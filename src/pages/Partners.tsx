import Icon from "@/components/ui/icon";

const stats = [
  { value: "10%", label: "Комиссия платформы с каждой сделки" },
  { value: "3 формата", label: "Аукцион, фикс. цена, бронь" },
  { value: "24ч", label: "Вывод средств продавцу" },
  { value: "5%", label: "Реферальная программа" },
];

const features = [
  {
    icon: "Gavel",
    title: "Аукционная модель",
    desc: "Продавец выставляет букет — покупатели торгуются. Побеждает максимальная ставка. Таймер удлиняется при каждой ставке — азарт растёт.",
  },
  {
    icon: "Tag",
    title: "Фиксированная цена",
    desc: "Продавец сам устанавливает цену — покупатель берёт сразу. Быстро, предсказуемо, без торгов. Идеально для магазинов.",
  },
  {
    icon: "BookmarkCheck",
    title: "Бронирование",
    desc: "Покупатель бронирует букет на 24 часа с подтверждением продавца. Никто другой в это время не может купить.",
  },
  {
    icon: "ShieldCheck",
    title: "Эскроу-защита сделок",
    desc: "Деньги замораживаются до подтверждения получения. Покупатель и продавец защищены от мошенничества.",
  },
  {
    icon: "Store",
    title: "Витрина магазина",
    desc: "Флористы и магазины открывают свой профиль с логотипом, описанием, адресом и всеми активными букетами.",
  },
  {
    icon: "Megaphone",
    title: "Рекламные баннеры",
    desc: "Слайдер из 3 баннеров в шапке главной страницы. Фото или видео, ссылка при клике, настраиваемая длительность показа.",
  },
  {
    icon: "Bell",
    title: "Push-уведомления",
    desc: "Уведомления о новых ставках, продажах, сообщениях — в браузере и на телефоне. Рекламные рассылки для магазинов.",
  },
  {
    icon: "MapPin",
    title: "Геолокация и районы",
    desc: "Фильтрация по городам и районам — Москва, СПб, Екатеринбург, Казань, Новосибирск и ещё 100+ городов.",
  },
  {
    icon: "MessageCircle",
    title: "Встроенный чат",
    desc: "Чат активируется только после оплаты. Стороны договариваются о встрече без внешних мессенджеров.",
  },
  {
    icon: "Wallet",
    title: "Внутренний кошелёк",
    desc: "Пополнение через ЮКассу, вывод на карту/СБП за 24 часа. Реферальные бонусы зачисляются автоматически.",
  },
  {
    icon: "RefreshCw",
    title: "Автопродление подписок",
    desc: "Подписки магазинов и рекламные пакеты продлеваются автоматически. Напоминания за 3 дня до окончания.",
  },
  {
    icon: "Star",
    title: "Рейтинги и отзывы",
    desc: "После каждой сделки — взаимные отзывы. Продавцы с высоким рейтингом получают больше доверия и ставок.",
  },
];

const niches = [
  { emoji: "🏪", title: "Цветочные магазины", why: "Витрина на платформе, неограниченные букеты, все форматы продажи. Привлекайте новых клиентов через маркетплейс.", potential: "Высокий", color: "#ff3d8b" },
  { emoji: "💐", title: "Флористы-фрилансеры", why: "Авторские букеты по цене выше рынка. Аукцион позволяет найти ценящего покупателя без торговли вручную.", potential: "Высокий", color: "#a855f7" },
  { emoji: "🎁", title: "Event-агентства", why: "Срочная реализация цветочного декора после корпоративов, свадеб, фотосессий. Деньги возвращаются в тот же день.", potential: "Средний", color: "#ff6b2b" },
  { emoji: "📢", title: "Рекламодатели", why: "Баннеры на главной странице — фото или видео с переходом на сайт. Аудитория: покупатели и продавцы цветов.", potential: "Высокий", color: "#06d6de" },
  { emoji: "💍", title: "Свадебные флористы", why: "После торжества — десятки букетов. Аукцион позволяет продать в тот же день по честной рыночной цене.", potential: "Средний", color: "#ff3d8b" },
  { emoji: "🛒", title: "Все дарящие цветы", why: "День рождения, 8 марта, свидание — свежие букеты дешевле магазина с удовольствием от торгов.", potential: "Массовый", color: "#a855f7" },
];

const revenueStreams = [
  {
    icon: "TrendingUp",
    title: "Комиссия со сделок",
    items: [
      "10% с каждой завершённой сделки",
      "Взимается автоматически при подтверждении",
      "Работает для аукциона и фиксированной цены",
    ],
  },
  {
    icon: "Store",
    title: "Подписки магазинов",
    items: [
      "Ежемесячная подписка для флористов и магазинов",
      "Автопродление — стабильный рекуррентный доход",
      "Доп. опция: рекламные баннеры на главной",
    ],
  },
  {
    icon: "Megaphone",
    title: "Рекламный инвентарь",
    items: [
      "3 баннера на главной — фото и видео",
      "Настройка длительности, ссылки, описания",
      "Статистика кликов для рекламодателей",
    ],
  },
];

const subscriptionPlans = [
  {
    name: "Магазин",
    price: "1 990",
    period: "мес",
    color: "#a855f7",
    features: ["Профиль с логотипом", "Неограниченно букетов", "Все форматы продажи", "Фильтр по городам", "Страница в разделе «Магазины»"],
  },
  {
    name: "Магазин + Баннеры",
    price: "2 980",
    period: "мес",
    color: "#ff3d8b",
    badge: "Популярный",
    features: ["Всё из тарифа Магазин", "Баннер на главной странице", "Фото или видео", "Настройка ссылки и описания", "Статистика кликов"],
  },
  {
    name: "Только баннер",
    price: "990",
    period: "мес",
    color: "#ff6b2b",
    features: ["Баннер на главной", "Для любых рекламодателей", "Фото или видео до 30 сек", "Ссылка на сайт при клике", "Отчёт по кликам"],
  },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, fontFamily: "'Oswald', sans-serif", marginBottom: 32, textAlign: "center", color: "#fff" }}>
      {children}
    </h2>
  );
}

export default function Partners() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d0d14 0%, #12071e 50%, #0d1020 100%)", fontFamily: "'Golos Text', sans-serif", color: "#fff" }}>

      {/* HERO */}
      <section style={{ padding: "80px 24px 60px", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 100, background: "rgba(255,61,139,0.12)", border: "1px solid rgba(255,61,139,0.3)", fontSize: 12, color: "#ff3d8b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>
          Партнёрская презентация
        </div>
        <h1 style={{ fontSize: "clamp(36px, 8vw, 64px)", fontWeight: 800, lineHeight: 1.1, background: "linear-gradient(135deg, #ff3d8b 0%, #a855f7 50%, #ff6b2b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 20, fontFamily: "'Oswald', sans-serif" }}>
          FlowerFlip
        </h1>
        <p style={{ fontSize: 20, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 600, margin: "0 auto 12px" }}>
          Маркетплейс живых букетов с аукционом, фикс. ценой и магазинами
        </p>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
          Продавцы выставляют букеты — покупатели торгуются или покупают сразу.<br />
          Магазины открывают витрину. Платформа зарабатывает автоматически.
        </p>
      </section>

      {/* STATS */}
      <section style={{ padding: "0 24px 60px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Oswald', sans-serif", background: "linear-gradient(135deg, #ff3d8b, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.value}
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Возможности платформы</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {features.map((f) => (
            <div key={f.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, rgba(255,61,139,0.2), rgba(168,85,247,0.2))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon name={f.icon} size={18} className="text-pink-400" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SUBSCRIPTION PLANS */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Тарифы для магазинов и рекламодателей</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {subscriptionPlans.map((p) => (
            <div key={p.name} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${p.color}40`, borderRadius: 20, padding: 28, position: "relative" }}>
              {p.badge && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: `linear-gradient(135deg, #ff3d8b, #a855f7)`, borderRadius: 100, padding: "4px 16px", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                  {p.badge}
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Oswald', sans-serif", color: p.color }}>{p.price} ₽</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>/{p.period}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {p.features.map((feat) => (
                  <li key={feat} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                    <span style={{ color: p.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 24, padding: "12px 0 0", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                Автопродление · Подключение через профиль
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW EARNS */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Как зарабатывает платформа</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {revenueStreams.map((r) => (
            <div key={r.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, rgba(255,61,139,0.2), rgba(168,85,247,0.2))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon name={r.icon} size={20} className="text-pink-400" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#fff" }}>{r.title}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {r.items.map((item) => (
                  <li key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ color: "#a855f7", marginTop: 2, flexShrink: 0 }}>✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Commission example */}
        <div style={{ marginTop: 32, background: "linear-gradient(135deg, rgba(255,61,139,0.08), rgba(168,85,247,0.08))", border: "1px solid rgba(255,61,139,0.2)", borderRadius: 20, padding: 28 }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 16, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.08em" }}>Пример расчёта дохода</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
            {[
              { label: "Сделок в день", value: "100" },
              { label: "Средний букет", value: "1 500 ₽" },
              { label: "Комиссия (10%)", value: "150 ₽" },
              { label: "Доход в месяц", value: "450 000 ₽" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Oswald', sans-serif", background: "linear-gradient(135deg, #ff3d8b, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NICHES */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Для кого платформа</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {niches.map((n) => (
            <div key={n.title} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${n.color}25`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 32 }}>{n.emoji}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: n.color, marginTop: 2 }}>Потенциал: {n.potential}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0 }}>{n.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "0 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        <SectionTitle>Как работает сделка</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { n: "1", title: "Продавец публикует букет", desc: "Фото, описание, тип продажи: аукцион, фиксированная цена или оба. Опционально — разрешить бронь.", color: "#ff3d8b" },
            { n: "2", title: "Покупатель делает ставку или покупает", desc: "При аукционе — ставки, при фиксе — мгновенная покупка. Бронь даёт 24 часа на решение.", color: "#a855f7" },
            { n: "3", title: "Деньги замораживаются в эскроу", desc: "Платёж через ЮКассу. Средства хранятся на платформе — ни продавец, ни покупатель не рискуют.", color: "#ff6b2b" },
            { n: "4", title: "Передача букета", desc: "Стороны договариваются через встроенный чат. Личная передача без курьеров и доставки.", color: "#06d6de" },
            { n: "5", title: "Подтверждение и выплата", desc: "Покупатель подтверждает получение → деньги минус 10% комиссии переходят продавцу за 24 часа.", color: "#4ade80" },
          ].map((s, i, arr) => (
            <div key={s.n} style={{ display: "flex", gap: 16, paddingBottom: i < arr.length - 1 ? 0 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${s.color}40, ${s.color}20)`, border: `2px solid ${s.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: s.color, flexShrink: 0, fontFamily: "'Oswald', sans-serif" }}>{s.n}</div>
                {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: `linear-gradient(${s.color}40, transparent)`, margin: "4px 0", minHeight: 24 }} />}
              </div>
              <div style={{ paddingBottom: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "0 24px 100px", textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.1), rgba(168,85,247,0.1))", border: "1px solid rgba(255,61,139,0.25)", borderRadius: 24, padding: "48px 32px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌸</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Oswald', sans-serif", marginBottom: 12, background: "linear-gradient(135deg, #ff3d8b, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Стать партнёром
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 28 }}>
            Откройте витрину магазина, разместите рекламу или станьте инвестором платформы. Напишите нам — ответим в течение 24 часов.
          </p>
          <a href="mailto:flowerflip@flowerflip.ru?subject=Партнёрство FlowerFlip"
            style={{ display: "inline-block", background: "linear-gradient(135deg, #ff3d8b, #a855f7)", borderRadius: 16, padding: "14px 36px", fontSize: 15, fontWeight: 700, color: "#fff", textDecoration: "none", fontFamily: "'Oswald', sans-serif", letterSpacing: "0.05em" }}>
            НАПИСАТЬ НАМ
          </a>
          <div style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
            flowerflip@flowerflip.ru · flowerflip.online
          </div>
        </div>
      </section>
    </div>
  );
}