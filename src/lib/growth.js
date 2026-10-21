// 성장 계산 모듈 — 순수 함수만 둔다 (UI/저장소와 분리).

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// 성장 단계: `at` = 해당 단계가 시작되는 진행률(0~1)
export const PHASES = [
  { id: 0, key: 'seed', label: '씨앗', at: 0 },
  { id: 1, key: 'sprout', label: '새싹', at: 0.05 }, // 씨앗 단계는 짧게 (약 1시간)
  { id: 2, key: 'stem', label: '줄기와 잎', at: 0.35 },
  { id: 3, key: 'bud', label: '꽃봉오리', at: 0.7 },
  { id: 4, key: 'bloom', label: '만개', at: 1 },
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

/** 햇빛 부스터를 켜 둔 동안의 성장 배율 */
export const SUN_BOOST = 1.1;

/** from 부터 to 까지 부스터 덕분에 더 자란 시간 */
export function sunBonusMs(from, to) {
  return from ? grownMs(from, to) * (SUN_BOOST - 1) : 0;
}

/**
 * 부스터가 실제로 도는 중인가: 햇빛이 켜져 있고, 목마르지 않을 때.
 * (햇빛을 켜 두면 흙이 빨리 말라 물을 자주 원하고, 물을 줄 때까지 부스터가 멈춘다)
 */
export function isBoosting(timer) {
  return Boolean(timer.sunOn) && timer.want?.kind !== 'water';
}

/** 상태를 바꾸기 직전(t)에 지금까지 쌓인 부스터 몫을 bonusMs 로 옮긴다 */
export function foldBoost(timer, t) {
  if (!timer.boostSince) return timer;
  return {
    ...timer,
    bonusMs: (timer.bonusMs ?? 0) + sunBonusMs(timer.boostSince, t),
    boostSince: null,
  };
}

/** 상태를 바꾼 직후(t)에 부스터가 돌아야 하면 다시 측정 시작 */
export function resumeBoost(timer, t) {
  return isBoosting(timer) ? { ...timer, boostSince: t } : { ...timer, boostSince: null };
}

/** 타이머 상태 → 화면에 필요한 모든 값 */
export function computeGrowth(timer, now = Date.now()) {
  const { startedAt, bonusMs = 0, boostSince = null } = timer;
  // bonusMs: 돌봄·지난 부스터로 앞당긴 시간 / sunBonusMs: 지금 돌고 있는 부스터 몫
  const elapsed = grownMs(startedAt, now) + bonusMs + sunBonusMs(boostSince, now);
  const progress = Math.min(1, elapsed / GOAL_MS);
  const left = Math.max(0, GOAL_MS - elapsed);
  return {
    progress,
    percent: Math.floor(progress * 100),
    phase: getPhase(progress),
    // 부스터가 돌면 실제로 기다릴 시간은 1.1배 빨리 줄어든다
    remainingMs: boostSince ? left / SUN_BOOST : left,
    sunOn: Boolean(timer.sunOn),
    thirsty: Boolean(timer.sunOn) && timer.want?.kind === 'water',
  };
}

export function formatRemaining(ms) {
  if (ms <= 0) return '활짝 피었어요';
  const totalMin = Math.ceil(ms / MINUTE);
  if (totalMin < 1) return '곧 피어나요';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) {
    return ms < MINUTE ? `${Math.ceil(ms / 1000)}초 남음` : `${m}분 남음`;
  }
  return m === 0 ? `${h}시간 남음` : `${h}시간 ${m}분 남음`;
}
