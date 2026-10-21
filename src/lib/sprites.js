// 화분 + 꽃 스프라이트 조립: (꽃 종류, 진행률) → 픽셀 그리드
// 단계별 이미지를 통째로 그리는 대신 부위(씨앗/줄기/잎/봉오리/꽃머리)를 조합해서
// 줄기가 한 픽셀씩 자라는 "조금씩" 성장을 표현한다.
import { createGrid, mirror, outline, shiftAbove, stamp } from './pixel.js';

export const SPRITE_W = 27;
export const SPRITE_H = 43;
const CX = 13; // 줄기 x
const STEM_BASE_Y = 31; // 흙 바로 위 첫 줄기 픽셀

const BASE_COLORS = {
  // 줄기·잎
  g: '#5fb35e',
  G: '#3f8a44',
  l: '#74c96f',
  L: '#b4e89e',
  // 씨앗
  k: '#a0704a',
  K: '#7a5236',
  // 화분 (파스텔 테라코타)
  s: '#7a5236',
  S: '#5e3d27',
  R: '#f4b48c',
  r: '#e8956b',
  h: '#fbd5ba',
  p: '#d97f57',
  q: '#b8653f',
};

const POT = [
  '...ssSsssSss...',
  'RRRRRRRRRRRRRRR',
  'rhhrrrrrrrrrrrq',
  '.phppppppppppq.',
  '.phppppppppppq.',
  '.ppppppppppppq.',
  '..pppppppppqq..',
  '..pppppppppqq..',
  '..qqqqqqqqqqq..',
  '...qqqqqqqqq...',
];

// 씨앗은 꽃 종류를 숨기되 희귀도는 살짝 힌트를 준다 (흔함=갈색, 희귀=푸른 윤기, 전설=금빛)
const SEED = {
  common: { rows: ['kkk', 'kKK'], colors: {} },
  rare: { rows: ['kek', 'kKK'], colors: { k: '#8a7a9a', K: '#5f5470', e: '#9fd0ff' } },
  legendary: { rows: ['kyk', 'yKK'], colors: { k: '#e0b43a', K: '#b08218', y: '#fff3b0' } },
};
const COTYLEDON = ['LL.LL', '.lgl.'];
const LEAF_R = ['..LL', 'lllL', 'll..'];
const LEAF_L = mirror(LEAF_R);
const BUD_SMALL = { rows: ['.a.', 'aba', '.g.'], anchor: [1, 2] };
const BUD_LARGE = { rows: ['..a..', '.aaa.', '.aab.', 'gabbg', '.ggg.'], anchor: [2, 4] };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));

function stampAnchored(grid, part, topY, colors) {
  const [ax, ay] = part.anchor;
  stamp(grid, part.rows, CX - ax, topY - ay, colors);
}

/** 진행률 → 이번 프레임에 그릴 부위들 */
export function plantShape(flower, progress) {
  const p = clamp01(progress);
  const max = flower.stemHeight;
  if (p < 0.05) return { stage: 'seed', h: 0, cracked: p > 0.025 };
  if (p < 0.35) return { stage: 'sprout', h: 1 + Math.round(seg(p, 0.05, 0.35) * 3) };
  if (p < 0.7) return { stage: 'stem', h: 4 + Math.round(seg(p, 0.35, 0.7) * (Math.round(max * 0.8) - 4)) };
  if (p < 1) {
    const t = seg(p, 0.7, 1);
    return { stage: 'bud', h: Math.round(max * 0.8 + t * max * 0.2), bud: t < 0.45 ? BUD_SMALL : BUD_LARGE };
  }
  return { stage: 'bloom', h: max };
}

/**
 * @param flower  flowers.js 의 꽃 데이터 (씨앗 단계에서는 아무 꽃이나 같은 모습)
 * @param progress 0~1
 * @param sway    -1 | 0 | 1  윗부분 흔들림
 */
export function buildPlantGrid(flower, progress, sway = 0) {
  const colors = { ...BASE_COLORS, ...flower.colors };
  const shape = plantShape(flower, progress);
  const plant = createGrid(SPRITE_W, SPRITE_H);
  const topY = STEM_BASE_Y - shape.h + 1;

  if (shape.stage === 'seed') {
    const seed = SEED[flower.rarity];
    stamp(plant, seed.rows, CX - 1, STEM_BASE_Y - 1, { ...colors, ...seed.colors });
    if (shape.cracked) stamp(plant, ['L'], CX, STEM_BASE_Y - 2, colors);
  } else {
    for (let i = 0; i < shape.h; i++) stamp(plant, ['g'], CX, STEM_BASE_Y - i, colors);

    if (shape.stage === 'sprout' && shape.h >= 2) {
      stamp(plant, COTYLEDON, CX - 2, topY - 1, colors);
    }
    if (shape.stage !== 'sprout') {
      // 아래에서부터 4칸 간격으로 잎을 번갈아 단다 (꽃머리가 나중에 덮어 그려짐)
      const leafRoom = shape.h - 3;
      for (let k = 0, ly = STEM_BASE_Y - 2; STEM_BASE_Y - ly <= leafRoom && k < 3; k++, ly -= 4) {
        stamp(plant, k % 2 ? LEAF_L : LEAF_R, k % 2 ? CX - 4 : CX + 1, ly - 2, colors);
      }
    }
    if (shape.stage === 'bud') stampAnchored(plant, shape.bud, topY, colors);
    if (shape.stage === 'bloom') stampAnchored(plant, flower.head, topY, colors);
  }

  // 줄기 위쪽 절반만 흔들리게
  const swayed = shape.h >= 4 ? shiftAbove(plant, STEM_BASE_Y - Math.floor(shape.h / 2), sway) : plant;

  stamp(swayed, POT, CX - 7, STEM_BASE_Y + 1, colors);
  return outline(swayed);
}
