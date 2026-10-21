// 꽃 도감 데이터베이스
// head: 만개 시 꽃머리 픽셀 패턴 (anchor = 줄기 꼭대기가 닿는 패턴 내 좌표)
//   a 꽃잎 · b 꽃잎 그늘 · c 꽃술 · d 꽃술 그늘 · w 하이라이트 · e 보조색 · g/G 초록
// colors: 위 글자들의 색 (g 를 넣으면 줄기 색도 바뀜)
import { radialHead } from '../lib/pixel.js';

export const RARITY = {
  common: { label: 'Common', ko: '흔함', stars: 1, weight: 65, color: '#8bbf7a', seedHint: '평범해 보이는 씨앗' },
  rare: { label: 'Rare', ko: '희귀', stars: 2, weight: 28, color: '#6fa8e8', seedHint: '푸른 윤기가 도는 씨앗…?' },
  legendary: { label: 'Legendary', ko: '전설', stars: 3, weight: 7, color: '#f0b429', seedHint: '금빛으로 반짝이는 씨앗!' },
};

const radial = (opts) => {
  const rows = radialHead(opts);
  const c = (opts.size - 1) / 2;
  return { rows, anchor: [c, c] };
};

export const FLOWERS = [
  // ───────── Common ─────────
  {
    id: 'daisy',
    name: '데이지',
    nameEn: 'Daisy',
    rarity: 'common',
    language: '희망, 순수한 마음',
    message: '오늘도 작은 희망 하나를 피워냈어요.',
    stemHeight: 14,
    head: radial({ size: 11, petals: 10, radius: 5, core: 1.6, base: 0.35, sharp: 1.4 }),
    colors: { a: '#fffdf7', b: '#d9d6e8', c: '#ffd23f', d: '#e8a22b', w: '#fff3b0' },
  },
  {
    id: 'tulip',
    name: '튤립',
    nameEn: 'Tulip',
    rarity: 'common',
    language: '사랑의 고백',
    message: '수줍게 건네는 마음, 받아줄래요?',
    stemHeight: 13,
    head: {
      rows: [
        'a..a..a',
        'aa.a.aa',
        'aaaaaab',
        'awaaabb',
        'aaaaabb',
        '.aaabb.',
        '..abb..',
        '...g...',
      ],
      anchor: [3, 7],
    },
    colors: { a: '#ff8fa3', b: '#e05f7e', w: '#ffd1dc' },
  },
  {
    id: 'cherry',
    name: '벚꽃',
    nameEn: 'Cherry Blossom',
    rarity: 'common',
    language: '삶의 아름다움',
    message: '잠깐 멈춰서 봄을 느껴봐요.',
    stemHeight: 12,
    head: radial({ size: 9, petals: 5, radius: 4.4, core: 1, base: 0.5, sharp: 0.8, twist: Math.PI / 2 }),
    colors: { a: '#ffd6e3', b: '#f4a3bf', c: '#e8577f', d: '#c23d63', g: '#7a9a5a' },
  },
  {
    id: 'forget-me-not',
    name: '물망초',
    nameEn: 'Forget-me-not',
    rarity: 'common',
    language: '나를 잊지 마세요',
    message: '바쁜 하루 속에서도 서로를 기억해요.',
    stemHeight: 11,
    head: radial({ size: 9, petals: 5, radius: 4, core: 1, base: 0.55, sharp: 0.7, twist: Math.PI / 2 }),
    colors: { a: '#8cc8ff', b: '#5a9be0', c: '#ffe066', d: '#f2b630' },
  },
  {
    id: 'lavender',
    name: '라벤더',
    nameEn: 'Lavender',
    rarity: 'common',
    language: '당신을 기다립니다',
    message: '조금 지친 날엔 숨을 크게 쉬어요.',
    stemHeight: 12,
    head: {
      rows: [
        '..a..',
        '.aa..',
        '..ab.',
        '.aab.',
        '.baa.',
        '..aab',
        '.aab.',
        'aba..',
        '.aab.',
        '..g..',
      ],
      anchor: [2, 9],
    },
    colors: { a: '#b79cf0', b: '#8a6cd1', g: '#7fae7a' },
  },
  {
    id: 'sunflower',
    name: '해바라기',
    nameEn: 'Sunflower',
    rarity: 'common',
    language: '오직 당신만을 바라봅니다',
    message: '당신이 있는 쪽이 늘 해가 드는 쪽이에요.',
    stemHeight: 17,
    head: radial({ size: 13, petals: 14, radius: 6, core: 2.8, base: 0.62, sharp: 1.2 }),
    colors: { a: '#ffd23f', b: '#f2a81d', c: '#8a5a2b', d: '#5e3a1a', w: '#b07a44' },
  },

  // ───────── Rare ─────────
  {
    id: 'rose',
    name: '장미',
    nameEn: 'Rose',
    rarity: 'rare',
    language: '열렬한 사랑',
    message: '가시마저 감싸 안는 마음을 담아.',
    stemHeight: 15,
    head: {
      rows: [
        '..aab..',
        '.abbaa.',
        'aabaaba',
        'abaabba',
        'abbbaab',
        '.aaabb.',
        'gg.b.gg',
        '...g...',
      ],
      anchor: [3, 7],
    },
    colors: { a: '#ff5d73', b: '#c9304f' },
  },
  {
    id: 'lily-of-the-valley',
    name: '은방울꽃',
    nameEn: 'Lily of the Valley',
    rarity: 'rare',
    language: '틀림없이 행복해질 거예요',
    message: '조용히 울리는 작은 행운의 종소리.',
    stemHeight: 12,
    head: {
      rows: [
        '..ggggggg.',
        '.g.g...g..',
        '.gaaa.aaa.',
        '.gawa.awa.',
        '.ga.a.a.a.',
        '.g........',
        '.g........',
      ],
      anchor: [1, 6],
    },
    colors: { a: '#fbfbf2', b: '#d8dccb', w: '#ffffff' },
  },
  {
    id: 'hydrangea',
    name: '수국',
    nameEn: 'Hydrangea',
    rarity: 'rare',
    language: '진심',
    message: '변하는 날씨 속에서도 진심은 그대로예요.',
    stemHeight: 14,
    head: {
      rows: [
        '..abeab..',
        '.eabeabe.',
        'abeawbeab',
        'eabeabeab',
        'abeabeabe',
        '.eabeabe.',
        '..abeab..',
        '....g....',
      ],
      anchor: [4, 7],
    },
    colors: { a: '#a9c8ff', b: '#7d9ef0', e: '#c8b6ff', w: '#eef3ff' },
  },
  {
    id: 'lotus',
    name: '연꽃',
    nameEn: 'Lotus',
    rarity: 'rare',
    language: '청순한 마음',
    message: '흙탕물 위에서도 맑게 피어난 당신에게.',
    stemHeight: 13,
    head: {
      rows: [
        '....a....',
        '...aba...',
        'a..aba..a',
        'ab.aba.ba',
        'aabacabaa',
        '.aaabaaa.',
        '..aaaaa..',
        '....g....',
      ],
      anchor: [4, 7],
    },
    colors: { a: '#ffc2d6', b: '#f08bb0', c: '#ffe27a' },
  },
  {
    id: 'lily',
    name: '백합',
    nameEn: 'Lily',
    rarity: 'rare',
    language: '변함없는 사랑',
    message: '한결같은 마음이 가장 큰 선물이에요.',
    stemHeight: 15,
    head: radial({ size: 11, petals: 6, radius: 5.2, core: 1, base: 0.18, sharp: 0.9, twist: Math.PI / 2 }),
    colors: { a: '#fffaf0', b: '#f3d9c4', c: '#ff9f43', d: '#d9772a' },
  },

  // ───────── Legendary ─────────
  {
    id: 'blue-rose',
    name: '푸른 장미',
    nameEn: 'Blue Rose',
    rarity: 'legendary',
    language: '기적, 불가능을 이루다',
    message: '세상에 없던 꽃이 당신 곁에서 피었어요.',
    stemHeight: 16,
    head: {
      rows: [
        '..aab..',
        '.abbaa.',
        'aabwaba',
        'abaabba',
        'abbbaab',
        '.aaabb.',
        'gg.b.gg',
        '...g...',
      ],
      anchor: [3, 7],
    },
    colors: { a: '#7fb2ff', b: '#3f6fd8', w: '#d6e8ff', g: '#3f8a6a' },
  },
  {
    id: 'queen-of-the-night',
    name: '월하미인',
    nameEn: 'Queen of the Night',
    rarity: 'legendary',
    language: '단 한 번의 만남',
    message: '일 년에 단 하룻밤, 오늘이 바로 그날이에요.',
    stemHeight: 15,
    head: radial({ size: 13, petals: 14, radius: 6, core: 1.8, base: 0.2, sharp: 1.6 }),
    colors: { a: '#fdfcff', b: '#c9bdf2', c: '#fff2a8', d: '#e8cf6a', w: '#ffffff' },
  },
  {
    id: 'edelweiss',
    name: '에델바이스',
    nameEn: 'Edelweiss',
    rarity: 'legendary',
    language: '소중한 추억',
    message: '함께한 시간이 별처럼 오래 빛나기를.',
    stemHeight: 12,
    head: radial({ size: 11, petals: 7, radius: 5, core: 1.6, base: 0.15, sharp: 0.6 }),
    colors: { a: '#f4f1e6', b: '#c9c6b4', c: '#e8de9c', d: '#bfb36a', w: '#fffbe0', g: '#8fa88a' },
  },
];

export const FLOWER_BY_ID = Object.fromEntries(FLOWERS.map((f) => [f.id, f]));

/** 희귀도 가중치 → 그 안에서 균등하게 랜덤 꽃 하나 */
export function pickRandomFlower(random = Math.random) {
  const tiers = Object.entries(RARITY);
  const total = tiers.reduce((sum, [, r]) => sum + r.weight, 0);
  let roll = random() * total;
  let rarity = tiers[0][0];
  for (const [key, r] of tiers) {
    if ((roll -= r.weight) < 0) {
      rarity = key;
      break;
    }
  }
  const pool = FLOWERS.filter((f) => f.rarity === rarity);
  return pool[Math.floor(random() * pool.length)];
}
