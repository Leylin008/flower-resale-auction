import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { bouquetsApi, uploadApi, shopsApi } from "@/lib/api";
import { useCities } from "@/lib/cities";
import type { Bouquet, User } from "./shared";
import { formatTime, isUrgent, formatPrice, getDistricts, deferredInstallPrompt } from "./shared";
import type { BeforeInstallPromptEvent } from "./shared";

// Хук установки PWA — используется и баннером, и кнопкой в профиле
export function usePwaInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(deferredInstallPrompt);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
    }
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !nav.standalone);
    const onReady = () => setPrompt(deferredInstallPrompt);
    window.addEventListener("ff-install-ready", onReady);
    const onInstalled = () => { setPrompt(null); setIsStandalone(true); };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("ff-install-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "ios" | "unavailable"> => {
    if (isIos) return "ios";
    const p = prompt || deferredInstallPrompt;
    if (!p) return "unavailable";
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === "accepted") { setPrompt(null); }
    return outcome;
  };

  // canInstall: можно показать кнопку (есть prompt или iOS) и приложение ещё не установлено
  return { isIos, isStandalone, canInstall: (!!prompt || isIos) && !isStandalone, promptInstall };
}

export function InstallBanner() {
  const { isIos, isStandalone, canInstall, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem("ff_install_dismissed"));
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isStandalone || dismissed || !canInstall) return null;

  const dismiss = () => { localStorage.setItem("ff_install_dismissed", "1"); setDismissed(true); };

  const install = async () => {
    const res = await promptInstall();
    if (res === "ios") { setShowIosGuide(true); return; }
    if (res === "accepted") dismiss();
  };

  return (
    <div className="sticky top-0 z-50 px-4 pt-2 pb-0 max-w-lg mx-auto">
      <div className="glass-strong rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in-up"
        style={{ border: "1px solid rgba(255,61,139,0.3)", background: "rgba(255,61,139,0.08)" }}>
        <span className="text-2xl flex-shrink-0 animate-float" style={{ display: "inline-block" }}>🌸</span>
        <div className="flex-1 min-w-0">
          {showIosGuide ? (
            <>
              <p className="text-white font-medium text-sm">Установка на iPhone</p>
              <p className="text-white/50 text-xs">Нажмите <Icon name="Share" size={11} className="inline" /> → «На экран домой»</p>
            </>
          ) : (
            <>
              <p className="text-white font-medium text-sm">Добавить на экран</p>
              <p className="text-white/50 text-xs">Быстрый доступ к FlowerFlip</p>
            </>
          )}
        </div>
        {!showIosGuide && (
          <button onClick={install}
            className="btn-gradient px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0">
            {isIos ? "Как?" : "Установить"}
          </button>
        )}
        <button onClick={dismiss} className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── BID MODAL ─────────────────────────────────────────── */
export function BidModal({ bouquet, onClose, onBid }: { bouquet: Bouquet; onClose: () => void; onBid: (id: number, amount: number) => void }) {
  const [amount, setAmount] = useState(bouquet.current_price + bouquet.min_step);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true); setError("");
    const r = await bouquetsApi.bid(bouquet.id, amount);
    setLoading(false);
    if (!r.ok) { setError(r.data.error); return; }
    onBid(bouquet.id, amount); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="glass-strong rounded-2xl p-6 w-full max-w-sm animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald text-xl font-bold text-white">{bouquet.title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><Icon name="X" size={20} /></button>
        </div>
        <div className="flex items-center gap-3 mb-5">
          {bouquet.image_urls[0] && <img src={bouquet.image_urls[0]} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />}
          <div>
            <p className="text-white/50 text-sm">Текущая ставка</p>
            <p className="gradient-text font-oswald text-2xl font-bold">{formatPrice(bouquet.current_price)}</p>
            <p className="text-white/40 text-xs">Шаг от {formatPrice(bouquet.min_step)}</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-white/60 text-sm mb-2 block">Ваша ставка</label>
          <div className="flex gap-2">
            <button className="glass rounded-xl px-3 py-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setAmount(a => Math.max(bouquet.current_price + bouquet.min_step, a - bouquet.min_step))}>
              <Icon name="Minus" size={16} />
            </button>
            <div className="flex-1 glass rounded-xl px-4 py-2 font-oswald text-xl text-center text-white font-bold">{formatPrice(amount)}</div>
            <button className="glass rounded-xl px-3 py-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setAmount(a => a + bouquet.min_step)}>
              <Icon name="Plus" size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          {[1, 3, 5].map(x => (
            <button key={x} className="flex-1 glass rounded-xl py-2 text-sm text-white/60 hover:text-white transition-colors"
              onClick={() => setAmount(bouquet.current_price + bouquet.min_step * x)}>
              +{formatPrice(bouquet.min_step * x)}
            </button>
          ))}
        </div>
        {error && !error.includes("email") && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
        {error && error.includes("email") && (
          <div className="mt-3 px-3 py-2.5 rounded-xl text-sm text-center"
            style={{ background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.3)" }}>
            <p className="text-orange-400 font-medium">📧 Подтвердите email</p>
            <p className="text-white/40 text-xs mt-1">Перейдите по ссылке из письма, затем попробуйте снова</p>
          </div>
        )}
        <button onClick={submit} disabled={loading}
          className="btn-gradient w-full rounded-2xl py-4 mt-5 font-oswald text-lg tracking-wide animate-pulse-glow disabled:opacity-50">
          {loading ? "..." : "СДЕЛАТЬ СТАВКУ"}
        </button>
      </div>
    </div>
  );
}

/* ─── AUCTION CARD ───────────────────────────────────────── */
function AuctionCard({ b, onBid, onLike }: { b: Bouquet; onBid: () => void; onLike: () => void }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const urgent = isUrgent(b.ends_at);
  const img = b.image_urls[0] || "/placeholder.svg";
  return (
    <div className="glass rounded-2xl overflow-hidden card-hover">
      <div className="relative">
        <img src={img} alt={b.title} className="w-full h-48 object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
        <button onClick={onLike} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full glass transition-all hover:scale-110">
          <Icon name="Heart" size={16} className={b.liked ? "text-pink-400 fill-pink-400" : "text-white/60"} />
        </button>
        <div className={`absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${urgent ? "animate-timer" : "text-white"}`}
          style={{ background: urgent ? "rgba(255,61,139,0.25)" : "rgba(0,0,0,0.5)", border: urgent ? "1px solid rgba(255,61,139,0.5)" : "none" }}>
          <Icon name="Clock" size={11} />{formatTime(b.ends_at)}
        </div>
        <div className="absolute bottom-3 right-3 glass px-2 py-1 rounded-full text-xs text-white/70">{b.bids_count} ставок</div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-oswald text-lg font-semibold text-white">{b.title}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <Icon name="Star" size={11} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white/50 text-xs">{b.seller_rating?.toFixed(1)} · {b.seller_name}</span>
            </div>
            {b.city && (
              <div className="flex items-center gap-1 mt-0.5">
                <Icon name="MapPin" size={10} className="text-pink-400" />
                <span className="text-white/40 text-xs">{b.city}{b.district ? `, ${b.district}` : ""}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="gradient-text font-oswald text-xl font-bold">{formatPrice(b.current_price)}</p>
            <p className="text-white/40 text-xs">свежесть: {b.freshness}</p>
          </div>
        </div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {(b.flowers || []).slice(0, 3).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>#{t}</span>
          ))}
        </div>
        <button onClick={onBid} className="btn-gradient w-full rounded-xl py-2.5 text-sm font-semibold">Сделать ставку</button>
      </div>
    </div>
  );
}

/* ─── CATALOG CARD ───────────────────────────────────────── */
function CatalogCard({ b, onLike }: { b: Bouquet; onLike: () => void }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const urgent = isUrgent(b.ends_at);
  const timeStr = formatTime(b.ends_at);
  return (
    <div className="glass rounded-2xl overflow-hidden card-hover flex">
      <div className="relative flex-shrink-0">
        <img src={b.image_urls[0] || "/placeholder.svg"} className="w-28 h-28 object-cover" />
        <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${urgent ? "animate-timer" : "text-white"}`}
          style={{ background: urgent ? "rgba(255,61,139,0.35)" : "rgba(0,0,0,0.6)", border: urgent ? "1px solid rgba(255,61,139,0.5)" : "none" }}>
          <Icon name="Clock" size={9} />{timeStr}
        </div>
      </div>
      <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-oswald text-base font-semibold text-white truncate">{b.title}</h3>
            <button onClick={onLike} className="ml-2 flex-shrink-0">
              <Icon name="Heart" size={16} className={b.liked ? "text-pink-400 fill-pink-400" : "text-white/30"} />
            </button>
          </div>
          <div className="flex items-center gap-1 mt-0.5 mb-1">
            <Icon name="Star" size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-white/40 text-xs">{b.seller_rating?.toFixed(1)} · {b.seller_name}</span>
          </div>
          {b.city && (
            <div className="flex items-center gap-1 mb-1">
              <Icon name="MapPin" size={9} className="text-pink-400" />
              <span className="text-white/30 text-xs">{b.city}{b.district ? `, ${b.district}` : ""}</span>
            </div>
          )}
          <div className="flex gap-1 flex-wrap">
            {(b.flowers || []).slice(0, 2).map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>#{t}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="gradient-text font-oswald text-lg font-bold">{formatPrice(b.current_price)}</span>
          <div className="flex items-center gap-2">
            <span className="text-white/30 text-xs">{b.bids_count} ст.</span>
            <span className="text-white/40 text-xs">{b.freshness}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CITY FILTER ────────────────────────────────────────── */
function CityFilter({ city, district, onCity, onDistrict }: {
  city: string; district: string;
  onCity: (c: string) => void; onDistrict: (d: string) => void;
}) {
  const cities = useCities();
  const [open, setOpen] = useState(false);
  const [distOpen, setDistOpen] = useState(false);
  const [input, setInput] = useState(city);
  const suggestions = (input.length > 0 ? cities.filter(c => c.toLowerCase().includes(input.toLowerCase())) : cities).slice(0, 50);
  const districts = getDistricts(city);

  return (
    <div className="glass rounded-2xl p-3 mb-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
            <Icon name="MapPin" size={14} className="text-pink-400 flex-shrink-0" />
            <input value={input} onChange={e => { setInput(e.target.value); setOpen(true); if (!e.target.value) { onCity(""); onDistrict(""); }}}
              onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="Ваш город..." />
            {city && <button onClick={() => { onCity(""); onDistrict(""); setInput(""); }} className="text-white/30 hover:text-white"><Icon name="X" size={12} /></button>}
          </div>
          {open && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto border border-white/10 shadow-2xl"
              style={{ background: "#150f1c", maxHeight: 260, backdropFilter: "blur(12px)" }}>
              {suggestions.map(c => (
                <button key={c} onMouseDown={() => { onCity(c); onDistrict(""); setInput(c); setOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        {city && districts.length > 0 && (
          <div className="relative flex-1">
            <button onClick={() => setDistOpen(v => !v)} onBlur={() => setTimeout(() => setDistOpen(false), 150)}
              className="w-full flex items-center justify-between gap-1 glass rounded-xl px-3 py-2 text-sm outline-none"
              style={{ color: district ? "#fff" : "rgba(255,255,255,0.4)" }}>
              <span className="truncate">{district || "Все районы"}</span>
              <Icon name="ChevronDown" size={13} className="flex-shrink-0 text-white/30" />
            </button>
            {distOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto border border-white/10 shadow-2xl"
                style={{ background: "#150f1c", maxHeight: 220, backdropFilter: "blur(12px)" }}>
                <button onMouseDown={() => { onDistrict(""); setDistOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white/50 hover:bg-pink-500/20 transition-colors border-b border-white/5">
                  Все районы
                </button>
                {districts.map(d => (
                  <button key={d} onMouseDown={() => { onDistrict(d); setDistOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0"
                    style={{ color: district === d ? "var(--neon-pink)" : "rgba(255,255,255,0.8)" }}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {city && (
        <p className="text-white/30 text-xs mt-2 flex items-center gap-1">
          <Icon name="Info" size={11} />
          Передача лично — покупатель и продавец договариваются о встрече
        </p>
      )}
    </div>
  );
}

/* ─── AUCTIONS SCREEN ────────────────────────────────────── */
export function AuctionsScreen({ onBid, user }: { onBid: (b: Bouquet) => void; user: User | null }) {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState(user?.city || "");
  const [district, setDistrict] = useState("");

  const load = useCallback(async () => {
    const r = await bouquetsApi.list({
      status: "active", sort: "ends_at",
      city: city || undefined,
      district: district || undefined,
    });
    if (r.ok) setBouquets(r.data.bouquets);
    setLoading(false);
  }, [city, district]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const toggleLike = async (b: Bouquet) => {
    if (!user) return;
    setBouquets(prev => prev.map(x => x.id === b.id ? { ...x, liked: !x.liked } : x));
    await bouquetsApi.favorite(b.id, !b.liked);
  };

  return (
    <div className="animate-fade-in">
      <div className="relative rounded-3xl overflow-hidden mb-4 p-5"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.2) 0%, rgba(168,85,247,0.2) 50%, rgba(255,107,43,0.12) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 animate-spin-slow" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">LIVE — {bouquets.length} аукционов</span>
          </div>
          <h2 className="font-oswald text-2xl font-bold text-white">Живые <span className="gradient-text">букеты</span></h2>
          <p className="text-white/40 text-xs mt-0.5">Самовывоз — без доставки, только личная встреча</p>
        </div>
      </div>

      <CityFilter city={city} district={district} onCity={c => { setCity(c); setDistrict(""); }} onDistrict={setDistrict} />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="glass rounded-2xl h-64 animate-pulse" />)}
        </div>
      ) : bouquets.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-6xl block mb-4">🌸</span>
          <p className="text-white/50 font-oswald text-xl">
            {city ? `В ${city} пока нет аукционов` : "Нет активных аукционов"}
          </p>
          <p className="text-white/30 text-sm mt-2">Станьте первым продавцом!</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-oswald text-xl font-semibold text-white">Горячие аукционы 🔥</h3>
            <button onClick={load} className="glass p-2 rounded-xl"><Icon name="RefreshCw" size={14} className="text-white/50" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bouquets.map((b, i) => (
              <div key={b.id} className={`animate-fade-in-up delay-${Math.min((i + 1) * 100, 500)}`}>
                <AuctionCard b={b} onBid={() => onBid(b)} onLike={() => toggleLike(b)} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── CATALOG SCREEN ─────────────────────────────────────── */
export function CatalogScreen({ user }: { user: User | null }) {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState("все");
  const [sortBy, setSortBy] = useState<"price" | "rating">("price");
  const PRICE_CAP = 1000000;
  const [priceMax, setPriceMax] = useState(PRICE_CAP);
  const noPriceLimit = priceMax >= PRICE_CAP;
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(user?.city || "");
  const [district, setDistrict] = useState("");
  const [flowerTags, setFlowerTags] = useState<string[]>([]);

  useEffect(() => {
    bouquetsApi.flowers().then(r => {
      if (r.ok && r.data.flowers?.length) setFlowerTags(r.data.flowers);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    bouquetsApi.list({
      status: "active",
      tag: activeTag !== "все" ? activeTag : undefined,
      sort: sortBy,
      max_price: noPriceLimit ? undefined : priceMax,
      city: city || undefined,
      district: district || undefined,
    }).then(r => { if (r.ok) setBouquets(r.data.bouquets); setLoading(false); });
  }, [activeTag, sortBy, priceMax, noPriceLimit, city, district]);

  const filtered = search
    ? bouquets.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || (b.flowers || []).join(" ").includes(search.toLowerCase()))
    : bouquets;

  const toggleLike = async (b: Bouquet) => {
    if (!user) return;
    setBouquets(prev => prev.map(x => x.id === b.id ? { ...x, liked: !x.liked } : x));
    await bouquetsApi.favorite(b.id, !b.liked);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-4">Каталог букетов</h2>
      <CityFilter city={city} district={district} onCity={c => { setCity(c); setDistrict(""); }} onDistrict={setDistrict} />
      <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 mb-4">
        <Icon name="Search" size={18} className="text-white/30 flex-shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="Поиск по цветам..." />
        {search && <button onClick={() => setSearch("")}><Icon name="X" size={14} className="text-white/30" /></button>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
        {["все", ...flowerTags].map(t => (
          <button key={t} onClick={() => setActiveTag(t)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize"
            style={activeTag === t ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {([["price", "По цене"], ["rating", "По рейтингу"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)}
            className="flex-1 py-2 rounded-xl text-sm font-medium glass transition-all"
            style={{ color: sortBy === k ? "#ff3d8b" : "rgba(255,255,255,0.4)" }}>{l}</button>
        ))}
      </div>
      <div className="glass rounded-2xl p-4 mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/50 text-sm">Макс. цена</span>
          {noPriceLimit ? (
            <span className="gradient-text font-oswald font-bold text-lg">Без ограничения</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={priceMax}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (v >= 0) setPriceMax(Math.min(v, PRICE_CAP));
                }}
                onBlur={e => { if (!e.target.value || Number(e.target.value) < 500) setPriceMax(500); }}
                className="w-28 bg-transparent text-right font-oswald font-bold text-lg outline-none border-b border-pink-500/50 focus:border-pink-500 text-white transition-colors"
                style={{ color: "var(--neon-pink)" }}
              />
              <span className="text-white/50 font-oswald font-bold text-lg">₽</span>
            </div>
          )}
        </div>
        <input type="range" min={500} max={PRICE_CAP} step={500} value={noPriceLimit ? PRICE_CAP : priceMax}
          onChange={e => setPriceMax(Number(e.target.value))} className="w-full accent-pink-500" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-white/25 text-xs">500 ₽</span>
          <button onClick={() => setPriceMax(noPriceLimit ? 5000 : PRICE_CAP)}
            className="text-pink-400 text-xs hover:text-pink-300 transition-colors">
            {noPriceLimit ? "Задать ограничение" : "Снять ограничение"}
          </button>
          <span className="text-white/25 text-xs">∞</span>
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/50 text-sm">Найдено: {filtered.length} букетов</span>
      </div>
      {loading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-28 animate-pulse" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(b => (
            <CatalogCard key={b.id} b={b} onLike={() => toggleLike(b)} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <span className="text-5xl block mb-3">🌵</span>
              <p>Нет букетов по этому фильтру</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── SHOPS SCREEN ──────────────────────────────────────── */
export function ShopsScreen({ user }: { user: User | null }) {
  const [shops, setShops] = useState<{ id: number; user_id: number; shop_name: string; logo_url?: string; description?: string; rating: number; reviews_count: number; sales_count: number; city?: string }[]>([]);
  const [selected, setSelected] = useState<{ user_id: number; shop_name: string; logo_url?: string; description?: string; address?: string; phone?: string; rating: number; reviews_count: number } | null>(null);
  const [bouquets, setBouquets] = useState<{ id: number; title: string; image_urls: string[]; current_price?: number; fixed_price?: number; sale_type: string; status: string; bids_count: number; reserve_enabled: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBouquets, setLoadingBouquets] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const cities = useCities();

  useEffect(() => {
    setLoading(true);
    shopsApi.list().then(r => {
      if (r.ok) setShops(r.data.shops);
      setLoading(false);
    });
  }, []);

  const openShop = async (userId: number) => {
    const r = await shopsApi.profile(userId);
    if (r.ok && r.data.profile) {
      setSelected(r.data.profile);
      setLoadingBouquets(true);
      const rb = await shopsApi.shopBouquets(userId);
      setLoadingBouquets(false);
      if (rb.ok) setBouquets(rb.data.bouquets);
    }
  };

  if (selected) return (
    <div className="animate-fade-in">
      <button onClick={() => { setSelected(null); setBouquets([]); }}
        className="flex items-center gap-2 text-white/50 text-sm mb-4 hover:text-white transition-colors">
        <Icon name="ArrowLeft" size={16} /> Все магазины
      </button>
      <div className="rounded-3xl p-5 mb-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.12) 0%, rgba(168,85,247,0.12) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            {selected.logo_url
              ? <img src={selected.logo_url} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-3xl">🏪</div>}
          </div>
          <div className="flex-1">
            <h2 className="font-oswald text-xl font-bold text-white">{selected.shop_name}</h2>
            <div className="flex items-center gap-1 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Icon key={i} name="Star" size={11} className={i < Math.round(selected.rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
              ))}
              <span className="text-white/40 text-xs ml-1">{selected.rating?.toFixed(1)} · {selected.reviews_count} отзывов</span>
            </div>
          </div>
        </div>
        {selected.description && <p className="text-white/50 text-sm mt-3">{selected.description}</p>}
        <div className="flex gap-3 mt-3">
          {selected.address && (
            <div className="flex items-center gap-1.5">
              <Icon name="MapPin" size={12} className="text-white/30" />
              <span className="text-white/40 text-xs">{selected.address}</span>
            </div>
          )}
          {selected.phone && (
            <a href={`tel:${selected.phone}`} className="flex items-center gap-1.5 hover:text-pink-400 transition-colors">
              <Icon name="Phone" size={12} className="text-white/30" />
              <span className="text-white/40 text-xs">{selected.phone}</span>
            </a>
          )}
        </div>
      </div>

      <h3 className="font-oswald text-lg font-bold text-white mb-3">Букеты магазина</h3>
      {loadingBouquets ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
        </div>
      ) : bouquets.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <span className="text-4xl block mb-3">🌸</span>
          <p>Нет активных букетов</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {bouquets.map(b => (
            <div key={b.id} className="glass rounded-2xl overflow-hidden">
              <div className="aspect-square bg-white/5 relative">
                {b.image_urls?.[0]
                  ? <img src={b.image_urls[0]} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-3xl">🌸</div>}
                <div className="absolute top-2 left-2">
                  {b.sale_type === "fixed"
                    ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(168,85,247,0.8)", color: "#fff" }}>Фикс</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,61,139,0.8)", color: "#fff" }}>Аукцион</span>}
                </div>
                {b.reserve_enabled && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.7)" }}>📌</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-white text-sm font-medium truncate">{b.title}</p>
                <p className="gradient-text font-oswald font-bold mt-1">
                  {formatPrice(b.sale_type === "fixed" ? b.fixed_price : b.current_price)}
                </p>
                {b.sale_type === "auction" && b.bids_count > 0 && (
                  <p className="text-white/30 text-xs mt-0.5">{b.bids_count} ставок</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const filteredShops = cityFilter ? shops.filter(s => s.city === cityFilter) : shops;
  const shopCities = [...new Set(shops.map(s => s.city).filter(Boolean))] as string[];

  // cities is used for potential future filtering — suppress unused warning
  void cities;

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Магазины</h2>
      <p className="text-white/40 text-sm mb-4">Проверенные цветочные магазины на платформе</p>

      {/* Фильтр по городу */}
      {shopCities.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setCityFilter("")}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={!cityFilter ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
            Все города
          </button>
          {shopCities.map(c => (
            <button key={c} onClick={() => setCityFilter(c)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={cityFilter === c ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-6xl block mb-4">🏪</span>
          <p className="font-oswald text-xl text-white mb-2">{cityFilter ? `Магазинов в ${cityFilter} нет` : "Магазинов пока нет"}</p>
          <p className="text-white/40 text-sm">Первые магазины появятся совсем скоро</p>
          {user && !cityFilter && (
            <p className="text-white/30 text-xs mt-4">Хочешь открыть свой? Перейди в Профиль → Магазин</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredShops.map(s => (
            <button key={s.id} onClick={() => openShop(s.user_id)}
              className="glass rounded-2xl p-4 w-full text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)" }}>
                  {s.logo_url
                    ? <img src={s.logo_url} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🏪</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{s.shop_name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Icon key={i} name="Star" size={10} className={i < Math.round(s.rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
                    ))}
                    <span className="text-white/40 text-xs ml-1">{s.rating?.toFixed(1)}</span>
                  </div>
                  {s.description && <p className="text-white/40 text-xs mt-0.5 truncate">{s.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white/50 text-xs">{s.sales_count} продаж</p>
                  <Icon name="ChevronRight" size={16} className="text-white/20 mt-1 ml-auto" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SELL SCREEN ────────────────────────────────────────── */
export function SellScreen({ user }: { user: User | null }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [flowers, setFlowers] = useState("");
  const [freshness, setFreshness] = useState("сегодня");
  const [price, setPrice] = useState("500");
  const [duration, setDuration] = useState(3);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sellCity, setSellCity] = useState(user?.city || "");
  const [sellDistrict, setSellDistrict] = useState("");
  const [meetPoint, setMeetPoint] = useState("");
  const [saleType, setSaleType] = useState<"auction" | "fixed">("auction");
  const [reserveEnabled, setReserveEnabled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadApi.upload(file);
    setUploading(false);
    if (url) setImages(prev => [...prev, url]);
  };

  const submit = async () => {
    const priceVal = parseFloat(price);
    if (!priceVal || priceVal < 100) { setError("Минимальная цена — 100 ₽"); return; }
    setLoading(true); setError("");
    const r = await bouquetsApi.create({
      title, description: "",
      flowers: flowers.split(",").map(s => s.trim()).filter(Boolean),
      freshness, image_urls: images,
      start_price: parseFloat(price) || 500,
      duration_hours: saleType === "auction" ? duration : 0,
      city: sellCity || undefined,
      district: sellDistrict || undefined,
      meet_point: meetPoint || undefined,
      sale_type: saleType,
      fixed_price: saleType === "fixed" ? parseFloat(price) : undefined,
      reserve_enabled: reserveEnabled,
    });
    setLoading(false);
    if (!r.ok) { setError(r.data.error); return; }
    setDone(true);
  };

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🔐</span>
      <p className="text-white/50 font-oswald text-xl">Войдите, чтобы продавать</p>
    </div>
  );

  if (done) return (
    <div className="text-center py-20 animate-fade-in-up">
      <span className="text-6xl block mb-4">🎉</span>
      <h2 className="font-oswald text-3xl font-bold gradient-text mb-3">Букет выставлен!</h2>
      <p className="text-white/50 mb-6">Ваш аукцион активен. Следите за ставками в «Профиле».</p>
      <button onClick={() => { setDone(false); setStep(1); setTitle(""); setFlowers(""); setImages([]); }}
        className="btn-gradient px-8 py-3 rounded-2xl font-oswald tracking-wide">ВЫСТАВИТЬ ЕЩЁ</button>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Продать букет</h2>
      <p className="text-white/40 text-sm mb-6">Выставьте подаренный букет на аукцион</p>
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{ background: s <= step ? "var(--grad-main)" : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>

      {step === 1 && (
        <div className="animate-fade-in-up space-y-4">
          <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" className="hidden" onChange={handleFile} />
          {images.length > 0 ? (
            <div className="mb-2">
              <div className="flex gap-2 flex-wrap mb-2">
                {images.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} className="w-20 h-20 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "#ef4444", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                      <Icon name="X" size={11} className="text-white" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 text-white text-xs px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: "rgba(0,0,0,0.6)", fontSize: "9px" }}>гл.</span>
                    )}
                  </div>
                ))}
                {images.length < 5 && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1 border-2 border-dashed transition-colors"
                    style={{ borderColor: "rgba(255,61,139,0.4)", background: "rgba(255,61,139,0.05)" }}>
                    {uploading
                      ? <div className="animate-spin rounded-full w-6 h-6 border-2 border-pink-400 border-t-transparent" />
                      : <><Icon name="Plus" size={20} style={{ color: "var(--neon-pink)" }} /><span className="text-white/40 text-xs">фото</span></>
                    }
                  </button>
                )}
              </div>
              <p className="text-white/30 text-xs">{images.length} из 5 · первое — главное</p>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="rounded-3xl border-2 border-dashed mb-2 flex flex-col items-center justify-center py-10 cursor-pointer"
              style={{ borderColor: "rgba(255,61,139,0.3)", background: "rgba(255,61,139,0.05)" }}>
              {uploading ? (
                <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 animate-float" style={{ background: "rgba(255,61,139,0.15)" }}>
                    <Icon name="Camera" size={26} style={{ color: "var(--neon-pink)" }} />
                  </div>
                  <p className="text-white/60 font-medium">Добавить фото</p>
                  <p className="text-white/30 text-sm mt-1">до 5 · jpg, png, webp, heic</p>
                </>
              )}
            </div>
          )}
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Название букета</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="Напр.: Розы и тюльпаны, 51 шт." />
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Состав (через запятую)</label>
            <input value={flowers} onChange={e => setFlowers(e.target.value)}
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="розы, пионы, орхидеи" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in-up space-y-4">
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Тип продажи</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: "auction", label: "Аукцион", icon: "Zap", desc: "Ставки, побеждает максимальная" },
                { id: "fixed", label: "Фикс. цена", icon: "Tag", desc: "Покупают сразу по вашей цене" }
              ].map(t => (
                <button key={t.id} onClick={() => setSaleType(t.id as "auction" | "fixed")}
                  className="rounded-xl p-3 text-left transition-all"
                  style={saleType === t.id ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  <p className="font-semibold text-sm">{t.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Когда подарили?</label>
            <div className="grid grid-cols-3 gap-2">
              {["сегодня", "вчера", "2–3 дня"].map(t => (
                <button key={t} onClick={() => setFreshness(t)}
                  className="rounded-xl py-3 text-sm font-medium transition-all"
                  style={freshness === t ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">{saleType === "fixed" ? "Цена продажи" : "Начальная цена"}</label>
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2"
              style={parseFloat(price) > 0 && parseFloat(price) < 100 ? { border: "1px solid rgba(239,68,68,0.5)" } : {}}>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="100"
                className="flex-1 bg-transparent text-white text-xl font-oswald font-bold outline-none placeholder:text-white/20" placeholder="500" />
              <span className="text-white/40 font-oswald">₽</span>
            </div>
            {parseFloat(price) > 0 && parseFloat(price) < 100 && (
              <p className="text-red-400 text-xs mt-1">Минимальная цена — 100 ₽</p>
            )}
            {parseFloat(price) > 0 && (() => {
              const amt = parseFloat(price);
              const yk = Math.round(amt * 0.055 * 100) / 100;
              const platform = Math.round((amt - yk) * 0.15 * 100) / 100;
              const youGet = Math.round((amt - yk - platform) * 100) / 100;
              return (
                <div className="mt-2 glass rounded-xl p-3 space-y-1 text-xs">
                  <div className="flex justify-between text-white/40">
                    <span>Комиссия ЮКассы (~5.5%)</span>
                    <span>−{formatPrice(yk)}</span>
                  </div>
                  <div className="flex justify-between text-white/40">
                    <span>Комиссия платформы (15%)</span>
                    <span>−{formatPrice(platform)}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-0.5 border-t border-white/10">
                    <span className="text-white/70">Вы получите</span>
                    <span className="text-green-400">{formatPrice(youGet)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
          {saleType === "auction" && (
            <div>
              <label className="text-white/50 text-sm mb-1.5 block">Длительность аукциона</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 3, 6].map(h => (
                  <button key={h} onClick={() => setDuration(h)}
                    className="rounded-xl py-3 text-sm font-medium transition-all"
                    style={duration === h ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                    {h} {h === 1 ? "час" : "часа"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Разрешить бронь</label>
            <button onClick={() => setReserveEnabled(r => !r)}
              className="w-full rounded-xl py-3 px-4 text-sm font-medium transition-all flex items-center justify-between"
              style={reserveEnabled ? { background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
              <span>Покупатель может забронировать букет</span>
              <span>{reserveEnabled ? "✓ Вкл" : "Выкл"}</span>
            </button>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Город передачи</label>
            <CityFilter
              city={sellCity} district={sellDistrict}
              onCity={c => { setSellCity(c); setSellDistrict(""); }}
              onDistrict={setSellDistrict}
            />
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Удобное место встречи <span className="text-white/30">(необязательно)</span></label>
            <input value={meetPoint} onChange={e => setMeetPoint(e.target.value)}
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="Напр.: метро Сокольники, ТЦ Мега..." />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in-up">
          <div className="glass rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-white/50 text-sm font-medium">Подтверждение</p>
            {[["Название", title || "—"], ["Состав", flowers || "—"], ["Свежесть", freshness],
              ["Начальная цена", formatPrice(parseFloat(price) || 500)],
              ["Длительность", `${duration} ч`], ["Фото", `${images.length} шт`],
              ["Город", sellCity || "не указан"],
              ...(sellDistrict ? [["Район", sellDistrict]] : []),
              ...(meetPoint ? [["Место встречи", meetPoint]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-white/40">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
            {([
              ["Комиссия платформы", saleType === "auction" ? "15% (аукцион)" : "8% (фикс. цена)"],
              ["ЮКасса", saleType === "auction" ? "вычитается из суммы" : "+2.5% к цене покупателя"],
              ["Выплата продавцу", "после подтверждения"],
              ["Передача букета", "лично, без курьера"],
              ["Способы вывода", "Карта, СБП, кошелёк"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm mb-2 last:mb-0">
                <span className="text-white/40">{k}</span>
                <span className="text-white/70">{v}</span>
              </div>
            ))}
          </div>
          {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} className="glass rounded-2xl px-6 py-4 text-white/60 font-semibold hover:text-white transition-colors">Назад</button>
        )}
        <button onClick={() => step < 3 ? setStep(s => s + 1) : submit()} disabled={loading || (step === 1 && !title)}
          className="btn-gradient flex-1 rounded-2xl py-4 font-oswald text-lg tracking-wide disabled:opacity-50">
          {loading ? "..." : step === 3 ? (saleType === "fixed" ? "ВЫСТАВИТЬ ПО ФИКС. ЦЕНЕ" : "ВЫСТАВИТЬ НА АУКЦИОН") : "ДАЛЕЕ"}
        </button>
      </div>
    </div>
  );
}