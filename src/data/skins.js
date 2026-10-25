// 화분 꾸미기: 도감을 모으면 열리는 화분 색 (화분 도트의 R r h p q 글자 색만 바꾼다)
//   region: 그 대륙 꽃을 모두 모으면 열림 / legendary: 전설 꽃을 n종 모으면 열림
import { FLOWERS } from './flowers.js';

export const SKINS = [
  {
    id: 'classic',
    colors: { R: '#f4b48c', r: '#e8956b', h: '#fbd5ba', p: '#d97f57', q: '#b8653f' },
  },
  {
    id: 'celadon', // 청자
    region: 'asia',
    colors: { R: '#c9e8dc', r: '#a6d6c4', h: '#ebf8f2', p: '#86c1ac', q: '#5f9f8c' },
  },
  {
    id: 'delft', // 하얀 바탕 푸른 도자기
    region: 'europe',
    colors: { R: '#f4f7ff', r: '#dfe7fb', h: '#ffffff', p: '#9fb6ec', q: '#4a6fc8' },
  },
  {
    id: 'talavera', // 멕시코 탈라베라 타일
    region: 'americas',
    colors: { R: '#ffe08a', r: '#f6c94c', h: '#fff3c4', p: '#3a68d8', q: '#2a4fb0' },
  },
  {
    id: 'coral',
    region: 'oceania',
    colors: { R: '#ffd0c2', r: '#ffb09a', h: '#ffe9e1', p: '#ff8f78', q: '#e06a52' },
  },
  {
    id: 'basket', // 짚 바구니
    region: 'africa',
    colors: { R: '#ecc07c', r: '#d9a254', h: '#f8e0b4', p: '#bd8138', q: '#8f5a1e' },
  },
  {
    id: 'gold',
    legendary: 3,
    colors: { R: '#ffe27a', r: '#f5c542', h: '#fff6c2', p: '#e0a82a', q: '#b07d14' },
  },
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

/** 열림 조건 진행도 → { unlocked, have, need } */
export function skinProgress(skin, discovered) {
  if (skin.region) {
    const list = FLOWERS.filter((f) => f.region === skin.region);
    const have = list.filter((f) => discovered.has(f.id)).length;
    return { unlocked: have >= list.length, have, need: list.length };
  }
  if (skin.legendary) {
    const have = FLOWERS.filter((f) => f.rarity === 'legendary' && discovered.has(f.id)).length;
    return { unlocked: have >= skin.legendary, have: Math.min(have, skin.legendary), need: skin.legendary };
  }
  return { unlocked: true, have: 0, need: 0 };
}
