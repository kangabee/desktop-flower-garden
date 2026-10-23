// 돌봄 상호작용
//  - 노래 · 물: 한 번 누르면 끝나는 돌봄. 쿨타임마다 한 번, 목표 시간의 1%만큼 성장을 앞당긴다.
//  - 햇빛: 켜고 끄는 부스터. 켜 둔 동안 성장 속도가 ×1.1 (growth.js 의 SUN_BOOST).
//  - 비료: 한 번에 1시간을 앞당긴다. 정원 전체에서 12시간에 한 번, 햇빛 부스터와는 같이 쓸 수 없다.
//  - 바람(want): 꽃이 가끔 물·햇빛·음악을 원한다. 원하는 걸 해주면 쿨타임 없이 +2%.
//    햇빛을 켜 두면 흙이 빨리 말라 물을 더 자주 원하고, 물을 줄 때까지 부스터가 멈춘다.
import { GOAL_MS } from './growth.js';
import { t } from '../i18n/index.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// 문구는 i18n/messages.js 의 care.* · sun.* · want.* 키
export const CARE_KINDS = ['song', 'water'];
export const WANT_ICON = { water: 'water', sun: 'sun', song: 'note' };

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const BONUS_RATIO = 0.01;
const WANT_BONUS_RATIO = 0.02;

export const CARE_COOLDOWN_MS = 3 * HOUR;

export const FERTILIZER_MS = 1 * HOUR;
export const FERTILIZER_COOLDOWN_MS = 12 * HOUR;

/** 다음 바람까지의 간격. 햇빛을 켜 두면 절반 (흙이 빨리 마름) */
export function wantIntervalMs(sunOn) {
  const base = 90 * MINUTE;
  return sunOn ? base / 2 : base;
}

/** 햇빛이 켜져 있으면 대부분 물을, 아니면 셋 중 하나를 원한다 */
export function pickWant(timer) {
  if (timer.sunOn) return Math.random() < 0.75 ? 'water' : 'song';
  return pick(['water', 'sun', 'song']);
}

/** 바람을 들어줬을 때 공통 처리 */
function fulfil(timer, now) {
  return {
    ...timer,
    bonusMs: (timer.bonusMs ?? 0) + GOAL_MS * WANT_BONUS_RATIO,
    want: null,
    nextWantAt: now + wantIntervalMs(timer.sunOn),
  };
}

/**
 * 노래·물 돌봄 적용 → { timer, reaction }
 * 꽃이 원하던 것이면 +2%, 아니면 쿨타임마다 +1%. 이미 핀 꽃은 반응만 한다.
 */
export function applyCare(timer, kind, bloomed, now = Date.now()) {
  const counted = { ...timer, care: { ...timer.care, [kind]: (timer.care?.[kind] ?? 0) + 1 } };

  if (!bloomed && timer.want?.kind === kind) {
    return { timer: fulfil(counted, now), reaction: t(`want.${kind}.thanks`) };
  }

  const last = timer.lastCare?.[kind] ?? 0;
  const gained = !bloomed && now - last >= CARE_COOLDOWN_MS;
  const reaction = gained
    ? `${pick(t(`care.${kind}.reactions`))} (+1%)`
    : bloomed
      ? pick(t(`care.${kind}.reactions`))
      : t('care.again');

  return {
    reaction,
    timer: {
      ...counted,
      bonusMs: (timer.bonusMs ?? 0) + (gained ? GOAL_MS * BONUS_RATIO : 0),
      lastCare: gained ? { ...timer.lastCare, [kind]: now } : timer.lastCare,
    },
  };
}

/** 햇빛 켜기/끄기 (부스터 적립은 호출하는 쪽에서 foldBoost/resumeBoost 로 감싼다) */
export function applySun(timer, now = Date.now()) {
  if (timer.sunOn) return { timer: { ...timer, sunOn: false }, on: false, reaction: pick(t('sun.off')) };
  const lit = { ...timer, sunOn: true, care: { ...timer.care, sun: (timer.care?.sun ?? 0) + 1 } };
  if (timer.want?.kind === 'sun') return { timer: fulfil(lit, now), on: true, reaction: t('want.sun.thanks') };
  return { timer: lit, on: true, reaction: pick(t('sun.on')) };
}
