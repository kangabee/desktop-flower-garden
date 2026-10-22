import { useEffect, useMemo, useState } from 'react';
import PixelPlant from './components/PixelPlant.jsx';
import PixelIcon from './components/PixelIcon.jsx';
import PixelFlag from './components/PixelFlag.jsx';
import GiftEditor from './GiftEditor.jsx';
import { FLOWERS, FLOWER_BY_ID, NATIONS, RARITY, REGIONS } from './data/flowers.js';
import { gardenApi, useGarden } from './lib/garden.js';
import { formatDate } from './lib/card.js';
import './collection.css';

// 해시 라우트: #collection · #collection/flower/<id> · #collection/gift/<uid>
function parseRoute(hash) {
  const [, view, id] = hash.replace(/^#/, '').split('/');
  return { view: view ?? 'list', id: id ? decodeURIComponent(id) : null };
}

const REGION_KEY = 'dfg.collection.region';
const REGION_LABEL = Object.fromEntries(REGIONS.map((r) => [r.id, r.label]));

function loadRegion() {
  try {
    return localStorage.getItem(REGION_KEY) || 'all';
  } catch {
    return 'all';
  }
}

function formatDuration(ms) {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return [d && `${d}일`, h && `${h}시간`, !d && m && `${m}분`].filter(Boolean).join(' ');
}

export default function Collection() {
  const { collection } = useGarden();
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
        <p className="empty">이 꽃을 도감에서 찾을 수 없어요.</p>
        <button className="px-btn" onClick={() => go('collection')}>
          도감으로
        </button>
      </div>
    );
  }

  const discovered = Object.keys(bySpecies).length;
  const shown = region === 'all' ? FLOWERS : FLOWERS.filter((f) => f.region === region);
  const selected = FLOWER_BY_ID[route.id] ?? shown.find((f) => bySpecies[f.id]) ?? null;
  const tabs = [{ id: 'all', label: '전체' }, ...REGIONS].map((r) => {
    const list = r.id === 'all' ? FLOWERS : FLOWERS.filter((f) => f.region === r.id);
    return { ...r, total: list.length, found: list.filter((f) => bySpecies[f.id]).length };
  });

  return (
    <div className="book">
      <header className="book-header">
        <h1>
          <PixelIcon name="book" scale={3} /> 꽃 도감
        </h1>
        <p>
          발견 <strong>{discovered}</strong> / {FLOWERS.length} 종 · 피운 꽃 <strong>{collection.length}</strong> 송이
        </p>
      </header>

      <nav className="region-tabs" aria-label="대륙별 도감">
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
                  className={`slot${owned ? '' : ' locked'}${selected?.id === f.id ? ' selected' : ''}`}
                  onClick={() => owned && go(`collection/flower/${f.id}`)}
                  disabled={!owned}
                  aria-label={owned ? f.name : '아직 만나지 못한 꽃'}
                >
                  {f.nation && <PixelFlag code={f.nation} className="slot-flag" />}
                  <PixelPlant flower={f} progress={1} scale={2} silhouette={owned ? null : '#d9cdbf'} />
                  <span className="slot-name">{owned ? f.name : '???'}</span>
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
            <FlowerDetail flower={selected} entries={bySpecies[selected.id]} onGift={(uid) => go(`collection/gift/${uid}`)} />
          ) : (
            <div className="empty">
              <PixelIcon name="water" scale={4} />
              <p>
                <strong>화면 오른쪽 아래에 화분이 생겼어요!</strong>
              </p>
              <p>화분을 클릭하면 물·햇빛·노래·비료로 돌봐줄 수 있고,</p>
              <p>우클릭하면 설정 메뉴가 열려요.</p>
              <p>씨앗은 24시간 동안 천천히 자라고, 꽃이 피면 이 도감에 모여요.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FlowerDetail({ flower, entries, onGift }) {
  const rarity = RARITY[flower.rarity];
  return (
    <>
      <div className="detail-hero" style={{ '--tint': flower.colors.a }}>
        <PixelPlant flower={flower} progress={1} scale={4} />
      </div>
      <h2>
        {flower.name} <small>{flower.nameEn}</small>
      </h2>
      <p className="rarity" style={{ color: rarity.color }}>
        {'★'.repeat(rarity.stars)} {rarity.label} · {rarity.ko}
      </p>
      <p className="where">
        {flower.nation ? (
          <>
            <PixelFlag code={flower.nation} /> {NATIONS[flower.nation]}의 나라꽃
          </>
        ) : (
          (flower.origin ?? REGION_LABEL[flower.region])
        )}
        {flower.nation || flower.origin ? ` · ${REGION_LABEL[flower.region]}` : ''}
      </p>
      <p className="lang">꽃말 「{flower.language}」</p>
      <p className="msg">“{flower.message}”</p>

      <h3>키운 기록</h3>
      <ol className="records">
        {[...entries].reverse().map((e) => (
          <li key={e.uid}>
            <div>
              <strong>{formatDate(e.bloomedAt)}</strong> 개화
              {e.giftFrom != null && <span className="gift-tag">🎁 {e.giftFrom || '선물'}</span>}
              <span className="muted">
                {' '}
                · {formatDuration(e.bloomedAt - e.startedAt)} 만에
              </span>
              <div className="care-counts">
                <PixelIcon name="note" scale={1} /> {e.care?.song ?? 0}
                <PixelIcon name="water" scale={1} /> {e.care?.water ?? 0}
                <PixelIcon name="sun" scale={1} /> {e.care?.sun ?? 0}
                <PixelIcon name="fertilizer" scale={1} /> {e.care?.fertilizer ?? 0}
              </div>
            </div>
            <button className="px-btn gift-btn" onClick={() => onGift(e.uid)}>
              <PixelIcon name="gift" scale={2} /> 선물하기
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

