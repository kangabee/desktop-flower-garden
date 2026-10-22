// 선물 카드: 캔버스 렌더링 · 공유 링크 인코딩 · 단독 HTML 카드 파일
import { drawGrid, mix } from './pixel.js';
import { SPRITE_H, SPRITE_W, buildPlantGrid } from './sprites.js';
import { FLOWER_BY_ID, NATIONS, RARITY } from '../data/flowers.js';
import { flagGrid } from '../data/flags.js';
import { seedCheck } from './ids.js';

export const CARD_W = 360;
export const CARD_H = 540;
export const LIMITS = { to: 16, from: 16, message: 120 };

const INK = '#2b1b22';
const PAPER = '#fff7ec';
const FONT = 'Galmuri11';

/** 공백 우선 줄바꿈, 너무 긴 단어(한글 연속 등)는 글자 단위로 자른다 */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (ctx.measureText(line + word).width <= maxWidth) {
        line += word;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = '';
      for (const ch of word.trimStart()) {
        if (ctx.measureText(line + ch).width > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += ch;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function pixelFrame(ctx, x, y, w, h, color, t) {
  ctx.fillStyle = color;
  ctx.fillRect(x + t, y, w - 2 * t, t);
  ctx.fillRect(x + t, y + h - t, w - 2 * t, t);
  ctx.fillRect(x, y + t, t, h - 2 * t);
  ctx.fillRect(x + w - t, y + t, t, h - 2 * t);
}

export function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * data: { flowerId, to, from, message, date } (씨앗 정보는 그림에 넣지 않는다)
 * 캔버스는 (CARD_W × CARD_H) × scale 크기로 그려진다.
 */
export async function renderGiftCard(canvas, data, scale = 2) {
  const flower = FLOWER_BY_ID[data.flowerId];
  const rarity = RARITY[flower.rarity];
  await Promise.all([document.fonts.load(`400 14px ${FONT}`), document.fonts.load(`700 14px ${FONT}`)]).catch(() => {});

  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;

  // 배경 + 도트 테두리
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  pixelFrame(ctx, 0, 0, CARD_W, CARD_H, INK, 4);
  pixelFrame(ctx, 8, 8, CARD_W - 16, CARD_H - 16, mix(flower.colors.a, '#ffffff', 0.2), 4);

  // 받는 사람
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText(`To. ${data.to || '소중한 당신'}`, 28, 46);

  // 꽃 뒤 도트 원형 배경
  const cx = CARD_W / 2;
  const cy = 160;
  const tint = mix(flower.colors.a, PAPER, 0.7);
  for (let y = -92; y <= 92; y += 6) {
    for (let x = -92; x <= 92; x += 6) {
      if (x * x + y * y <= 92 * 92) {
        ctx.fillStyle = (x / 6 + y / 6) % 2 === 0 ? tint : mix(tint, PAPER, 0.4);
        ctx.fillRect(cx + x - 3, cy + y - 3, 6, 6);
      }
    }
  }

  // 꽃 스프라이트 (5배)
  const s = 5;
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE_W * s;
  sprite.height = SPRITE_H * s;
  drawGrid(sprite.getContext('2d'), buildPlantGrid(flower, 1), s);
  ctx.drawImage(sprite, Math.round(cx - (SPRITE_W * s) / 2), 52);

  // 꽃 이름 · 희귀도 · 꽃말
  ctx.textAlign = 'center';
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = INK;
  if (flower.nation) {
    // 나라 대표 꽃: 이름 왼쪽에 도트 국기 (이름+국기를 한 덩어리로 가운데 정렬)
    const flag = flagGrid(flower.nation);
    const fs = 2;
    const fw = flag[0].length * fs;
    const nameW = ctx.measureText(flower.name).width;
    const left = cx - (fw + 8 + nameW) / 2;
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = fw;
    flagCanvas.height = flag.length * fs;
    drawGrid(flagCanvas.getContext('2d'), flag, fs);
    ctx.drawImage(flagCanvas, Math.round(left), 280);
    ctx.textAlign = 'left';
    ctx.fillText(flower.name, left + fw + 8, 298);
    ctx.textAlign = 'center';
  } else {
    ctx.fillText(flower.name, cx, 298);
  }
  ctx.font = `400 12px ${FONT}`;
  ctx.fillStyle = rarity.color;
  ctx.fillText(
    `${'★'.repeat(rarity.stars)} ${rarity.label}${flower.nation ? ` · ${NATIONS[flower.nation]}의 꽃` : ''}`,
    cx,
    318,
  );
  ctx.fillStyle = '#b04d6f';
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText(`꽃말 「${flower.language}」`, cx, 340);

  // 편지 영역
  const box = { x: 28, y: 356, w: CARD_W - 56, h: 120 };
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = mix(INK, '#ffffff', 0.75);
  for (let x = box.x; x < box.x + box.w; x += 8) {
    ctx.fillRect(x, box.y, 4, 2);
    ctx.fillRect(x, box.y + box.h - 2, 4, 2);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `400 14px ${FONT}`;
  wrapText(ctx, data.message || flower.message, box.w - 24)
    .slice(0, 5)
    .forEach((line, i) => ctx.fillText(line, box.x + 12, box.y + 28 + i * 21));

  // 보내는 사람 · 날짜
  ctx.textAlign = 'right';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(`From. ${data.from || '익명의 정원사'}`, CARD_W - 28, 504);
  ctx.textAlign = 'left';
  ctx.font = `400 11px ${FONT}`;
  ctx.fillStyle = '#8a6f6f';
  ctx.fillText(`${formatDate(data.date)} · Desktop Flower Garden`, 28, 522);

  return canvas;
}

// ── 공유 링크 (#해시에 카드 내용을 담는다 → 서버에 아무것도 저장하지 않음) ──
// 씨앗 정보(seedId·gardenId)도 링크 안에 숨겨 두고, 받는 사람에게는 "씨앗 받기" 버튼만 보인다.
export function encodeCard({ flowerId, to, from, message, date, seedId, gardenId }) {
  const payload = { v: 2, f: flowerId, t: to, s: from, m: message, d: date };
  if (seedId) Object.assign(payload, { k: seedId, g: gardenId, x: seedCheck(flowerId, seedId, gardenId, from) });
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCard(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const { f, t, s, m, d, k, g, x } = JSON.parse(json);
    if (!FLOWER_BY_ID[f]) return null;
    // 링크를 고쳐 꽃을 바꾸면 검증값이 안 맞아 씨앗은 받을 수 없다 (카드는 그대로 보임)
    const seedOk = Boolean(k) && x === seedCheck(f, k, g, s);
    const clip = (v, n) => String(v ?? '').slice(0, n);
    return {
      flowerId: f,
      to: clip(t, LIMITS.to),
      from: clip(s, LIMITS.from),
      message: clip(m, LIMITS.message),
      date: Number(d) || Date.now(),
      seedId: seedOk ? String(k) : null,
      gardenId: seedOk ? String(g ?? '') : null,
    };
  } catch {
    return null;
  }
}

/**
 * 공유 페이지(card.html)가 배포된 주소. .env 의 VITE_SHARE_BASE_URL 로 지정.
 * 개발 중에는 로컬 dev 서버의 card.html 을 쓴다. 둘 다 없으면 null → 링크 기능 비활성.
 */
export function shareBaseUrl() {
  if (import.meta.env.VITE_SHARE_BASE_URL) return import.meta.env.VITE_SHARE_BASE_URL;
  if (import.meta.env.DEV && location.origin.startsWith('http')) return `${location.origin}/card.html`;
  return null;
}

export function buildShareUrl(data) {
  const base = shareBaseUrl();
  return base ? `${base}#${encodeCard(data)}` : null;
}
