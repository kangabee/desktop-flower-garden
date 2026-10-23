// Electron 메인 프로세스
// 창 테두리·배경 없이 "화분 픽셀만" 바탕화면/다른 앱(엑셀 등) 위에 떠 있게 만든다.
//  - 투명 + 항상 위(screen-saver 레벨) + 모든 데스크탑/전체화면 위에 표시
//  - 투명한 부분은 클릭이 아래 앱으로 그대로 통과 (setIgnoreMouseEvents + forward)
//  - 렌더러가 "커서가 화분 픽셀 위에 있다"고 알려줄 때만 마우스를 받는다
//  - 설정은 우클릭 메뉴 / 트레이 메뉴로 (창 안에 UI 패널 없음)
// 도감(컬렉션)·선물 카드는 별도의 일반 창에서 연다.
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Menu,
  Tray,
  nativeImage,
  clipboard,
  shell,
} = require('electron');
const path = require('node:path');
const { GardenStore } = require('./store.cjs');
const { LANG_IDS, LANG_NAMES, MENU, normalizeLang, detectSystemLanguage } = require('./i18n.cjs');

const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';

// 말풍선·햇빛 연출이 창 가장자리에서 잘리지 않도록 여유 있게 (투명한 부분은 클릭이 통과하므로 무해)
const WIDGET = { width: 280, height: 300, margin: 16 };

let win = null;
let collectionWin = null;
let tray = null;
let store = null;
let pinned = true;
// 렌더러가 보내주는 현재 상태 (메뉴 구성용)
let plantState = { bloomed: false };
// 선물 링크의 "씨앗 받기"로 들어온 씨앗 (위젯이 준비되면 전달)
const pendingSeeds = [];
let widgetReady = false;

// 선물 카드 페이지의 "씨앗 받기" 버튼이 여는 앱 링크: flowergarden://seed?d=<카드 데이터>
const PROTOCOL = 'flowergarden';
if (process.defaultApp && process.argv.length >= 2) {
  // 개발 실행(electron .)일 때는 실행 파일 + 프로젝트 경로로 등록
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function handleSeedLink(url) {
  const match = /^flowergarden:\/\/seed\/?\?d=([A-Za-z0-9_-]{1,4000})/.exec(String(url));
  if (!match) return;
  if (widgetReady) send({ type: 'receive-seed', payload: match[1] });
  else pendingSeeds.push(match[1]);
}
const seedLinkIn = (argv) => argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));

// macOS: 링크로 앱이 열리거나, 이미 실행 중일 때
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleSeedLink(url);
});
// Windows: 처음 실행될 때는 명령줄 인자로 들어온다
if (seedLinkIn(process.argv)) handleSeedLink(seedLinkIn(process.argv));

// 개발 실행(npm run dev)과 설치된 앱이 같은 정원 데이터를 쓰도록 저장 폴더 이름을 고정
app.setPath('userData', path.join(app.getPath('appData'), 'desktop-flower-garden'));

// 아이콘을 두 번 눌러도 화분이 두 개 생기지 않게: 이미 실행 중이면 그쪽에서 도감을 연다
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', (_event, argv) => {
  // Windows: 이미 실행 중일 때 링크를 누르면 두 번째 실행의 인자로 들어온다
  const link = seedLinkIn(argv);
  if (link) handleSeedLink(link);
  else openCollection();
});

function loadPage(target, hash = '') {
  if (isDev) target.loadURL(`${DEV_URL}/${hash ? `#${hash}` : ''}`);
  else target.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash });
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WIDGET.width - WIDGET.margin,
    y: workArea.y + workArea.height - WIDGET.height,
  };
}

/** 저장된 위치가 현재 연결된 모니터 안에 있을 때만 사용 (모니터를 뺐을 때 대비) */
function initialPosition() {
  let saved = store.get().position;
  if (saved) {
    // 창 크기가 바뀌었어도 화분(창 아래 가운데)이 같은 자리에 오도록 보정. 예전 저장분은 200×240
    const w = saved.w ?? 200;
    const h = saved.h ?? 240;
    saved = { x: saved.x + Math.round((w - WIDGET.width) / 2), y: saved.y + (h - WIDGET.height) };
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      saved.x + WIDGET.width / 2 >= a.x &&
      saved.x + WIDGET.width / 2 <= a.x + a.width &&
      saved.y + WIDGET.height / 2 >= a.y &&
      saved.y <= a.y + a.height,
    );
    if (visible) return saved;
  }
  return defaultPosition();
}

function createWidgetWindow() {
  const { x, y } = initialPosition();

  win = new BrowserWindow({
    width: WIDGET.width,
    height: WIDGET.height,
    x,
    y,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // 클릭해도 엑셀 등 작업 중인 앱의 포커스를 빼앗지 않는다
    focusable: false,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  applyPinned();
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  loadPage(win);

  win.on('closed', () => {
    win = null;
  });
}

/** 도감 창 (route 예: 'collection', 'collection/gift/<uid>') */
function openCollection(route = 'collection') {
  if (collectionWin) {
    collectionWin.webContents.send('collection:navigate', route);
    if (collectionWin.isMinimized()) collectionWin.restore();
    collectionWin.show();
    collectionWin.focus();
    return;
  }

  collectionWin = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 600,
    minHeight: 480,
    title: m('collectionTitle'),
    backgroundColor: '#fdf6ec',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  loadPage(collectionWin, route);
  collectionWin.on('closed', () => {
    collectionWin = null;
  });
}

function applyPinned() {
  if (!win) return;
  // 'screen-saver' 레벨: 최대화된 엑셀/브라우저 위에도 표시
  win.setAlwaysOnTop(pinned, 'screen-saver');
}

function send(command) {
  win?.webContents.send('widget:command', command);
}

function broadcast(state, except) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.webContents !== except) w.webContents.send('garden:changed', state);
  }
}

/** 사용자가 고른 언어 → 없으면 컴퓨터 언어 */
function menuLang() {
  const state = store?.get() ?? {};
  return normalizeLang(state.language) ?? normalizeLang(state.systemLanguage) ?? 'en';
}
const m = (key) => MENU[menuLang()][key];

/** 언어 바꾸기 (null = 자동) → 모든 창과 메뉴에 반영 */
function setLanguage(language) {
  broadcast(store.merge({ language }));
  refreshTray();
  collectionWin?.setTitle(m('collectionTitle'));
}

function buildMenu() {
  const chosen = normalizeLang(store?.get().language);
  return Menu.buildFromTemplate([
    { label: m('openCollection'), click: () => openCollection() },
    {
      label: m('newSeed'),
      enabled: plantState.bloomed,
      click: () => send({ type: 'new-seed' }),
    },
    { type: 'separator' },
    {
      label: m('alwaysOnTop'),
      type: 'checkbox',
      checked: pinned,
      click: (item) => {
        pinned = item.checked;
        applyPinned();
        refreshTray();
      },
    },
    {
      label: m('resetPosition'),
      click: () => {
        const { x, y } = defaultPosition();
        win?.setPosition(x, y);
        broadcast(store.merge({ position: null }));
      },
    },
    {
      label: m('launchAtLogin'),
      type: 'checkbox',
      // 개발 모드(npm run dev)에서는 Electron 자체가 등록되므로 설치된 앱에서만 허용
      enabled: app.isPackaged,
      checked: app.isPackaged && app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        refreshTray();
      },
    },
    {
      label: m('language'),
      submenu: [
        { label: m('languageAuto'), type: 'radio', checked: !chosen, click: () => setLanguage(null) },
        { type: 'separator' },
        ...LANG_IDS.map((id) => ({
          label: LANG_NAMES[id],
          type: 'radio',
          checked: chosen === id,
          click: () => setLanguage(id),
        })),
      ],
    },
    { type: 'separator' },
    { label: m('quit'), click: () => app.quit() },
  ]);
}

// 16×16 픽셀 꽃 트레이 아이콘을 코드로 직접 그린다 (이미지 파일 불필요)
function createTrayIcon() {
  const art = [
    '................',
    '......aaaa......',
    '....aaAAAAaa....',
    '...aAAAAAAAAa...',
    '...aAAAccAAAa...',
    '...aAAccccAAa...',
    '...aAAAccAAAa...',
    '....aaAAAAaa....',
    '......aaaa......',
    '.......gg.......',
    '....ll.gg.......',
    '.....llgg.ll....',
    '.......ggll.....',
    '.......gg.......',
    '.......gg.......',
    '................',
  ];
  const colors = {
    a: [0xb8, 0x4e, 0x6e],
    A: [0xf7, 0x9c, 0xb8],
    c: [0xff, 0xd8, 0x4d],
    g: [0x4e, 0x9a, 0x4f],
    l: [0x7f, 0xd0, 0x7a],
  };
  const buf = Buffer.alloc(16 * 16 * 4);
  art.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const rgb = colors[ch];
      if (!rgb) return;
      const i = (y * 16 + x) * 4;
      // createFromBitmap 은 BGRA 순서
      buf[i] = rgb[2];
      buf[i + 1] = rgb[1];
      buf[i + 2] = rgb[0];
      buf[i + 3] = 0xff;
    }),
  );
  return nativeImage.createFromBitmap(buf, { width: 16, height: 16 });
}

function refreshTray() {
  tray?.setContextMenu(buildMenu());
}

// ── 위젯 창 제어 ──
ipcMain.on('widget:set-ignore-mouse', (_event, ignore) => {
  win?.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});
ipcMain.handle('widget:get-position', () => win?.getPosition() ?? [0, 0]);
ipcMain.on('widget:set-position', (_event, x, y) => {
  if (!win) return;
  // 화면 밖으로 완전히 사라지지 않게, 해당 디스플레이 작업영역 안으로 제한
  const { workArea } = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
  const [w, h] = win.getSize();
  const nx = Math.min(Math.max(Math.round(x), workArea.x - w / 2), workArea.x + workArea.width - w / 2);
  const ny = Math.min(Math.max(Math.round(y), workArea.y - h / 2), workArea.y + workArea.height - h);
  win.setPosition(Math.round(nx), Math.round(ny));
});
ipcMain.on('widget:state', (_event, state) => {
  if (!widgetReady) {
    widgetReady = true;
    for (const payload of pendingSeeds.splice(0)) send({ type: 'receive-seed', payload });
  }
  plantState = { ...plantState, ...state };
  refreshTray();
});
ipcMain.on('widget:show-menu', () => {
  if (win) buildMenu().popup({ window: win });
});

// ── 저장소 ──
ipcMain.handle('garden:get', () => store.get());
ipcMain.on('garden:merge', (event, patch) => {
  broadcast(store.merge(patch), event.sender);
});
ipcMain.on('garden:open-collection', (_event, route) => openCollection(route));

// ── 선물 링크 ──
ipcMain.handle('clipboard:write-text', (_event, text) => {
  clipboard.writeText(String(text));
  return true;
});
ipcMain.on('shell:open-external', (_event, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});

app.whenReady().then(() => {
  if (!gotLock) return;
  store = new GardenStore(app.getPath('userData'));
  // 화면(렌더러)도 같은 값을 쓰도록 컴퓨터 언어를 저장해 둔다
  store.merge({ systemLanguage: detectSystemLanguage(app) });
  const firstRun = !store.get().timer;

  // macOS: Dock 아이콘 숨김 → 앱이 아니라 바탕화면 소품처럼 보이게
  app.dock?.hide();

  tray = new Tray(createTrayIcon());
  tray.setToolTip('Desktop Flower Garden');
  refreshTray();

  createWidgetWindow();
  // 처음 설치한 사람에게: 도감 창이 사용법 안내를 겸한다 (Dock 아이콘이 없어 실행됐는지 헷갈리지 않게)
  if (firstRun) openCollection();
});

// 도감 창만 닫혔을 때는 위젯은 계속 살아 있어야 한다
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => store?.flush());
