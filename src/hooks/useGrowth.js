import { useCallback, useEffect, useState } from 'react';
import { computeGrowth, foldBoost, resumeBoost } from '../lib/growth.js';
import { applyCare, applySun, pickWant, wantIntervalMs } from '../lib/care.js';
import { getGarden, updateGarden, useGarden } from '../lib/garden.js';
import { decodeCard } from '../lib/card.js';
import { FLOWER_BY_ID, pickRandomFlower } from '../data/flowers.js';

/**
 * 새 씨앗. legacy = Step 1~2 시절 저장 형식이면 진행도를 이어받는다.
 * gift = 선물받은 씨앗 { flowerId, from, seedId, fromGarden } 이면 그 꽃으로 심는다.
 */
export function createTimer(legacy, mode = 'workhours', gift = null) {
  const base = legacy?.mode && typeof legacy.startedAt === 'number' ? legacy : { mode, startedAt: Date.now() };
  const flowerId = gift?.flowerId ?? (FLOWER_BY_ID[base.flowerId] ? base.flowerId : pickRandomFlower().id);
  return {
    mode: base.mode,
    startedAt: base.startedAt,
    flowerId,
    giftFrom: gift ? gift.from || '' : null, // null = 직접 받은 랜덤 씨앗
    bonusMs: 0,
    care: { song: 0, water: 0, sun: 0 },
    lastCare: {},
    sunOn: false, // 햇빛 부스터 스위치
    boostSince: null, // 부스터가 실제로 돌기 시작한 시각 (목마르면 멈춤)
    want: null, // 꽃이 지금 원하는 것 { kind, since }
    nextWantAt: Date.now() + wantIntervalMs(base.mode, false),
    recorded: false,
  };
}

/** 예전 저장 형식(sunSince 하나로 햇빛을 표현)을 지금 형식으로 */
function normalize(timer) {
  if (!('sunSince' in timer) && 'sunOn' in timer) return timer;
  const { sunSince = null, ...rest } = timer;
  return {
    ...rest,
    sunOn: Boolean(sunSince),
    boostSince: sunSince,
    want: rest.want ?? null,
    nextWantAt: rest.nextWantAt ?? Date.now() + wantIntervalMs(rest.mode, Boolean(sunSince)),
  };
}

const setTimer = (fn) => updateGarden((s) => ({ timer: fn(normalize(s.timer)) }));

/**
 * 경과 시간 기반 성장 훅.
 * 매 tick마다 "시작 시각 ~ 지금"으로 다시 계산하므로 창이 잠들어도 오차가 쌓이지 않는다.
 */
export function useGrowth() {
  const garden = useGarden();
  const timer = normalize(garden.timer);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    // 데모 모드만 촘촘하게, 나머지는 느슨하게 갱신해 CPU 사용 최소화
    const interval = timer.mode === 'demo' ? 250 : 5000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [timer.mode]);

  const growth = computeGrowth(timer, now);
  const flower = FLOWER_BY_ID[timer.flowerId];
  const bloomed = growth.phase.key === 'bloom';

  // 만개하면 도감(컬렉션)에 한 번만 기록
  useEffect(() => {
    if (!bloomed || timer.recorded) return;
    const t = Date.now();
    // 최신 상태 기준으로 다시 확인해야 같은 꽃이 두 번 기록되지 않는다
    updateGarden((s) => {
      if (s.timer.recorded) return null;
      const cur = foldBoost(normalize(s.timer), t);
      return {
        // 다 폈으니 햇빛·바람도 정리
        timer: { ...cur, recorded: true, sunOn: false, boostSince: null, want: null },
        collection: [
          ...s.collection,
          {
            uid: `${cur.startedAt}-${cur.flowerId}`,
            flowerId: cur.flowerId,
            mode: cur.mode,
            startedAt: cur.startedAt,
            bloomedAt: t,
            care: cur.care,
            giftFrom: cur.giftFrom ?? null,
          },
        ],
      };
    });
  }, [bloomed, timer.recorded]);

  // 바람이 생길 시각이 지났으면 등장 (앱이 꺼져 있던 동안 지났어도 그 시각 기준으로 처리)
  useEffect(() => {
    if (bloomed || timer.want || !(now >= timer.nextWantAt)) return;
    setTimer((prev) => {
      if (prev.want || Date.now() < prev.nextWantAt) return prev;
      const at = prev.nextWantAt;
      return resumeBoost({ ...foldBoost(prev, at), want: { kind: pickWant(prev), since: at } }, at);
    });
  }, [now, bloomed, timer.want, timer.nextWantAt]);

  /** 새 씨앗: 선물받은 씨앗이 기다리고 있으면 그것부터, 아니면 랜덤 (mode를 넘기면 모드도 변경) */
  const plantNewSeed = useCallback((mode) => {
    updateGarden((s) => {
      const [gift, ...rest] = s.seedQueue ?? [];
      return { timer: createTimer(null, mode ?? s.timer.mode, gift), seedQueue: rest };
    });
    setNow(Date.now());
  }, []);

  /** 노래·물 → 반응 문구 */
  const care = useCallback(
    (kind) => {
      const t = Date.now();
      let reaction = '';
      setTimer((prev) => {
        const result = applyCare(foldBoost(prev, t), kind, bloomed, t);
        reaction = result.reaction;
        return resumeBoost(result.timer, t);
      });
      setNow(t);
      return reaction;
    },
    [bloomed],
  );

  /** 햇빛 부스터 켜기/끄기 → { on, reaction } */
  const toggleSun = useCallback(() => {
    const t = Date.now();
    let out = { on: false, reaction: '' };
    setTimer((prev) => {
      const result = applySun(foldBoost(prev, t), t);
      out = { on: result.on, reaction: result.reaction };
      return resumeBoost(result.timer, t);
    });
    setNow(t);
    return out;
  }, []);

  /**
   * 선물 링크의 "씨앗 받기"로 들어온 씨앗 → { ok, text }
   * 숨은 씨앗 ID·정원 ID로 확인만 하고, 사용자는 아무것도 입력하지 않는다.
   */
  const receiveSeed = useCallback((payload) => {
    const card = decodeCard(payload);
    if (!card?.seedId) return { ok: false, text: '씨앗 정보를 읽을 수 없어요.' };
    const g = getGarden();
    if (card.gardenId && card.gardenId === g.gardenId) return { ok: false, text: '내가 보낸 씨앗이에요!' };
    if (g.redeemed?.includes(card.seedId)) return { ok: false, text: '이미 받은 씨앗이에요.' };

    const gift = { flowerId: card.flowerId, from: card.from, seedId: card.seedId, fromGarden: card.gardenId };
    // 지금 꽃이 다 피어 있으면 바로 심고, 키우는 중이면 다음 차례로 예약
    const plantNow = Boolean(g.timer.recorded);
    updateGarden((s) => ({
      redeemed: [...(s.redeemed ?? []), card.seedId],
      ...(plantNow ? { timer: createTimer(null, s.timer.mode, gift) } : { seedQueue: [...(s.seedQueue ?? []), gift] }),
    }));
    setNow(Date.now());
    const who = card.from ? `${card.from}님의 ` : '';
    const name = FLOWER_BY_ID[card.flowerId].name;
    return {
      ok: true,
      text: plantNow
        ? `${who}${name} 씨앗을 화분에 심었어요!`
        : `${who}${name} 씨앗이 도착했어요! 지금 꽃이 피면 🌱 로 심어요.`,
    };
  }, []);

  return {
    timer,
    growth,
    flower,
    bloomed,
    plantNewSeed,
    care,
    toggleSun,
    receiveSeed,
    seedQueue: garden.seedQueue ?? [],
  };
}
