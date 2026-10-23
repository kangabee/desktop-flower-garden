import { useLayoutEffect, useMemo, useRef } from 'react';
import { drawGrid } from '../lib/pixel.js';
import { FLAGS, flagGrid } from '../data/flags.js';
import { nationName, t } from '../i18n/index.js';

/** 나라 대표 꽃 옆의 작은 도트 국기 */
export default function PixelFlag({ code, scale = 1, className }) {
  const canvasRef = useRef(null);
  const grid = useMemo(() => (FLAGS[code] ? flagGrid(code) : null), [code]);

  useLayoutEffect(() => {
    if (grid) drawGrid(canvasRef.current.getContext('2d'), grid, scale);
  }, [grid, scale]);

  if (!grid) return null;
  const w = grid[0].length * scale;
  const h = grid.length * scale;
  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={w}
      height={h}
      style={{ width: w, height: h, imageRendering: 'pixelated', verticalAlign: 'middle' }}
      role="img"
      aria-label={t('flagOf', { nation: nationName(code) })}
    />
  );
}
