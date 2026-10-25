// 랜덤 방문객: 화분 하나당 한 번, 진행률 20~85% 사이 아무 때나 찾아온다.
// 1분 30초 동안 머물고, 클릭하면 효과를 받는다 (놓쳐도 손해 없음).
//   effect 종류 —  boost: 성장 앞당김 / luck: 다음 랜덤 씨앗 확률 업 / ladybug: 목마름·비료 쿨타임 해결 / seed: 보너스 씨앗
export const VISITORS = {
  butterfly: { weight: 35, effect: 'boost', amount: 0.05 },
  bee: { weight: 25, effect: 'luck', luck: { rare: 2 } },
  ladybug: { weight: 15, effect: 'ladybug' },
  sparrow: { weight: 15, effect: 'seed' },
  firefly: { weight: 12, effect: 'luck', luck: { legendary: 3 }, night: true },
  rainbow: { weight: 3, effect: 'boost', amount: 0.15 },
};

export const VISITOR_IDS = Object.keys(VISITORS);
export const VISIT_WINDOW = [0.2, 0.85]; // 이 진행률 사이 아무 때나
export const VISIT_STAY_MS = 90 * 1000;

/** 밤(20시~6시)에만 오는 방문객이 있다 */
export const isNight = (now = Date.now()) => {
  const h = new Date(now).getHours();
  return h >= 20 || h < 6;
};

export function pickVisitor(now = Date.now(), random = Math.random) {
  const pool = VISITOR_IDS.filter((id) => !VISITORS[id].night || isNight(now));
  const total = pool.reduce((sum, id) => sum + VISITORS[id].weight, 0);
  let roll = random() * total;
  for (const id of pool) {
    if ((roll -= VISITORS[id].weight) < 0) return id;
  }
  return pool[0];
}
