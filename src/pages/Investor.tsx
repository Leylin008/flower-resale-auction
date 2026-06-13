import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";

interface AdminUser { id: number; name: string; is_admin?: boolean; }

const fmt = (n: number) => n.toLocaleString("ru-RU");

/* ─── ДАННЫЕ ─────────────────────────────────────────────── */

const VALUATION = {
  preMoney: { min: 80, base: 150, max: 250 }, // млн ₽ — оценка до раунда
  round: { ask: 60, min: 40, max: 120 }, // млн ₽ — запрашиваемые инвестиции
  ipo: { conservative: 8, base: 25, optimistic: 60 }, // млрд ₽ — оценка при выходе на биржу
};

const EQUITY_SCENARIOS = [
  {
    title: "Консервативный",
    invest: "40 млн ₽",
    share: "20%",
    preMoney: "160 млн ₽",
    postMoney: "200 млн ₽",
    note: "Минимальная отдаваемая доля. Сохраняем контроль 80%. Подходит для умеренного масштабирования по 3 городам.",
    color: "#06d6de",
    recommended: false,
  },
  {
    title: "Базовый (рекомендуем)",
    invest: "60 млн ₽",
    share: "25%",
    preMoney: "180 млн ₽",
    postMoney: "240 млн ₽",
    note: "Оптимальный баланс. Контроль 75% у основателей. Хватает на 12–18 месяцев агрессивного роста + резерв на безопасность и команду.",
    color: "#ff3d8b",
    recommended: true,
  },
  {
    title: "Агрессивный",
    invest: "120 млн ₽",
    share: "35%",
    preMoney: "223 млн ₽",
    postMoney: "343 млн ₽",
    note: "Максимальный буст: выход в 15+ городов за год, агрессивный маркетинг. Отдаём больше доли, но кратно ускоряем рост и оценку.",
    color: "#a855f7",
    recommended: false,
  },
];

const PROFIT_SHARE = [
  { label: "Доля в капитале (equity)", val: "20–35%", desc: "Инвестор получает акции компании, а не % с оборота. Это стандарт венчура." },
  { label: "Дивиденды до выхода на биржу", val: "0%", desc: "Прибыль реинвестируем в рост. Инвестор зарабатывает на росте стоимости акций." },
  { label: "Целевой возврат инвестору", val: "x10–x40", desc: "При выходе на IPO/продаже стратегу через 4–6 лет." },
  { label: "Liquidation preference", val: "1x", desc: "При продаже компании инвестор первым возвращает вложенное, потом делёж по долям." },
];

const TEAM = [
  { role: "CTO / Тех-директор", salary: 350, count: 1, icon: "Cpu", desc: "Архитектура, отказоустойчивость, контроль разработки." },
  { role: "Специалист по информационной безопасности (CISO)", salary: 320, count: 1, icon: "ShieldCheck", desc: "Защита данных, аудит, политика доступа, соответствие 152-ФЗ." },
  { role: "Пентестер / этичный хакер", salary: 280, count: 1, icon: "Bug", desc: "Поиск уязвимостей, нагрузочные атаки, защита от взлома и фрода." },
  { role: "Backend-разработчики", salary: 250, count: 3, icon: "Server", desc: "Платёжная логика, эскроу, масштабирование, антифрод." },
  { role: "Frontend-разработчики", salary: 220, count: 2, icon: "Code", desc: "UX/UI, мобильная версия, скорость интерфейса." },
  { role: "DevOps-инженер", salary: 260, count: 1, icon: "Settings", desc: "Серверы, CI/CD, мониторинг, резервное копирование." },
  { role: "Head of Marketing", salary: 280, count: 1, icon: "Megaphone", desc: "Стратегия привлечения, аналитика каналов, бренд." },
  { role: "Таргетолог / трафик-менеджер", salary: 180, count: 2, icon: "Target", desc: "Закупка рекламы, A/B тесты, оптимизация CAC." },
  { role: "SMM + контент-менеджер", salary: 150, count: 2, icon: "Instagram", desc: "Соцсети, блогеры, вирусный контент, комьюнити." },
  { role: "Support / модерация 24/7", salary: 120, count: 4, icon: "Headphones", desc: "Поддержка сделок, разбор споров, модерация лотов." },
  { role: "Юрист", salary: 220, count: 1, icon: "Scale", desc: "Договоры, эквайринг, лицензии, защита платформы." },
  { role: "Финансист / бухгалтер", salary: 200, count: 1, icon: "Calculator", desc: "Учёт, налоги, отчётность для инвестора." },
];

const SECURITY_STACK = [
  { name: "WAF + Anti-DDoS (Qrator / DDoS-Guard)", cost: "от 150 000 ₽/мес", icon: "Shield" },
  { name: "Облачные серверы (Яндекс.Облако / VK Cloud)", cost: "300 000–800 000 ₽/мес", icon: "Cloud" },
  { name: "Резервное копирование + гео-репликация БД", cost: "120 000 ₽/мес", icon: "DatabaseBackup" },
  { name: "Антифрод-система транзакций", cost: "200 000 ₽/мес", icon: "ScanFace" },
  { name: "SIEM-мониторинг угроз 24/7", cost: "180 000 ₽/мес", icon: "Activity" },
  { name: "Внешний пентест-аудит (раз в квартал)", cost: "500 000 ₽/квартал", icon: "Search" },
  { name: "SSL, шифрование данных, 2FA", cost: "60 000 ₽/мес", icon: "Lock" },
  { name: "Программа Bug Bounty", cost: "от 1 000 000 ₽/год", icon: "Award" },
];

const ADS = [
  { channel: "Таргет VK + Одноклассники", efficiency: "Высокая", budget: "1,5 млн ₽/мес", why: "Основная аудитория РФ/СНГ. Точный таргет по гео, интересам (цветы, свадьбы, подарки).", color: "#ff3d8b" },
  { channel: "Блогеры и инфлюенсеры (Telegram, VK, RuTube)", efficiency: "Очень высокая", budget: "2 млн ₽/мес", why: "Цветы — визуальный товар. Распаковки букетов, обзоры аукционов, доверие аудитории.", color: "#a855f7" },
  { channel: "Яндекс.Директ + РСЯ", efficiency: "Высокая", budget: "1,2 млн ₽/мес", why: "Перехват горячего спроса: «купить букет дёшево», «цветы со скидкой».", color: "#06d6de" },
  { channel: "Telegram Ads + каналы о подарках", efficiency: "Средне-высокая", budget: "800 тыс ₽/мес", why: "Растущая платёжеспособная аудитория, дешёвый охват на старте.", color: "#ff6b2b" },
  { channel: "Реферальная программа (вирусный рост)", efficiency: "Максимальная (ROI)", budget: "5% с оборота", why: "Самый дешёвый канал. Пользователи приводят пользователей за бонусы.", color: "#22c55e" },
  { channel: "SEO + контент-маркетинг", efficiency: "Долгосрочная", budget: "400 тыс ₽/мес", why: "Бесплатный органический трафик в перспективе 6–12 мес.", color: "#eab308" },
  { channel: "Наружная реклама в цветочных кластерах", efficiency: "Точечная", budget: "600 тыс ₽/мес", why: "Привлечение продавцов (флористов, магазинов) — сторона предложения.", color: "#06d6de" },
];

const NEGOTIATION_PATHS = [
  {
    title: "Путь A — Классический венчур",
    icon: "Rocket",
    points: [
      "Раунд Seed: 60 млн ₽ за 25% (оценка 240 млн ₽ post-money)",
      "Чёткий roadmap на 18 месяцев с KPI по сделкам/городам",
      "Место в совете директоров инвестору, но контроль 75% у основателей",
      "Следующий раунд (Series A) через 12–18 мес по оценке в 5–10× выше",
    ],
    color: "#ff3d8b",
  },
  {
    title: "Путь B — Стратегический партнёр",
    icon: "Handshake",
    points: [
      "Инвестор-партнёр с экспертизой (FoodTech / маркетплейсы / финтех)",
      "Меньше денег (40 млн ₽), но доступ к ресурсам: логистика, эквайринг, база клиентов",
      "Доля 18–22%, синергия важнее суммы",
      "Совместный выход на новые рынки СНГ",
    ],
    color: "#a855f7",
  },
  {
    title: "Путь C — Поэтапное финансирование (транши)",
    icon: "Layers",
    points: [
      "Первый транш 20 млн ₽ — запуск MVP-роста в 3 городах",
      "Второй транш 40 млн ₽ — при достижении 10 000 сделок/день",
      "Снижает риск инвестора, защищает долю основателей",
      "Оценка пересматривается вверх на каждом транше",
    ],
    color: "#06d6de",
  },
  {
    title: "Путь D — Convertible Note (заём с конвертацией)",
    icon: "FileText",
    points: [
      "Инвестор даёт заём, который конвертируется в акции на следующем раунде",
      "Дисконт 20% + cap по оценке для инвестора",
      "Не фиксируем оценку прямо сейчас — выгодно при быстром росте",
      "Быстрое закрытие сделки, минимум юридических споров",
    ],
    color: "#ff6b2b",
  },
];

const INVESTORS = [
  { name: "AltaIR Capital", focus: "Маркетплейсы, потребительские платформы", icon: "Building2" },
  { name: "Kama Flow", focus: "Российский венчур, ранние стадии", icon: "Building2" },
  { name: "Day One Ventures / s16vc", focus: "Стартапы с быстрым ростом", icon: "Building2" },
  { name: "Восход (Сибур / Интеррос)", focus: "Технологические компании РФ", icon: "Building2" },
  { name: "ФРИИ (Фонд развития интернет-инициатив)", focus: "Ранние раунды, акселерация", icon: "Building2" },
  { name: "Сбер / SberX", focus: "Финтех, эквайринг, экосистема", icon: "Building2" },
  { name: "VK Ventures", focus: "Соцплатформы, контент, реклама", icon: "Building2" },
  { name: "Яндекс (M&A / Яндекс.Маркет)", focus: "Маркетплейсы, логистика", icon: "Building2" },
  { name: "МТС Венчурный фонд", focus: "Цифровые сервисы, экосистема", icon: "Building2" },
  { name: "Бизнес-ангелы (AngelsDeck, СОБА)", focus: "Частные инвесторы, ранние чеки", icon: "Building2" },
];

/* ─── КОМПОНЕНТЫ ─────────────────────────────────────────── */

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--grad-main)" }}>
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

export default function Investor() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("ff_token");
    if (!token) { setChecked(true); return; }
    authApi.me().then(r => {
      if (r.ok) setUser(r.data.user);
      setChecked(true);
    });
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

  const totalTeamMonthly = TEAM.reduce((s, t) => s + t.salary * t.count, 0);
  const totalHeadcount = TEAM.reduce((s, t) => s + t.count, 0);

  return (
    <div className="min-h-screen pb-16" style={{ background: "#0d0d14" }}>
      {/* HEADER */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(13,13,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <a href="/" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <Icon name="ChevronLeft" size={20} className="text-white" />
        </a>
        <div className="flex-1">
          <p className="font-oswald text-base font-bold text-white leading-tight">Инвестиционная стратегия</p>
          <p className="text-white/40 text-xs">FlowerFlip · конфиденциально</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,61,139,0.15)", color: "#ff3d8b" }}>ADMIN</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* INTRO */}
        <div className="rounded-3xl p-6 mb-8 text-center" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(255,61,139,0.25)" }}>
          <span className="text-4xl block mb-2">💐</span>
          <h1 className="font-oswald text-2xl font-bold gradient-text mb-1">FLOWERFLIP</h1>
          <p className="text-white/60 text-sm">Первая в России и СНГ P2P-аукционная платформа букетов</p>
          <p className="text-white/40 text-xs mt-3 italic">«Продай букет. Получи деньги. Пусть цветы живут дольше.»</p>
        </div>

        {/* ССЫЛКА НА ПРЕЗЕНТАЦИЮ */}
        <a href="/pitch" className="flex items-center gap-3 mb-3 rounded-2xl p-4 transition-all hover:scale-[1.01]"
          style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.18), rgba(6,214,222,0.15))", border: "1px solid rgba(255,61,139,0.3)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#ff3d8b,#06d6de)" }}>
            <Icon name="Presentation" size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-oswald text-base font-bold text-white">Презентация для инвестора</p>
            <p className="text-white/50 text-xs">Питч-дек из 10 слайдов — показать на встрече</p>
          </div>
          <Icon name="ChevronRight" size={20} className="text-white/40" />
        </a>

        {/* ССЫЛКА НА ПЕРЕГОВОРЫ */}
        <a href="/negotiation" className="flex items-center gap-3 mb-8 rounded-2xl p-4 transition-all hover:scale-[1.01]"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(34,197,94,0.3)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#22c55e,#a855f7)" }}>
            <Icon name="MessagesSquare" size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-oswald text-base font-bold text-white">Сценарии переговоров</p>
            <p className="text-white/50 text-xs">Готовые фразы и на чём делать упор, чтобы продавить позицию</p>
          </div>
          <Icon name="ChevronRight" size={20} className="text-white/40" />
        </a>

        {/* 1. ОЦЕНКА КОМПАНИИ */}
        <Section icon="Gem" title="Оценка компании">
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { l: "Pre-money сейчас", v: `${VALUATION.preMoney.base} млн ₽`, c: "#06d6de" },
              { l: "Запрос раунда", v: `${VALUATION.round.ask} млн ₽`, c: "#ff3d8b" },
              { l: "Оценка на IPO", v: `${VALUATION.ipo.base} млрд ₽`, c: "#a855f7" },
            ].map(x => (
              <Card key={x.l} className="text-center">
                <p className="font-oswald text-lg font-bold" style={{ color: x.c }}>{x.v}</p>
                <p className="text-white/40 text-xs mt-1">{x.l}</p>
              </Card>
            ))}
          </div>
          <Card>
            <p className="text-white/70 text-sm leading-relaxed">
              Сейчас компания — на стадии работающего MVP с проверенной моделью (15% комиссия, эскроу, реферальная сеть). Текущая справедливая оценка <b className="text-white">80–250 млн ₽</b> в зависимости от метрик роста.
            </p>
            <div className="h-px my-3" style={{ background: "rgba(255,255,255,0.08)" }} />
            <p className="text-white/70 text-sm leading-relaxed">
              <b className="text-white">Стоимость при выходе на биржу (через 4–6 лет).</b> При среднем сценарии выручка <b className="text-white">2,74 млрд ₽/год</b>. Маркетплейсы оцениваются в 4–10× годовой выручки → <b style={{ color: "#a855f7" }}>оценка 8–60 млрд ₽</b>:
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center"><p className="font-oswald text-base font-bold" style={{ color: "#06d6de" }}>{VALUATION.ipo.conservative} млрд</p><p className="text-white/30 text-[10px]">консерв.</p></div>
              <div className="text-center"><p className="font-oswald text-base font-bold" style={{ color: "#ff3d8b" }}>{VALUATION.ipo.base} млрд</p><p className="text-white/30 text-[10px]">базовый</p></div>
              <div className="text-center"><p className="font-oswald text-base font-bold" style={{ color: "#a855f7" }}>{VALUATION.ipo.optimistic} млрд</p><p className="text-white/30 text-[10px]">оптимист.</p></div>
            </div>
          </Card>
        </Section>

        {/* 2. СКОЛЬКО ИНВЕСТИЦИЙ + ДОЛЯ */}
        <Section icon="Coins" title="Инвестиции и доля акций">
          <div className="space-y-3">
            {EQUITY_SCENARIOS.map(s => (
              <Card key={s.title} className={s.recommended ? "ring-1" : ""}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-oswald font-bold text-white flex items-center gap-2">
                    {s.title}
                    {s.recommended && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--grad-main)", color: "#fff" }}>РЕКОМЕНДУЕМ</span>}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-white/40 text-[10px]">Инвестиции</p>
                    <p className="font-oswald text-lg font-bold text-white">{s.invest}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-white/40 text-[10px]">Доля инвестора</p>
                    <p className="font-oswald text-lg font-bold" style={{ color: s.color }}>{s.share}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-white/40 text-[10px]">Pre-money</p>
                    <p className="font-oswald text-sm font-bold text-white">{s.preMoney}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-white/40 text-[10px]">Post-money</p>
                    <p className="font-oswald text-sm font-bold text-white">{s.postMoney}</p>
                  </div>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">{s.note}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* 3. КАКОЙ % ПРИБЫЛИ ОТДАЁМ */}
        <Section icon="PieChart" title="Сколько прибыли жертвуем">
          <div className="space-y-2">
            {PROFIT_SHARE.map(p => (
              <Card key={p.label}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-white text-sm font-medium">{p.label}</p>
                  <p className="font-oswald font-bold gradient-text shrink-0">{p.val}</p>
                </div>
                <p className="text-white/45 text-xs">{p.desc}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-3">
            <p className="text-white/70 text-sm leading-relaxed">
              <Icon name="Lightbulb" size={15} className="inline text-yellow-400 mr-1" />
              <b className="text-white">Ключевая мысль для инвестора:</b> мы отдаём не «процент с прибыли», а <b className="text-white">долю в капитале</b>. Прибыль реинвестируется в рост — это кратно увеличивает стоимость акций инвестора. Его доход = рост оценки компании в 10–40 раз к моменту выхода.
            </p>
          </Card>
        </Section>

        {/* 4. КОМАНДА */}
        <Section icon="Users" title="Команда">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Card className="text-center">
              <p className="font-oswald text-2xl font-bold gradient-text">{totalHeadcount}</p>
              <p className="text-white/40 text-xs">человек в штате</p>
            </Card>
            <Card className="text-center">
              <p className="font-oswald text-2xl font-bold" style={{ color: "#ff3d8b" }}>{fmt(totalTeamMonthly * 1000)} ₽</p>
              <p className="text-white/40 text-xs">ФОТ в месяц</p>
            </Card>
          </div>
          <div className="space-y-2">
            {TEAM.map(t => (
              <Card key={t.role}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,61,139,0.12)" }}>
                    <Icon name={t.icon} size={17} className="text-pink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-tight">{t.role} {t.count > 1 && <span className="text-white/40">×{t.count}</span>}</p>
                    <p className="text-white/40 text-xs">{t.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-oswald text-sm font-bold text-white">{t.salary} тыс</p>
                    <p className="text-white/30 text-[10px]">₽/чел</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* 5. ОБОРУДОВАНИЕ И БЕЗОПАСНОСТЬ */}
        <Section icon="ServerCog" title="Оборудование и защита от взлома">
          <div className="space-y-2">
            {SECURITY_STACK.map(s => (
              <Card key={s.name}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(6,214,222,0.12)" }}>
                    <Icon name={s.icon} size={17} style={{ color: "#06d6de" }} />
                  </div>
                  <p className="flex-1 text-white text-sm">{s.name}</p>
                  <p className="font-oswald text-xs font-bold text-white/80 shrink-0">{s.cost}</p>
                </div>
              </Card>
            ))}
          </div>
          <Card className="mt-3">
            <p className="text-white/70 text-sm leading-relaxed">
              <Icon name="ShieldCheck" size={15} className="inline mr-1" style={{ color: "#22c55e" }} />
              Суммарно на инфраструктуру и безопасность: <b className="text-white">~1,5–2 млн ₽/мес</b>. Это критично — платформа хранит деньги пользователей в эскроу. Один взлом = потеря доверия и бизнеса.
            </p>
          </Card>
        </Section>

        {/* 6. РЕКЛАМА */}
        <Section icon="Megaphone" title="Реклама: бюджет и каналы">
          <div className="space-y-2">
            {ADS.map(a => (
              <Card key={a.channel}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="text-white text-sm font-medium">{a.channel}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: `${a.color}22`, color: a.color }}>{a.efficiency}</span>
                </div>
                <p className="text-white/45 text-xs mb-2">{a.why}</p>
                <p className="font-oswald text-sm font-bold" style={{ color: a.color }}>{a.budget}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-3">
            <p className="text-white/70 text-sm leading-relaxed">
              <Icon name="TrendingUp" size={15} className="inline text-pink-400 mr-1" />
              Рекомендуемый рекламный бюджет: <b className="text-white">6–8 млн ₽/мес</b> на старте (≈70–90 млн ₽/год). Самые эффективные для нашей аудитории — <b className="text-white">блогеры (визуальный товар)</b> и <b className="text-white">реферальная программа (вирусный рост, лучший ROI)</b>.
            </p>
          </Card>
        </Section>

        {/* 7. ИТОГОВЫЙ БЮДЖЕТ */}
        <Section icon="Wallet" title="Структура использования инвестиций (60 млн ₽)">
          <Card>
            {[
              { l: "Маркетинг и привлечение", v: "24 млн ₽", p: 40, c: "#ff3d8b" },
              { l: "Команда (ФОТ ~6 мес запас)", v: "18 млн ₽", p: 30, c: "#a855f7" },
              { l: "Инфраструктура и безопасность", v: "9 млн ₽", p: 15, c: "#06d6de" },
              { l: "Юридическое + операционное", v: "6 млн ₽", p: 10, c: "#ff6b2b" },
              { l: "Резерв на риски", v: "3 млн ₽", p: 5, c: "#eab308" },
            ].map(b => (
              <div key={b.l} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/70">{b.l}</span>
                  <span className="font-oswald font-bold text-white">{b.v}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${b.p}%`, background: b.c }} />
                </div>
              </div>
            ))}
          </Card>
        </Section>

        {/* 8. ПУТИ ПЕРЕГОВОРОВ */}
        <Section icon="GitBranch" title="Пути развития переговоров с инвестором">
          <div className="space-y-3">
            {NEGOTIATION_PATHS.map(p => (
              <Card key={p.title}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${p.color}22` }}>
                    <Icon name={p.icon} size={16} style={{ color: p.color }} />
                  </div>
                  <p className="font-oswald font-bold text-white">{p.title}</p>
                </div>
                <ul className="space-y-1.5">
                  {p.points.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-white/60 text-xs leading-relaxed">
                      <Icon name="Check" size={13} className="shrink-0 mt-0.5" style={{ color: p.color }} />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Section>

        {/* 9. ПОТЕНЦИАЛЬНЫЕ ИНВЕСТОРЫ */}
        <Section icon="Landmark" title="Компании и фонды для привлечения">
          <div className="grid grid-cols-1 gap-2">
            {INVESTORS.map(inv => (
              <Card key={inv.name}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.12)" }}>
                    <Icon name={inv.icon} size={17} style={{ color: "#a855f7" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{inv.name}</p>
                    <p className="text-white/40 text-xs">{inv.focus}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* 10. ПРЕДЛОЖЕНИЕ ИНВЕСТОРУ */}
        <Section icon="FileSignature" title="Предложение инвестору (Term Sheet)">
          <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.12), rgba(168,85,247,0.12))", border: "1px solid rgba(255,61,139,0.25)" }}>
            <p className="font-oswald text-lg font-bold gradient-text mb-3">Базовое предложение</p>
            {[
              ["Раунд", "Seed"],
              ["Инвестиции", "60 000 000 ₽"],
              ["Доля инвестора", "25%"],
              ["Оценка post-money", "240 000 000 ₽"],
              ["Тип", "Доля в капитале (equity) + 1x liquidation preference"],
              ["Горизонт выхода", "4–6 лет (IPO или продажа стратегу)"],
              ["Целевая оценка на выходе", "8–60 млрд ₽"],
              ["Потенциал возврата", "x10–x40"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 text-sm" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-white/50">{k}</span>
                <span className="text-white font-medium text-right ml-3">{v}</span>
              </div>
            ))}
            <p className="text-white/60 text-xs mt-4 leading-relaxed">
              Деньги пользователей защищены эскроу, выручка масштабируется без складов и закупки товара. Первый мувер на рынке 180+ млн человек. Это редкая возможность войти в категорию-лидера на ранней стадии.
            </p>
          </div>
        </Section>

        <p className="text-center text-white/25 text-xs mt-8">
          Документ конфиденциален · только для администратора и инвестора<br />
          FlowerFlip © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}