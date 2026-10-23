import { useCallback, useEffect, useRef, useState } from 'react';
import PixelPlant from './components/PixelPlant.jsx';
import PixelParticles from './components/PixelParticles.jsx';
import PixelIcon from './components/PixelIcon.jsx';
import CareEffect from './components/CareEffect.jsx';
import SunBoost from './components/SunBoost.jsx';
import PixelFlag from './components/PixelFlag.jsx';
import Twinkles from './components/Twinkles.jsx';
import { useGrowth } from './hooks/useGrowth.js';
import { CARE_KINDS, WANT_ICON } from './lib/care.js';
import { flowerText, formatRemaining, t, useLang } from './i18n/index.js';
import { gardenApi, updateGarden } from './lib/garden.js';
import { RARITY } from './data/flowers.js';
import { playBloomChime, playSun } from './lib/sound.js';

// 브라우저 미리보기(vite 단독 실행)에서도 깨지지 않도록 Electron API가 없으면 no-op
const widget = window.widget ?? {
  setIgnoreMouse: () => {},
  getPosition: async () => [0, 0],
  setPosition: () => {},
  reportState: () => {},
  showMenu: () => {},
  onCommand: () => () => {},
};

const SWAY_FRAMES = [0, 1, 0, -1];

// 전설 꽃 주변에서 반짝이는 별 자리 (화분을 가운데 둔 200×240 무대 기준 %)
const LEGEND_STARS = [
  { x: 26, y: 42, big: true, delay: 0 },
  { x: 76, y: 38, big: true, delay: 0.8 },
  { x: 82, y: 62, big: false, delay: 0.4 },
  { x: 18, y: 64, big: false, delay: 1.6 },
  { x: 50, y: 26, big: true, delay: 1.2 },
  { x: 66, y: 78, big: false, delay: 2 },
  { x: 36, y: 80, big: false, delay: 1 },
  { x: 62, y: 46, big: false, delay: 1.8 },
];

export default function App() {
  const { timer, growth, flower, bloomed, plantNewSeed, care, toggleSun, fertilize, fertilizerState, receiveSeed, seedQueue } =
    useGrowth();
  useLang(); // 언어가 바뀌면 다시 그린다
  const plantRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [effect, setEffect] = useState(null); // 'song' | 'water'
  const [reaction, setReaction] = useState(null);
  const [sway, setSway] = useState(0);
  const [burst, setBurst] = useState(false);
  const [hop, setHop] = useState(false);
  const prevPhase = useRef(growth.phase.id);
  const closeTimer = useRef(null);
  const sayTimer = useRef(null);
  const sayRef = useRef(null);
  const [reactionTitle, setReactionTitle] = useState(null);

  const rarity = RARITY[flower.rarity];
  const uid = `${timer.startedAt}-${timer.flowerId}`;

  // 우클릭/트레이 메뉴 구성을 위해 상태를 메인 프로세스에 알림
  useEffect(() => {
    widget.reportState({ bloomed });
  }, [bloomed]);

  useEffect(
    () =>
      widget.onCommand((cmd) => {
        if (cmd.type === 'new-seed') plantNewSeed();
        if (cmd.type === 'receive-seed') {
          const result = receiveSeed(cmd.payload);
          if (result.ok) playBloomChime();
          sayRef.current(result.text, t('w.giftTitle'), 5000);
        }
      }),
    [plantNewSeed, receiveSeed],
  );

  // 도트 특유의 1픽셀 살랑임 (노래 중엔 신나게 빠르게)
  useEffect(() => {
    let i = 0;
    const id = setInterval(
      () => {
        i = (i + 1) % SWAY_FRAMES.length;
        setSway(SWAY_FRAMES[i]);
      },
      effect === 'song' ? 260 : 900,
    );
    return () => clearInterval(id);
  }, [effect]);

  // 개화 "순간"에만 효과음 + 파티클 버스트 (앱을 켰을 때 이미 피어 있으면 생략)
  useEffect(() => {
    if (growth.phase.key === 'bloom' && prevPhase.current < growth.phase.id) {
      playBloomChime();
      setBurst(true);
      const id = setTimeout(() => setBurst(false), 5000);
      prevPhase.current = growth.phase.id;
      return () => clearTimeout(id);
    }
    prevPhase.current = growth.phase.id;
  }, [growth.phase]);

  // ── 클릭 통과 + 픽셀 단위 히트 테스트 + 드래그 이동 ──
  useEffect(() => {
    let ignoring = true;
    let drag = null;
    const onPlant = (e) => plantRef.current?.hitTest(e.clientX, e.clientY) ?? false;
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
      const overPlant = onPlant(e);
      setIgnore(!(overPlant || onUi(e)));
      setHover(overPlant);
      if (overPlant || onUi(e)) clearTimeout(closeTimer.current);
    };
    const onDown = (e) => {
      if (e.button !== 0 || !onPlant(e)) return;
      const current = { sx: e.screenX, sy: e.screenY, moved: false, origin: null };
      drag = current;
      widget.getPosition().then((pos) => {
        current.origin = pos;
      });
    };
    const onUp = () => {
      if (!drag) return;
      const { moved } = drag;
      drag = null;
      if (moved) {
        widget.getPosition().then(([x, y]) =>
          updateGarden({ position: { x, y, w: window.innerWidth, h: window.innerHeight } }),
        );
      } else {
        // 클릭: 콩 뛰고 돌봄 메뉴 열기/닫기
        setHop(true);
        setTimeout(() => setHop(false), 450);
        setActionsOpen((v) => !v);
      }
    };
    const onLeave = () => {
      if (drag) return;
      setIgnore(true);
      setHover(false);
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => setActionsOpen(false), 2500);
    };
    const onContextMenu = (e) => {
      e.preventDefault();
      if (onPlant(e)) widget.showMenu();
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

  const doCare = (kind) => {
    if (effect) return;
    setEffect(kind);
    setReactionTitle(null);
    setReaction(care(kind));
  };
  const endEffect = useCallback(() => {
    setEffect(null);
    setTimeout(() => setReaction(null), 1200);
  }, []);

  // 잠깐 말풍선만 띄우는 반응 (햇빛 켜기/끄기, 새 씨앗 등)
  const say = (text, title = null, ms = 2500) => {
    setReaction(text);
    setReactionTitle(title);
    clearTimeout(sayTimer.current);
    sayTimer.current = setTimeout(() => setReaction(null), ms);
  };
  // 메인 프로세스 명령 핸들러(한 번만 등록됨)에서도 최신 say 를 쓰도록
  sayRef.current = say;

  const onSun = () => {
    if (bloomed) return say(t('w.alreadyBloomed'));
    const { on, reaction } = toggleSun();
    if (on) playSun();
    say(reaction);
  };

  const onFertilize = () => {
    if (effect) return;
    const result = fertilize();
    if (!result.ok) return say(result.text);
    setEffect('fertilizer');
    setReactionTitle(null);
    setReaction(result.text);
  };

  const onNewSeed = () => {
    plantNewSeed();
    setActionsOpen(false);
    say(t(seedQueue.length ? 'w.plantedGift' : 'w.plantedNew'));
  };

  // 씨앗 단계 제목: 선물 씨앗은 꽃 이름을, 랜덤 씨앗은 희귀도 힌트만
  const name = flowerText(flower, 'name');
  const seedTitle =
    timer.giftFrom != null
      ? t('w.giftedFlower', { from: timer.giftFrom, name })
      : growth.phase.key === 'seed'
        ? t(`seedHint.${flower.rarity}`)
        : t('w.unknownSprout');
  const showBubble = hover || burst || reaction;
  const particleColors = [flower.colors.a, flower.colors.b, '#fff6c2'];

  let bubble;
  if (reaction) {
    bubble = (
      <>
        <p className="bubble-title">
          {reactionTitle ?? (bloomed || timer.giftFrom != null ? name : t('w.unknownSprout'))}
        </p>
        <p className="bubble-sub">{reaction}</p>
      </>
    );
  } else if (bloomed) {
    bubble = (
      <>
        <p className="bubble-title">
          <span className="bubble-name">
            {flower.nation && <PixelFlag code={flower.nation} />}
            {name}
          </span>
          <span className="stars" style={{ color: rarity.color }}>
            {'★'.repeat(rarity.stars)}
          </span>
        </p>
        <p className="bubble-lang">「{flowerText(flower, 'language')}」</p>
        <p className="bubble-sub">{burst && !hover ? t('w.bloomedNotice') : flowerText(flower, 'message')}</p>
        <p className="bubble-mode">{t('w.newSeedHint', { queue: seedQueue.length })}</p>
      </>
    );
  } else {
    bubble = (
      <>
        <p className="bubble-title">
          {seedTitle}
          <span className="bubble-percent">{growth.percent}%</span>
        </p>
        <div className="pixel-bar">
          <div className="pixel-bar-fill" style={{ width: `${growth.progress * 100}%` }} />
        </div>
        <p className="bubble-sub">
          {t(`phase.${growth.phase.key}`)} · {formatRemaining(growth.remainingMs)}
        </p>
        {timer.want && <p className="bubble-want">{t(`want.${timer.want.kind}`)}</p>}
        {growth.thirsty && <p className="bubble-mode">{t('w.thirsty')}</p>}
        <p className="bubble-mode">
          {growth.sunOn ? t(growth.thirsty ? 'w.sunPaused' : 'w.sunBoost') : t('w.clickToCare')}
        </p>
      </>
    );
  }

  return (
    <div className={`overlay${hover ? ' is-hover' : ''}${actionsOpen ? ' actions-open' : ''}`}>
      {showBubble && (
        <div className="bubble" role="tooltip">
          {bubble}
        </div>
      )}

      {actionsOpen && !effect && (
        <div className="actions interactive" role="toolbar" aria-label={t('w.careToolbar')}>
          {CARE_KINDS.map((kind) => (
            <button
              key={kind}
              className="action-btn"
              title={t(`care.${kind}`)}
              aria-label={t(`care.${kind}`)}
              onClick={() => doCare(kind)}
            >
              <PixelIcon name={kind === 'song' ? 'note' : kind} />
            </button>
          ))}
          <button
            className={`action-btn${growth.sunOn ? ' active' : ''}`}
            title={t(growth.sunOn ? 'w.sunOff' : 'w.sunOnTitle')}
            aria-label={t(growth.sunOn ? 'w.sunOff' : 'w.sunOn')}
            aria-pressed={growth.sunOn}
            onClick={onSun}
          >
            <PixelIcon name="sun" />
          </button>
          <button
            className={`action-btn${fertilizerState.ok ? '' : ' unavailable'}`}
            title={fertilizerState.ok ? t('w.fertTitle') : fertilizerState.reason}
            aria-label={t('w.fert')}
            onClick={onFertilize}
          >
            <PixelIcon name="fertilizer" />
          </button>
          <span className="action-sep" />
          <button
            className="action-btn"
            title={t('w.collection')}
            aria-label={t('w.collection')}
            onClick={() => gardenApi.openCollection('collection')}
          >
            <PixelIcon name="book" />
          </button>
          {bloomed && (
            <button className="action-btn" title={t('w.newSeed')} aria-label={t('w.newSeed')} onClick={onNewSeed}>
              <PixelIcon name="sprout" />
            </button>
          )}
          {bloomed && (
            <button
              className="action-btn"
              title={t('w.giftThis')}
              aria-label={t('w.giftThis')}
              onClick={() => gardenApi.openCollection(`collection/gift/${uid}`)}
            >
              <PixelIcon name="gift" />
            </button>
          )}
        </div>
      )}

      {effect && <CareEffect key={effect} kind={effect} onDone={endEffect} />}
      {growth.sunOn && !bloomed && <SunBoost paused={growth.thirsty} />}
      {timer.want && !bloomed && !effect && (
        <div className={`want want-${timer.want.kind}`} aria-hidden="true">
          <PixelIcon name={WANT_ICON[timer.want.kind]} scale={2} />
        </div>
      )}

      {bloomed && flower.rarity === 'legendary' && (
        <>
          <div className="legend-aura" aria-hidden="true" />
          <div className="fx">
            <Twinkles stars={LEGEND_STARS} burst={burst} center={[50, 56]} />
          </div>
        </>
      )}

      <div className="stage">
        {growth.phase.key === 'seed' && flower.rarity !== 'common' && timer.giftFrom == null && (
          <PixelParticles
            key="seed-glint"
            colors={flower.rarity === 'legendary' ? ['#fff6c2', '#ffe27a'] : ['#cfe8ff', '#9fd0ff']}
            count={flower.rarity === 'legendary' ? 5 : 2}
          />
        )}
        {bloomed && (
          <PixelParticles
            key={burst ? 'burst' : 'idle'}
            colors={flower.rarity === 'legendary' ? ['#fff6c2', '#ffe27a', flower.colors.a] : particleColors}
            count={burst ? 14 : 4}
            burst={burst}
          />
        )}
        <PixelPlant
          ref={plantRef}
          className={`plant${hop ? ' hop' : ''}${burst ? ' pop' : ''}${effect === 'water' || effect === 'fertilizer' ? ' happy' : ''}${
            growth.phase.key === 'seed' && !hop ? ' seed-idle' : ''
          }`}
          flower={flower}
          progress={growth.progress}
          sway={growth.phase.id >= 2 ? sway : 0}
        />
      </div>
    </div>
  );
}
