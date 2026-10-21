// 공유 링크로 열리는 카드 페이지 (card.html#<인코딩된 카드>)
// 서버 없이 해시에 담긴 내용만으로 카드를 다시 그린다.
// 씨앗 정보(씨앗 ID·정원 ID)는 링크 안에 숨겨져 있고, 받는 사람은 "씨앗 받기" 버튼 하나만 누르면 된다.
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { decodeCard, renderGiftCard } from './lib/card.js';
import { FLOWER_BY_ID } from './data/flowers.js';
import './fonts.js';
import './card-viewer.css';

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
        <p>카드를 열 수 없어요. 링크가 잘렸는지 확인해 주세요.</p>
      </main>
    );
  }

  const flower = FLOWER_BY_ID[card.flowerId];
  return (
    <main className="viewer">
      <p className="viewer-title">
        🌸 <strong>{card.from || '익명의 정원사'}</strong>님이 {flower.name}을(를) 보냈어요
      </p>
      <canvas ref={canvasRef} aria-label={`${flower.name} 선물 카드: ${card.message}`} />
      {card.seedId && <ReceiveSeed payload={hash} />}
      <p className="viewer-foot">Desktop Flower Garden 에서 하루 동안 천천히 키운 꽃이에요</p>
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
        {state === 'opening' ? '정원을 여는 중…' : '🌱 씨앗 받기'}
      </button>
      {state === 'sent' && <p className="receive-help">바탕화면의 화분을 확인해 보세요!</p>}
      {state === 'no-app' && (
        <p className="receive-help">
          정원이 열리지 않았나요? 브라우저가 앱을 열지 물어보면 <b>허용</b>을 눌러 주세요.
          <br />
          아직 앱이 없다면{' '}
          {DOWNLOAD_URL ? <a href={DOWNLOAD_URL}>Desktop Flower Garden 설치하기</a> : 'Desktop Flower Garden 을 설치'} 한
          뒤 이 버튼을 다시 눌러 주세요.
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
