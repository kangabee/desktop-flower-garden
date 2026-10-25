import { useCallback, useEffect, useState } from 'react';
import { SUN_BOOST, computeGrowth, potRate } from '../lib/growth.js';
import { activeWeather, weatherEffect } from '../lib/weather.js';
import { FERTILIZER_COOLDOWN_MS, FERTILIZER_MS } from '../lib/care.js';
import {
  activateWant,
  arriveVisitor,
  careAction,
  catchVisitor,
  discoveredSet,
  leaveVisitor,
  nextSeed,
  normalizePot,
  potView,
  rainWaters,
  recordBloom,
  sunAction,
  syncRate,
  unlockedPotCount,
  visitorDue,
  visitorExpired,
} from '../lib/pots.js';
import { VISIT_STAY_MS } from '../data/visitors.js';
import { getGarden, settingsOf, updateGarden, useGarden } from '../lib/garden.js';
import { decodeCard } from '../lib/card.js';
import { FLOWER_BY_ID } from '../data/flowers.js';
import { flowerText, formatDuration, t } from '../i18n/index.js';

/** 지금 날씨의 성장 효과 (날씨를 끄면 효과 없음) */
export function effectOf(state, now) {
  return weatherEffect(activeWeather(state.weather, settingsOf(state).weather.enabled, now), now);
}

/** i 번째 화분만 바꾸기 */
const withPot = (state, i, pot) => state.pots.map((p, j) => (j === i ? pot : p));

/**
 * 선반의 화분들. 매 tick 마다 "시작 시각 ~ 지금"으로 다시 계산하므로 창이 잠들어도 오차가 쌓이지 않는다.
 * driver: 시간이 흐르며 생기는 일(만개 기록·바람·방문객·날씨 속도·화분 늘리기)을 처리하는 창 (위젯만 true)
 */
export function usePots({ driver = false } = {}) {
  const garden = useGarden();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    // 24시간에 걸쳐 자라므로 5초마다만 다시 계산해도 충분 (방문객이 와 있을 땐 1초마다)
    const busy = (garden.pots ?? []).some((p) => p.visit);
    const id = setInterval(() => setNow(Date.now()), busy ? 1000 : 5000);
    return () => clearInterval(id);
  }, [garden.pots]);

  const pots = (garden.pots ?? []).map((p) => potView(normalizePot(p), now));

  // ── 시간이 흐르며 생기는 일 ──
  useEffect(() => {
    if (!driver) return;
    updateGarden((s) => {
      const at = Date.now();
      const effect = effectOf(s, at);
      const rainbowEnd = s.weather?.rainbowUntil;
      let changed = false;
      let collection = s.collection;

      let list = (s.pots ?? []).map((raw) => {
        let p = normalizePot(raw);
        if (p.recorded) return p;
        const g = computeGrowth(p, at);
        if (g.progress >= 1) {
          const r = recordBloom(p, at);
          collection = [...collection, r.entry];
          changed = true;
          return r.pot;
        }
        if (effect.noWater && p.want?.kind === 'water') {
          p = rainWaters(p, at, effect);
          changed = true;
        }
        if (!p.want && at >= p.nextWantAt) {
          p = activateWant(p, effect);
          changed = true;
        }
        // 날씨·무지개로 속도가 달라졌으면 그 시각부터 새 속도 (무지개가 끝난 건 끝난 시각 기준)
        const current = p.boostSince ? (p.boostRate ?? SUN_BOOST) : 1;
        if (Math.abs(potRate(p, effect) - current) > 1e-9) {
          const from = rainbowEnd && at > rainbowEnd && p.boostSince && p.boostSince < rainbowEnd ? rainbowEnd : at;
          p = syncRate(p, from, effect);
          changed = true;
        }
        if (visitorDue(p, g.progress)) {
          p = arriveVisitor(p, at);
          changed = true;
        } else if (visitorExpired(p, at, VISIT_STAY_MS)) {
          p = leaveVisitor(p);
          changed = true;
        }
        return p;
      });

      // 도감을 모으면 화분이 늘어난다 (새 화분엔 바로 씨앗을 심어 둔다)
      let rest = { seedQueue: s.seedQueue, nextSeedLuck: s.nextSeedLuck };
      while (list.length < unlockedPotCount(discoveredSet(collection).size)) {
        const seeded = nextSeed({ ...s, ...rest }, at);
        list = [...list, seeded.pot];
        rest = { seedQueue: seeded.seedQueue, nextSeedLuck: seeded.nextSeedLuck };
        changed = true;
      }

      return changed ? { pots: list, collection, ...rest } : null;
    });
  }, [driver, now]);

  // ── 사용자의 돌봄 (i = 화분 번호) ──

  /** 노래·물 → 반응 문구 */
  const care = useCallback((i, kind) => {
    const at = Date.now();
    let reaction = '';
    updateGarden((s) => {
      const p = normalizePot(s.pots[i]);
      const r = careAction(p, kind, p.recorded, at, effectOf(s, at));
      reaction = r.reaction;
      return { pots: withPot(s, i, r.pot) };
    });
    setNow(at);
    return reaction;
  }, []);

  /** 햇빛 부스터 켜기/끄기 → { on, reaction } */
  const toggleSun = useCallback((i) => {
    const at = Date.now();
    let out = { on: false, reaction: '' };
    updateGarden((s) => {
      const r = sunAction(normalizePot(s.pots[i]), at, effectOf(s, at));
      out = { on: r.on, reaction: r.reaction };
      return { pots: withPot(s, i, r.pot) };
    });
    setNow(at);
    return out;
  }, []);

  /** 비료가 지금 가능한지 → { ok, reason } (버튼을 흐리게 할지 정하는 데도 쓴다) */
  const fertilizerState = (i) => {
    const view = pots[i];
    if (!view || view.bloomed) return { ok: false, reason: t('w.alreadyBloomed') };
    if (view.pot.sunOn) return { ok: false, reason: t('fert.sunOn') };
    const left = FERTILIZER_COOLDOWN_MS - (now - (garden.fertilizedAt ?? 0));
    if (left > 0) return { ok: false, reason: t('fert.wait', { time: formatDuration(left) }) };
    return { ok: true, reason: '' };
  };

  /** 비료: 1시간 앞당기기 → { ok, text } */
  const fertilize = (i) => {
    const state = fertilizerState(i);
    if (!state.ok) return { ok: false, text: state.reason };
    const at = Date.now();
    updateGarden((s) => {
      const p = normalizePot(s.pots[i]);
      const pot = {
        ...p,
        bonusMs: (p.bonusMs ?? 0) + FERTILIZER_MS,
        care: { ...p.care, fertilizer: (p.care?.fertilizer ?? 0) + 1 },
      };
      return { fertilizedAt: at, pots: withPot(s, i, pot) };
    });
    setNow(at);
    return { ok: true, text: t('fert.done') };
  };

  /** 새 씨앗: 선물·참새 씨앗이 기다리고 있으면 그것부터, 아니면 랜덤 (방문객 행운 적용) */
  const plantNewSeed = useCallback((i) => {
    const at = Date.now();
    updateGarden((s) => {
      const seeded = nextSeed(s, at);
      return { pots: withPot(s, i, seeded.pot), seedQueue: seeded.seedQueue, nextSeedLuck: seeded.nextSeedLuck };
    });
    setNow(at);
  }, []);

  /** 방문객 잡기 → 방문객 종류 (이미 떠났으면 null) */
  const catchVisitorAt = useCallback((i) => {
    const at = Date.now();
    let kind = null;
    updateGarden((s) => {
      const p = normalizePot(s.pots[i]);
      if (!p.visit) return null;
      const r = catchVisitor(p, s, at, effectOf(s, at));
      kind = r.kind;
      return {
        ...r.gardenPatch,
        pots: withPot(s, i, r.pot),
        visitors: { ...(s.visitors ?? {}), [kind]: ((s.visitors ?? {})[kind] ?? 0) + 1 },
      };
    });
    setNow(at);
    return kind;
  }, []);

  /**
   * 선물 링크의 "씨앗 받기"로 들어온 씨앗 → { ok, text, pot }
   * 다 핀 화분이 있으면 그 자리에 바로 심고, 없으면 다음 차례로 예약
   */
  const receiveSeed = useCallback((payload) => {
    const card = decodeCard(payload);
    if (!card?.seedId) return { ok: false, text: t('seed.unreadable') };
    const g = getGarden();
    if (card.gardenId && card.gardenId === g.gardenId) return { ok: false, text: t('seed.mine') };
    if (g.redeemed?.includes(card.seedId)) return { ok: false, text: t('seed.already') };

    const gift = { flowerId: card.flowerId, from: card.from, seedId: card.seedId, fromGarden: card.gardenId };
    const target = g.pots.findIndex((p) => p.recorded);
    const at = Date.now();
    updateGarden((s) => {
      const redeemed = [...(s.redeemed ?? []), card.seedId];
      if (target < 0) return { redeemed, seedQueue: [...(s.seedQueue ?? []), gift] };
      const seeded = nextSeed({ ...s, seedQueue: [gift, ...(s.seedQueue ?? [])] }, at);
      return { redeemed, pots: withPot(s, target, seeded.pot), seedQueue: seeded.seedQueue };
    });
    setNow(at);
    const vars = { from: card.from, name: flowerText(FLOWER_BY_ID[card.flowerId], 'name') };
    return { ok: true, text: t(target >= 0 ? 'seed.planted' : 'seed.queued', vars), pot: Math.max(target, 0) };
  }, []);

  return {
    pots,
    now,
    garden,
    care,
    toggleSun,
    fertilize,
    fertilizerState,
    plantNewSeed,
    catchVisitor: catchVisitorAt,
    receiveSeed,
    seedQueue: garden.seedQueue ?? [],
  };
}
