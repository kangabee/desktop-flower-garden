// 정원 데이터 저장소: userData/garden.json 하나에 전부 보관한다.
// (성장 타이머, 컬렉션, 위젯 위치) — 앱을 껐다 켜도, 창이 여러 개여도 같은 데이터를 본다.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STATE = {
  version: 1,
  timer: null,
  collection: [],
  position: null,
  seedQueue: [], // 선물받아 심을 차례를 기다리는 씨앗
  redeemed: [], // 이미 받은 씨앗 ID (같은 선물 링크로 두 번 받기 방지)
  gardenId: null, // 이 정원(설치)의 숨은 ID
  fertilizedAt: 0, // 마지막으로 비료를 준 시각 (12시간 쿨타임)
};

class GardenStore {
  constructor(dir) {
    this.file = path.join(dir, 'garden.json');
    this.state = this.#read();
    this.saveTimer = null;
    if (!this.state.gardenId) this.merge({ gardenId: crypto.randomBytes(6).toString('hex').toUpperCase() });
  }

  #read() {
    try {
      return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  get() {
    return this.state;
  }

  /** 최상위 키 단위로 병합 저장 */
  merge(patch) {
    this.state = { ...this.state, ...patch };
    this.#scheduleSave();
    return this.state;
  }

  #scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 300);
  }

  /** 임시 파일에 쓰고 rename → 쓰는 도중 꺼져도 파일이 깨지지 않음 */
  flush() {
    clearTimeout(this.saveTimer);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { GardenStore };
