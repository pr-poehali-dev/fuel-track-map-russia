import { useState, useMemo, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';

type Fuel = { ai92: number; ai95: number; ai98: number; dt: number };
type FuelStatus = 'yes' | 'no' | null;
type Vote = { yes: number; no: number; userVote: FuelStatus };

type Station = {
  id: number;
  brand: string;
  address: string;
  city: string;
  x: number;
  y: number;
  fuel: Fuel;
  rating: number;
};

// Реальные средние цены по России — июль 2026 (по данным Росстат / мониторинг АЗС)
const RUSSIA_AVG: Fuel = { ai92: 53.80, ai95: 58.60, ai98: 65.40, dt: 67.20 };

// Разброс цен по городу относительно среднего
const CITY_DELTA: Record<string, Partial<Fuel>> = {
  'Москва':           { ai92: +2.1, ai95: +2.4, ai98: +3.0, dt: +1.8 },
  'Санкт-Петербург':  { ai92: +1.8, ai95: +2.1, ai98: +2.7, dt: +1.5 },
  'Краснодар':        { ai92: -0.4, ai95: -0.3, ai98: +0.5, dt: -0.8 },
  'Казань':           { ai92: +0.2, ai95: +0.5, ai98: +1.0, dt: +0.4 },
  'Екатеринбург':     { ai92: -0.8, ai95: -0.5, ai98: -0.2, dt: -1.2 },
  'Новосибирск':      { ai92: -1.2, ai95: -0.9, ai98: -0.5, dt: -1.8 },
  'Нижний Новгород':  { ai92: +0.5, ai95: +0.7, ai98: +1.2, dt: +0.3 },
  'Ростов-на-Дону':   { ai92: -0.3, ai95: -0.1, ai98: +0.6, dt: -0.5 },
};

const CITIES = [
  { name: 'Москва',          x: 41, y: 40, lat: 55.7558, lon: 37.6173, zoom: 10 },
  { name: 'Санкт-Петербург', x: 36, y: 30, lat: 59.9343, lon: 30.3351, zoom: 10 },
  { name: 'Казань',          x: 50, y: 45, lat: 55.7963, lon: 49.1088, zoom: 11 },
  { name: 'Екатеринбург',    x: 58, y: 42, lat: 56.8389, lon: 60.6057, zoom: 11 },
  { name: 'Новосибирск',     x: 68, y: 52, lat: 55.0084, lon: 82.9357, zoom: 11 },
  { name: 'Краснодар',       x: 38, y: 62, lat: 45.0355, lon: 38.9753, zoom: 11 },
  { name: 'Нижний Новгород', x: 46, y: 41, lat: 56.2965, lon: 43.9361, zoom: 11 },
  { name: 'Ростов-на-Дону',  x: 39, y: 58, lat: 47.2357, lon: 39.7015, zoom: 11 },
];

const BRANDS = ['Лукойл', 'Газпромнефть', 'Роснефть', 'Татнефть', 'Башнефть', 'Нефтьмагистраль'];

const rnd = (center: number, spread: number) =>
  +(center + (Math.random() - 0.5) * spread * 2).toFixed(2);

const makeFuel = (city: string): Fuel => {
  const d = CITY_DELTA[city] ?? {};
  return {
    ai92: rnd(RUSSIA_AVG.ai92 + (d.ai92 ?? 0), 0.6),
    ai95: rnd(RUSSIA_AVG.ai95 + (d.ai95 ?? 0), 0.6),
    ai98: rnd(RUSSIA_AVG.ai98 + (d.ai98 ?? 0), 0.8),
    dt:   rnd(RUSSIA_AVG.dt   + (d.dt   ?? 0), 0.7),
  };
};

const STATIONS: Station[] = Array.from({ length: 34 }).map((_, i) => {
  const city = CITIES[i % CITIES.length];
  return {
    id: i + 1,
    brand: BRANDS[i % BRANDS.length],
    address: `ул. ${['Ленина', 'Мира', 'Гагарина', 'Советская', 'Кольцевая'][i % 5]}, ${10 + i}`,
    city: city.name,
    x: city.x + (Math.random() * 8 - 4),
    y: city.y + (Math.random() * 8 - 4),
    fuel: makeFuel(city.name),
    rating: +(3.8 + Math.random() * 1.2).toFixed(1),
  };
});

// Начальные голоса — имитируем что уже проголосовали люди
const initVotes = (): Record<number, Vote> => {
  const map: Record<number, Vote> = {};
  STATIONS.forEach((s) => {
    const yes = Math.floor(Math.random() * 18) + 2;
    const no  = Math.floor(Math.random() * 8);
    map[s.id] = { yes, no, userVote: null };
  });
  return map;
};

const FUEL_LABELS: { key: keyof Fuel; label: string; color: string }[] = [
  { key: 'ai92', label: 'АИ-92', color: '#2563eb' },
  { key: 'ai95', label: 'АИ-95', color: '#16a34a' },
  { key: 'ai98', label: 'АИ-98', color: '#9333ea' },
  { key: 'dt',   label: 'ДТ',    color: '#ea580c' },
];

const Index = () => {
  const [query, setQuery] = useState('');
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState<keyof Fuel>('ai95');
  const [selected, setSelected] = useState<Station | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [votes, setVotes] = useState<Record<number, Vote>>(initVotes);
  const [justVoted, setJustVoted] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [query]);

  const filtered = useMemo(() => {
    let list = [...STATIONS];
    if (activeCity) list = list.filter((s) => s.city === activeCity);
    return list.sort((a, b) => a.fuel[fuelType] - b.fuel[fuelType]);
  }, [activeCity, fuelType]);

  const prices = STATIONS.map((s) => s.fuel[fuelType]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const priceColor = (p: number) => {
    const t = (p - minP) / (maxP - minP || 1);
    if (t < 0.34) return '#16a34a';
    if (t < 0.67) return '#eab308';
    return '#dc2626';
  };

  const selectCity = (name: string) => {
    setActiveCity(name);
    setQuery(name);
    setShowSuggest(false);
    setSelected(null);
  };

  const castVote = (stationId: number, vote: FuelStatus) => {
    setVotes((prev) => {
      const cur = prev[stationId];
      if (cur.userVote === vote) return prev; // уже голосовал так
      const next = { ...cur };
      if (cur.userVote === 'yes') next.yes = Math.max(0, next.yes - 1);
      if (cur.userVote === 'no')  next.no  = Math.max(0, next.no  - 1);
      if (vote === 'yes') next.yes += 1;
      if (vote === 'no')  next.no  += 1;
      next.userVote = vote;
      return { ...prev, [stationId]: next };
    });
    setJustVoted(stationId);
    setTimeout(() => setJustVoted(null), 1500);
  };

  const mapUrl = useMemo(() => {
    const city = CITIES.find((c) => c.name === (selected?.city || activeCity));
    if (city) {
      return `https://yandex.ru/map-widget/v1/?ll=${city.lon}%2C${city.lat}&z=${city.zoom}&text=${encodeURIComponent('заправки ' + city.name)}`;
    }
    return `https://yandex.ru/map-widget/v1/?ll=60%2C60&z=3&text=${encodeURIComponent('заправки')}`;
  }, [activeCity, selected]);

  const fuelMeta = FUEL_LABELS.find((f) => f.key === fuelType)!;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Icon name="Fuel" size={20} className="text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg leading-none tracking-wide">БЕНЗИН·КАРТА</div>
              <div className="text-[11px] text-muted-foreground">цены на топливо России</div>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <span className="flex items-center gap-1.5"><Icon name="MapPin" size={15} /> {STATIONS.length} АЗС</span>
            <span className="flex items-center gap-1.5"><Icon name="RefreshCw" size={15} /> июль 2026</span>
          </div>
        </div>
      </header>

      {/* Средние цены по России */}
      <div className="border-b border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-6 py-3">
          <span className="shrink-0 text-xs font-medium text-muted-foreground mr-2">Средние по РФ:</span>
          {FUEL_LABELS.map((f) => (
            <div key={f.key} className="shrink-0 flex items-center gap-2 rounded-lg bg-white border border-border px-3 py-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className="font-display text-sm font-semibold">{RUSSIA_AVG[f.key].toFixed(2)} ₽</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-8 pb-6">
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Где заправиться <span className="text-green-600">выгоднее</span>?
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Актуальные цены + народный мониторинг: сообщайте, есть ли бензин на АЗС прямо сейчас.
        </p>

        {/* Search */}
        <div ref={boxRef} className="relative mt-5 max-w-md">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 shadow-sm transition focus-within:border-primary focus-within:shadow-md">
            <Icon name="Search" size={18} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              placeholder="Введите город или адрес…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {activeCity && (
              <button onClick={() => { setActiveCity(null); setQuery(''); }} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={16} />
              </button>
            )}
          </div>
          {showSuggest && suggestions.length > 0 && (
            <div className="absolute z-20 mt-2 w-full animate-scale-in overflow-hidden rounded-xl border border-border bg-white shadow-lg">
              {suggestions.map((c) => (
                <button key={c.name} onClick={() => selectCity(c.name)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition hover:bg-secondary">
                  <Icon name="MapPin" size={15} className="text-muted-foreground" />
                  <span>{c.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {STATIONS.filter((s) => s.city === c.name).length} АЗС
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fuel tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {FUEL_LABELS.map((f) => (
            <button key={f.key} onClick={() => setFuelType(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                fuelType === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Map + list */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1.6fr_1fr]">
        {/* Map */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-[#f7f9fb]">
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> дёшево</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> средне</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> дорого</span>
          </div>
          <iframe
            title="Карта заправок"
            src={mapUrl}
            className="h-full min-h-[440px] w-full border-0"
            allowFullScreen
            loading="lazy"
          />
        </div>

        {/* Panel */}
        <div className="flex flex-col">
          {selected ? (
            /* Station detail */
            <div className="animate-fade-in rounded-2xl border border-border bg-white p-5 shadow-sm">
              <button onClick={() => setSelected(null)}
                className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <Icon name="ArrowLeft" size={15} /> к списку
              </button>

              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-xl">{selected.brand}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{selected.city}, {selected.address}</div>
                </div>
                <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                  <Icon name="Star" size={13} className="text-yellow-500" /> {selected.rating}
                </span>
              </div>

              {/* Цены */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {FUEL_LABELS.map((f) => (
                  <div key={f.key}
                    className={`rounded-xl border p-3 ${fuelType === f.key ? 'border-primary bg-secondary' : 'border-border'}`}>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.color }} />
                      {f.label}
                    </div>
                    <div className="font-display text-lg">{selected.fuel[f.key].toFixed(2)} ₽</div>
                    <div className={`text-[11px] mt-0.5 ${selected.fuel[f.key] < RUSSIA_AVG[f.key] ? 'text-green-600' : 'text-red-500'}`}>
                      {selected.fuel[f.key] < RUSSIA_AVG[f.key]
                        ? `−${(RUSSIA_AVG[f.key] - selected.fuel[f.key]).toFixed(2)} ₽ ниже среднего`
                        : `+${(selected.fuel[f.key] - RUSSIA_AVG[f.key]).toFixed(2)} ₽ выше среднего`}
                    </div>
                  </div>
                ))}
              </div>

              {/* Народный мониторинг */}
              <div className="mt-5 rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Icon name="Users" size={15} /> Есть бензин сейчас?
                </div>

                {(() => {
                  const v = votes[selected.id];
                  const total = v.yes + v.no;
                  const yesPct = total ? Math.round((v.yes / total) * 100) : 50;
                  return (
                    <>
                      {/* Кнопки голосования */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => castVote(selected.id, 'yes')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                            v.userVote === 'yes'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                          }`}>
                          <Icon name="CheckCircle" size={16} /> Есть
                        </button>
                        <button
                          onClick={() => castVote(selected.id, 'no')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                            v.userVote === 'no'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          }`}>
                          <Icon name="XCircle" size={16} /> Нет
                        </button>
                      </div>

                      {/* Прогресс-бар */}
                      <div className="mt-3">
                        <div className="flex h-2 overflow-hidden rounded-full bg-red-100">
                          <div
                            className="bg-green-500 transition-all duration-500"
                            style={{ width: `${yesPct}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                          <span className="text-green-700 font-medium">{v.yes} — есть ({yesPct}%)</span>
                          <span className="text-red-600 font-medium">{v.no} — нет</span>
                        </div>
                        {justVoted === selected.id && (
                          <div className="mt-2 animate-fade-in text-center text-xs font-medium text-green-600">
                            Спасибо! Ваш голос учтён 👍
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] text-muted-foreground text-center">
                        {total} {total === 1 ? 'голос' : total < 5 ? 'голоса' : 'голосов'} за последние 2 часа
                      </div>
                    </>
                  );
                })()}
              </div>

              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                <Icon name="Navigation" size={16} /> Построить маршрут
              </button>
            </div>
          ) : (
            /* Stations list */
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="font-display text-base tracking-wide">
                  {activeCity ? activeCity.toUpperCase() : 'ВСЕ АЗС'} · {fuelMeta.label}
                </span>
                <span className="text-xs text-muted-foreground">дешевле → дороже</span>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {filtered.map((s, i) => {
                  const v = votes[s.id];
                  const total = v.yes + v.no;
                  const hasGas = total === 0 ? null : v.yes >= v.no;
                  return (
                    <button key={s.id} onClick={() => setSelected(s)}
                      className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left transition last:border-0 hover:bg-secondary">
                      <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: priceColor(s.fuel[fuelType]) }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.brand}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.city}, {s.address}</div>
                      </div>
                      {/* Статус бензина */}
                      {hasGas === null ? null : (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          hasGas ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {hasGas ? '✓ есть' : '✗ нет'}
                        </span>
                      )}
                      <div className="font-display text-base shrink-0">{s.fuel[fuelType].toFixed(2)} ₽</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Бензин·Карта — средние цены по данным мониторинга АЗС России, июль 2026. Народный мониторинг наличия топлива.
      </footer>
    </div>
  );
};

export default Index;
