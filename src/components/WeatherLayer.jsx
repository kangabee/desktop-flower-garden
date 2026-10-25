import { useLayoutEffect, useMemo, useRef } from 'react';
import PixelIcon from './PixelIcon.jsx';

// 날씨 연출 (화분들 뒤, 클릭은 통과): 비 · 눈 · 구름 · 무지개
const RAINBOW = ['#ff7a7a', '#ffb347', '#ffe066', '#7fd07a', '#7cb4ff', '#b48cf0'];

/** 도트 무지개: 반원 띠를 3px 칸으로 그린다 */
function Rainbow({ width }) {
  const ref = useRef(null);
  const cell = 3;
  const cols = Math.floor(width / cell);
  const rows = Math.floor(cols / 2) + 2;
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.clearRect(0, 0, cols * cell, rows * cell);
    const cx = (cols - 1) / 2;
    const outer = cols / 2 - 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x - cx, rows - 1 - y);
        const band = Math.floor(outer - d);
        if (band >= 0 && band < RAINBOW.length) {
          ctx.fillStyle = RAINBOW[band];
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }, [cols, rows]);
  return <canvas ref={ref} className="rainbow" width={cols * cell} height={rows * cell} />;
}

export default function WeatherLayer({ kind, rainbow, width }) {
  const drops = useMemo(
    () =>
      Array.from({ length: kind === 'snow' ? 16 : 26 }, (_, i) => ({
        id: i,
        left: Math.round(Math.random() * (width / 3)) * 3,
        delay: Math.random() * 1.6,
        duration: kind === 'snow' ? 4 + Math.random() * 3 : 0.7 + Math.random() * 0.5,
      })),
    [kind, width],
  );

  return (
    <div className={`weather weather-${kind}`} aria-hidden="true">
      {rainbow && <Rainbow width={width} />}
      {(kind === 'cloudy' || kind === 'rain' || kind === 'snow') && (
        <>
          <PixelIcon name="cloud" scale={3} className="cloud cloud-1" />
          <PixelIcon name="cloud" scale={2} className="cloud cloud-2" />
        </>
      )}
      {(kind === 'rain' || kind === 'snow') &&
        drops.map((d) => (
          <span
            key={d.id}
            className={kind === 'snow' ? 'flake' : 'raindrop'}
            style={{ left: d.left, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s` }}
          />
        ))}
    </div>
  );
}
