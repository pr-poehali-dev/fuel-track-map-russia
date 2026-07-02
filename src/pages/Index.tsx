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
  px: number; // позиция на SVG-карте %
  py: number;
  fuel: Fuel;
  rating: number;
};

type MapPin = {
  id: string;
  px: number;
  py: number;
  status: 'yes' | 'no';
  label: string;
  ts: number;
};

const RUSSIA_AVG: Fuel = { ai92: 53.80, ai95: 58.60, ai98: 65.40, dt: 67.20 };

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

// Позиции городов в % от размера SVG viewBox (0–100)
const CITIES = [
  { name: 'Москва',          px: 38, py: 37, zoom: 10 },
  { name: 'Санкт-Петербург', px: 32, py: 24, zoom: 10 },
  { name: 'Казань',          px: 50, py: 38, zoom: 11 },
  { name: 'Екатеринбург',    px: 60, py: 34, zoom: 11 },
  { name: 'Новосибирск',     px: 72, py: 42, zoom: 11 },
  { name: 'Краснодар',       px: 37, py: 56, zoom: 11 },
  { name: 'Нижний Новгород', px: 45, py: 36, zoom: 11 },
  { name: 'Ростов-на-Дону',  px: 40, py: 52, zoom: 11 },
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
    px: city.px + (Math.random() * 7 - 3.5),
    py: city.py + (Math.random() * 7 - 3.5),
    fuel: makeFuel(city.name),
    rating: +(3.8 + Math.random() * 1.2).toFixed(1),
  };
});

const initVotes = (): Record<number, Vote> => {
  const map: Record<number, Vote> = {};
  STATIONS.forEach((s) => {
    map[s.id] = { yes: Math.floor(Math.random() * 18) + 2, no: Math.floor(Math.random() * 8), userVote: null };
  });
  return map;
};

const FUEL_LABELS: { key: keyof Fuel; label: string; color: string }[] = [
  { key: 'ai92', label: 'АИ-92', color: '#2563eb' },
  { key: 'ai95', label: 'АИ-95', color: '#16a34a' },
  { key: 'ai98', label: 'АИ-98', color: '#9333ea' },
  { key: 'dt',   label: 'ДТ',    color: '#ea580c' },
];

// SVG-контур России (упрощённый, достаточный для демо)
const RUSSIA_PATH = `
  M 18,28 L 22,22 L 28,18 L 34,16 L 38,14 L 44,13 L 50,13 L 56,14 L 62,13
  L 68,14 L 74,15 L 80,17 L 85,20 L 88,24 L 90,28 L 89,33 L 86,37
  L 88,40 L 87,44 L 84,47 L 80,50 L 76,52 L 72,55 L 68,57 L 64,58
  L 60,60 L 55,62 L 50,63 L 44,62 L 38,61 L 34,60 L 30,62 L 26,64
  L 22,63 L 18,60 L 14,56 L 12,51 L 12,46 L 14,41 L 16,36 L 16,31 Z
`;

const Index = () => {
  const [query, setQuery] = useState('');
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState<keyof Fuel>('ai95');
  const [selected, setSelected] = useState<Station | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [votes, setVotes] = useState<Record<number, Vote>>(initVotes);
  const [justVoted, setJustVoted] = useState<number | null>(null);

  // Состояние для пользовательских меток на карте
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [pendingPin, setPendingPin] = useState<{ px: number; py: number } | null>(null);
  const [pinStation, setPinStation] = useState<Station | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [pinLabel, setPinLabel] = useState('');
  const [showPinSuccess, setShowPinSuccess] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
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
      if (cur.userVote === vote) return prev;
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

  // Клик по карте в режиме добавления метки
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!addMode) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;

    // Найти ближайшую АЗС
    let nearest: Station | null = null;
    let minDist = Infinity;
    STATIONS.forEach((s) => {
      const dist = Math.hypot(s.px - px, s.py - py);
      if (dist < minDist) { minDist = dist; nearest = s; }
    });

    setPendingPin({ px, py });
    setPinStation(nearest);
    setPinLabel('');
  };

  const submitPin = (status: 'yes' | 'no') => {
    if (!pendingPin) return;
    const station = pinStation;
    const newPin: MapPin = {
      id: Date.now().toString(),
      px: pendingPin.px,
      py: pendingPin.py,
      status,
      label: pinLabel.trim() || (station ? `${station.brand}, ${station.address}` : 'АЗС'),
      ts: Date.now(),
    };
    setMapPins((prev) => [...prev, newPin]);
    // Обновить голос ближайшей АЗС
    if (station) castVote(station.id, status);
    setPendingPin(null);
    setPinStation(null);
    setAddMode(false);
    setShowPinSuccess(true);
    setTimeout(() => setShowPinSuccess(false), 2500);
  };

  const cancelPin = () => {
    setPendingPin(null);
    setPinStation(null);
    setAddMode(false);
  };

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
          Актуальные цены + народный мониторинг: кликайте на карту и отмечайте наличие бензина.
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

        {/* ===== SVG MAP ===== */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-[#eef4fb] shadow-sm">

          {/* Легенда */}
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> дёшево</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> средне</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> дорого</span>
          </div>

          {/* Кнопка режима добавления метки */}
          <button
            onClick={() => { setAddMode((v) => !v); setPendingPin(null); }}
            className={`absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition ${
              addMode
                ? 'bg-amber-500 text-white'
                : 'bg-white/90 text-foreground backdrop-blur hover:bg-white'
            }`}
          >
            <Icon name={addMode ? 'X' : 'MapPin'} size={14} />
            {addMode ? 'Отменить' : '+ Отметить АЗС'}
          </button>

          {/* Подсказка режима */}
          {addMode && !pendingPin && (
            <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 animate-fade-in rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
              Кликните на карте по нужной АЗС
            </div>
          )}

          {/* Уведомление об успехе */}
          {showPinSuccess && (
            <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 animate-fade-in rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
              ✓ Метка добавлена! Спасибо за информацию
            </div>
          )}

          {/* Попап выбора статуса */}
          {pendingPin && (
            <div
              className="absolute z-20 animate-scale-in"
              style={{
                left: `${Math.min(pendingPin.px, 70)}%`,
                top: `${Math.max(pendingPin.py - 18, 5)}%`,
              }}
            >
              <div className="rounded-2xl border border-border bg-white p-4 shadow-xl w-64">
                <div className="mb-1 font-semibold text-sm">Отметить статус АЗС</div>
                {pinStation && (
                  <div className="mb-3 text-xs text-muted-foreground">
                    {pinStation.brand} · {pinStation.city}, {pinStation.address}
                  </div>
                )}
                <input
                  value={pinLabel}
                  onChange={(e) => setPinLabel(e.target.value)}
                  placeholder="Комментарий (необязательно)"
                  className="mb-3 w-full rounded-lg border border-border px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submitPin('yes')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-xs font-bold text-white transition hover:bg-green-700"
                  >
                    <Icon name="CheckCircle" size={14} /> Есть бензин
                  </button>
                  <button
                    onClick={() => submitPin('no')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700"
                  >
                    <Icon name="XCircle" size={14} /> Нет бензина
                  </button>
                </div>
                <button onClick={cancelPin} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* SVG карта */}
          <svg
            ref={svgRef}
            viewBox="0 0 100 78"
            className={`h-full min-h-[480px] w-full select-none ${addMode ? 'cursor-crosshair' : 'cursor-default'}`}
            onClick={handleMapClick}
          >
            <defs>
              <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
                <path d="M 4 0 L 0 0 0 4" fill="none" stroke="#dce8f5" strokeWidth="0.15" />
              </pattern>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.12" />
              </filter>
            </defs>

            {/* Фон */}
            <rect width="100" height="78" fill="#dce8f5" />
            <rect width="100" height="78" fill="url(#grid)" />

            {/* Основной контур России */}
            <path d={RUSSIA_PATH} fill="#c8dff0" stroke="#a8c8e8" strokeWidth="0.4" filter="url(#shadow)" />

            {/* Внутренние детали — реки/регионы (имитация) */}
            <path d="M 38,37 Q 42,34 46,36 Q 50,38 54,36" stroke="#a8c8e8" strokeWidth="0.3" fill="none" opacity="0.6"/>
            <path d="M 30,44 Q 34,42 38,44 Q 40,46 42,48" stroke="#a8c8e8" strokeWidth="0.3" fill="none" opacity="0.5"/>
            <path d="M 60,34 Q 64,36 68,38 Q 72,40 76,42" stroke="#a8c8e8" strokeWidth="0.3" fill="none" opacity="0.5"/>

            {/* Названия городов */}
            {CITIES.map((c) => (
              <text key={c.name} x={c.px} y={c.py - 3.5} textAnchor="middle"
                fontSize="2" fill="#5a7a9a" fontFamily="Golos Text, sans-serif" opacity="0.8">
                {c.name}
              </text>
            ))}

            {/* Метки АЗС */}
            {STATIONS.map((s) => {
              const dim = activeCity && s.city !== activeCity;
              const isSel = selected?.id === s.id;
              const color = priceColor(s.fuel[fuelType]);
              const v = votes[s.id];
              const hasGas = v.yes + v.no > 0 ? v.yes >= v.no : null;
              return (
                <g key={s.id} opacity={dim ? 0.15 : 1} className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); if (!addMode) setSelected(s); }}>
                  {isSel && (
                    <circle cx={s.px} cy={s.py} r="3.5" fill={color} opacity="0.2" className="animate-ping-slow" />
                  )}
                  <circle cx={s.px} cy={s.py} r={isSel ? 2.2 : 1.5}
                    fill={color} stroke="#fff" strokeWidth="0.4" />
                  {/* Значок статуса бензина */}
                  {hasGas !== null && (
                    <circle cx={s.px + 1.6} cy={s.py - 1.6} r="1"
                      fill={hasGas ? '#16a34a' : '#dc2626'} stroke="#fff" strokeWidth="0.3" />
                  )}
                </g>
              );
            })}

            {/* Пользовательские метки */}
            {mapPins.map((pin) => (
              <g key={pin.id}>
                <circle cx={pin.px} cy={pin.py} r="2.2"
                  fill={pin.status === 'yes' ? '#16a34a' : '#dc2626'}
                  stroke="#fff" strokeWidth="0.5" opacity="0.95" />
                <text x={pin.px} y={pin.py - 2.8} textAnchor="middle"
                  fontSize="1.8" fill={pin.status === 'yes' ? '#16a34a' : '#dc2626'}
                  fontFamily="Golos Text, sans-serif" fontWeight="bold">
                  {pin.status === 'yes' ? '✓' : '✗'}
                </text>
              </g>
            ))}

            {/* Курсор при добавлении метки */}
            {pendingPin && (
              <circle cx={pendingPin.px} cy={pendingPin.py} r="2.5"
                fill="#f59e0b" stroke="#fff" strokeWidth="0.5" opacity="0.9" />
            )}
          </svg>
        </div>

        {/* Panel */}
        <div className="flex flex-col">
          {selected ? (
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
                      <div className="flex gap-2">
                        <button onClick={() => castVote(selected.id, 'yes')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                            v.userVote === 'yes'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                          }`}>
                          <Icon name="CheckCircle" size={16} /> Есть
                        </button>
                        <button onClick={() => castVote(selected.id, 'no')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                            v.userVote === 'no'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          }`}>
                          <Icon name="XCircle" size={16} /> Нет
                        </button>
                      </div>
                      <div className="mt-3">
                        <div className="flex h-2 overflow-hidden rounded-full bg-red-100">
                          <div className="bg-green-500 transition-all duration-500" style={{ width: `${yesPct}%` }} />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                          <span className="text-green-700 font-medium">{v.yes} — есть ({yesPct}%)</span>
                          <span className="text-red-600 font-medium">{v.no} — нет</span>
                        </div>
                        {justVoted === selected.id && (
                          <div className="mt-2 animate-fade-in text-center text-xs font-medium text-green-600">
                            Спасибо! Ваш голос учтён
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
                      {hasGas !== null && (
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

          {/* Лента последних меток */}
          {mapPins.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Icon name="Activity" size={15} /> Последние отметки
              </div>
              <div className="flex flex-col gap-1.5">
                {[...mapPins].reverse().slice(0, 4).map((pin) => (
                  <div key={pin.id} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${pin.status === 'yes' ? 'bg-green-600' : 'bg-red-600'}`} />
                    <span className="truncate flex-1 text-foreground">{pin.label}</span>
                    <span className={`shrink-0 font-semibold ${pin.status === 'yes' ? 'text-green-700' : 'text-red-600'}`}>
                      {pin.status === 'yes' ? 'есть' : 'нет'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Бензин·Карта — демо-версия. Цены по данным мониторинга АЗС России, июль 2026.
      </footer>
    </div>
  );
};

export default Index;
