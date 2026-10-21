import PixelPlant from './components/PixelPlant.jsx';
import { FLOWERS, RARITY } from './data/flowers.js';

// 개발용: 모든 꽃의 단계별 스프라이트를 한 화면에서 확인
const STEPS = [0.02, 0.08, 0.25, 0.5, 0.68, 0.8, 0.95, 1];

export default function Gallery() {
  return (
    <div className="gallery">
      {FLOWERS.map((f) => (
        <section key={f.id} className="gallery-row">
          <header>
            <strong>{f.name}</strong>
            <span style={{ color: RARITY[f.rarity].color }}>{'★'.repeat(RARITY[f.rarity].stars)}</span>
            <small>{f.language}</small>
          </header>
          <div className="gallery-sprites">
            {STEPS.map((p) => (
              <PixelPlant key={p} flower={f} progress={p} scale={2} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
