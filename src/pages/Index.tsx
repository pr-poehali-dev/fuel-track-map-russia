import { useState, useMemo, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';

type Fuel = { ai92: number; ai95: number; ai98: number; dt: number };
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

const CITIES = [
  { name: 'Москва', x: 41, y: 40, lat: 55.7558, lon: 37.6173, zoom: 10 },
  { name: 'Санкт-Петербург', x: 36, y: 30, lat: 59.9343, lon: 30.3351, zoom: 10 },
  { name: 'Казань', x: 50, y: 45, lat: 55.7963, lon: 49.1088, zoom: 11 },
  { name: 'Екатеринбург', x: 58, y: 42, lat: 56.8389, lon: 60.6057, zoom: 11 },
  { name: 'Новосибирск', x: 68, y: 52, lat: 55.0084, lon: 82.9357, zoom: 11 },
  { name: 'Краснодар', x: 38, y: 62, lat: 45.0355, lon: 38.9753, zoom: 11 },
  { name: 'Нижний Новгород', x: 46, y: 41, lat: 56.2965, lon: 43.9361, zoom: 11 },
  { name: 'Ростов-на-Дону', x: 39, y: 58, lat: 47.2357, lon: 39.7015, zoom: 11 },
];

const BRANDS = ['Лукойл', 'Газпромнефть', 'Роснефть', 'Татнефть', 'Shell', 'Нефтьмагистраль'];

const rnd = (min: number, max: number) => +(min + Math.random() * (max - min)).toFixed(2);

const STATIONS: Station[] = Array.from({ length: 34 }).map((_, i) => {
  const city = CITIES[i % CITIES.length];
  const base = 50 + (i % CITIES.length);
  return {
    id: i + 1,
    brand: BRANDS[i % BRANDS.length],
    address: `ул. ${['Ленина', 'Мира', 'Гагарина', 'Советская', 'Кольцевая'][i % 5]}, ${10 + i}`,
    city: city.name,
    x: city.x + (Math.random() * 8 - 4),
    y: city.y + (Math.random() * 8 - 4),
    fuel: {
      ai92: rnd(base - 3, base),
      ai95: rnd(base, base + 4),
      ai98: rnd(base + 4, base + 9),
      dt: rnd(base - 1, base + 3),
    },
    rating: rnd(3.8, 5),
  };
});

const FUEL_LABELS: { key: keyof Fuel; label: string }[] = [
  { key: 'ai92', label: 'АИ-92' },
  { key: 'ai95', label: 'АИ-95' },
  { key: 'ai98', label: 'АИ-98' },
  { key: 'dt', label: 'ДТ' },
];

const Index = () => {
  const [query, setQuery] = useState('');
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState<keyof Fuel>('ai95');
  const [selected, setSelected] = useState<Station | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
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

  const mapUrl = useMemo(() => {
    const city = CITIES.find((c) => c.name === (selected?.city || activeCity));
    if (city) {
      return `https://yandex.ru/map-widget/v1/?ll=${city.lon}%2C${city.lat}&z=${city.zoom}&text=${encodeURIComponent('заправки ' + city.name)}`;
    }
    return `https://yandex.ru/map-widget/v1/?ll=60%2C60&z=3&text=${encodeURIComponent('заправки')}`;
  }, [activeCity, selected]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
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
            <span className="flex items-center gap-1.5"><Icon name="RefreshCw" size={15} /> обновлено сегодня</span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pt-10 pb-6">
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Где заправиться <span className="text-green-600">выгоднее</span>?
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Актуальные цены на заправках России на карте. Найдите ближайшую АЗС с самым дешёвым топливом.
        </p>

        <div ref={boxRef} className="relative mt-6 max-w-md">
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
                <button
                  key={c.name}
                  onClick={() => selectCity(c.name)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition hover:bg-secondary"
                >
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

        <div className="mt-5 flex flex-wrap gap-2">
          {FUEL_LABELS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFuelType(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                fuelType === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1.6fr_1fr]">
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

        <div className="flex flex-col">
          {selected ? (
            <div className="animate-fade-in rounded-2xl border border-border bg-white p-5 shadow-sm">
              <button onClick={() => setSelected(null)} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
              <div className="mt-4 grid grid-cols-2 gap-2">
                {FUEL_LABELS.map((f) => (
                  <div key={f.key} className={`rounded-xl border p-3 ${fuelType === f.key ? 'border-primary bg-secondary' : 'border-border'}`}>
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <div className="font-display text-lg">{selected.fuel[f.key].toFixed(2)} ₽</div>
                  </div>
                ))}
              </div>
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                <Icon name="Navigation" size={16} /> Построить маршрут
              </button>
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="font-display text-base tracking-wide">
                  {activeCity ? activeCity.toUpperCase() : 'ВСЕ АЗС'} · {FUEL_LABELS.find((f) => f.key === fuelType)?.label}
                </span>
                <span className="text-xs text-muted-foreground">по возрастанию цены</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {filtered.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left transition last:border-0 hover:bg-secondary"
                  >
                    <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: priceColor(s.fuel[fuelType]) }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.brand}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.city}, {s.address}</div>
                    </div>
                    <div className="font-display text-base">{s.fuel[fuelType].toFixed(2)} ₽</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Бензин·Карта — демо-данные. Цены на топливо обновляются ежедневно.
      </footer>
    </div>
  );
};

export default Index;