import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { aiApi } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string; bouquets?: BouquetCard[] };
type BouquetCard = { id: number; title: string; price: number | null; sale_type: string; shop_name?: string };

interface Props {
  city?: string;
  onOpenBouquet?: (id: number) => void;
}

const SUGGESTIONS = [
  "Букет на день рождения до 2000 ₽",
  "Что-то нежное для девушки",
  "Как работает бронь букета?",
];

export default function AiConsultant({ city, onOpenBouquet }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Привет! Я помогу подобрать букет или отвечу на вопросы о площадке. Что ищете?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    const r = await aiApi.consult(text, history, city);
    setLoading(false);
    if (r.ok) {
      setMessages(prev => [...prev, { role: "assistant", content: r.data.reply, bouquets: r.data.bouquets || [] }]);
    } else {
      setMessages(prev => [...prev, { role: "assistant", content: "Извините, консультант сейчас недоступен. Попробуйте чуть позже." }]);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg animate-fade-in-up"
          style={{ background: "var(--grad-main)", boxShadow: "0 8px 24px rgba(255,61,139,0.4)" }}
          aria-label="AI-консультант"
        >
          <Icon name="Sparkles" size={24} className="text-white" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm flex flex-col rounded-2xl overflow-hidden animate-fade-in-up"
          style={{ height: "min(70vh, 540px)", background: "rgba(20,18,28,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ background: "var(--grad-main)" }}>
            <Icon name="Sparkles" size={18} className="text-white" />
            <div className="flex-1">
              <p className="text-white font-oswald text-sm font-bold leading-tight">AI-флорист</p>
              <p className="text-white/70 text-xs">Подбор букета и помощь</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15">
              <Icon name="X" size={18} className="text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap"
                    style={m.role === "user"
                      ? { background: "var(--grad-main)", color: "#fff" }
                      : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.9)" }}>
                    {m.content}
                  </div>
                </div>
                {m.bouquets && m.bouquets.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {m.bouquets.map(b => (
                      <button key={b.id} onClick={() => onOpenBouquet?.(b.id)}
                        className="w-full flex items-center gap-2 glass rounded-xl px-3 py-2 text-left hover:bg-white/5 transition-colors">
                        <Icon name="Flower2" size={16} style={{ color: "var(--neon-pink)" }} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white/85 text-xs font-medium truncate">{b.title}</p>
                          {b.shop_name && <p className="text-white/30 text-[10px] truncate">{b.shop_name}</p>}
                        </div>
                        {b.price != null && <span className="text-pink-400 text-xs font-oswald font-bold flex-shrink-0">{b.price.toLocaleString("ru-RU")} ₽</span>}
                        <Icon name="ChevronRight" size={13} className="text-white/20 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="space-y-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="w-full text-left glass rounded-xl px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-center gap-2 p-3 flex-shrink-0 border-t border-white/5">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              className="flex-1 glass rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="Спросите что-нибудь..." />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="btn-gradient w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
              <Icon name="Send" size={14} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}