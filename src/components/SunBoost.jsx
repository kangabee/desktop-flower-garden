import PixelIcon from './PixelIcon.jsx';
import { t } from '../i18n/index.js';

// 햇빛 부스터가 켜져 있는 동안 화분 옆에 계속 떠 있는 도트 해 (끌 때까지 유지)
// paused = 목이 말라 부스터가 멈춘 상태 → 흐리게
export default function SunBoost({ paused = false }) {
  return (
    <div className={`sunboost${paused ? ' paused' : ''}`} aria-hidden="true">
      <div className="sunboost-glow" />
      <div className="sunboost-body">
        <PixelIcon name="sunRaysA" scale={2} className="fx-sun-a" />
        <PixelIcon name="sunRaysB" scale={2} className="fx-sun-b" />
        <span className="sunboost-badge">{paused ? t('w.thirstyBadge') : '×1.1'}</span>
      </div>
      {[0, 1, 2].map((i) => (
        <PixelIcon
          key={i}
          name="sparkle"
          scale={2}
          className="sunboost-ray"
          style={{ left: 118 + i * 10, animationDelay: `${i * 0.7}s` }}
        />
      ))}
    </div>
  );
}
