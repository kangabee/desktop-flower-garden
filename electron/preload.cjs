// 렌더러에 필요한 최소 API만 노출한다.
const { contextBridge, ipcRenderer } = require('electron');

function listen(channel, handler) {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// 위젯(바탕화면 화분) 창 제어
contextBridge.exposeInMainWorld('widget', {
  /** true = 클릭이 아래 앱으로 통과, false = 위젯이 마우스를 받음 */
  setIgnoreMouse: (ignore) => ipcRenderer.send('widget:set-ignore-mouse', ignore),
  getPosition: () => ipcRenderer.invoke('widget:get-position'),
  setPosition: (x, y) => ipcRenderer.send('widget:set-position', x, y),
  /** 메뉴 구성을 위해 현재 상태(bloomed)를 메인에 알림 */
  reportState: (state) => ipcRenderer.send('widget:state', state),
  showMenu: () => ipcRenderer.send('widget:show-menu'),
  onCommand: (handler) => listen('widget:command', handler),
});

// 정원 데이터 + 도감/선물 링크 (모든 창 공용)
contextBridge.exposeInMainWorld('garden', {
  get: () => ipcRenderer.invoke('garden:get'),
  merge: (patch) => ipcRenderer.send('garden:merge', patch),
  onChange: (handler) => listen('garden:changed', handler),
  openCollection: (route) => ipcRenderer.send('garden:open-collection', route),
  onNavigate: (handler) => listen('collection:navigate', handler),
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  openExternal: (url) => ipcRenderer.send('shell:open-external', url),
  exportGarden: () => ipcRenderer.invoke('garden:export'),
  importGarden: () => ipcRenderer.invoke('garden:import'),
  applyImport: () => ipcRenderer.invoke('garden:import-apply'),
});
