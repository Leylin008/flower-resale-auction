import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { bouquetsApi, profileApi } from "@/lib/api";
import { useMaintenance } from "@/lib/maintenance";
import { useCities } from "@/lib/cities";
import {
  Bouquet, User, Chat, Message,
  formatTime, isUrgent, formatPrice, timeAgo,
  getDistricts,
} from "./shared";

/* ─── BID MODAL ─────────────────────────────────────────── */
export function BidModal({ bouquet, onClose, onBid }: { bouquet: Bouquet; onClose: () => void; onBid: (id: number, amount: number) => void }) {
  const [amount, setAmount] = useState(bouquet.current_price + bouquet.min_step);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { maintenance } = useMaintenance();

  const submit = async () => {
    if (maintenance) { setError("Платформа на этапе доработки — ставки временно недоступны"); return; }
    setLoading(true); setError("");
    const r = await bouquetsApi.bid(bouquet.id, amount);
    setLoading(false);
    if (!r.ok) {
      setError(r.status === 423 ? r.data.error : r.data.error);
      return;
    }
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
        {maintenance && (
          <p className="text-amber-400 text-xs mt-4 text-center">Демо-режим: ставки временно отключены</p>
        )}
        <button onClick={submit} disabled={loading || maintenance}
          className="btn-gradient w-full rounded-2xl py-4 mt-3 font-oswald text-lg tracking-wide animate-pulse-glow disabled:opacity-40">
          {loading ? "..." : "СДЕЛАТЬ СТАВКУ"}
        </button>
      </div>
    </div>
  );
}

/* ─── AUCTION CARD ───────────────────────────────────────── */
export function AuctionCard({ b, onBid, onLike }: { b: Bouquet; onBid: () => void; onLike: () => void }) {
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
export function CatalogCard({ b, onLike }: { b: Bouquet; onLike: () => void }) {
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
export function CityFilter({ city, district, onCity, onDistrict }: {
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

/* ─── PRICE CALCULATOR ──────────────────────────────────── */
export const DISCOUNT_TABLE: Record<number, number> = { 1: 0, 2: 5, 3: 10, 6: 15, 12: 25 };
export const MONTH_OPTIONS = [
  { value: 1, label: "1 мес." },
  { value: 2, label: "2 мес.", discount: 5 },
  { value: 3, label: "3 мес.", discount: 10 },
  { value: 6, label: "6 мес.", discount: 15 },
  { value: 12, label: "12 мес.", discount: 25 },
];

export function calcTotal(basePrice: number, months: number): number {
  const discount = DISCOUNT_TABLE[months] ?? 0;
  return Math.floor(basePrice * months * (100 - discount) / 100);
}

export function PriceBreakdown({ basePrice, months, label = "Итого" }: { basePrice: number; months: number; label?: string }) {
  const discount = DISCOUNT_TABLE[months] ?? 0;
  const total = calcTotal(basePrice, months);
  const fullPrice = basePrice * months;
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-xs">{label}</span>
        <div className="flex items-center gap-2">
          {discount > 0 && (
            <span className="text-white/25 text-xs line-through">{fullPrice.toLocaleString("ru-RU")} ₽</span>
          )}
          <span className="gradient-text font-oswald text-lg font-bold">{total.toLocaleString("ru-RU")} ₽</span>
        </div>
      </div>
      {discount > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded-md font-bold" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
            −{discount}%
          </span>
          <span className="text-white/30 text-xs">экономия {(fullPrice - total).toLocaleString("ru-RU")} ₽</span>
        </div>
      )}
    </div>
  );
}

/* ─── CHAT WINDOW ────────────────────────────────────────── */
export function ChatWindow({ chat, user, onBack }: { chat: Chat; user: User; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    profileApi.messages(chat.other_id).then(r => { if (r.ok) setMessages(r.data.messages); });
  }, [chat.other_id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const r = await profileApi.sendMessage(chat.other_id, text.trim(), chat.bouquet_id);
    setSending(false);
    if (r.ok) {
      setMessages(prev => [...prev, { id: r.data.id, sender_id: user.id, text: text.trim(), created_at: r.data.created_at, is_read: false }]);
      setText("");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="glass p-2 rounded-xl"><Icon name="ArrowLeft" size={18} className="text-white/60" /></button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--grad-main)" }}>{chat.other_name[0]}</div>
        <div>
          <p className="text-white font-medium text-sm">{chat.other_name}</p>
          {chat.bouquet_title && <p className="text-white/40 text-xs">{chat.bouquet_title}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm"
              style={m.sender_id === user.id
                ? { background: "var(--grad-main)", color: "#fff" }
                : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)" }}>
              <p>{m.text}</p>
              <p className="text-xs mt-1 opacity-60">{timeAgo(m.created_at)}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center text-white/30 text-sm py-8">Начните диалог</p>}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          className="flex-1 glass rounded-2xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="Сообщение..." />
        <button onClick={send} disabled={sending || !text.trim()}
          className="btn-gradient w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
          <Icon name="Send" size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
