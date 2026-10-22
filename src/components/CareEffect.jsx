import { useEffect, useMemo } from 'react';
import PixelIcon from './PixelIcon.jsx';
import { SONG_SECONDS, playFertilizer, playSong, playWater } from '../lib/sound.js';

// 돌봄 연출 (모두 CSS steps() 애니메이션 → 끝나면 onDone)
const DURATION = { song: SONG_SECONDS * 1000, water: 2600, fertilizer: 2400 };
const SOUND = { song: playSong, water: playWater, fertilizer: playFertilizer };

export default function CareEffect({ kind, onDone }) {
  useEffect(() => {
    SOUND[kind]();
    const id = setTimeout(onDone, DURATION[kind]);
    return () => clearTimeout(id);
  }, [kind, onDone]);

  const items = useMemo(() => {
    const n = kind === 'song' ? 6 : 12;
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      x: Math.random(),
      delay: (i / n) * (kind === 'song' ? 3 : 1.4),
    }));
  }, [kind]);

  if (kind === 'water') {
    return (
      <div className="fx fx-water" aria-hidden="true">
        <PixelIcon name="can" scale={3} className="fx-can" />
        {items.map((d) => (
          <PixelIcon
            key={d.id}
            name="drop"
            scale={2}
            className="fx-drop"
            style={{ left: 68 + Math.round(d.x * 6) * 2, animationDelay: `${0.35 + d.delay}s` }}
          />
        ))}
      </div>
    );
  }

  if (kind === 'fertilizer') {
    return (
      <div className="fx fx-fertilizer" aria-hidden="true">
        <PixelIcon name="fertilizer" scale={3} className="fx-bag" />
        {items.map((d) => (
          <PixelIcon
            key={d.id}
            name="grain"
            scale={2}
            className="fx-grain"
            style={{ left: 86 + Math.round(d.x * 8) * 2, animationDelay: `${0.3 + d.delay}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="fx fx-song" aria-hidden="true">
      {items.map((n) => (
        <PixelIcon
          key={n.id}
          name="note"
          scale={2}
          className="fx-note"
          style={{ left: 30 + Math.round(n.x * 40) * 3, animationDelay: `${n.delay}s` }}
        />
      ))}
    </div>
  );
}
