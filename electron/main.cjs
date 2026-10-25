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
  dialog,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { GardenStore } = require('./store.cjs');
const { LANG_IDS, LANG_NAMES, MENU, normalizeLang, detectSystemLanguage } = require('./i18n.cjs');
const { DOWNLOAD_PAGE, checkForNewVersion } = require('./updates.cjs');

const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';

// 말풍선·햇빛 연출이 창 가장자리에서 잘리지 않도록 여유 있게 (투명한 부분은 클릭이 통과하므로 무해)
const WIDGET = { width: 280, height: 300, margin: 16 };
// 선반: 화분이 늘 때마다 창이 이만큼 넓어진다 (src/App.jsx 의 POT_GAP 과 같아야 함)
const POT_GAP = 110;
// 화분 크기 설정 → 창 확대 비율 (도트 한 칸이 2px · 3px · 4px 이 되도록)
const SIZE_ZOOM = { small: 2 / 3, normal: 1, large: 4 / 3 };
const DEFAULT_SETTINGS = {
  sound: true,
  size: 'normal',
  reduceMotion: false,
  weather: { enabled: false, name: null, lat: null, lon: null },
};

let win = null;
let collectionWin = null;
let tray = null;
let store = null;
let pinned = true;
// 렌더러가 보내주는 현재 상태 (메뉴 구성용)
let plantState = { bloomed: false, pots: 1 };
// 선물 링크의 "씨앗 받기"로 들어온 씨앗 (위젯이 준비되면 전달)
// 위젯이 아직 준비되지 않았을 때 보낼 명령 (선물 씨앗·업데이트 알림)
const pendingCommands = [];
let widgetReady = false;
// 업데이트 상태: available = Mac 새 버전 알림, ready = Windows 에서 받아 둔 새 버전
const update = { available: null, ready: null };

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
  sendToWidget({ type: 'receive-seed', payload: match[1] });
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
// (DFG_USER_DATA: 설치된 앱을 켜 둔 채 따로 시험할 때만 쓰는 다른 폴더)
app.setPath('userData', process.env.DFG_USER_DATA || path.join(app.getPath('appData'), 'desktop-flower-garden'));

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

function settingsOf(state) {
  const s = state?.settings ?? {};
  return { ...DEFAULT_SETTINGS, ...s, weather: { ...DEFAULT_SETTINGS.weather, ...s.weather } };
}

/** 위젯 창 크기: 화분 수 × 화분 크기 설정 */
function widgetSize() {
  const zoom = SIZE_ZOOM[settingsOf(store.get()).size] ?? 1;
  const pots = Math.max(1, plantState.pots ?? 1);
  return {
    // 올림: 작게(×2/3)일 때 1px 모자라 오른쪽 화분 끝이 잘리지 않도록
    width: Math.ceil((WIDGET.width + (pots - 1) * POT_GAP) * zoom),
    height: Math.ceil(WIDGET.height * zoom),
    zoom,
  };
}

/** 화분 수·크기가 바뀌면 창 크기를 맞춘다 (오른쪽 아래 모서리를 기준으로 늘고 줄어든다) */
function layoutWidget() {
  if (!win) return;
  const { width, height, zoom } = widgetSize();
  win.webContents.setZoomFactor(zoom);
  const b = win.getBounds();
  if (b.width === width && b.height === height) return;
  win.setBounds({ x: b.x + b.width - width, y: b.y + b.height - height, width, height });
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  const { width, height } = widgetSize();
  return {
    x: workArea.x + workArea.width - width - WIDGET.margin,
    y: workArea.y + workArea.height - height,
  };
}

/** 저장된 위치가 현재 연결된 모니터 안에 있을 때만 사용 (모니터를 뺐을 때 대비) */
function initialPosition() {
  let saved = store.get().position;
  if (saved) {
    // 창 크기가 바뀌었어도 오른쪽 아래 모서리가 같은 자리에 오도록 보정. 예전 저장분은 200×240
    const { width, height } = widgetSize();
    const w = saved.w ?? 200;
    const h = saved.h ?? 240;
    saved = { x: saved.x + w - width, y: saved.y + h - height };
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      saved.x + width / 2 >= a.x &&
      saved.x + width / 2 <= a.x + a.width &&
      saved.y + height / 2 >= a.y &&
      saved.y <= a.y + a.height,
    );
    if (visible) return saved;
  }
  return defaultPosition();
}

function createWidgetWindow() {
  const { x, y } = initialPosition();
  const { width, height } = widgetSize();

  win = new BrowserWindow({
    width,
    height,
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
  // 화분 크기 설정은 화면 확대 비율로 적용 (페이지를 불러올 때마다 다시)
  win.webContents.on('did-finish-load', () => layoutWidget());

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

function sendToWidget(command) {
  if (widgetReady) send(command);
  else pendingCommands.push(command);
}

// ── 업데이트 ──
const HOUR = 60 * 60 * 1000;

/** 새 버전 소식을 메뉴에 반영하고, 버전마다 한 번만 말풍선으로 알린다 */
function announceUpdate() {
  refreshTray();
  const version = update.ready ?? update.available;
  if (store.get().notifiedVersion === version) return;
  store.merge({ notifiedVersion: version });
  sendToWidget({ type: update.ready ? 'update-ready' : 'update-available', version });
}

function startUpdateChecks() {
  // 개발 중에는 꺼 두고, --update-test 로만 확인 (현재 버전을 0.0.1 로 간주)
  const test = process.argv.includes('--update-test');
  if (!app.isPackaged && !test) return;
  const current = test ? '0.0.1' : app.getVersion();

  if (process.platform === 'win32' && app.isPackaged) {
    // Windows: 백그라운드로 받아 두었다가, 앱을 끌 때 또는 메뉴에서 "다시 시작" 할 때 적용
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', (info) => {
      update.ready = info.version;
      announceUpdate();
    });
    autoUpdater.on('error', () => {}); // 오프라인 등은 다음 확인 때 다시
    const run = () => autoUpdater.checkForUpdates().catch(() => {});
    run();
    setInterval(run, 6 * HOUR);
    return;
  }

  // Mac (그리고 예외 상황): 새 버전이 있으면 알려 주고 다운로드 페이지로 안내
  const run = async () => {
    const version = await checkForNewVersion(current);
    if (version && version !== update.available) {
      update.available = version;
      announceUpdate();
    }
  };
  run();
  setInterval(run, 24 * HOUR);
}

function installUpdateNow() {
  const { autoUpdater } = require('electron-updater');
  store.flush();
  autoUpdater.quitAndInstall();
}

function send(command) {
  win?.webContents.send('widget:command', command);
}

function broadcast(state, except) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.webContents !== except) w.webContents.send('garden:changed', state);
  }
}

// ── 설정 ──
function setSettings(patch) {
  const settings = { ...settingsOf(store.get()), ...patch };
  broadcast(store.merge({ settings }));
  onSettingsChanged();
}

function onSettingsChanged() {
  layoutWidget();
  startWeather();
  refreshTray();
}

// ── 날씨 (선택 기능): Open-Meteo 무료 API, 키 없음. 30분마다 위도·경도의 지금 날씨만 받는다 ──
let weatherTimer = null;
let weatherKey = null;

/** WMO 날씨 코드 → clear | cloudy | rain | snow (src/lib/weather.js 와 같은 규칙) */
function weatherKind(code) {
  if (code <= 1) return 'clear';
  if (code <= 48) return 'cloudy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain';
}

async function fetchWeather({ lat, lon }) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day&timezone=auto`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DesktopFlowerGarden' } });
    if (!res.ok) return;
    const { current } = await res.json();
    const now = Date.now();
    const kind = weatherKind(current.weather_code);
    const prev = store.get().weather;
    // 비가 그치고 해가 나면 1시간 동안 무지개
    let rainbowUntil = prev?.rainbowUntil && prev.rainbowUntil > now ? prev.rainbowUntil : null;
    if (prev?.kind === 'rain' && (kind === 'clear' || kind === 'cloudy') && current.is_day) rainbowUntil = now + 60 * 60 * 1000;
    broadcast(store.merge({ weather: { kind, isDay: Boolean(current.is_day), at: now, rainbowUntil } }));
  } catch {
    /* 오프라인 등은 다음 확인 때 다시 */
  }
}

function startWeather() {
  const { weather } = settingsOf(store.get());
  const key = weather.enabled && weather.lat != null ? `${weather.lat},${weather.lon}` : null;
  if (key === weatherKey) return;
  weatherKey = key;
  clearInterval(weatherTimer);
  if (!key) return;
  fetchWeather(weather);
  weatherTimer = setInterval(() => fetchWeather(settingsOf(store.get()).weather), 30 * 60 * 1000);
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
  const settings = settingsOf(store?.get());
  const updateItems = update.ready
    ? [{ label: m('updateReady').replace('{v}', update.ready), click: installUpdateNow }, { type: 'separator' }]
    : update.available
      ? [
          { label: m('updateAvailable').replace('{v}', update.available), click: () => shell.openExternal(DOWNLOAD_PAGE) },
          { type: 'separator' },
        ]
      : [];
  return Menu.buildFromTemplate([
    ...updateItems,
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
      label: m('settings'),
      submenu: [
        { label: m('sound'), type: 'checkbox', checked: settings.sound, click: (i) => setSettings({ sound: i.checked }) },
        {
          label: m('potSize'),
          submenu: ['small', 'normal', 'large'].map((size) => ({
            label: m(`size_${size}`),
            type: 'radio',
            checked: settings.size === size,
            click: () => setSettings({ size }),
          })),
        },
        {
          label: m('reduceMotion'),
          type: 'checkbox',
          checked: settings.reduceMotion,
          click: (i) => setSettings({ reduceMotion: i.checked }),
        },
        { type: 'separator' },
        { label: m('moreSettings'), click: () => openCollection('collection/settings') },
      ],
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
    for (const command of pendingCommands.splice(0)) send(command);
  }
  const potsChanged = state.pots != null && state.pots !== plantState.pots;
  plantState = { ...plantState, ...state };
  if (potsChanged) layoutWidget();
  refreshTray();
});
ipcMain.on('widget:show-menu', () => {
  if (win) buildMenu().popup({ window: win });
});

// ── 저장소 ──
ipcMain.handle('garden:get', () => store.get());
ipcMain.on('garden:merge', (event, patch) => {
  broadcast(store.merge(patch), event.sender);
  if (patch.settings) onSettingsChanged();
  if ('language' in patch) {
    refreshTray();
    collectionWin?.setTitle(m('collectionTitle'));
  }
});

// ── 백업: 정원 기록을 파일로 내보내고 불러오기 ──
let pendingImport = null;
ipcMain.handle('garden:export', async (event) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(app.getPath('documents'), `desktop-flower-garden-${stamp}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return null;
  const { systemLanguage, ...data } = store.get();
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  return path.basename(filePath);
});
ipcMain.handle('garden:import', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return null;
  try {
    const data = JSON.parse(await fs.promises.readFile(filePaths[0], 'utf8'));
    if (!data || !Array.isArray(data.collection) || !(Array.isArray(data.pots) || data.timer)) return { ok: false };
    pendingImport = data;
    return { ok: true, bloomed: data.collection.length, species: new Set(data.collection.map((e) => e.flowerId)).size };
  } catch {
    return { ok: false };
  }
});
ipcMain.handle('garden:import-apply', () => {
  if (!pendingImport) return false;
  const state = store.replace({ ...pendingImport, systemLanguage: store.get().systemLanguage });
  pendingImport = null;
  broadcast(state);
  onSettingsChanged();
  win?.webContents.reload(); // 위젯은 새 기록으로 처음부터 다시 그린다
  return true;
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
  const firstRun = !store.get().timer && !store.get().pots?.length;

  // macOS: Dock 아이콘 숨김 → 앱이 아니라 바탕화면 소품처럼 보이게
  app.dock?.hide();

  tray = new Tray(createTrayIcon());
  tray.setToolTip('Desktop Flower Garden');
  refreshTray();

  createWidgetWindow();
  // 처음 설치한 사람에게: 도감 창이 사용법 안내를 겸한다 (Dock 아이콘이 없어 실행됐는지 헷갈리지 않게)
  if (firstRun) openCollection();
  startUpdateChecks();
  startWeather();
});

// 도감 창만 닫혔을 때는 위젯은 계속 살아 있어야 한다
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => store?.flush());
