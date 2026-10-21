import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' → 빌드 결과물을 Electron에서 file:// 로 열 수 있도록 상대경로 사용
// card.html  → 공유 링크용 카드 페이지 (dist/ 를 정적 호스팅에 올리면 링크 공유 가능)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        card: resolve(import.meta.dirname, 'card.html'),
      },
    },
  },
});
