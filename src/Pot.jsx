import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import PixelPlant from './components/PixelPlant.jsx';
import PixelParticles from './components/PixelParticles.jsx';
import PixelIcon from './components/PixelIcon.jsx';
import CareEffect from './components/CareEffect.jsx';
import SunBoost from './components/SunBoost.jsx';
import PixelFlag from './components/PixelFlag.jsx';
import Twinkles from './components/Twinkles.jsx';
import Visitor from './components/Visitor.jsx';
import { CARE_KINDS, WANT_ICON } from './lib/care.js';
import { gardenApi } from './lib/garden.js';
import { RARITY } from './data/flowers.js';
import { playBloomChime, playSun, playVisitor } from './lib/sound.js';
import { flowerText, formatRemaining, t } from './i18n/index.js';

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

/**
 * 선반 위의 화분 하나: 말풍선 · 돌봄 메뉴 · 연출 · 방문객.
 * 창 전체의 마우스 처리(클릭 통과·드래그)는 App(선반)이 맡고, 여기엔 hovered/actionsOpen 으로 알려 준다.
 * ref: { hitTest(x, y), say(text, title, ms), hop() }
 */
const Pot = forwardRef(function Pot(
  { index, view, left, hovered, actionsOpen, api, seedQueue, potColors, calm, weatherLine },
  ref,
) {
  const { pot, growth, flower, bloomed } = view;
  const plantRef = useRef(null);
  const [effect, setEffect] = useState(null); // 'song' | 'water' | 'fertilizer'
  const [reaction, setReaction] = useState(null);
  const [reactionTitle, setReactionTitle] = useState(null);
  const [sway, setSway] = useState(0);
  const [burst, setBurst] = useState(false);
  const [hop, setHop] = useState(false);
  const prevPhase = useRef(growth.phase.id);
  const prevVisit = useRef(pot.visit?.kind ?? null);
  const sayTimer = useRef(null);

  const rarity = RARITY[flower.rarity];
  const name = flowerText(flower, 'name');
  const uid = `${pot.startedAt}-${pot.flowerId}`;

  const say = useCallback((text, title = null, ms = 2500) => {
    setReaction(text);
    setReactionTitle(title);
    clearTimeout(sayTimer.current);
    sayTimer.current = setTimeout(() => setReaction(null), ms);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      hitTest: (x, y) => plantRef.current?.hitTest(x, y) ?? false,
      say,
      hop: () => {
        setHop(true);
        setTimeout(() => setHop(false), 450);
      },
    }),
    [say],
  );

  // 도트 특유의 1픽셀 살랑임 (노래 중엔 신나게 빠르게, 움직임 줄이기면 멈춤)
  useEffect(() => {
    if (calm) return setSway(0);
    let i = 0;
    const id = setInterval(
      () => {
        i = (i + 1) % SWAY_FRAMES.length;
        setSway(SWAY_FRAMES[i]);
      },
      effect === 'song' ? 260 : 900,
    );
    return () => clearInterval(id);
  }, [effect, calm]);

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

  // 방문객이 찾아오면 한 번 알려 준다
  useEffect(() => {
    const kind = pot.visit?.kind ?? null;
    if (kind && kind !== prevVisit.current) {
      playVisitor();
      say(t(`visit.${kind}.arrive`), t('visit.title'), 6000);
    }
    prevVisit.current = kind;
  }, [pot.visit, say]);

  const doCare = (kind) => {
    if (effect) return;
    setEffect(kind);
    setReactionTitle(null);
    setReaction(api.care(index, kind));
  };
  const endEffect = useCallback(() => {
    setEffect(null);
    setTimeout(() => setReaction(null), 1200);
  }, []);

  const onSun = () => {
    if (bloomed) return say(t('w.alreadyBloomed'));
    const { on, reaction: text } = api.toggleSun(index);
    if (on) playSun();
    say(text);
  };

  const onFertilize = () => {
    if (effect) return;
    const result = api.fertilize(index);
    if (!result.ok) return say(result.text);
    setEffect('fertilizer');
    setReactionTitle(null);
    setReaction(result.text);
  };

  const onNewSeed = () => {
    api.plantNewSeed(index);
    api.closeActions();
    say(t(seedQueue.length ? 'w.plantedGift' : 'w.plantedNew'));
  };

  const onCatch = () => {
    const kind = api.catchVisitor(index);
    if (!kind) return;
    playBloomChime();
    say(t(`visit.${kind}.caught`), t(`visit.${kind}.name`), 5000);
  };

  const fert = api.fertilizerState(index);

  // 씨앗 단계 제목: 선물·참새 씨앗은 꽃 이름을, 랜덤 씨앗은 희귀도 힌트만
  const seedTitle = pot.fromVisitor
    ? t('visit.sparrowSeed', { name })
    : pot.giftFrom != null
      ? t('w.giftedFlower', { from: pot.giftFrom, name })
      : growth.phase.key === 'seed'
        ? t(`seedHint.${flower.rarity}`)
        : t('w.unknownSprout');
  const showBubble = hovered || burst || reaction;
  const particleColors = [flower.colors.a, flower.colors.b, '#fff6c2'];

  let bubble;
  if (reaction) {
    bubble = (
      <>
        <p className="bubble-title">
          {reactionTitle ?? (bloomed || pot.giftFrom != null || pot.fromVisitor ? name : t('w.unknownSprout'))}
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
        <p className="bubble-sub">{burst && !hovered ? t('w.bloomedNotice') : flowerText(flower, 'message')}</p>
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
        {pot.visit && <p className="bubble-want">{t(`visit.${pot.visit.kind}.arrive`)}</p>}
        {pot.want && <p className="bubble-want">{t(`want.${pot.want.kind}`)}</p>}
        {growth.thirsty && <p className="bubble-mode">{t('w.thirsty')}</p>}
        {weatherLine && <p className="bubble-mode">{weatherLine}</p>}
        <p className="bubble-mode">
          {growth.sunOn ? t(growth.thirsty ? 'w.sunPaused' : 'w.sunBoost') : t('w.clickToCare')}
        </p>
      </>
    );
  }

  return (
    <div className={`pot-slot${hovered ? ' is-hover' : ''}${actionsOpen ? ' actions-open' : ''}`} style={{ left }}>
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
            className={`action-btn${fert.ok ? '' : ' unavailable'}`}
            title={fert.ok ? t('w.fertTitle') : fert.reason}
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
      {pot.want && !bloomed && !effect && (
        <div className={`want want-${pot.want.kind}`} aria-hidden="true">
          <PixelIcon name={WANT_ICON[pot.want.kind]} scale={2} />
        </div>
      )}
      {pot.visit && !bloomed && (
        <div className="fx visitor-stage">
          <Visitor kind={pot.visit.kind} label={t(`visit.${pot.visit.kind}.name`)} onCatch={onCatch} />
        </div>
      )}

      {bloomed && flower.rarity === 'legendary' && (
        <>
          <div className="legend-aura" aria-hidden="true" />
          <div className="fx">
            <Twinkles stars={calm ? LEGEND_STARS.slice(0, 3) : LEGEND_STARS} burst={burst && !calm} center={[50, 56]} />
          </div>
        </>
      )}

      <div className="stage">
        {bloomed && !calm && (
          <PixelParticles
            key={burst ? 'burst' : 'idle'}
            colors={flower.rarity === 'legendary' ? ['#fff6c2', '#ffe27a', flower.colors.a] : particleColors}
            count={burst ? 14 : 4}
            burst={burst}
          />
        )}
        {growth.phase.key === 'seed' && flower.rarity !== 'common' && pot.giftFrom == null && !calm && (
          <PixelParticles
            key="seed-glint"
            colors={flower.rarity === 'legendary' ? ['#fff6c2', '#ffe27a'] : ['#cfe8ff', '#9fd0ff']}
            count={flower.rarity === 'legendary' ? 5 : 2}
          />
        )}
        <PixelPlant
          ref={plantRef}
          className={`plant${hop ? ' hop' : ''}${burst ? ' pop' : ''}${
            effect === 'water' || effect === 'fertilizer' ? ' happy' : ''
          }${growth.phase.key === 'seed' && !hop && !calm ? ' seed-idle' : ''}`}
          flower={flower}
          progress={growth.progress}
          sway={growth.phase.id >= 2 ? sway : 0}
          potColors={potColors}
        />
      </div>
    </div>
  );
});

export default Pot;
