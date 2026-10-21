import { useEffect, useRef, useState } from 'react';
import PixelIcon from './components/PixelIcon.jsx';
import { FLOWER_BY_ID } from './data/flowers.js';
import { gardenApi, useGarden } from './lib/garden.js';
import { LIMITS, buildShareUrl, renderGiftCard } from './lib/card.js';
import { makeId } from './lib/ids.js';

// 선물 카드 만들기: 받는 사람 · 편지 · 보내는 사람 → 링크로 보내기
// 링크 안에는 숨은 씨앗 ID·정원 ID가 들어가서, 받은 사람은 링크 페이지의 "씨앗 받기"만 누르면 같은 꽃을 키운다.
export default function GiftEditor({ entry, onBack }) {
  const flower = FLOWER_BY_ID[entry.flowerId];
  const { gardenId } = useGarden();
  const canvasRef = useRef(null);
  const [form, setForm] = useState({ to: '', message: flower.message, from: '' });
  const [status, setStatus] = useState('');

  const card = { flowerId: flower.id, ...form, date: entry.bloomedAt };
  // 링크를 만들 때마다 새 씨앗 ID → 여러 사람에게 보내도 각자 따로 받는다
  const makeLink = () => buildShareUrl({ ...card, seedId: makeId(12), gardenId });
  const canShare = Boolean(buildShareUrl(card));

  useEffect(() => {
    const id = setTimeout(() => renderGiftCard(canvasRef.current, card), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.to, form.message, form.from]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.slice(0, LIMITS[key]) }));

  const flash = (text) => {
    setStatus(text);
    setTimeout(() => setStatus((s) => (s === text ? '' : s)), 3000);
  };

  const copyLink = async () => {
    try {
      await gardenApi.copyText(makeLink());
      flash('선물 링크를 복사했어요 · 메신저에 붙여넣어 보내세요');
    } catch {
      flash('복사에 실패했어요. 다시 시도해 주세요');
    }
  };
  const openLink = () => gardenApi.openExternal(makeLink());

  return (
    <div className="book gift">
      <header className="book-header">
        <button className="px-btn ghost" onClick={onBack}>
          ← 도감
        </button>
        <h1>
          <PixelIcon name="gift" scale={3} /> {flower.name} 선물하기
        </h1>
      </header>

      <div className="gift-body">
        <form className="gift-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            받는 사람
            <input value={form.to} onChange={set('to')} placeholder="예) 옆자리 지민님" />
          </label>
          <label>
            편지
            <textarea value={form.message} onChange={set('message')} rows={5} />
            <small>
              {form.message.length} / {LIMITS.message}
            </small>
          </label>
          <label>
            보내는 사람
            <input value={form.from} onChange={set('from')} placeholder="예) 3층 정원사" />
          </label>

          <div className="export">
            <button
              type="button"
              className="px-btn primary"
              onClick={copyLink}
              disabled={!canShare}
              title={canShare ? '' : '공유 페이지(card.html)를 배포하고 VITE_SHARE_BASE_URL 을 설정하면 사용할 수 있어요'}
            >
              🔗 선물 링크 복사
            </button>
            <button type="button" className="px-btn" onClick={openLink} disabled={!canShare}>
              받는 사람 화면 미리보기
            </button>
          </div>
          <p className="status" role="status">
            {status ||
              (canShare
                ? `받은 사람은 링크에서 카드를 보고, "씨앗 받기" 한 번으로 ${flower.name}을(를) 키울 수 있어요.`
                : '선물 링크는 공유 페이지를 배포한 뒤에 켜져요.')}
          </p>
        </form>

        <div className="gift-preview">
          <canvas ref={canvasRef} aria-label="선물 카드 미리보기" />
        </div>
      </div>
    </div>
  );
}
