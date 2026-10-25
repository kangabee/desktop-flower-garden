// 성장 계산 모듈 — 순수 함수만 둔다 (UI/저장소와 분리).

const HOUR = 60 * 60 * 1000;

// 성장 단계: `at` = 해당 단계가 시작되는 진행률(0~1). 이름은 i18n 의 phase.<key>
export const PHASES = [
  { id: 0, key: 'seed', at: 0 },
  { id: 1, key: 'sprout', at: 0.05 }, // 씨앗 단계는 짧게 (약 1시간)
  { id: 2, key: 'stem', at: 0.35 },
  { id: 3, key: 'bud', at: 0.7 },
  { id: 4, key: 'bloom', at: 1 },
];

/** 꽃 한 송이가 피기까지: 실제 시간 24시간 (앱을 켜 두든 꺼 두든 흘러간다) */
export const GOAL_MS = 24 * HOUR;

/** 성장에 인정되는 경과 시간 = 실제로 흐른 시간 */
export function grownMs(startedAt, now) {
  return Math.max(0, now - startedAt);
}

export function getPhase(progress) {
  let phase = PHASES[0];
  for (const p of PHASES) if (progress >= p.at) phase = p;
  return phase;
}

// ── 성장 속도 ──
// 기본 속도는 ×1. 햇빛 부스터·날씨가 속도를 바꾸며, 바뀔 때마다 "그때까지 더/덜 자란 몫"을 bonusMs 에 적립한다.
//   boostSince: 지금 속도가 시작된 시각 / boostRate: 그 속도 (없으면 ×1)

/** 햇빛 부스터 배율 (흐린 날은 약하게) */
export const SUN_BOOST = 1.1;
export const SUN_BOOST_CLOUDY = 1.05;

/** 목마름: 햇빛을 켜 둔 채 물을 원하는 상태 → 햇빛 부스터가 멈춘다 */
export const isThirsty = (pot) => Boolean(pot.sunOn) && pot.want?.kind === 'water';

/**
 * 이 화분의 지금 성장 속도
 * @param effect weather.js 의 weatherEffect() 결과 ({ growth, sun }) — 날씨를 안 쓰면 생략
 */
export function potRate(pot, effect = { growth: 1, sun: SUN_BOOST }) {
  const sun = pot.sunOn && !isThirsty(pot) ? effect.sun : 1;
  return sun * effect.growth;
}

/** at 시각까지의 속도 변화 몫을 bonusMs 로 옮긴다 (상태를 바꾸기 직전에 호출) */
export function foldRate(pot, at) {
  if (!pot.boostSince) return pot;
  const rate = pot.boostRate ?? SUN_BOOST; // 예전 저장분은 햇빛 부스터만 있었다
  return {
    ...pot,
    bonusMs: (pot.bonusMs ?? 0) + grownMs(pot.boostSince, at) * (rate - 1),
    boostSince: null,
    boostRate: null,
  };
}

/** 상태를 바꾼 직후(at) 새 속도로 다시 측정 시작 (×1 이면 측정할 것 없음) */
export function resumeRate(pot, at, effect) {
  const rate = potRate(pot, effect);
  return rate === 1 ? { ...pot, boostSince: null, boostRate: null } : { ...pot, boostSince: at, boostRate: rate };
}

/** 화분 상태 → 화면에 필요한 모든 값 */
export function computeGrowth(pot, now = Date.now()) {
  const { startedAt, bonusMs = 0, boostSince = null } = pot;
  const rate = boostSince ? (pot.boostRate ?? SUN_BOOST) : 1;
  const elapsed = grownMs(startedAt, now) + bonusMs + (boostSince ? grownMs(boostSince, now) * (rate - 1) : 0);
  const progress = Math.min(1, Math.max(0, elapsed / GOAL_MS));
  const left = Math.max(0, GOAL_MS - elapsed);
  return {
    progress,
    percent: Math.floor(progress * 100),
    phase: getPhase(progress),
    // 속도가 바뀐 만큼 실제로 기다릴 시간도 달라진다
    remainingMs: left / rate,
    rate,
    sunOn: Boolean(pot.sunOn),
    thirsty: isThirsty(pot),
  };
}
