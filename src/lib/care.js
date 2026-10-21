// 돌봄 상호작용
//  - 노래 · 물: 한 번 누르면 끝나는 돌봄. 쿨타임마다 한 번, 목표 시간의 1%만큼 성장을 앞당긴다.
//  - 햇빛: 켜고 끄는 부스터. 켜 둔 동안 성장 속도가 ×1.1 (growth.js 의 SUN_BOOST).
//  - 바람(want): 꽃이 가끔 물·햇빛·음악을 원한다. 원하는 걸 해주면 쿨타임 없이 +2%.
//    햇빛을 켜 두면 흙이 빨리 말라 물을 더 자주 원하고, 물을 줄 때까지 부스터가 멈춘다.
import { MODES } from './growth.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const CARE = {
  song: {
    label: '노래 들려주기',
    reactions: ['♪ 흥얼흥얼~', '이 노래 좋아요!', '잎사귀가 춤춰요', '박자에 맞춰 살랑살랑'],
  },
  water: {
    label: '물 주기',
    reactions: ['시원해요!', '꿀꺽꿀꺽~', '뿌리까지 촉촉해요', '목말랐는데 고마워요'],
  },
};

export const SUN = {
  on: ['따뜻해요~ (×1.1 쑥쑥)', '햇살 켜짐! 광합성 시작', '해가 드니까 힘이 나요'],
  off: ['햇빛 끔 · 잠깐 쉬어갈게요', '그늘도 좋아요'],
};

export const WANT = {
  water: { icon: 'water', text: '이 꽃은 물을 원하는 것 같아요', thanks: '딱 물이 필요했어요! (+2%)' },
  sun: { icon: 'sun', text: '이 꽃은 햇빛을 원하는 것 같아요', thanks: '기다리던 햇살이에요! (+2%)' },
  song: { icon: 'note', text: '이 꽃은 음악을 원하는 것 같아요', thanks: '듣고 싶던 노래예요! (+2%)' },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const BONUS_RATIO = 0.01;
const WANT_BONUS_RATIO = 0.02;

export function careCooldownMs(mode) {
  return mode === 'demo' ? 8 * 1000 : 3 * HOUR;
}

/** 다음 바람까지의 간격. 햇빛을 켜 두면 절반 (흙이 빨리 마름) */
export function wantIntervalMs(mode, sunOn) {
  const base = mode === 'demo' ? 12 * 1000 : 90 * MINUTE;
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
    bonusMs: (timer.bonusMs ?? 0) + MODES[timer.mode].goalMs * WANT_BONUS_RATIO,
    want: null,
    nextWantAt: now + wantIntervalMs(timer.mode, timer.sunOn),
  };
}

/**
 * 노래·물 돌봄 적용 → { timer, reaction }
 * 꽃이 원하던 것이면 +2%, 아니면 쿨타임마다 +1%. 이미 핀 꽃은 반응만 한다.
 */
export function applyCare(timer, kind, bloomed, now = Date.now()) {
  const counted = { ...timer, care: { ...timer.care, [kind]: (timer.care?.[kind] ?? 0) + 1 } };

  if (!bloomed && timer.want?.kind === kind) {
    return { timer: fulfil(counted, now), reaction: WANT[kind].thanks };
  }

  const last = timer.lastCare?.[kind] ?? 0;
  const gained = !bloomed && now - last >= careCooldownMs(timer.mode);
  const reaction = gained
    ? `${pick(CARE[kind].reactions)} (+1%)`
    : bloomed
      ? pick(CARE[kind].reactions)
      : '아까 받았어요, 고마워요!';

  return {
    reaction,
    timer: {
      ...counted,
      bonusMs: (timer.bonusMs ?? 0) + (gained ? MODES[timer.mode].goalMs * BONUS_RATIO : 0),
      lastCare: gained ? { ...timer.lastCare, [kind]: now } : timer.lastCare,
    },
  };
}

/** 햇빛 켜기/끄기 (부스터 적립은 호출하는 쪽에서 foldBoost/resumeBoost 로 감싼다) */
export function applySun(timer, now = Date.now()) {
  if (timer.sunOn) return { timer: { ...timer, sunOn: false }, on: false, reaction: pick(SUN.off) };
  const lit = { ...timer, sunOn: true, care: { ...timer.care, sun: (timer.care?.sun ?? 0) + 1 } };
  if (timer.want?.kind === 'sun') return { timer: fulfil(lit, now), on: true, reaction: WANT.sun.thanks };
  return { timer: lit, on: true, reaction: pick(SUN.on) };
}
