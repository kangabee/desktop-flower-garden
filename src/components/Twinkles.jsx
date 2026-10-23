import { useMemo } from 'react';
import PixelIcon from './PixelIcon.jsx';

// 전설 꽃의 반짝임 — 포켓몬 이로치처럼 커다란 네 갈래 별이 터지고 반짝인다.
//  stars: [{ x, y, big, delay }] (x·y 는 상자 기준 %) — 계속 반짝이는 별
//  burst: 처음 피는 순간 꽃머리(center)에서 사방으로 터져 나가는 별
export default function Twinkles({ stars, burst = false, center = [50, 50], burstCount = 10, scale = 1 }) {
  const shots = useMemo(
    () =>
      Array.from({ length: burstCount }, (_, i) => {
        const angle = (i / burstCount) * Math.PI * 2 + Math.random() * 0.4;
        const dist = (46 + Math.random() * 24) * scale;
        return {
          id: i,
          dx: Math.round(Math.cos(angle) * dist),
          dy: Math.round(Math.sin(angle) * dist),
          big: i % 2 === 0,
          delay: Math.random() * 0.25,
        };
      }),
    [burstCount, scale],
  );

  return (
    <div className="twinkles" aria-hidden="true">
      {stars.map((s, i) => (
        <PixelIcon
          key={i}
          name={s.big ? 'shine' : 'shineSmall'}
          scale={s.big ? 3 * scale : 2}
          className="twinkle"
          style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.delay}s` }}
        />
      ))}
      {burst &&
        shots.map((b) => (
          <PixelIcon
            key={`b${b.id}`}
            name={b.big ? 'shine' : 'shineSmall'}
            scale={b.big ? 4 * scale : 2}
            className="shine-burst"
            style={{
              left: `${center[0]}%`,
              top: `${center[1]}%`,
              animationDelay: `${b.delay}s`,
              '--dx': `${b.dx}px`,
              '--dy': `${b.dy}px`,
            }}
          />
        ))}
    </div>
  );
}
