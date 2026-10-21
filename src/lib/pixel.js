// 아주 작은 픽셀아트 엔진
// 스프라이트 = 문자열 배열(한 글자 = 한 픽셀, '.' = 투명) + 글자→색 팔레트.
// 여러 조각을 그리드에 찍은 뒤 자동 외곽선을 둘러 포켓몬 도트 같은 느낌을 낸다.

export function createGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(null));
}

/** rows 패턴을 (x0, y0)에 찍는다. 팔레트에 없는 글자와 '.'은 건너뜀 */
export function stamp(grid, rows, x0, y0, colors) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = colors[ch];
      if (!color) return;
      const gy = y0 + y;
      const gx = x0 + x;
      if (gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length) grid[gy][gx] = color;
    });
  });
}

export const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** a와 b를 t 비율로 섞은 색 */
export function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const OUTLINE_INK = '#2b1b22';

/** 투명 칸 중 상하좌우에 색이 닿는 칸을 "이웃 색을 어둡게 한" 외곽선으로 채운다 */
export function outline(grid, strength = 0.68) {
  const h = grid.length;
  const w = grid[0].length;
  const out = grid.map((row) => row.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) continue;
      const neighbor =
        (y > 0 && grid[y - 1][x]) ||
        (y < h - 1 && grid[y + 1][x]) ||
        (x > 0 && grid[y][x - 1]) ||
        (x < w - 1 && grid[y][x + 1]);
      if (neighbor) out[y][x] = mix(neighbor, OUTLINE_INK, strength);
    }
  }
  return out;
}

/** 아래쪽 rows 줄은 고정, 그 위는 dx 만큼 밀어서 "살랑" 흔들림을 만든다 */
export function shiftAbove(grid, rowLimit, dx) {
  if (!dx) return grid;
  const w = grid[0].length;
  return grid.map((row, y) => {
    if (y >= rowLimit) return row;
    const next = Array(w).fill(null);
    row.forEach((c, x) => {
      if (c && x + dx >= 0 && x + dx < w) next[x + dx] = c;
    });
    return next;
  });
}

export function drawGrid(ctx, grid, scale) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  grid.forEach((row, y) =>
    row.forEach((color, x) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }),
  );
}

/**
 * 방사형 꽃머리 생성기 → 문자열 패턴
 *  a 꽃잎 / b 꽃잎 그늘(오른쪽 아래) / c 꽃술 / d 꽃술 그늘 / w 하이라이트
 */
export function radialHead({ size, petals, radius, core, base = 0.4, sharp = 1, twist = 0 }) {
  const c = (size - 1) / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      const theta = Math.atan2(dy, dx) + twist;
      const f = Math.abs(Math.cos((petals * theta) / 2)) ** sharp;
      const edge = radius * (base + (1 - base) * f);
      if (r <= core + 0.25) {
        if (core >= 1.5 && dx + dy <= -core) row += 'w';
        else row += dx + dy > 0.5 ? 'd' : 'c';
      } else if (r <= edge) {
        row += r > edge - 1.2 && dx + dy > 0 ? 'b' : 'a';
      } else {
        row += '.';
      }
    }
    rows.push(row);
  }
  return rows;
}
