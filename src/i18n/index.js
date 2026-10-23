// 다국어: 한국어 · English · 日本語 · 简体中文
// 언어 결정 순서: 사용자가 메뉴에서 고른 언어 → 컴퓨터(시스템) 언어 → 브라우저 언어 → 영어
// (garden.language 는 사용자의 선택, garden.systemLanguage 는 메인 프로세스가 알려준 시스템 언어)
import { useSyncExternalStore } from 'react';
import { getGarden, subscribeGarden } from '../lib/garden.js';
import { MESSAGES } from './messages.js';
import { FLOWER_TEXT } from './flowers.js';

export const LANGUAGES = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '简体中文' },
];

/** 'ko-KR', 'zh-Hans-CN' 같은 언어 태그 → 지원 언어 id (모르면 null) */
export function normalizeLang(tag) {
  const t = String(tag ?? '').toLowerCase();
  for (const { id } of LANGUAGES) if (t === id || t.startsWith(`${id}-`) || t.startsWith(`${id}_`)) return id;
  return null;
}

export function detectBrowserLang() {
  const list = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of list) {
    const id = normalizeLang(tag);
    if (id) return id;
  }
  return 'en';
}

export function currentLang() {
  const g = getGarden();
  return normalizeLang(g?.language) ?? normalizeLang(g?.systemLanguage) ?? detectBrowserLang();
}

/** 언어가 바뀌면 다시 그려지게 하는 훅 */
export function useLang() {
  const lang = useSyncExternalStore(subscribeGarden, currentLang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

/** 번역: 문자열 · 배열 · (vars) => 문자열 함수 모두 지원. 없는 키는 한국어로 */
export function t(key, vars = {}) {
  const lang = currentLang();
  const value = MESSAGES[lang]?.[key] ?? MESSAGES.ko[key];
  if (value == null) return key;
  return typeof value === 'function' ? value(vars) : value;
}

/** 꽃 이름·꽃말·메시지·원산지 (한국어는 flowers.js 원문) */
export function flowerText(flower, field) {
  const lang = currentLang();
  if (lang === 'ko') return flower[field];
  return FLOWER_TEXT[lang]?.[flower.id]?.[field] ?? flower[field];
}

export const regionName = (id) => t(`region.${id}`);
export const nationName = (code) => t(`nation.${code}`);

/** 남은 시간 (예: 3시간 20분) — 뒤에 붙는 "남음"은 호출하는 쪽에서 */
export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.ceil(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (ms < 60000) return t('time.seconds', { n: Math.max(1, Math.ceil(ms / 1000)) });
  const parts = [];
  if (d) parts.push(t('time.days', { n: d }));
  if (h) parts.push(t('time.hours', { n: h }));
  if (m && !d) parts.push(t('time.minutes', { n: m }));
  return parts.join(t('time.join'));
}

export function formatRemaining(ms) {
  if (ms <= 0) return t('time.bloomed');
  return t('time.left', { time: formatDuration(ms) });
}

/** 화면·카드에 쓸 글꼴 순서 (중국어는 중국어 도트 글꼴을 먼저) */
export function fontStack(lang = currentLang()) {
  const pixel = lang === 'zh'
    ? "'Fusion Pixel SC', 'Galmuri11', 'Galmuri11 Fallback'"
    : "'Galmuri11', 'Galmuri11 Fallback', 'Fusion Pixel SC'";
  return `${pixel}, 'Apple SD Gothic Neo', 'Hiragino Sans', 'PingFang SC', 'Malgun Gothic', 'Microsoft YaHei', sans-serif`;
}
