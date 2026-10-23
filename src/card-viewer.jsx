// 공유 링크로 열리는 카드 페이지 (card.html#<인코딩된 카드>)
// 서버 없이 해시에 담긴 내용만으로 카드를 다시 그린다.
// 씨앗 정보(씨앗 ID·정원 ID)는 링크 안에 숨겨져 있고, 받는 사람은 "씨앗 받기" 버튼 하나만 누르면 된다.
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { decodeCard, renderGiftCard } from './lib/card.js';
import { FLOWER_BY_ID } from './data/flowers.js';
import { currentLang, flowerText, t } from './i18n/index.js';
import './fonts.js';
import './card-viewer.css';

// 받는 사람의 브라우저 언어로 표시한다
document.documentElement.lang = currentLang();
document.title = t('v.pageTitle');

// 앱 설치 파일 주소 (GitHub Releases 등). 앱이 없는 사람에게 안내할 때 쓴다.
const DOWNLOAD_URL = import.meta.env.VITE_DOWNLOAD_URL;

function CardPage() {
  const [hash] = useState(() => location.hash.slice(1));
  const [card] = useState(() => decodeCard(hash));
  const canvasRef = useRef(null);

  useEffect(() => {
    if (card) renderGiftCard(canvasRef.current, card);
  }, [card]);

  if (!card) {
    return (
      <main className="viewer">
        <p>{t('v.cantOpen')}</p>
      </main>
    );
  }

  const flower = FLOWER_BY_ID[card.flowerId];
  const name = flowerText(flower, 'name');
  return (
    <main className="viewer">
      <p className="viewer-title">🌸 {t('v.sent', { from: card.from || t('card.fromDefault'), name })}</p>
      <canvas ref={canvasRef} aria-label={t('v.cardAria', { name, message: card.message })} />
      {card.seedId && <ReceiveSeed payload={hash} />}
      <p className="viewer-foot">{t('v.foot')}</p>
    </main>
  );
}

/**
 * "씨앗 받기": 설치된 앱을 flowergarden:// 링크로 열어 씨앗을 넘긴다.
 * 앱이 열리면 브라우저 창이 뒤로 가므로(document.hidden), 잠시 뒤에도 그대로면 앱이 없는 것으로 보고 설치를 안내한다.
 */
function ReceiveSeed({ payload }) {
  const [state, setState] = useState('idle'); // idle | opening | sent | no-app

  const receive = () => {
    setState('opening');
    let left = false;
    const onHide = () => {
      if (document.hidden) left = true;
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onHide);
    location.href = `flowergarden://seed?d=${payload}`;
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onHide);
      setState(left || document.hidden ? 'sent' : 'no-app');
    }, 2500);
  };

  return (
    <section className="receive">
      <button type="button" className="receive-btn" onClick={receive} disabled={state === 'opening'}>
        {state === 'opening' ? t('v.opening') : t('v.receive')}
      </button>
      {state === 'sent' && <p className="receive-help">{t('v.sentHelp')}</p>}
      {state === 'no-app' && (
        <p className="receive-help">
          {t('v.noApp1')}
          <br />
          {t('v.noApp2')} {DOWNLOAD_URL ? <a href={DOWNLOAD_URL}>{t('v.install')}</a> : t('v.install')}
          {t('v.noApp3')}
        </p>
      )}
    </section>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CardPage />
  </StrictMode>,
);
