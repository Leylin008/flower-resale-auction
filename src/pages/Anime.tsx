import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";

interface AdminUser { id: number; name: string; is_admin?: boolean; }

const grad = "linear-gradient(135deg,#ff3d8b,#a855f7)";

/* ─── СЮЖЕТ ──────────────────────────────────────────────── */

const PLOT = [
  {
    act: "Акт 1 — Дно",
    color: "#ef4444",
    icon: "CloudRain",
    text: "Кента — 23 года, работает на трёх работах в Москве. Его младшая сестра Аои после аварии прикована к инвалидному креслу, а бабушка, которая их вырастила, тяжело больна и нуждается в дорогой операции. Денег катастрофически не хватает, долги растут, отчаяние сжимает горло.",
  },
  {
    act: "Акт 2 — Искра",
    color: "#eab308",
    icon: "Sparkles",
    text: "Случайно Кента находит платформу FLOWERFLIP. Сначала просто перепродаёт остатки букетов из соседнего магазина через аукцион. Первая прибыль — копейки, но это работает. Он изучает рынок, ловит сезонные пики, выстраивает рейтинг и репутацию надёжного продавца.",
  },
  {
    act: "Акт 3 — Взлёт",
    color: "#06d6de",
    icon: "TrendingUp",
    text: "Кента превращает хобби в систему: договаривается с флористами, event-агентствами, свадебными салонами, выкупает неликвид и перепродаёт через ставки. Внутренний кошелёк растёт. Он нанимает курьеров, масштабируется на несколько городов. Из выживающего парня он становится предпринимателем.",
  },
  {
    act: "Акт 4 — Спасение",
    color: "#22c55e",
    icon: "Heart",
    text: "На заработанные деньги Кента оплачивает операцию бабушки и реабилитацию сестры. Аои встаёт на ноги после курса лечения. Финал: семья вместе в своём цветочном магазине, который теперь и продаёт, и выставляет лоты на платформе. «Цветы умирают за три дня. Мечты — нет».",
  },
];

const CHARACTERS = [
  { name: "Кента", role: "Главный герой", desc: "Упорный, добрый, не сдаётся ради семьи", emoji: "🧑‍💼", color: "#ff3d8b" },
  { name: "Аои", role: "Сестра", desc: "В инвалидном кресле, мечтает снова рисовать", emoji: "👧", color: "#a855f7" },
  { name: "Бабушка Хана", role: "Опора семьи", desc: "Больна, вырастила внуков одна", emoji: "👵", color: "#06d6de" },
  { name: "Рин", role: "Флорист-наставница", desc: "Учит Кенту искусству букетов и торга", emoji: "💐", color: "#22c55e" },
];

/* ─── БЮДЖЕТ ─────────────────────────────────────────────── */

const BUDGET = [
  { l: "Производство 12 серий (аутсорс Китай/Корея)", v: "≈ 90 млн ₽", p: 60, c: "#ff3d8b" },
  { l: "Сценарий, режиссура, дизайн персонажей", v: "≈ 12 млн ₽", p: 8, c: "#a855f7" },
  { l: "Озвучка (сэйю) + музыка + звук", v: "≈ 15 млн ₽", p: 10, c: "#06d6de" },
  { l: "Локализация (RU/EN/CN субтитры + дубляж)", v: "≈ 9 млн ₽", p: 6, c: "#ff6b2b" },
  { l: "Маркетинг и продвижение тайтла", v: "≈ 18 млн ₽", p: 12, c: "#eab308" },
  { l: "Резерв и непредвиденные расходы", v: "≈ 6 млн ₽", p: 4, c: "#22c55e" },
];

/* ─── 10 СТУДИЙ С МИНИМАЛЬНЫМИ ЦЕНАМИ ────────────────────── */

const STUDIOS = [
  { n: "Colored Pencil Animation", country: "🇨🇳 Китай", price: "от $40–70k / серия", note: "Один из самых бюджетных китайских аутсорс-партнёров, делает TV-аниме.", c: "#ff3d8b" },
  { n: "Haoliners / bilibili-студии", country: "🇨🇳 Китай", price: "от $50–90k / серия", note: "Производят donghua дешевле японских студий, своя дистрибуция на bilibili.", c: "#a855f7" },
  { n: "Studio LAN", country: "🇨🇳 Китай", price: "от $45–80k / серия", note: "Молодая студия, гибкие условия для заказных проектов.", c: "#06d6de" },
  { n: "G.CMay Animation", country: "🇨🇳 Китай", price: "от $50–85k / серия", note: "Опыт аутсорса для японских тайтлов по сниженным ставкам.", c: "#22c55e" },
  { n: "DR Movie", country: "🇰🇷 Корея", price: "от $60–110k / серия", note: "Известный корейский аутсорс-партнёр японских студий, экономия 20–40%.", c: "#ff6b2b" },
  { n: "Studio Mir", country: "🇰🇷 Корея", price: "от $70–120k / серия", note: "Высокое качество при цене ниже топовых японских студий.", c: "#eab308" },
  { n: "JM Animation", country: "🇰🇷 Корея", price: "от $55–100k / серия", note: "Большой опыт субподряда, конкурентные ставки.", c: "#ff3d8b" },
  { n: "EKACHI EPILKA", country: "🇯🇵 Япония", price: "от $80–130k / серия", note: "Небольшая студия, берёт заказные короткометражки дешевле гигантов.", c: "#a855f7" },
  { n: "Studio Deen (заказные)", country: "🇯🇵 Япония", price: "от $90–150k / серия", note: "Готовы на бюджетные TV-проекты с упрощённой анимацией.", c: "#06d6de" },
  { n: "Felix Film / инди-студии", country: "🇯🇵 Япония", price: "от $80–140k / серия", note: "Молодые японские студии с гибким ценником для дебютных тайтлов.", c: "#22c55e" },
];

/* ─── ЗАЧЕМ ЭТО КОМПАНИИ ─────────────────────────────────── */

const WHY = [
  { i: "Globe", t: "Глобальный охват", d: "Аниме смотрят по всему миру — выход на международную аудиторию без рекламы в лоб." },
  { i: "Heart", t: "Эмоция = доверие", d: "Душевная история создаёт привязанность к бренду сильнее любого баннера." },
  { i: "Repeat", t: "Вирусность", d: "Фанаты пересматривают, цитируют, делают мемы и фан-арт — бесплатный охват." },
  { i: "ShoppingBag", t: "Мерч и IP", d: "Дополнительный доход: фигурки, мерч, лицензии — и продвижение платформы внутри сюжета." },
];

/* ─── КОМПОНЕНТЫ ─────────────────────────────────────────── */

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: grad }}>
          <Icon name={icon} size={18} className="text-white" />
        </div>
        <h2 className="font-oswald text-xl font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl p-4 ${className}`} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>{children}</div>;
}

export default function Anime() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("ff_token");
    if (!token) { setChecked(true); return; }
    authApi.me().then(r => { if (r.ok) setUser(r.data.user); setChecked(true); });
  }, []);

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
    <div className="min-h-screen pb-16" style={{ background: "#0d0d14" }}>
      {/* HEADER */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(13,13,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <a href="/investor" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <Icon name="ChevronLeft" size={20} className="text-white" />
        </a>
        <div className="flex-1">
          <p className="font-oswald text-base font-bold text-white leading-tight">Аниме для продвижения</p>
          <p className="text-white/40 text-xs">FlowerFlip · маркетинг через IP</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,61,139,0.15)", color: "#ff3d8b" }}>ADMIN</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* INTRO */}
        <div className="rounded-3xl p-6 mb-8 text-center" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(255,61,139,0.25)" }}>
          <span className="text-4xl block mb-2">🌸🎬</span>
          <h1 className="font-oswald text-2xl font-bold gradient-text mb-1">«FLOWER FLIP»</h1>
          <p className="text-white/60 text-sm">Аниме-сериал о парне, который спас семью благодаря аукциону букетов</p>
          <p className="text-white/40 text-xs mt-3 italic">«Цветы умирают за три дня. Мечты — нет.»</p>
        </div>

        {/* СЮЖЕТ */}
        <Section icon="BookOpen" title="Сюжет (4 акта)">
          <div className="space-y-3">
            {PLOT.map(p => (
              <Card key={p.act}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${p.color}22` }}>
                    <Icon name={p.icon} size={16} style={{ color: p.color }} />
                  </div>
                  <p className="font-oswald font-bold" style={{ color: p.color }}>{p.act}</p>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{p.text}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ПЕРСОНАЖИ */}
        <Section icon="Users" title="Главные персонажи">
          <div className="grid grid-cols-2 gap-3">
            {CHARACTERS.map(c => (
              <Card key={c.name}>
                <span className="text-3xl block mb-2">{c.emoji}</span>
                <p className="font-oswald font-bold text-white">{c.name}</p>
                <p className="text-xs font-medium mb-1" style={{ color: c.color }}>{c.role}</p>
                <p className="text-white/45 text-xs leading-snug">{c.desc}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* БЮДЖЕТ */}
        <Section icon="Wallet" title="Бюджет из инвестиций (≈ 150 млн ₽)">
          <Card className="mb-3">
            <p className="text-white/70 text-sm leading-relaxed">
              <Icon name="Info" size={15} className="inline text-pink-400 mr-1" />
              Серия TV-аниме стоит <b className="text-white">$150–300k</b>, но аутсорс в Китай/Корею снижает цену анимации на <b className="text-white">20–40%</b>. Сезон из 12 серий упрощённого формата реально уложить в <b className="text-white">~150 млн ₽</b>. Это отдельный медиа-раунд поверх 60 млн на платформу.
            </p>
          </Card>
          <Card>
            {BUDGET.map(b => (
              <div key={b.l} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/70 pr-2">{b.l}</span>
                  <span className="font-oswald font-bold text-white shrink-0">{b.v}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${b.p}%`, background: b.c }} />
                </div>
              </div>
            ))}
          </Card>
        </Section>

        {/* 10 СТУДИЙ */}
        <Section icon="Building2" title="10 студий с минимальным бюджетом">
          <Card className="mb-3">
            <p className="text-white/60 text-xs leading-relaxed">
              <Icon name="TrendingDown" size={14} className="inline mr-1" style={{ color: "#22c55e" }} />
              Отсортированы от самых дешёвых. Китайские студии (donghua) и корейский аутсорс — минимальная стоимость серии. Цены ориентировочные, под заказной проект.
            </p>
          </Card>
          <div className="space-y-2">
            {STUDIOS.map((s, i) => (
              <Card key={s.n}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-oswald font-bold text-white text-sm" style={{ background: s.c }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm leading-tight">{s.n} <span className="text-white/40 text-xs">{s.country}</span></p>
                    <p className="text-white/40 text-xs">{s.note}</p>
                  </div>
                  <p className="font-oswald text-xs font-bold shrink-0" style={{ color: s.c }}>{s.price}</p>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* ЗАЧЕМ */}
        <Section icon="Target" title="Зачем это компании">
          <div className="grid grid-cols-2 gap-3">
            {WHY.map(w => (
              <Card key={w.t}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: grad }}>
                  <Icon name={w.i} size={17} className="text-white" />
                </div>
                <p className="text-white font-medium text-sm">{w.t}</p>
                <p className="text-white/45 text-xs mt-0.5 leading-snug">{w.d}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ИТОГ */}
        <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.12), rgba(168,85,247,0.12))", border: "1px solid rgba(255,61,139,0.25)" }}>
          <p className="font-oswald text-lg font-bold gradient-text mb-2">
            <Icon name="Clapperboard" size={18} className="inline mr-1.5" />Вывод
          </p>
          <p className="text-white/75 text-sm leading-relaxed">
            Аниме — это не расход, а вирусный медиа-актив. Душевная история о спасении семьи через FLOWERFLIP создаёт эмоциональную связь с брендом, выводит платформу на мировую аудиторию и приносит доход от IP. Старт — один сезон через бюджетную студию Китая/Кореи.
          </p>
        </div>

        <p className="text-center text-white/25 text-xs mt-8">
          Документ конфиденциален · только для администратора<br />
          FlowerFlip © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
