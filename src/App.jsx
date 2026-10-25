import { useEffect, useMemo, useRef, useState } from 'react';
import Pot from './Pot.jsx';
import WeatherLayer from './components/WeatherLayer.jsx';
import { usePots } from './hooks/usePots.js';
import { settingsOf, updateGarden } from './lib/garden.js';
import { activeWeather, isRainbow } from './lib/weather.js';
import { SKIN_BY_ID } from './data/skins.js';
import { playBloomChime } from './lib/sound.js';
import { t, useLang } from './i18n/index.js';

// 브라우저 미리보기(vite 단독 실행)에서도 깨지지 않도록 Electron API가 없으면 no-op
const widget = window.widget ?? {
  setIgnoreMouse: () => {},
  getPosition: async () => [0, 0],
  setPosition: () => {},
  reportState: () => {},
  showMenu: () => {},
  onCommand: () => () => {},
};

// 선반 배치: 화분마다 280px 무대를 110px 간격으로 겹쳐 놓는다 (메인 프로세스의 창 크기 계산과 같아야 함)
export const POT_W = 280;
export const POT_GAP = 110;

/**
 * 바탕화면 위젯 = 화분 선반.
 * 창 전체의 마우스 처리(투명한 곳은 클릭 통과 · 픽셀 단위 히트 테스트 · 드래그 이동)와
 * 메인 프로세스 명령(새 씨앗 · 선물 씨앗 · 업데이트 알림)을 맡고, 화분 하나하나는 Pot 이 그린다.
 */
export default function App() {
  const api = usePots({ driver: true });
  const { pots, garden, now } = api;
  useLang(); // 언어가 바뀌면 다시 그린다
  const settings = settingsOf(garden);
  const calm = settings.reduceMotion;
  const skin = SKIN_BY_ID[garden.potSkin];
  const potColors = skin && skin.id !== 'classic' ? skin.colors : null;

  const weather = activeWeather(garden.weather, settings.weather.enabled, now);
  const rainbow = isRainbow(weather, now);
  const weatherLine = weather ? t(rainbow ? 'weather.rainbow' : `weather.${weather.kind}`) : null;

  const [hovered, setHovered] = useState(-1);
  const [openPot, setOpenPot] = useState(-1);
  const potRefs = useRef([]);
  const closeTimer = useRef(null);
  const latest = useRef(api);
  latest.current = api;

  const potApi = useMemo(
    () => ({
      care: (i, kind) => latest.current.care(i, kind),
      toggleSun: (i) => latest.current.toggleSun(i),
      fertilize: (i) => latest.current.fertilize(i),
      fertilizerState: (i) => latest.current.fertilizerState(i),
      plantNewSeed: (i) => latest.current.plantNewSeed(i),
      catchVisitor: (i) => latest.current.catchVisitor(i),
      closeActions: () => setOpenPot(-1),
    }),
    [],
  );

  const anyBloomed = pots.some((v) => v.pot.recorded);

  // 우클릭/트레이 메뉴 구성과 창 크기(화분 수)를 메인 프로세스에 알림
  useEffect(() => {
    widget.reportState({ bloomed: anyBloomed, pots: pots.length });
  }, [anyBloomed, pots.length]);

  // 도감을 모아 화분이 늘어나면 새 화분에서 알려 준다
  const prevCount = useRef(pots.length);
  useEffect(() => {
    if (pots.length > prevCount.current) {
      const i = pots.length - 1;
      setTimeout(() => potRefs.current[i]?.say(t('shelf.newPot'), t('shelf.newPotTitle'), 6000), 300);
      playBloomChime();
    }
    prevCount.current = pots.length;
  }, [pots.length]);

  useEffect(
    () =>
      widget.onCommand((cmd) => {
        const say = (i, ...args) => potRefs.current[i]?.say(...args);
        if (cmd.type === 'new-seed') {
          const i = latest.current.pots.findIndex((v) => v.pot.recorded);
          if (i >= 0) {
            latest.current.plantNewSeed(i);
            say(i, t('w.plantedNew'));
          }
        }
        if (cmd.type === 'update-available' || cmd.type === 'update-ready') {
          const key = cmd.type === 'update-ready' ? 'upd.ready' : 'upd.available';
          say(0, t(key, { version: cmd.version }), t('upd.title'), 8000);
        }
        if (cmd.type === 'receive-seed') {
          const result = latest.current.receiveSeed(cmd.payload);
          if (result.ok) playBloomChime();
          say(result.pot ?? 0, result.text, t('w.giftTitle'), 5000);
        }
      }),
    [],
  );

  // ── 클릭 통과 + 픽셀 단위 히트 테스트 + 드래그 이동 ──
  useEffect(() => {
    let ignoring = true;
    let drag = null;
    const potAt = (e) => potRefs.current.findIndex((p) => p?.hitTest(e.clientX, e.clientY));
    const onUi = (e) => Boolean(document.elementFromPoint(e.clientX, e.clientY)?.closest('.interactive'));
    const setIgnore = (v) => {
      if (v === ignoring) return;
      ignoring = v;
      widget.setIgnoreMouse(v);
    };

    const onMove = (e) => {
      if (drag) {
        const dx = e.screenX - drag.sx;
        const dy = e.screenY - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved && drag.origin) widget.setPosition(drag.origin[0] + dx, drag.origin[1] + dy);
        return;
      }
      const i = potAt(e);
      const ui = onUi(e);
      setIgnore(!(i >= 0 || ui));
      setHovered(i);
      if (i >= 0 || ui) clearTimeout(closeTimer.current);
    };
    const onDown = (e) => {
      const i = e.button === 0 ? potAt(e) : -1;
      if (i < 0) return;
      const current = { sx: e.screenX, sy: e.screenY, moved: false, origin: null, pot: i };
      drag = current;
      widget.getPosition().then((pos) => {
        current.origin = pos;
      });
    };
    const onUp = () => {
      if (!drag) return;
      const { moved, pot } = drag;
      drag = null;
      if (moved) {
        widget.getPosition().then(([x, y]) =>
          updateGarden({ position: { x, y, w: window.innerWidth, h: window.innerHeight } }),
        );
      } else {
        // 클릭: 콩 뛰고 그 화분의 돌봄 메뉴 열기/닫기
        potRefs.current[pot]?.hop();
        setOpenPot((open) => (open === pot ? -1 : pot));
      }
    };
    const onLeave = () => {
      if (drag) return;
      setIgnore(true);
      setHovered(-1);
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => setOpenPot(-1), 2500);
    };
    const onContextMenu = (e) => {
      e.preventDefault();
      if (potAt(e) >= 0) widget.showMenu();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('contextmenu', onContextMenu);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('contextmenu', onContextMenu);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const shelfWidth = POT_W + (pots.length - 1) * POT_GAP;

  return (
    <div className={`shelf${calm ? ' calm' : ''}${hovered >= 0 ? ' is-hover' : ''}`} style={{ width: shelfWidth }}>
      {weather && <WeatherLayer kind={weather.kind} rainbow={rainbow} width={shelfWidth} />}
      {pots.map((view, i) => (
        <Pot
          key={i}
          ref={(el) => {
            potRefs.current[i] = el;
          }}
          index={i}
          view={view}
          left={i * POT_GAP}
          hovered={hovered === i}
          actionsOpen={openPot === i}
          api={potApi}
          seedQueue={api.seedQueue}
          potColors={potColors}
          calm={calm}
          weatherLine={weatherLine}
        />
      ))}
    </div>
  );
}
