// 효과음: 오디오 파일 없이 WebAudio로 합성한다 (8비트 오르골 느낌).
// 설정에서 효과음을 끄면 아무 소리도 내지 않는다 (사무실용).
import { getGarden, settingsOf } from './garden.js';
let ctx = null;

function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(ac, { freq, start, length, type = 'sine', volume = 0.1, glideTo }) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + length);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

function safely(fn) {
  if (!settingsOf(getGarden()).sound) return;
  try {
    fn(audio());
  } catch {
    /* 오디오 사용 불가 환경은 조용히 무시 */
  }
}

const NOTE = {
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
  C6: 1046.5, E6: 1318.5, G6: 1568.0, C7: 2093.0,
};

/** 개화: 짧은 오르골 아르페지오 */
export function playBloomChime() {
  safely((ac) => {
    const t = ac.currentTime + 0.05;
    ['C6', 'E6', 'G6', 'C7'].forEach((n, i) =>
      tone(ac, { freq: NOTE[n], start: t + i * 0.14, length: 1.2, volume: 0.12 }),
    );
  });
}

/** 노래 들려주기: 4초 남짓한 자작 자장가 멜로디 */
export const SONG_SECONDS = 4.2;
export function playSong() {
  safely((ac) => {
    const t = ac.currentTime + 0.05;
    const melody = [
      ['E5', 1], ['G5', 1], ['A5', 2], ['G5', 1], ['E5', 1], ['D5', 2],
      ['E5', 1], ['G5', 1], ['C6', 1], ['A5', 1], ['G5', 4],
    ];
    const beat = 0.25;
    let at = t;
    for (const [n, beats] of melody) {
      tone(ac, { freq: NOTE[n], start: at, length: beats * beat + 0.3, type: 'triangle', volume: 0.08 });
      at += beats * beat;
    }
    // 은은한 반주
    [['C5', 0], ['F5', 1], ['C5', 2], ['G5', 3]].forEach(([n, bar]) =>
      tone(ac, { freq: NOTE[n] / 2, start: t + bar * 1.0, length: 1.0, volume: 0.04 }),
    );
  });
}

/** 물 주기: 보글보글 물방울 소리 */
export function playWater() {
  safely((ac) => {
    const t = ac.currentTime + 0.05;
    for (let i = 0; i < 6; i++) {
      const f = 500 + Math.random() * 500;
      tone(ac, { freq: f, glideTo: f * 1.8, start: t + i * 0.16 + Math.random() * 0.05, length: 0.12, volume: 0.06 });
    }
  });
}

/** 햇빛: 따뜻하게 차오르는 화음 */
export function playSun() {
  safely((ac) => {
    const t = ac.currentTime + 0.05;
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) =>
      tone(ac, { freq: NOTE[n], start: t + i * 0.06, length: 1.6, volume: 0.05 }),
    );
  });
}

/** 비료: 톡톡 떨어지는 낮은 소리 */
export function playFertilizer() {
  safely((ac) => {
    const t = ac.currentTime + 0.05;
    for (let i = 0; i < 5; i++) {
      const f = 220 + Math.random() * 120;
      tone(ac, { freq: f, glideTo: f * 0.7, start: t + i * 0.12, length: 0.1, type: 'triangle', volume: 0.07 });
    }
    tone(ac, { freq: NOTE.C5, start: t + 0.7, length: 0.6, volume: 0.06 });
    tone(ac, { freq: NOTE.G5, start: t + 0.8, length: 0.6, volume: 0.05 });
  });
}

/** 방문객 등장: 반짝이는 짧은 두 음 */
export function playVisitor() {
  safely((ac) => {
    const t = ac.currentTime + 0.05;
    tone(ac, { freq: NOTE.E6, start: t, length: 0.3, volume: 0.06 });
    tone(ac, { freq: NOTE.G6, start: t + 0.12, length: 0.4, volume: 0.06 });
  });
}
