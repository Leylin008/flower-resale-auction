import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { escrowApi, profileApi } from "@/lib/api";
import type { User, Deal, Message } from "./shared";
import { formatPrice, timeAgo, ESCROW_STATUS } from "./shared";

/* ─── DEALS SCREEN (ESCROW) ──────────────────────────────── */
export function DealsScreen({ user, onPaySuccess }: { user: User | null; onPaySuccess?: () => void }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Deal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [disputeText, setDisputeText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ deal: Deal } | null>(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [dealMessages, setDealMessages] = useState<Message[]>([]);
  const [dealChatText, setDealChatText] = useState("");
  const [dealChatSending, setDealChatSending] = useState(false);
  const dealChatBottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const r = await escrowApi.myDeals();
    if (r.ok) setDeals(r.data.deals);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const loadDealChat = useCallback(async (deal: Deal) => {
    if (!user) return;
    const otherId = deal.is_buyer ? deal.seller_id : deal.buyer_id;
    const bouquetId = deal.id; // orders.id → связан с bouquet через join, но используем bouquet через deal title
    // Получаем messages по other_id — все сообщения между двумя пользователями по этой сделке
    void bouquetId;
    const r = await profileApi.messages(otherId);
    if (r.ok) setDealMessages(r.data.messages);
  }, [user]);

  useEffect(() => {
    if (active) { setDealMessages([]); setDealChatText(""); loadDealChat(active); }
  }, [active, loadDealChat]);

  useEffect(() => { dealChatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dealMessages]);

  const sendDealMessage = async () => {
    if (!active || !dealChatText.trim() || dealChatSending || !user) return;
    setDealChatSending(true);
    const otherId = active.is_buyer ? active.seller_id : active.buyer_id;
    const r = await profileApi.sendMessage(otherId, dealChatText.trim());
    setDealChatSending(false);
    if (r.ok) {
      setDealMessages(prev => [...prev, { id: r.data.id, sender_id: user.id, text: dealChatText.trim(), created_at: r.data.created_at, is_read: false }]);
      setDealChatText("");
    }
  };

  const doPay = async (deal: Deal) => {
    setActionLoading(true); setMsg("");
    const r = await escrowApi.pay(deal.id);
    setActionLoading(false);
    if (r.ok) {
      onPaySuccess?.(); // обновляем баланс в шапке
      await load();
      // обновляем активную сделку чтобы показать контакты
      const updated = await escrowApi.myDeals();
      if (updated.ok) {
        const updatedDeal = updated.data.deals.find((d: Deal) => d.id === deal.id);
        if (updatedDeal) setActive(updatedDeal);
      }
    }
    else {
      if (r.data.email_not_verified) setMsg("📧 Подтвердите email перед оплатой — проверьте почту и перейдите по ссылке из письма");
      else setMsg(r.data.error || "Ошибка оплаты");
    }
  };

  const doConfirm = async (deal: Deal) => {
    setActionLoading(true); setMsg("");
    const r = await escrowApi.confirm(deal.id);
    setActionLoading(false);
    if (r.ok) {
      await load();
      setActive(null);
      setReviewStars(5); setReviewText("");
      setReviewModal({ deal });
    } else setMsg(r.data.error);
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    setReviewLoading(true);
    const targetId = reviewModal.deal.is_buyer ? reviewModal.deal.seller_id : reviewModal.deal.buyer_id;
    await profileApi.addReview(targetId, reviewStars, reviewText, reviewModal.deal.id);
    setReviewLoading(false);
    setReviewModal(null);
  };

  const doDispute = async (deal: Deal) => {
    if (!disputeText.trim()) return;
    setActionLoading(true); setMsg("");
    const r = await escrowApi.dispute(deal.id, disputeText);
    setActionLoading(false);
    setMsg(r.ok ? r.data.message : r.data.error);
    if (r.ok) { setShowDispute(false); load(); }
  };

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🤝</span>
      <p className="text-white/50 font-oswald text-xl">Войдите, чтобы видеть сделки</p>
    </div>
  );

  /* ── МОДАЛ ОТЗЫВА ── */
  if (reviewModal) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-sm">
        <div className="text-center mb-5">
          <span className="text-5xl block mb-2">🌸</span>
          <h3 className="font-oswald text-2xl text-white mb-1">Сделка завершена!</h3>
          <p className="text-white/50 text-sm">Оставьте отзыв о {reviewModal.deal.is_buyer ? "продавце" : "покупателе"}</p>
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setReviewStars(s)}
              className="text-3xl transition-transform hover:scale-110"
              style={{ opacity: s <= reviewStars ? 1 : 0.25 }}>⭐</button>
          ))}
        </div>
        <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
          className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none resize-none mb-4"
          rows={3} placeholder="Расскажите о сделке..." />
        <button onClick={submitReview} disabled={reviewLoading}
          className="btn-gradient w-full rounded-2xl py-3 font-oswald text-base tracking-wide disabled:opacity-50 mb-2">
          {reviewLoading ? "Отправляем..." : "ОТПРАВИТЬ ОТЗЫВ"}
        </button>
        <button onClick={() => setReviewModal(null)}
          className="w-full text-white/30 text-sm py-2 hover:text-white/50 transition-colors">
          Пропустить
        </button>
      </div>
    </div>
  );

  if (active) {
    const st = ESCROW_STATUS[active.escrow_status] || { label: active.escrow_status, color: "#fff", icon: "Circle", desc: "" };
    const timeLeft = active.auto_confirm_at
      ? Math.max(0, Math.floor((new Date(active.auto_confirm_at).getTime() - Date.now()) / 3600000))
      : null;
    return (
      <div className="animate-fade-in">
        <button onClick={() => { setActive(null); setMsg(""); setShowDispute(false); }}
          className="flex items-center gap-2 text-white/50 hover:text-white mb-4 transition-colors">
          <Icon name="ArrowLeft" size={18} /> Назад к сделкам
        </button>

        {/* Шапка сделки */}
        <div className="glass rounded-2xl overflow-hidden mb-4">
          {active.image_urls?.[0] && <img src={active.image_urls[0]} className="w-full h-40 object-cover" />}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-oswald text-xl font-bold text-white">{active.title}</h3>
                {active.city && (
                  <div className="flex items-center gap-1 mt-1">
                    <Icon name="MapPin" size={12} className="text-pink-400" />
                    <span className="text-white/50 text-xs">{active.city}{active.district ? `, ${active.district}` : ""}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="gradient-text font-oswald text-xl font-bold">{formatPrice(active.amount)}</p>
                {active.is_seller
                  ? <p className="text-green-400 text-xs font-medium">вы получите {formatPrice(active.amount - active.commission)}</p>
                  : <p className="text-white/40 text-xs">комиссия {formatPrice(active.commission)}</p>
                }
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl" style={{ background: `${st.color}15`, border: `1px solid ${st.color}40` }}>
              <Icon name={st.icon as "Clock"} size={16} style={{ color: st.color }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: st.color }}>{st.label}</p>
                <p className="text-white/40 text-xs">{st.desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Оплата (waiting_payment) */}
        {active.escrow_status === "waiting_payment" && active.is_buyer && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(168,85,247,0.35)" }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(168,85,247,0.15)" }}>
                <Icon name="ShoppingBag" size={18} style={{ color: "#a855f7" }} />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Вы выиграли аукцион!</p>
                <p className="text-white/50 text-xs mt-0.5">Оплатите букет с баланса — деньги заморозятся до получения</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl mb-3"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="text-white/60 text-sm">Сумма к оплате</span>
              <span className="gradient-text font-oswald text-xl font-bold">{formatPrice(active.amount)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl mb-4"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="text-white/60 text-sm">Ваш баланс</span>
              <span className="text-white font-semibold">{formatPrice(user!.balance)}</span>
            </div>
            {user!.balance < active.amount ? (
              <div>
                <div className="flex items-center gap-2 p-3 rounded-xl mb-3"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <Icon name="AlertCircle" size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-xs">Недостаточно средств. Пополните баланс в профиле.</p>
                </div>
              </div>
            ) : (
              <button onClick={() => doPay(active)} disabled={actionLoading}
                className="btn-gradient w-full rounded-2xl py-4 font-oswald text-lg tracking-wide disabled:opacity-50 flex items-center justify-center gap-2">
                <Icon name="CreditCard" size={20} />
                {actionLoading ? "Обрабатываем..." : `ОПЛАТИТЬ ${formatPrice(active.amount)}`}
              </button>
            )}
            {msg && <p className="text-red-400 text-xs mt-2 text-center">{msg}</p>}
          </div>
        )}

        {/* Контакты (после оплаты) */}
        {active.escrow_status === "paid" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(6,214,222,0.3)" }}>
            <p className="text-white/50 text-xs mb-3 font-medium uppercase tracking-wide">Контакты для встречи</p>
            {active.is_buyer && (
              <div className="mb-3">
                <p className="text-white/40 text-xs mb-2">Продавец — {active.seller_name}</p>
                <div className="flex flex-wrap gap-2">
                  {active.seller_phone && (
                    <a href={`tel:${active.seller_phone}`}
                      className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                      <Icon name="Phone" size={14} />{active.seller_phone}
                    </a>
                  )}
                  {active.seller_email && (
                    <a href={`mailto:${active.seller_email}`}
                      className="glass px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white/80">
                      <Icon name="Mail" size={14} />{active.seller_email}
                    </a>
                  )}
                </div>
              </div>
            )}
            {active.is_seller && (
              <div className="mb-1">
                <p className="text-white/40 text-xs mb-2">Покупатель — {active.buyer_name}</p>
                <div className="flex flex-wrap gap-2">
                  {active.buyer_phone && (
                    <a href={`tel:${active.buyer_phone}`}
                      className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                      <Icon name="Phone" size={14} />{active.buyer_phone}
                    </a>
                  )}
                  {active.buyer_email && (
                    <a href={`mailto:${active.buyer_email}`}
                      className="glass px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white/80">
                      <Icon name="Mail" size={14} />{active.buyer_email}
                    </a>
                  )}
                </div>
              </div>
            )}
            {timeLeft !== null && timeLeft > 0 && active.is_buyer && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                <Icon name="Clock" size={14} className="text-white/30" />
                <p className="text-white/30 text-xs">Авто-подтверждение через {timeLeft} ч если не нажмёте кнопку</p>
              </div>
            )}
          </div>
        )}

        {/* Действия покупателя */}
        {active.is_buyer && active.escrow_status === "paid" && (
          <div className="space-y-3 mb-4">
            <button onClick={() => doConfirm(active)} disabled={actionLoading}
              className="btn-gradient w-full rounded-2xl py-4 font-oswald text-lg tracking-wide disabled:opacity-50 flex items-center justify-center gap-2">
              <Icon name="CheckCircle2" size={20} />
              {actionLoading ? "..." : "ПОДТВЕРДИТЬ ПОЛУЧЕНИЕ"}
            </button>
            <p className="text-white/30 text-xs text-center">
              Нажмите только после того как физически получили букет
            </p>
            {!showDispute ? (
              <button onClick={() => setShowDispute(true)}
                className="w-full glass rounded-2xl py-3 text-sm text-white/50 hover:text-white transition-colors">
                Есть проблема с букетом
              </button>
            ) : (
              <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,107,43,0.3)" }}>
                <p className="text-white/60 text-sm mb-2">Опишите проблему:</p>
                <textarea value={disputeText} onChange={e => setDisputeText(e.target.value)}
                  className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none mb-3 resize-none"
                  rows={3} placeholder="Букет не получен, не соответствует описанию..." />
                <div className="flex gap-2">
                  <button onClick={() => setShowDispute(false)} className="flex-1 glass rounded-xl py-2 text-sm text-white/50">Отмена</button>
                  <button onClick={() => doDispute(active)} disabled={actionLoading || !disputeText.trim()}
                    className="flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "var(--neon-orange)" }}>
                    {actionLoading ? "..." : "Открыть спор"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Статус для продавца */}
        {active.is_seller && active.escrow_status === "paid" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
            <div className="flex items-start gap-3">
              <Icon name="Info" size={16} className="text-pink-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-white/60 space-y-2 flex-1">
                <p>Передайте букет покупателю лично. Деньги поступят на баланс после его подтверждения.</p>
                <div className="glass rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/40">Сумма сделки</span>
                    <span className="text-white/70">{formatPrice(active.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Комиссия ЮКассы (~5.5%)</span>
                    <span className="text-red-400">−{formatPrice(Math.round(active.amount * 0.055 * 100) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Комиссия платформы (15%)</span>
                    <span className="text-red-400">−{formatPrice(Math.round((active.amount - active.amount * 0.055) * 0.15 * 100) / 100)}</span>
                  </div>
                  <div className="h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <div className="flex justify-between">
                    <span className="text-white font-medium">Вы получите</span>
                    <span className="text-green-400 font-bold">{formatPrice(active.amount - active.commission)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {active.escrow_status === "completed" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(74,222,128,0.3)" }}>
            <div className="flex items-center gap-3">
              <Icon name="CheckCircle2" size={20} className="text-green-400" />
              <div>
                <p className="text-white font-medium text-sm">Сделка успешно завершена</p>
                {active.is_seller && <p className="text-green-400 text-xs">{formatPrice(active.amount - active.commission)} зачислено на баланс</p>}
              </div>
            </div>
          </div>
        )}

        {active.escrow_status === "dispute" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(255,107,43,0.3)" }}>
            <div className="flex items-start gap-3">
              <Icon name="AlertTriangle" size={16} style={{ color: "var(--neon-orange)" }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Открыт спор</p>
                <p className="text-white/50 text-xs mt-0.5">{active.dispute_reason}</p>
                <p className="text-white/30 text-xs mt-1">Модератор рассмотрит в течение 24 часов</p>
              </div>
            </div>
          </div>
        )}

        {msg && <p className={`text-sm text-center p-3 rounded-xl mb-3 ${msg.includes("ошибка") || msg.includes("Не") || msg.includes("нельзя") ? "text-red-400" : "text-green-400"}`}
          style={{ background: "rgba(255,255,255,0.05)" }}>{msg}</p>}

        {/* Переписка по сделке */}
        {(active.escrow_status === "paid" || active.escrow_status === "completed" || active.escrow_status === "dispute") && (
          <div className="glass rounded-2xl p-4 mb-4">
            <p className="text-white/50 text-xs mb-3 font-medium uppercase tracking-wide flex items-center gap-2">
              <Icon name="MessageCircle" size={13} />
              Переписка по сделке
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-3">
              {dealMessages.length === 0
                ? <p className="text-white/20 text-xs text-center py-4">Нет сообщений</p>
                : dealMessages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === user!.id ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%] px-3 py-2 rounded-2xl text-sm"
                      style={m.sender_id === user!.id
                        ? { background: "var(--grad-main)", color: "#fff" }
                        : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)" }}>
                      <p>{m.text}</p>
                      <p className="text-xs mt-0.5 opacity-50">{timeAgo(m.created_at)}</p>
                    </div>
                  </div>
                ))
              }
              <div ref={dealChatBottomRef} />
            </div>
            {active.escrow_status !== "completed" && active.escrow_status !== "dispute" && (
              <div className="flex gap-2">
                <input value={dealChatText} onChange={e => setDealChatText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendDealMessage()}
                  className="flex-1 glass rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                  placeholder="Сообщение продавцу..." />
                <button onClick={sendDealMessage} disabled={dealChatSending || !dealChatText.trim()}
                  className="btn-gradient w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                  <Icon name="Send" size={14} className="text-white" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Мои сделки</h2>
      <p className="text-white/40 text-sm mb-5">Безопасная передача букетов</p>

      {/* Схема работы */}
      <div className="glass rounded-2xl p-4 mb-5">
        <p className="text-white/50 text-xs font-medium mb-3 uppercase tracking-wide">Как работает безопасная сделка</p>
        <div className="space-y-2">
          {[
            { icon: "CreditCard", color: "#a855f7", text: "Победитель оплачивает — деньги замораживаются у платформы" },
            { icon: "Phone", color: "#06d6de", text: "Открываются телефоны — договоритесь о встрече" },
            { icon: "Handshake", color: "#ff3d8b", text: "Передача лично — без курьеров и доставки" },
            { icon: "CheckCircle2", color: "#4ade80", text: "Покупатель подтверждает — деньги уходят продавцу" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <Icon name={s.icon as "CreditCard"} size={13} style={{ color: s.color }} />
              </div>
              <p className="text-white/60 text-xs">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">{[1,2].map(i => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">🤝</span>
          <p className="text-white/50">Активных сделок нет</p>
          <p className="text-white/30 text-xs mt-1">Участвуйте в аукционах!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {deals.map((d, i) => {
            const st = ESCROW_STATUS[d.escrow_status] || { label: d.escrow_status, color: "#fff", icon: "Circle", desc: "" };
            return (
              <div key={d.id} onClick={() => { setActive(d); setMsg(""); }}
                className={`glass rounded-2xl p-4 card-hover cursor-pointer animate-fade-in-up delay-${Math.min((i+1)*100, 500)}`}>
                <div className="flex items-center gap-3">
                  {d.image_urls?.[0]
                    ? <img src={d.image_urls[0]} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "rgba(255,61,139,0.1)" }}>🌸</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium text-sm truncate">{d.title}</p>
                      <span className="font-oswald font-bold ml-2 flex-shrink-0" style={{ color: st.color }}>{formatPrice(d.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: st.color }}>{st.label}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/30 text-xs">{d.is_buyer ? `от ${d.seller_name}` : `покупатель ${d.buyer_name}`}</span>
                    </div>
                    {d.city && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon name="MapPin" size={10} className="text-white/30" />
                        <span className="text-white/30 text-xs">{d.city}</span>
                      </div>
                    )}
                  </div>
                  <Icon name="ChevronRight" size={16} className="text-white/20 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
