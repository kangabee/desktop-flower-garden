import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { drawGrid } from '../lib/pixel.js';
import { SPRITE_H, SPRITE_W, buildPlantGrid } from '../lib/sprites.js';

/**
 * 도트 화분 캔버스.
 * ref.hitTest(clientX, clientY) → 커서 아래가 "색이 있는 픽셀"인지 (클릭 통과 판정용)
 */
const PixelPlant = forwardRef(function PixelPlant(
  { flower, progress, sway = 0, scale = 3, className, silhouette = null },
  ref,
) {
  const canvasRef = useRef(null);
  const grid = useMemo(() => {
    const g = buildPlantGrid(flower, progress, sway);
    // 도감에서 아직 못 만난 꽃은 실루엣으로
    return silhouette ? g.map((row) => row.map((c) => c && silhouette)) : g;
  }, [flower, progress, sway, silhouette]);

  useLayoutEffect(() => {
    drawGrid(canvasRef.current.getContext('2d'), grid, scale);
  }, [grid, scale]);

  useImperativeHandle(
    ref,
    () => ({
      hitTest(clientX, clientY) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return false;
        const gx = Math.floor(((clientX - rect.left) / rect.width) * SPRITE_W);
        const gy = Math.floor(((clientY - rect.top) / rect.height) * SPRITE_H);
        // 가는 줄기도 잡기 쉽도록 주변 1픽셀까지 허용
        for (let y = gy - 1; y <= gy + 1; y++) {
          for (let x = gx - 1; x <= gx + 1; x++) {
            if (grid[y]?.[x]) return true;
          }
        }
        return false;
      },
    }),
    [grid],
  );

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={SPRITE_W * scale}
      height={SPRITE_H * scale}
      style={{ width: SPRITE_W * scale, height: SPRITE_H * scale, imageRendering: 'pixelated' }}
    />
  );
});

export default PixelPlant;
