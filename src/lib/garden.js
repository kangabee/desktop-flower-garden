// 렌더러 쪽 정원 데이터 저장소
// Electron 에서는 메인 프로세스의 garden.json 을, 브라우저 미리보기에서는 localStorage 를 쓴다.
// 여러 창(위젯·도감)이 같은 상태를 보도록 변경 사항을 서로 방송한다.
import { useSyncExternalStore } from 'react';
import { makeId } from './ids.js';

const LOCAL_KEY = 'dfg.garden.v1';
const LEGACY_TIMER_KEY = 'dfg.timer.v1';
// 설정 기본값 (저장된 설정에 없는 항목은 이 값으로)
export const DEFAULT_SETTINGS = {
  sound: true, // 효과음
  size: 'normal', // 화분 크기: small | normal | large
  reduceMotion: false, // 반짝임·파티클 줄이기
  weather: { enabled: false, name: null, lat: null, lon: null }, // 날씨 (선택 기능)
};

export function settingsOf(state) {
  const s = state?.settings ?? {};
  return { ...DEFAULT_SETTINGS, ...s, weather: { ...DEFAULT_SETTINGS.weather, ...s.weather } };
}

const DEFAULT_STATE = {
  version: 1,
  timer: null, // v0.4 까지 쓰던 화분 1개 (지금은 pots 로 옮겨짐)
  pots: [], // 선반 위의 화분들 (최대 3개)
  collection: [],
  position: null,
  seedQueue: [],
  redeemed: [],
  gardenId: null,
  fertilizedAt: 0,
  language: null, // 사용자가 고른 언어 (null = 자동)
  systemLanguage: null, // 메인 프로세스가 알려준 컴퓨터 언어
  settings: {},
  potSkin: 'classic', // 화분 꾸미기
  visitors: {}, // 만난 방문객 { butterfly: 3, ... }
  nextSeedLuck: {}, // 방문객이 남긴 다음 씨앗 행운
  weather: null, // 메인 프로세스가 받아 오는 날씨 { kind, isDay, at, rainbowUntil }
};

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? {};
  } catch {
    return {};
  }
}

// 브라우저 미리보기용 대체 구현
const browserApi = {
  get: async () => readLocal(),
  merge: (patch) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...readLocal(), ...patch }));
    } catch {
      /* 무시 */
    }
  },
  onChange: (handler) => {
    const listener = (e) => e.key === LOCAL_KEY && handler(readLocal());
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  },
  openCollection: (route = 'collection') => window.open(`${location.pathname}#${route}`, '_blank'),
  onNavigate: () => () => {},
  copyText: async (text) => {
    await navigator.clipboard.writeText(text);
    return true;
  },
  openExternal: (url) => window.open(url, '_blank', 'noopener'),
};

export const gardenApi = window.garden ?? browserApi;

let current = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

/** 앱 시작 시 한 번 호출 (렌더 전에 await) */
/**
 * 앱 시작 시 한 번 호출 (렌더 전에 await).
 * migrate(state, legacyTimer) → 예전 저장 형식을 지금 형식으로 바꾸는 patch (없으면 null)
 */
export async function initGarden(migrate) {
  current = { ...DEFAULT_STATE, ...(await gardenApi.get()) };

  // Step 1~2 때 localStorage 에만 있던 타이머도 이어받는다
  let legacy = null;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_TIMER_KEY));
  } catch {
    /* 무시 */
  }
  const patch = migrate(current, legacy);
  if (patch) updateGarden(patch);

  // 브라우저 미리보기용: Electron 에서는 메인 프로세스 저장소가 이미 만들어 둔다
  if (!current.gardenId) updateGarden({ gardenId: makeId(12) });

  gardenApi.onChange((state) => {
    current = { ...DEFAULT_STATE, ...state };
    emit();
  });
  return current;
}

export function getGarden() {
  return current;
}

/** patch 객체 또는 (현재 상태 → patch) 함수 */
export function updateGarden(patchOrFn) {
  const patch = typeof patchOrFn === 'function' ? patchOrFn(current) : patchOrFn;
  if (!patch) return;
  current = { ...current, ...patch };
  gardenApi.merge(patch);
  emit();
}

export function subscribeGarden(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGarden() {
  return useSyncExternalStore(subscribeGarden, getGarden);
}
