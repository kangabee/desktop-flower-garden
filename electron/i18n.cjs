// 메인 프로세스(우클릭·트레이 메뉴, 창 제목) 문구. 화면 쪽 번역은 src/i18n 에 있다.
const LANG_IDS = ['ko', 'en', 'ja', 'zh'];
const LANG_NAMES = { ko: '한국어', en: 'English', ja: '日本語', zh: '简体中文' };

const MENU = {
  ko: {
    openCollection: '📖 꽃 도감 열기',
    newSeed: '🌱 새 씨앗 심기',
    alwaysOnTop: '항상 위에 표시',
    resetPosition: '화면 우측 하단으로 되돌리기',
    launchAtLogin: '로그인 시 자동으로 정원 열기',
    language: '🌐 언어',
    languageAuto: '자동 (컴퓨터 언어)',
    quit: '정원 닫기',
    collectionTitle: '꽃 도감 · Desktop Flower Garden',
  },
  en: {
    openCollection: '📖 Open collection',
    newSeed: '🌱 Plant a new seed',
    alwaysOnTop: 'Always on top',
    resetPosition: 'Move back to bottom-right',
    launchAtLogin: 'Open garden at login',
    language: '🌐 Language',
    languageAuto: 'Automatic (system language)',
    quit: 'Close garden',
    collectionTitle: 'Flower Collection · Desktop Flower Garden',
  },
  ja: {
    openCollection: '📖 花図鑑を開く',
    newSeed: '🌱 新しい種を植える',
    alwaysOnTop: '常に手前に表示',
    resetPosition: '画面の右下に戻す',
    launchAtLogin: 'ログイン時に庭を開く',
    language: '🌐 言語',
    languageAuto: '自動（コンピューターの言語）',
    quit: '庭を閉じる',
    collectionTitle: '花図鑑 · Desktop Flower Garden',
  },
  zh: {
    openCollection: '📖 打开花卉图鉴',
    newSeed: '🌱 种下新种子',
    alwaysOnTop: '始终显示在最前',
    resetPosition: '移回屏幕右下角',
    launchAtLogin: '登录时自动打开花园',
    language: '🌐 语言',
    languageAuto: '自动（跟随系统语言）',
    quit: '关闭花园',
    collectionTitle: '花卉图鉴 · Desktop Flower Garden',
  },
};

/** 'ko-KR', 'zh-Hans-CN' 같은 언어 태그 → 지원 언어 id (모르면 null) */
function normalizeLang(tag) {
  const t = String(tag ?? '').toLowerCase();
  return LANG_IDS.find((id) => t === id || t.startsWith(`${id}-`) || t.startsWith(`${id}_`)) ?? null;
}

/** 컴퓨터 설정 언어 중 지원하는 첫 번째 (없으면 영어) */
function detectSystemLanguage(app) {
  const list = [...(app.getPreferredSystemLanguages?.() ?? []), app.getLocale()];
  for (const tag of list) {
    const id = normalizeLang(tag);
    if (id) return id;
  }
  return 'en';
}

module.exports = { LANG_IDS, LANG_NAMES, MENU, normalizeLang, detectSystemLanguage };
