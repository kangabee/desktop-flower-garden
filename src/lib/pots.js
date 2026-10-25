// 화분(선반) 로직 — 순수 함수만. 화면은 hooks/usePots.js 에서 이 함수들로 정원 상태를 바꾼다.
//   화분 1개 = 씨앗 하나의 성장 기록 { startedAt, flowerId, bonusMs, care, want, sunOn, boostSince, visit ... }
import { GOAL_MS, computeGrowth, foldRate, resumeRate } from './growth.js';
import { applyCare, applySun, pickWant, wantIntervalMs } from './care.js';
import { FLOWERS, FLOWER_BY_ID, pickRandomFlower } from '../data/flowers.js';
import { VISITORS, VISIT_WINDOW, pickVisitor } from '../data/visitors.js';

// 선반: 도감에서 서로 다른 꽃을 이만큼 모으면 화분이 하나씩 늘어난다 (최대 3개)
export const POT_UNLOCKS = [0, 5, 15];
export const unlockedPotCount = (discovered) => POT_UNLOCKS.filter((need) => discovered >= need).length;

export const discoveredSet = (collection) => new Set(collection.map((e) => e.flowerId));

/**
 * 새 화분(씨앗).
 *   legacy: 예전 timer 형식이면 진행도를 이어받는다
 *   gift: 선물·참새가 준 씨앗 { flowerId, from, fromVisitor }
 *   luck: 방문객이 남긴 행운 (랜덤 씨앗일 때만 쓰임)
 */
export function createPot({ legacy = null, gift = null, luck = {}, now = Date.now() } = {}) {
  const base = typeof legacy?.startedAt === 'number' ? legacy : { startedAt: now };
  const flowerId =
    gift?.flowerId ?? (FLOWER_BY_ID[base.flowerId] ? base.flowerId : pickRandomFlower(Math.random, { luck, now }).id);
  return normalizePot({
    startedAt: base.startedAt,
    flowerId,
    giftFrom: gift ? gift.from || '' : null, // null = 랜덤 씨앗
    fromVisitor: gift?.fromVisitor ?? null, // 'sparrow' = 참새가 물어다 준 씨앗
    bonusMs: base.bonusMs ?? 0,
    care: base.care ?? { song: 0, water: 0, sun: 0, fertilizer: 0 },
    lastCare: base.lastCare ?? {},
    sunOn: base.sunOn ?? false,
    boostSince: base.boostSince ?? null,
    boostRate: base.boostRate ?? null,
    want: base.want ?? null,
    nextWantAt: base.nextWantAt ?? now + wantIntervalMs(false),
    recorded: base.recorded ?? false,
  });
}

/** 저장된 화분을 지금 형식으로 (예전 sunSince 형식, 방문 시점이 없는 화분 등) */
export function normalizePot(pot) {
  let p = pot;
  if ('sunSince' in p) {
    const { sunSince = null, ...rest } = p;
    p = { ...rest, sunOn: Boolean(sunSince), boostSince: sunSince };
  }
  return {
    ...p,
    want: p.want ?? null,
    nextWantAt: p.nextWantAt ?? Date.now() + wantIntervalMs(Boolean(p.sunOn)),
    // 방문객이 찾아올 진행률 (씨앗마다 몰래 정해 둔다)
    visitAt: p.visitAt ?? VISIT_WINDOW[0] + Math.random() * (VISIT_WINDOW[1] - VISIT_WINDOW[0]),
    visit: p.visit ?? null, // 지금 와 있는 방문객 { kind, since }
    visitDone: p.visitDone ?? false,
  };
}

/**
 * 저장 형식 정리: v0.4 까지의 화분 1개(timer) → pots[0], 화분마다 방문 시점 등을 채워 저장해 둔다
 */
export function migrateGarden(state, legacyTimer) {
  if (!state.pots?.length) return { pots: [createPot({ legacy: state.timer ?? legacyTimer })] };
  if (state.pots.every((p) => typeof p.visitAt === 'number' && !('sunSince' in p))) return null;
  return { pots: state.pots.map(normalizePot) };
}

/** 선물·씨앗 대기열에서 하나 꺼내 새 화분으로 */
export function nextSeed(state, now = Date.now()) {
  const [gift, ...rest] = state.seedQueue ?? [];
  const luck = state.nextSeedLuck ?? {};
  return {
    pot: createPot({ gift, luck, now }),
    seedQueue: rest,
    // 행운은 랜덤 씨앗에만 쓰이고 사라진다
    nextSeedLuck: gift ? state.nextSeedLuck ?? {} : {},
  };
}

// ── 시간이 흐르며 생기는 일 (위젯이 몇 초마다 확인) ──

/** 만개 기록: 도감에 남기고 햇빛·바람·방문객 정리 */
export function recordBloom(pot, at) {
  const cur = foldRate(pot, at);
  return {
    pot: { ...cur, recorded: true, sunOn: false, want: null, visit: null },
    entry: {
      uid: `${cur.startedAt}-${cur.flowerId}`,
      flowerId: cur.flowerId,
      startedAt: cur.startedAt,
      bloomedAt: at,
      care: cur.care,
      giftFrom: cur.giftFrom ?? null,
    },
  };
}

/** 바람(물·햇빛·음악)이 생길 시각이 지났으면 등장. 비가 오면 물은 원하지 않는다 */
export function activateWant(pot, effect) {
  const at = pot.nextWantAt;
  let kind = pickWant(pot);
  if (effect.noWater && kind === 'water') kind = pot.sunOn ? 'song' : 'sun';
  return resumeRate({ ...foldRate(pot, at), want: { kind, since: at } }, at, effect);
}

/** 비가 오면 목마름이 풀린다 (자연이 물을 줌) */
export function rainWaters(pot, at, effect) {
  if (pot.want?.kind !== 'water') return pot;
  return resumeRate(
    { ...foldRate(pot, at), want: null, nextWantAt: at + wantIntervalMs(pot.sunOn) },
    at,
    effect,
  );
}

/** 날씨·무지개가 바뀌어 성장 속도가 달라졌으면 그 시각(at)부터 새 속도 */
export function syncRate(pot, at, effect) {
  return resumeRate(foldRate(pot, at), at, effect);
}

// ── 사용자의 돌봄 ──

export function careAction(pot, kind, bloomed, now, effect) {
  const result = applyCare(foldRate(pot, now), kind, bloomed, now);
  return { pot: resumeRate(result.timer, now, effect), reaction: result.reaction };
}

export function sunAction(pot, now, effect) {
  const result = applySun(foldRate(pot, now), now);
  return { pot: resumeRate(result.timer, now, effect), on: result.on, reaction: result.reaction };
}

// ── 방문객 ──

/** 방문객이 올 차례인가 (만개 전, 아직 안 왔고, 정해 둔 진행률을 넘었을 때) */
export function visitorDue(pot, progress) {
  return !pot.recorded && !pot.visitDone && !pot.visit && progress >= pot.visitAt && progress < 1;
}

export const arriveVisitor = (pot, now) => ({ ...pot, visit: { kind: pickVisitor(now), since: now } });

/**
 * 방문객을 잡았을 때 → 정원 전체에 적용할 patch 의 재료
 * { pot, gardenPatch: { nextSeedLuck?, fertilizedAt?, seedQueue? } }
 */
export function catchVisitor(pot, state, now, effect) {
  const kind = pot.visit?.kind;
  const v = VISITORS[kind];
  let next = { ...pot, visit: null, visitDone: true };
  const gardenPatch = {};

  if (v.effect === 'boost') next = { ...next, bonusMs: (next.bonusMs ?? 0) + GOAL_MS * v.amount };
  if (v.effect === 'luck') {
    const luck = { ...(state.nextSeedLuck ?? {}) };
    for (const [rarity, mult] of Object.entries(v.luck)) luck[rarity] = Math.max(luck[rarity] ?? 1, mult);
    gardenPatch.nextSeedLuck = luck;
  }
  if (v.effect === 'ladybug') {
    // 목마름 해결 + 비료를 바로 다시 쓸 수 있게
    if (next.want?.kind === 'water') {
      next = resumeRate({ ...foldRate(next, now), want: null, nextWantAt: now + wantIntervalMs(next.sunOn) }, now, effect);
    }
    gardenPatch.fertilizedAt = 0;
  }
  if (v.effect === 'seed') {
    const flower = pickRandomFlower(Math.random, { now });
    gardenPatch.seedQueue = [...(state.seedQueue ?? []), { flowerId: flower.id, from: '', fromVisitor: kind }];
  }
  return { pot: next, kind, gardenPatch };
}

export const visitorExpired = (pot, now, stayMs) => Boolean(pot.visit && now - pot.visit.since > stayMs);
export const leaveVisitor = (pot) => ({ ...pot, visit: null, visitDone: true });

/** 화분 하나의 화면 값 */
export function potView(pot, now) {
  const growth = computeGrowth(pot, now);
  return { pot, growth, flower: FLOWER_BY_ID[pot.flowerId] ?? FLOWERS[0], bloomed: growth.phase.key === 'bloom' };
}
