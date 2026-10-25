// 날씨 (선택 기능): 메인 프로세스가 Open-Meteo 에서 받아 garden.weather 에 넣어 주면, 여기서 성장 효과로 바꾼다.
//   ☔ 비: 성장 ×0.9, 대신 꽃이 물을 원하지 않는다 (자연이 대신 물을 줌)
//   🌈 비 그친 뒤 햇살: 1시간 동안 ×2
//   ☁ 흐림: 햇빛 부스터가 ×1.05 로 약해짐
//   ❄ 눈 · 맑은 날: 효과 없이 연출만
import { SUN_BOOST, SUN_BOOST_CLOUDY } from './growth.js';

/** WMO 날씨 코드 → clear | cloudy | rain | snow */
export function weatherKind(code) {
  if (code == null) return null;
  if (code <= 1) return 'clear';
  if (code <= 48) return 'cloudy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain'; // 51–67 이슬비·비, 80–82 소나기, 95–99 뇌우
}

/** 날씨가 꺼져 있거나 오래된 정보(3시간 넘게 못 받음)면 효과 없음 */
export function activeWeather(weather, enabled, now = Date.now()) {
  if (!enabled || !weather?.at || now - weather.at > 3 * 60 * 60 * 1000) return null;
  return weather;
}

export function isRainbow(weather, now = Date.now()) {
  return Boolean(weather?.rainbowUntil && now < weather.rainbowUntil);
}

/** 성장 효과: growth = 기본 속도 배율, sun = 햇빛 부스터 배율, noWater = 물을 원하지 않음 */
export function weatherEffect(weather, now = Date.now()) {
  if (!weather) return { growth: 1, sun: SUN_BOOST, noWater: false };
  if (isRainbow(weather, now)) return { growth: 2, sun: SUN_BOOST, noWater: false };
  if (weather.kind === 'rain') return { growth: 0.9, sun: SUN_BOOST_CLOUDY, noWater: true };
  if (weather.kind === 'cloudy') return { growth: 1, sun: SUN_BOOST_CLOUDY, noWater: false };
  return { growth: 1, sun: SUN_BOOST, noWater: false };
}
