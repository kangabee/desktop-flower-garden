import { useMemo } from 'react';

// 개화 후 떠오르는 네모난 도트 반짝이 (CSS steps() 애니메이션 → JS 비용 0)
export default function PixelParticles({ colors, count = 8, burst = false, size = 3 }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        color: colors[i % colors.length],
        left: 25 + Math.random() * 50,
        delay: Math.random() * (burst ? 0.8 : 6),
        duration: 3 + Math.random() * 3,
        drift: Math.round((Math.random() - 0.5) * 12) * size,
        big: i % 3 === 0,
      })),
    [colors, count, burst, size],
  );

  return (
    <div className={`particles${burst ? ' particles-burst' : ''}`} aria-hidden="true">
      {particles.map((pt) => (
        <span
          key={pt.id}
          className="particle"
          style={{
            left: `${pt.left}%`,
            width: size * (pt.big ? 2 : 1),
            height: size * (pt.big ? 2 : 1),
            background: pt.color,
            animationDelay: `${pt.delay}s`,
            animationDuration: `${pt.duration}s`,
            '--drift': `${pt.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
