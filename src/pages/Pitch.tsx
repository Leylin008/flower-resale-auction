import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";

interface AdminUser { id: number; name: string; is_admin?: boolean; }

const COVER = "https://cdn.poehali.dev/projects/c3c15f66-a71a-4790-a1f7-f67719eb241e/files/e24efeff-ea94-4aff-9baf-a66707f26e96.jpg";

/* ─── СЛАЙДЫ ПРЕЗЕНТАЦИИ ─────────────────────────────────── */

interface Slide { id: string; render: () => JSX.Element; }

const grad = "linear-gradient(135deg,#ff3d8b,#a855f7)";

function Stat({ v, l, c = "#ff3d8b" }: { v: string; l: string; c?: string }) {
  return (
    <div className="text-center">
      <p className="font-oswald text-3xl md:text-4xl font-bold" style={{ color: c }}>{v}</p>
      <p className="text-white/50 text-xs md:text-sm mt-1">{l}</p>
    </div>
  );
}

const SLIDES: Slide[] = [
  // 1. ТИТУЛ
  {
    id: "cover",
    render: () => (
      <div className="relative h-full flex flex-col items-center justify-center text-center overflow-hidden rounded-3xl">
        <img src={COVER} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(13,13,20,0.6), rgba(13,13,20,0.92))" }} />
        <div className="relative z-10 px-6">
          <span className="text-5xl block mb-4 animate-fade-in">💐</span>
          <h1 className="font-oswald text-5xl md:text-6xl font-bold gradient-text mb-3">FLOWERFLIP</h1>
          <p className="text-white/80 text-base md:text-lg max-w-md mx-auto">Первая в России и СНГ P2P-аукционная платформа для продажи букетов</p>
          <p className="text-white/40 text-sm mt-6 italic">«Продай букет. Получи деньги.<br />Пусть цветы живут дольше.»</p>
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(255,61,139,0.15)", border: "1px solid rgba(255,61,139,0.3)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
            <span className="text-white/70 text-sm">Раунд Seed · 60 млн ₽ за 25%</span>
          </div>
        </div>
      </div>
    ),
  },
  // 2. ПРОБЛЕМА
  {
    id: "problem",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-pink-400 text-sm font-medium uppercase tracking-wide mb-2">Проблема</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Миллионы букетов теряют ценность за 1–3 дня</h2>
        <div className="space-y-3">
          {[
            { i: "Clock", t: "Цветы — скоропортящийся товар. Через пару дней букет за 3000 ₽ стоит ноль." },
            { i: "Store", t: "Флористы и магазины списывают остатки и неликвид в убыток." },
            { i: "Heart", t: "Свадебные и event-букеты выбрасывают сразу после торжества." },
            { i: "Search", t: "Покупатель хочет свежие цветы дешевле магазина — но негде взять." },
          ].map(x => (
            <div key={x.i} className="flex items-center gap-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                <Icon name={x.i} size={19} style={{ color: "#ef4444" }} />
              </div>
              <p className="text-white/75 text-sm md:text-base">{x.t}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 3. РЕШЕНИЕ
  {
    id: "solution",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-purple-400 text-sm font-medium uppercase tracking-wide mb-2">Решение</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Аукцион букетов, где выигрывает каждый</h2>
        <div className="rounded-3xl p-6 mb-4" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.12), rgba(168,85,247,0.12))", border: "1px solid rgba(255,61,139,0.25)" }}>
          <div className="flex items-center justify-between gap-2">
            {[
              { i: "Upload", l: "Продавец\nвыставляет лот" },
              { i: "Gavel", l: "Покупатели\nделают ставки" },
              { i: "Trophy", l: "Побеждает\nмакс. ставка" },
              { i: "Wallet", l: "Платформа\nберёт 15%" },
            ].map((x, i, arr) => (
              <div key={x.i} className="flex items-center gap-2 flex-1">
                <div className="text-center flex-1">
                  <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-2" style={{ background: grad }}>
                    <Icon name={x.i} size={22} className="text-white" />
                  </div>
                  <p className="text-white/70 text-[11px] whitespace-pre-line leading-tight">{x.l}</p>
                </div>
                {i < arr.length - 1 && <Icon name="ChevronRight" size={16} className="text-white/30 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/60 text-sm md:text-base text-center">Безопасная сделка через эскроу · встроенный чат · рейтинги · геолокация по районам</p>
      </div>
    ),
  },
  // 4. РЫНОК
  {
    id: "market",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-cyan-400 text-sm font-medium uppercase tracking-wide mb-2">Рынок</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-8 leading-tight">Огромный и никем не занятый</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-2xl p-5 flex items-center gap-5" style={{ background: "rgba(6,214,222,0.08)", border: "1px solid rgba(6,214,222,0.2)" }}>
            <Stat v="180 млн+" l="" c="#06d6de" />
            <p className="text-white/70 text-sm md:text-base flex-1">потенциальных пользователей в России и СНГ</p>
          </div>
          <div className="rounded-2xl p-5 flex items-center gap-5" style={{ background: "rgba(255,61,139,0.08)", border: "1px solid rgba(255,61,139,0.2)" }}>
            <Stat v="100+ млрд ₽" l="" c="#ff3d8b" />
            <p className="text-white/70 text-sm md:text-base flex-1">объём рынка цветов в год</p>
          </div>
          <div className="rounded-2xl p-5 flex items-center gap-5" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <Stat v="#1" l="" c="#a855f7" />
            <p className="text-white/70 text-sm md:text-base flex-1">первая аукционная платформа букетов в СНГ — конкурентов нет</p>
          </div>
        </div>
      </div>
    ),
  },
  // 5. БИЗНЕС-МОДЕЛЬ
  {
    id: "model",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-pink-400 text-sm font-medium uppercase tracking-wide mb-2">Как мы зарабатываем</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">15% с каждой сделки — автоматически</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { i: "Percent", t: "Комиссия 15%", d: "Основной доход, удерживается автоматически" },
            { i: "Megaphone", t: "Реклама", d: "Баннеры, топ-лоты, рассылки" },
            { i: "Users", t: "Партнёры", d: "Рефералы, доставка, B2B-тарифы" },
            { i: "Crown", t: "Подписки", d: "Премиум для флористов и магазинов" },
          ].map(x => (
            <div key={x.i} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: grad }}>
                <Icon name={x.i} size={17} className="text-white" />
              </div>
              <p className="text-white font-medium text-sm">{x.t}</p>
              <p className="text-white/45 text-xs mt-0.5">{x.d}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <p className="text-white/70 text-sm">Asset-light: <b className="text-white">нет складов, закупок и логистики</b> — чистая комиссия с чужого оборота</p>
        </div>
      </div>
    ),
  },
  // 6. ФИНМОДЕЛЬ
  {
    id: "finance",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-green-400 text-sm font-medium uppercase tracking-wide mb-2">Финансовая модель</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Выручка масштабируется кратно</h2>
        <div className="space-y-3">
          {[
            { n: "Минимальный", deals: "10 000 сделок/день", rev: "547,5 млн ₽/год", c: "#06d6de", w: 25 },
            { n: "Средний", deals: "50 000 сделок/день", rev: "2,74 млрд ₽/год", c: "#ff3d8b", w: 60 },
            { n: "Максимальный", deals: "250 000 сделок/день", rev: "13,69 млрд ₽/год", c: "#a855f7", w: 100 },
          ].map(s => (
            <div key={s.n} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white font-medium text-sm">{s.n} сценарий</p>
                  <p className="text-white/45 text-xs">{s.deals}</p>
                </div>
                <p className="font-oswald text-lg font-bold" style={{ color: s.c }}>{s.rev}</p>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${s.w}%`, background: s.c }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 7. ЦЕЛЕВАЯ АУДИТОРИЯ
  {
    id: "audience",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-purple-400 text-sm font-medium uppercase tracking-wide mb-2">Клиенты</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Спрос с обеих сторон</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { e: "💐", t: "Флористы и магазины", d: "продажа остатков и неликвида" },
            { e: "🌹", t: "Частные флористы", d: "авторские букеты напрямую" },
            { e: "🎁", t: "Event-агентства", d: "декор после мероприятий" },
            { e: "💍", t: "Свадебные флористы", d: "букеты после торжеств" },
            { e: "🛒", t: "Перекупщики", d: "покупка и перепродажа" },
            { e: "🏪", t: "Массовый покупатель", d: "свежие цветы дешевле магазина" },
          ].map(x => (
            <div key={x.t} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-2xl block mb-2">{x.e}</span>
              <p className="text-white font-medium text-sm leading-tight">{x.t}</p>
              <p className="text-white/45 text-xs mt-0.5">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 8. ПОЧЕМУ МЫ
  {
    id: "why",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-pink-400 text-sm font-medium uppercase tracking-wide mb-2">Почему стоит вложиться</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">7 причин сказать «да»</h2>
        <div className="grid grid-cols-1 gap-2.5">
          {[
            "Первый игрок на рынке 180 млн человек",
            "Asset-light: низкие расходы, нет складов",
            "Повторные покупки и сезонные пики спроса",
            "Высокая масштабируемость без доп. затрат",
            "Деньги защищены эскроу — доверие пользователей",
            "Работающий продукт с проверенной моделью",
            "Возврат инвестору x10–x40 к моменту выхода",
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: grad }}>
                <Icon name="Check" size={15} className="text-white" />
              </div>
              <p className="text-white/80 text-sm md:text-base">{t}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 9. ПРЕДЛОЖЕНИЕ
  {
    id: "offer",
    render: () => (
      <div className="h-full flex flex-col justify-center px-2">
        <p className="text-green-400 text-sm font-medium uppercase tracking-wide mb-2">Предложение</p>
        <h2 className="font-oswald text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Условия сделки</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(255,61,139,0.3)" }}>
            <p className="font-oswald text-3xl font-bold text-white">60 млн ₽</p>
            <p className="text-white/50 text-xs mt-1">объём инвестиций</p>
          </div>
          <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(6,214,222,0.15))", border: "1px solid rgba(168,85,247,0.3)" }}>
            <p className="font-oswald text-3xl font-bold gradient-text">25%</p>
            <p className="text-white/50 text-xs mt-1">доля инвестора</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {[
            ["Оценка post-money", "240 млн ₽"],
            ["Защита", "Liquidation preference 1x"],
            ["Горизонт выхода", "4–6 лет (IPO / стратег)"],
            ["Оценка на выходе", "8–60 млрд ₽"],
            ["Потенциал возврата", "x10–x40"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-white/50">{k}</span>
              <span className="text-white font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 10. ФИНАЛ / CTA
  {
    id: "cta",
    render: () => (
      <div className="relative h-full flex flex-col items-center justify-center text-center overflow-hidden rounded-3xl">
        <img src={COVER} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(13,13,20,0.7), rgba(13,13,20,0.95))" }} />
        <div className="relative z-10 px-6">
          <h2 className="font-oswald text-4xl md:text-5xl font-bold gradient-text mb-4">Войдите первым</h2>
          <p className="text-white/75 text-base md:text-lg max-w-md mx-auto mb-2">
            Пока рынок пуст — вход стоит 60 миллионов. Завтра это станет очевидно всем.
          </p>
          <p className="text-white/50 text-sm max-w-sm mx-auto mb-8">
            Готовы подписать term sheet на этой неделе.
          </p>
          <div className="inline-flex flex-col items-center gap-2 px-8 py-4 rounded-2xl" style={{ background: grad }}>
            <span className="text-white font-oswald text-lg font-bold">FLOWERFLIP</span>
            <span className="text-white/80 text-xs">Продай букет. Получи деньги.</span>
          </div>
        </div>
      </div>
    ),
  },
];

/* ─── СТРАНИЦА ───────────────────────────────────────────── */

export default function Pitch() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("ff_token");
    if (!token) { setChecked(true); return; }
    authApi.me().then(r => { if (r.ok) setUser(r.data.user); setChecked(true); });
  }, []);

  const go = useCallback((d: number) => {
    setIdx(i => Math.max(0, Math.min(SLIDES.length - 1, i + d)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!checked) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d14" }}>
      <Icon name="Loader2" size={32} className="text-pink-400 animate-spin" />
    </div>
  );

  if (!user?.is_admin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6" style={{ background: "#0d0d14" }}>
      <span className="text-5xl">🔒</span>
      <p className="text-white/60 font-oswald text-xl text-center">Доступ только для администратора</p>
      <a href="/" className="text-pink-400 text-sm">← На главную</a>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0d14" }}>
      {/* HEADER */}
      <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <a href="/investor" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <Icon name="ChevronLeft" size={20} className="text-white" />
        </a>
        <div className="flex-1">
          <p className="font-oswald text-base font-bold text-white leading-tight">Презентация для инвестора</p>
          <p className="text-white/40 text-xs">Слайд {idx + 1} из {SLIDES.length}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,61,139,0.15)", color: "#ff3d8b" }}>ADMIN</span>
      </div>

      {/* PROGRESS */}
      <div className="flex gap-1 px-4 py-2 shrink-0">
        {SLIDES.map((s, i) => (
          <button key={s.id} onClick={() => setIdx(i)} className="flex-1 h-1 rounded-full transition-all"
            style={{ background: i <= idx ? grad : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>

      {/* SLIDE */}
      <div className="flex-1 px-4 py-4 max-w-2xl w-full mx-auto">
        <div key={idx} className="h-[calc(100vh-220px)] min-h-[420px] animate-fade-in">
          {SLIDES[idx].render()}
        </div>
      </div>

      {/* NAV */}
      <div className="px-4 py-4 flex items-center gap-3 max-w-2xl w-full mx-auto shrink-0">
        <button onClick={() => go(-1)} disabled={idx === 0}
          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Icon name="ChevronLeft" size={22} className="text-white" />
        </button>
        {idx < SLIDES.length - 1 ? (
          <button onClick={() => go(1)} className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 font-medium text-white" style={{ background: grad }}>
            Далее <Icon name="ArrowRight" size={18} className="text-white" />
          </button>
        ) : (
          <a href="/negotiation" className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 font-medium text-white" style={{ background: "linear-gradient(135deg,#22c55e,#a855f7)" }}>
            К сценариям переговоров <Icon name="MessagesSquare" size={18} className="text-white" />
          </a>
        )}
      </div>
    </div>
  );
}
