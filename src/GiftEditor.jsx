import { useEffect, useRef, useState } from 'react';
import PixelIcon from './components/PixelIcon.jsx';
import { FLOWER_BY_ID } from './data/flowers.js';
import { gardenApi, useGarden } from './lib/garden.js';
import { LIMITS, buildShareUrl, renderGiftCard } from './lib/card.js';
import { makeId } from './lib/ids.js';
import { flowerText, t, useLang } from './i18n/index.js';

// 선물 카드 만들기: 받는 사람 · 편지 · 보내는 사람 → 링크로 보내기
// 링크 안에는 숨은 씨앗 ID·정원 ID가 들어가서, 받은 사람은 링크 페이지의 "씨앗 받기"만 누르면 같은 꽃을 키운다.
export default function GiftEditor({ entry, onBack }) {
  const flower = FLOWER_BY_ID[entry.flowerId];
  const { gardenId } = useGarden();
  const lang = useLang();
  const name = flowerText(flower, 'name');
  const canvasRef = useRef(null);
  const [form, setForm] = useState({ to: '', message: flowerText(flower, 'message'), from: '' });
  const [status, setStatus] = useState('');

  const card = { flowerId: flower.id, ...form, date: entry.bloomedAt };
  // 링크를 만들 때마다 새 씨앗 ID → 여러 사람에게 보내도 각자 따로 받는다
  const makeLink = () => buildShareUrl({ ...card, seedId: makeId(12), gardenId });
  const canShare = Boolean(buildShareUrl(card));

  useEffect(() => {
    const id = setTimeout(() => renderGiftCard(canvasRef.current, card), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.to, form.message, form.from, lang]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.slice(0, LIMITS[key]) }));

  const flash = (text) => {
    setStatus(text);
    setTimeout(() => setStatus((s) => (s === text ? '' : s)), 3000);
  };

  const copyLink = async () => {
    try {
      await gardenApi.copyText(makeLink());
      flash(t('g.copied'));
    } catch {
      flash(t('g.copyFailed'));
    }
  };
  const openLink = () => gardenApi.openExternal(makeLink());

  return (
    <div className="book gift">
      <header className="book-header">
        <button className="px-btn ghost" onClick={onBack}>
          {t('g.back')}
        </button>
        <h1>
          <PixelIcon name="gift" scale={3} /> {t('g.title', { name })}
        </h1>
      </header>

      <div className="gift-body">
        <form className="gift-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            {t('g.to')}
            <input value={form.to} onChange={set('to')} placeholder={t('g.toPh')} />
          </label>
          <label>
            {t('g.letter')}
            <textarea value={form.message} onChange={set('message')} rows={5} />
            <small>
              {form.message.length} / {LIMITS.message}
            </small>
          </label>
          <label>
            {t('g.from')}
            <input value={form.from} onChange={set('from')} placeholder={t('g.fromPh')} />
          </label>

          <div className="export">
            <button
              type="button"
              className="px-btn primary"
              onClick={copyLink}
              disabled={!canShare}
              title={canShare ? '' : t('g.shareOffTitle')}
            >
              {t('g.copyLink')}
            </button>
            <button type="button" className="px-btn" onClick={openLink} disabled={!canShare}>
              {t('g.preview')}
            </button>
          </div>
          <p className="status" role="status">
            {status ||
              (canShare
                ? t('g.hint', { name })
                : t('g.shareOff'))}
          </p>
        </form>

        <div className="gift-preview">
          <canvas ref={canvasRef} aria-label={t('g.previewAria')} />
        </div>
      </div>
    </div>
  );
}
