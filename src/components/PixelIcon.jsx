import { useLayoutEffect, useMemo, useRef } from 'react';
import { createGrid, drawGrid, outline, stamp } from '../lib/pixel.js';

// 작은 도트 아이콘/소품 스프라이트 (자동 외곽선 포함)

const SUN_COLORS = { a: '#ffb347', c: '#ffd84d', d: '#f5b630', w: '#fff6c2' };

/** 15×15 해 프레임. longAxis 면 가로·세로 햇살이 길고 대각선이 짧다 (반대 프레임은 그 반대) */
function sunFrame(longAxis) {
  const R = 7;
  const rows = [];
  for (let y = -R; y <= R; y++) {
    let row = '';
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y);
      const ax = Math.abs(x);
      const ay = Math.abs(y);
      if (d <= 4.2) {
        row += x + y >= 3 ? 'd' : x + y <= -4 && d <= 3.2 ? 'w' : 'c';
      } else if ((x === 0 || y === 0) && Math.max(ax, ay) >= 6 && Math.max(ax, ay) <= (longAxis ? 7 : 6)) {
        row += 'a';
      } else if (ax === ay && ax >= 4 && ax <= (longAxis ? 4 : 5)) {
        row += 'a';
      } else {
        row += '.';
      }
    }
    rows.push(row);
  }
  return rows;
}
export const ICONS = {
  note: {
    rows: [
      '.....aa..',
      '.....aba.',
      '.....a.ba',
      '.....a..b',
      '.....a...',
      '..aaaa...',
      '.aaaaa...',
      '.aaaa....',
      '..aa.....',
    ],
    colors: { a: '#b48cf0', b: '#8a64d6' },
  },
  water: {
    rows: [
      '....a....',
      '....a....',
      '...aaa...',
      '..aaaaa..',
      '..awaaa..',
      '.aawaaab.',
      '.aaaaaab.',
      '..aaabb..',
      '...bbb...',
    ],
    colors: { a: '#7cc4ff', b: '#4a95e0', w: '#e6f5ff' },
  },
  sun: {
    rows: [
      '....a....',
      '.a.....a.',
      '...ccc...',
      '..ccccc..',
      'a.ccwcc.a',
      '..ccccc..',
      '...ccc...',
      '.a.....a.',
      '....a....',
    ],
    colors: { a: '#ffb347', c: '#ffd84d', w: '#fff6c2' },
  },
  sprout: {
    rows: [
      '.LL...LL.',
      'LLLl.lLLL',
      '.lllglll.',
      '....g....',
      '....g....',
      '.kkkkkkk.',
      'kKKKKKKKk',
      '.kkkkkkk.',
    ],
    colors: { L: '#b4e89e', l: '#74c96f', g: '#5fb35e', k: '#a0704a', K: '#7a5236' },
  },
  book: {
    rows: [
      'aaaa.aaaa',
      'awwaaawwa',
      'awwaaawwa',
      'awwaaawwa',
      'awwaaawwa',
      'awwaaawwa',
      'aaaaaaaaa',
      '....a....',
    ],
    colors: { a: '#e8956b', w: '#fff3e0' },
  },
  gift: {
    rows: [
      '..a...a..',
      '...a.a...',
      'bbbbabbbb',
      'bbbbabbbb',
      '.cccaccc.',
      '.cccaccc.',
      '.cccaccc.',
      '.cccaccc.',
    ],
    colors: { a: '#ff7b9c', b: '#ffd0dc', c: '#fff4f6' },
  },
  can: {
    rows: [
      '...aaa........',
      '..a...a.......',
      '.bbbbbbb......',
      '.bwbbbbbb..c..',
      '.bwbbbbbbbcc..',
      '.bbbbbbbbc....',
      '.bbbbbbb......',
      '..bbbbb.......',
    ],
    colors: { a: '#7a8fa6', b: '#9fc3e6', w: '#e6f2ff', c: '#7a8fa6' },
  },
  // 해: 8방향 햇살이 항상 보이고, 두 프레임이 번갈아 가로·세로 / 대각선 햇살 길이를 바꿔 반짝인다
  sunRaysA: { rows: sunFrame(true), colors: SUN_COLORS },
  sunRaysB: { rows: sunFrame(false), colors: SUN_COLORS },
  // 물방울 · 햇살 파티클 (작은 도트)
  drop: {
    rows: ['.a.', 'aaa', 'awa', '.a.'],
    colors: { a: '#7cc4ff', w: '#e6f5ff' },
  },
  fertilizer: {
    rows: [
      '..kkkkk..',
      '.kKKKKKk.',
      '.kwwwwwk.',
      '.kwgggwk.',
      '.kwgLgwk.',
      '.kwgggwk.',
      '.kwwwwwk.',
      '.kKKKKKk.',
      '..kkkkk..',
    ],
    colors: { k: '#a0704a', K: '#7a5236', w: '#f5e6c8', g: '#5fb35e', L: '#b4e89e' },
  },
  grain: {
    rows: ['ab', 'ba'],
    colors: { a: '#7a5236', b: '#a6d96a' },
  },
  // 전설 꽃의 반짝임 (빛이라서 외곽선 없이)
  shine: {
    rows: [
      '....w....',
      '....w....',
      '...wcw...',
      '..wcccw..',
      'wwccWccww',
      '..wcccw..',
      '...wcw...',
      '....w....',
      '....w....',
    ],
    colors: { w: '#cfe8ff', c: '#ffffff', W: '#ffffff' },
    noOutline: true,
  },
  shineSmall: {
    rows: ['..w..', '..c..', 'wcWcw', '..c..', '..w..'],
    colors: { w: '#fff1b8', c: '#ffffff', W: '#ffffff' },
    noOutline: true,
  },
  sparkle: {
    rows: ['.a.', 'awa', '.a.'],
    colors: { a: '#ffd84d', w: '#fff6c2' },
  },
};

export default function PixelIcon({ name, scale = 2, className, style }) {
  const canvasRef = useRef(null);
  const icon = ICONS[name];
  const w = icon.rows[0].length + 2;
  const h = icon.rows.length + 2;

  const grid = useMemo(() => {
    const g = createGrid(w, h);
    stamp(g, icon.rows, 1, 1, icon.colors);
    return icon.noOutline ? g : outline(g);
  }, [icon, w, h]);

  useLayoutEffect(() => {
    drawGrid(canvasRef.current.getContext('2d'), grid, scale);
  }, [grid, scale]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={w * scale}
      height={h * scale}
      style={{ width: w * scale, height: h * scale, imageRendering: 'pixelated', ...style }}
    />
  );
}
