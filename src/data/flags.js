// 나라 대표 꽃 옆에 붙는 도트 국기 (15×10).
// 이모지 국기는 Windows 에서 글자(KR 등)로만 보여서, 모든 OS에서 똑같이 보이도록 직접 그린다.
// 세밀한 문양은 도트 크기에 맞게 단순화했다.
import { createGrid, outline, stamp } from '../lib/pixel.js';

const C = {
  W: '#ffffff',
  r: '#e0303c',
  b: '#2b4fae',
  k: '#2b2b2b',
  y: '#ffcd2e',
  g: '#1f8a4c',
  n: '#8a5a2b',
};

export const FLAGS = {
  JP: [
    'WWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWW',
    'WWWWWWrrrWWWWWW',
    'WWWWWrrrrrWWWWW',
    'WWWWWrrrrrWWWWW',
    'WWWWWrrrrrWWWWW',
    'WWWWWrrrrrWWWWW',
    'WWWWWWrrrWWWWWW',
    'WWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWW',
  ],
  KR: [
    'WWWWWWWWWWWWWWW',
    'WkkWWWWWWWWWkkW',
    'WkWWWWWWWWWWWkW',
    'WWWWWWrrrWWWWWW',
    'WWWWWrrrrbWWWWW',
    'WWWWWrbbbbWWWWW',
    'WWWWWWbbbWWWWWW',
    'WkWWWWWWWWWWWkW',
    'WkkWWWWWWWWWkkW',
    'WWWWWWWWWWWWWWW',
  ],
  CN: [
    'rrrrrrrrrrrrrrr',
    'rryrryrrrrrrrrr',
    'ryyyrrryrrrrrrr',
    'ryryrrryrrrrrrr',
    'rrrrryrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
  ],
  TW: [
    'bbbbbbbrrrrrrrr',
    'bbbWbbbrrrrrrrr',
    'bbWWWbbrrrrrrrr',
    'bbbWbbbrrrrrrrr',
    'bbbbbbbrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrr',
  ],
  MY: [
    'bbbbbbbrrrrrrrr',
    'byybbbbWWWWWWWW',
    'bybbyybrrrrrrrr',
    'byybbbbWWWWWWWW',
    'bbbbbbbrrrrrrrr',
    'WWWWWWWWWWWWWWW',
    'rrrrrrrrrrrrrrr',
    'WWWWWWWWWWWWWWW',
    'rrrrrrrrrrrrrrr',
    'WWWWWWWWWWWWWWW',
  ],
  FR: Array(10).fill('bbbbbWWWWWrrrrr'),
  DE: [...Array(3).fill('kkkkkkkkkkkkkkk'), ...Array(4).fill('rrrrrrrrrrrrrrr'), ...Array(3).fill('yyyyyyyyyyyyyyy')],
  ES: [...Array(2).fill('rrrrrrrrrrrrrrr'), ...Array(6).fill('yyyyyyyyyyyyyyy'), ...Array(2).fill('rrrrrrrrrrrrrrr')],
  MX: [
    'gggggWWWWWrrrrr',
    'gggggWWWWWrrrrr',
    'gggggWWWWWrrrrr',
    'gggggWWWWWrrrrr',
    'gggggWWnWWrrrrr',
    'gggggWnnnWrrrrr',
    'gggggWWgWWrrrrr',
    'gggggWWWWWrrrrr',
    'gggggWWWWWrrrrr',
    'gggggWWWWWrrrrr',
  ],
  AU: [
    'bbbrbbbbbbbbbbb',
    'bWWrWWbbbbbWbbb',
    'rrrrrrrbbbbbbbb',
    'bWWrWWbbbbbbbWb',
    'bbbrbbbbbbWbbbb',
    'bbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbWb',
    'bbbWbbbbbbbWbbb',
    'bbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbb',
  ],
  ZA: [
    'ggWrrrrrrrrrrrr',
    'yggWWrrrrrrrrrr',
    'kyggWWWWWWWWWWW',
    'kkygggggggggggg',
    'kkkyggggggggggg',
    'kkkyggggggggggg',
    'kkygggggggggggg',
    'kyggWWWWWWWWWWW',
    'yggWWbbbbbbbbbb',
    'ggWbbbbbbbbbbbb',
  ],
};


/** 테두리가 둘러진 국기 도트 그리드 (위젯·도감·선물 카드 공용) */
export function flagGrid(code) {
  const rows = FLAGS[code];
  const g = createGrid(rows[0].length + 2, rows.length + 2);
  stamp(g, rows, 1, 1, C);
  return outline(g, 0.75);
}
