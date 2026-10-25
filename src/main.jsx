import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Collection from './Collection.jsx';
import Gallery from './Gallery.jsx';
import { initGarden } from './lib/garden.js';
import { migrateGarden } from './lib/pots.js';
import './fonts.js';
import './styles.css';

// 같은 번들을 창마다 해시로 구분해서 쓴다
//   (기본)       바탕화면 위젯
//   #collection  꽃 도감 · 선물 카드 창
//   #gallery     개발용 스프라이트 미리보기
function pickRoot() {
  const hash = window.location.hash;
  if (hash.startsWith('#collection')) return Collection;
  if (hash === '#gallery') return Gallery;
  return App;
}

initGarden(migrateGarden).then(() => {
  const Root = pickRoot();
  document.documentElement.dataset.view = Root === App ? 'widget' : 'page';
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
});
