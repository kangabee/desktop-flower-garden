// 도감 창의 다른 탭: 방문객 · 꾸미기 · 설정
import { useState } from 'react';
import PixelIcon from './components/PixelIcon.jsx';
import PixelPlant from './components/PixelPlant.jsx';
import { FLOWERS } from './data/flowers.js';
import { SKINS, skinProgress } from './data/skins.js';
import { VISITORS, VISITOR_IDS } from './data/visitors.js';
import { POT_UNLOCKS, discoveredSet } from './lib/pots.js';
import { gardenApi, settingsOf, updateGarden, useGarden } from './lib/garden.js';
import { LANGUAGES, regionName, t } from './i18n/index.js';

// 꾸미기 미리보기에 쓰는 꽃 (어떤 화분 색과도 잘 어울리는 흰 데이지)
const PREVIEW_FLOWER = FLOWERS.find((f) => f.id === 'daisy') ?? FLOWERS[0];

/* ── 방문객 ── */
export function VisitorsPage() {
  const { visitors = {} } = useGarden();
  const met = VISITOR_IDS.filter((id) => visitors[id]).length;
  return (
    <>
      <p className="page-intro">{t('vp.intro', { met, total: VISITOR_IDS.length })}</p>
      <ul className="cards">
        {VISITOR_IDS.map((id) => {
          const count = visitors[id] ?? 0;
          return (
            <li key={id} className={`card${count ? '' : ' locked'}`}>
              <div className="card-art">
                <PixelIcon name={`${id}A`} scale={4} />
              </div>
              <div>
                <h3>{count ? t(`visit.${id}.name`) : '???'}</h3>
                <p>{count ? t(`visit.${id}.desc`) : t('vp.unknown')}</p>
                {VISITORS[id].night && <p className="muted">🌙 {t('vp.night')}</p>}
                {count > 0 && <p className="muted">{t('vp.count', { n: count })}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted page-foot">{t('vp.howto')}</p>
    </>
  );
}

/* ── 꾸미기: 화분 색 · 선반 ── */
export function DecorPage() {
  const garden = useGarden();
  const discovered = discoveredSet(garden.collection);
  const chosen = garden.potSkin ?? 'classic';
  return (
    <>
      <h2 className="page-title">{t('dp.shelf')}</h2>
      <p className="page-intro">
        {POT_UNLOCKS.map((need, i) => (
          <span key={need} className={`pot-step${discovered.size >= need ? ' done' : ''}`}>
            {t('dp.potN', { n: i + 1 })} · {need ? t('dp.need', { n: need }) : t('dp.basic')}
          </span>
        ))}
      </p>

      <h2 className="page-title">{t('dp.skins')}</h2>
      <ul className="cards skins">
        {SKINS.map((skin) => {
          const prog = skinProgress(skin, discovered);
          const condition = skin.region
            ? t('dp.regionAll', { region: regionName(skin.region) })
            : skin.legendary
              ? t('dp.legendary', { n: skin.legendary })
              : t('dp.basic');
          return (
            <li key={skin.id}>
              <button
                className={`card skin${prog.unlocked ? '' : ' locked'}${chosen === skin.id ? ' selected' : ''}`}
                disabled={!prog.unlocked}
                aria-pressed={chosen === skin.id}
                onClick={() => updateGarden({ potSkin: skin.id })}
              >
                <div className="card-art">
                  <PixelPlant
                    flower={PREVIEW_FLOWER}
                    progress={1}
                    scale={2}
                    potColors={skin.colors}
                    silhouette={prog.unlocked ? null : '#d9cdbf'}
                  />
                </div>
                <div>
                  <h3>{t(`skin.${skin.id}`)}</h3>
                  <p className="muted">{condition}</p>
                  {!prog.unlocked && (
                    <p className="muted">
                      {prog.have}/{prog.need}
                    </p>
                  )}
                  {chosen === skin.id && <p className="ok">✓ {t('dp.using')}</p>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ── 설정 ── */
export function SettingsPage() {
  const garden = useGarden();
  const settings = settingsOf(garden);
  const set = (patch) => updateGarden({ settings: { ...settingsOf(garden), ...patch } });

  return (
    <div className="settings">
      <section>
        <h2 className="page-title">{t('sp.general')}</h2>
        <label className="row">
          <input type="checkbox" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
          {t('sp.sound')}
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(e) => set({ reduceMotion: e.target.checked })}
          />
          <span>
            {t('sp.reduceMotion')} <small className="muted">{t('sp.reduceMotionHint')}</small>
          </span>
        </label>
        <div className="row">
          <span>{t('sp.size')}</span>
          <div className="seg">
            {['small', 'normal', 'large'].map((size) => (
              <button
                key={size}
                className={`px-btn ghost${settings.size === size ? ' primary' : ''}`}
                aria-pressed={settings.size === size}
                onClick={() => set({ size })}
              >
                {t(`sp.size.${size}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <span>{t('sp.language')}</span>
          <select
            value={garden.language ?? ''}
            onChange={(e) => updateGarden({ language: e.target.value || null })}
          >
            <option value="">{t('sp.languageAuto')}</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <WeatherSettings settings={settings} set={set} />
      <BackupSettings />
    </div>
  );
}

/** 검색 결과 → '부산광역시, 대한민국' (같은 이름이 겹치면 한 번만) */
const cityName = (r) => [...new Set([r.name, r.admin1, r.country].filter(Boolean))].join(', ');

function WeatherSettings({ settings, set }) {
  const { weather } = settings;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState('');

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus(t('sp.searching'));
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?count=5&format=json&language=${t('sp.geoLang')}&name=${encodeURIComponent(query.trim())}`;
      const data = await (await fetch(url)).json();
      setResults(data.results ?? []);
      setStatus(data.results?.length ? '' : t('sp.noCity'));
    } catch {
      setResults(null);
      setStatus(t('sp.offline'));
    }
  };

  const choose = (r) => {
    const name = cityName(r);
    set({ weather: { enabled: true, name, lat: r.latitude, lon: r.longitude } });
    setResults(null);
    setQuery('');
    setStatus('');
  };

  return (
    <section>
      <h2 className="page-title">{t('sp.weather')}</h2>
      <p className="muted">{t('sp.weatherHint')}</p>
      <label className="row">
        <input
          type="checkbox"
          checked={weather.enabled && weather.lat != null}
          disabled={weather.lat == null}
          onChange={(e) => set({ weather: { ...weather, enabled: e.target.checked } })}
        />
        {weather.name ? t('sp.weatherOn', { city: weather.name }) : t('sp.weatherPick')}
      </label>
      <form className="row" onSubmit={search}>
        <input
          className="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sp.cityPlaceholder')}
        />
        <button className="px-btn" type="submit">
          {t('sp.search')}
        </button>
      </form>
      {results?.length > 0 && (
        <ul className="city-results">
          {results.map((r) => (
            <li key={r.id}>
              <button className="px-btn ghost" onClick={() => choose(r)}>
                {cityName(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="status">{status}</p>}
      <p className="muted small">{t('sp.weatherEffects')}</p>
    </section>
  );
}

function BackupSettings() {
  const [status, setStatus] = useState({ text: '', kind: '' });
  const [pending, setPending] = useState(null);
  const available = Boolean(gardenApi.exportGarden);

  const doExport = async () => {
    const name = await gardenApi.exportGarden();
    if (name) setStatus({ text: t('sp.exported', { name }), kind: 'ok' });
  };
  const doImport = async () => {
    const r = await gardenApi.importGarden();
    if (!r) return;
    if (!r.ok) setStatus({ text: t('sp.importBad'), kind: 'err' });
    else {
      setPending(r);
      setStatus({ text: '', kind: '' });
    }
  };
  const apply = async () => {
    await gardenApi.applyImport();
    setPending(null);
    setStatus({ text: t('sp.imported'), kind: 'ok' });
  };

  return (
    <section>
      <h2 className="page-title">{t('sp.backup')}</h2>
      <p className="muted">{t('sp.backupHint')}</p>
      <div className="row">
        <button className="px-btn" disabled={!available} onClick={doExport}>
          {t('sp.export')}
        </button>
        <button className="px-btn" disabled={!available} onClick={doImport}>
          {t('sp.import')}
        </button>
      </div>
      {pending && (
        <div className="confirm">
          <p>{t('sp.importConfirm', { species: pending.species, bloomed: pending.bloomed })}</p>
          <div className="row">
            <button className="px-btn primary" onClick={apply}>
              {t('sp.importYes')}
            </button>
            <button className="px-btn ghost" onClick={() => setPending(null)}>
              {t('sp.cancel')}
            </button>
          </div>
        </div>
      )}
      {status.text && <p className={`status ${status.kind}`}>{status.text}</p>}
    </section>
  );
}
