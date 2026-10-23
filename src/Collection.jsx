import { useEffect, useMemo, useState } from 'react';
import PixelPlant from './components/PixelPlant.jsx';
import PixelIcon from './components/PixelIcon.jsx';
import PixelFlag from './components/PixelFlag.jsx';
import Twinkles from './components/Twinkles.jsx';
import GiftEditor from './GiftEditor.jsx';
import { FLOWERS, FLOWER_BY_ID, RARITY, REGIONS } from './data/flowers.js';
import { flowerText, formatDuration, nationName, regionName, t, useLang } from './i18n/index.js';
import { gardenApi, useGarden } from './lib/garden.js';
import { formatDate } from './lib/card.js';
import './collection.css';

// 해시 라우트: #collection · #collection/flower/<id> · #collection/gift/<uid>
function parseRoute(hash) {
  const [, view, id] = hash.replace(/^#/, '').split('/');
  return { view: view ?? 'list', id: id ? decodeURIComponent(id) : null };
}

const REGION_KEY = 'dfg.collection.region';

// 전설 꽃 반짝임 자리 (상자 기준 %)
const SLOT_STARS = [
  { x: 22, y: 24, big: false, delay: 0 },
  { x: 80, y: 34, big: false, delay: 0.8 },
  { x: 70, y: 66, big: false, delay: 1.6 },
];
const HERO_STARS = [
  { x: 24, y: 22, big: true, delay: 0 },
  { x: 78, y: 30, big: false, delay: 0.7 },
  { x: 82, y: 70, big: true, delay: 1.4 },
  { x: 20, y: 74, big: false, delay: 2 },
];

function loadRegion() {
  try {
    return localStorage.getItem(REGION_KEY) || 'all';
  } catch {
    return 'all';
  }
}

export default function Collection() {
  const { collection } = useGarden();
  const lang = useLang();
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  // 대륙별 도감 탭 (마지막으로 보던 탭을 기억)
  const [region, setRegionState] = useState(loadRegion);
  const setRegion = (id) => {
    setRegionState(id);
    try {
      localStorage.setItem(REGION_KEY, id);
    } catch {
      /* 무시 */
    }
  };

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    const off = gardenApi.onNavigate((r) => {
      location.hash = r;
    });
    return () => {
      window.removeEventListener('hashchange', onHash);
      off();
    };
  }, []);

  const go = (r) => {
    location.hash = r;
  };

  const bySpecies = useMemo(() => {
    const map = {};
    for (const entry of collection) (map[entry.flowerId] ??= []).push(entry);
    return map;
  }, [collection]);

  if (route.view === 'gift') {
    const entry = collection.find((e) => e.uid === route.id);
    return entry ? (
      <GiftEditor entry={entry} onBack={() => go(`collection/flower/${entry.flowerId}`)} />
    ) : (
      <div className="book">
        <p className="empty">{t('c.notFound')}</p>
        <button className="px-btn" onClick={() => go('collection')}>
          {t('c.back')}
        </button>
      </div>
    );
  }

  const discovered = Object.keys(bySpecies).length;
  const shown = region === 'all' ? FLOWERS : FLOWERS.filter((f) => f.region === region);
  const selected = FLOWER_BY_ID[route.id] ?? shown.find((f) => bySpecies[f.id]) ?? null;
  const tabs = [{ id: 'all', label: t('c.all') }, ...REGIONS.map((r) => ({ ...r, label: regionName(r.id) }))].map((r) => {
    const list = r.id === 'all' ? FLOWERS : FLOWERS.filter((f) => f.region === r.id);
    return { ...r, total: list.length, found: list.filter((f) => bySpecies[f.id]).length };
  });

  return (
    <div className="book">
      <header className="book-header">
        <h1>
          <PixelIcon name="book" scale={3} /> {t('c.title')}
        </h1>
        <p>{t('c.summary', { found: discovered, total: FLOWERS.length, bloomed: collection.length })}</p>
      </header>

      <nav className="region-tabs" aria-label={t('c.regionNav')}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`region-tab${region === t.id ? ' active' : ''}${t.found === t.total ? ' complete' : ''}`}
            aria-pressed={region === t.id}
            onClick={() => setRegion(t.id)}
          >
            {t.label}
            <small>
              {t.found}/{t.total}
            </small>
          </button>
        ))}
      </nav>

      <div className="book-body">
        <ul className="slots">
          {shown.map((f) => {
            const owned = bySpecies[f.id];
            return (
              <li key={f.id}>
                <button
                  className={`slot${owned ? '' : ' locked'}${selected?.id === f.id ? ' selected' : ''}${
                    owned && f.rarity === 'legendary' ? ' shiny' : ''
                  }`}
                  onClick={() => owned && go(`collection/flower/${f.id}`)}
                  disabled={!owned}
                  aria-label={owned ? flowerText(f, 'name') : t('c.unknown')}
                >
                  {f.nation && <PixelFlag code={f.nation} className="slot-flag" />}
                  {owned && f.rarity === 'legendary' && <Twinkles stars={SLOT_STARS} />}
                  <PixelPlant flower={f} progress={1} scale={2} silhouette={owned ? null : '#d9cdbf'} />
                  <span className="slot-name">{owned ? flowerText(f, 'name') : '???'}</span>
                  {owned && (
                    <span className="slot-stars" style={{ color: RARITY[f.rarity].color }}>
                      {'★'.repeat(RARITY[f.rarity].stars)}
                    </span>
                  )}
                  {owned?.length > 1 && <span className="slot-count">×{owned.length}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="detail">
          {selected ? (
            <FlowerDetail
              flower={selected}
              entries={bySpecies[selected.id]}
              lang={lang}
              onGift={(uid) => go(`collection/gift/${uid}`)}
            />
          ) : (
            <div className="empty">
              <PixelIcon name="water" scale={4} />
              <p>
                <strong>{t('c.welcome1')}</strong>
              </p>
              <p>{t('c.welcome2')}</p>
              <p>{t('c.welcome3')}</p>
              <p>{t('c.welcome4')}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FlowerDetail({ flower, entries, lang, onGift }) {
  const rarity = RARITY[flower.rarity];
  const origin = flowerText(flower, 'origin');
  return (
    <>
      <div className="detail-hero" style={{ '--tint': flower.colors.a }}>
        <PixelPlant flower={flower} progress={1} scale={4} />
        {/* 전설 꽃: 상세를 열 때마다 한 번 터지고 계속 반짝인다 */}
        {flower.rarity === 'legendary' && <Twinkles key={flower.id} stars={HERO_STARS} burst center={[50, 34]} />}
      </div>
      <h2>
        {/* 작은 글씨: 영어 화면에서는 한국어 원래 이름, 그 밖에는 영어 이름 */}
        {flowerText(flower, 'name')} <small>{lang === 'en' ? flower.name : flower.nameEn}</small>
      </h2>
      <p className="rarity" style={{ color: rarity.color }}>
        {'★'.repeat(rarity.stars)} {rarity.label}
        {lang === 'en' ? '' : ` · ${t(`rarity.${flower.rarity}`)}`}
      </p>
      <p className="where">
        {flower.nation ? (
          <>
            <PixelFlag code={flower.nation} /> {t('national', { nation: nationName(flower.nation) })}
          </>
        ) : (
          (origin ?? regionName(flower.region))
        )}
        {flower.nation || origin ? ` · ${regionName(flower.region)}` : ''}
      </p>
      <p className="lang">
        {t('flowerLanguage')} 「{flowerText(flower, 'language')}」
      </p>
      <p className="msg">“{flowerText(flower, 'message')}”</p>

      <h3>{t('c.records')}</h3>
      <ol className="records">
        {[...entries].reverse().map((e) => (
          <li key={e.uid}>
            <div>
              <strong>{t('c.bloomedOn', { date: formatDate(e.bloomedAt) })}</strong>
              {e.giftFrom != null && <span className="gift-tag">🎁 {e.giftFrom || t('c.giftTag')}</span>}
              <span className="muted">
                {' '}
                · {t('c.took', { time: formatDuration(e.bloomedAt - e.startedAt) })}
              </span>
              <div className="care-counts">
                <PixelIcon name="note" scale={1} /> {e.care?.song ?? 0}
                <PixelIcon name="water" scale={1} /> {e.care?.water ?? 0}
                <PixelIcon name="sun" scale={1} /> {e.care?.sun ?? 0}
                <PixelIcon name="fertilizer" scale={1} /> {e.care?.fertilizer ?? 0}
              </div>
            </div>
            <button className="px-btn gift-btn" onClick={() => onGift(e.uid)}>
              <PixelIcon name="gift" scale={2} /> {t('c.gift')}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

