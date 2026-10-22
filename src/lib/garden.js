// 렌더러 쪽 정원 데이터 저장소
// Electron 에서는 메인 프로세스의 garden.json 을, 브라우저 미리보기에서는 localStorage 를 쓴다.
// 여러 창(위젯·도감)이 같은 상태를 보도록 변경 사항을 서로 방송한다.
import { useSyncExternalStore } from 'react';
import { makeId } from './ids.js';

const LOCAL_KEY = 'dfg.garden.v1';
const LEGACY_TIMER_KEY = 'dfg.timer.v1';
const DEFAULT_STATE = {
  version: 1,
  timer: null,
  collection: [],
  position: null,
  seedQueue: [],
  redeemed: [],
  gardenId: null,
  fertilizedAt: 0,
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
export async function initGarden(createTimer) {
  current = { ...DEFAULT_STATE, ...(await gardenApi.get()) };

  if (!current.timer) {
    // Step 1~2 때 localStorage 에만 있던 타이머를 이어받는다
    let legacy = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_TIMER_KEY));
    } catch {
      /* 무시 */
    }
    updateGarden({ timer: createTimer(legacy) });
  }

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

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGarden() {
  return useSyncExternalStore(subscribe, getGarden);
}
