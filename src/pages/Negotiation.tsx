import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";

interface AdminUser { id: number; name: string; is_admin?: boolean; }

/* ─── СЦЕНАРИИ ПЕРЕГОВОРОВ ──────────────────────────────── */

const TOPICS = [
  {
    id: "why-invest",
    icon: "Rocket",
    color: "#ff3d8b",
    title: "Почему вообще стоит вложиться",
    opening:
      "«Представьте Avito, но только для цветов, где каждая сделка приносит нам 15% автоматически. Мы не покупаем товар, не держим склады, не возим букеты — мы берём комиссию с чужого оборота. Рынок цветов в РФ и СНГ — сотни миллиардов рублей в год, и до нас никто не закрыл нишу аукционной перепродажи. Мы первые.»",
    focus: [
      "Делай упор на «первый на рынке» — это создаёт ощущение упущенной выгоды (FOMO).",
      "Подчёркивай asset-light модель: нет складов, закупок, логистики — чистая комиссия.",
      "Покажи масштаб: 180+ млн человек, миллионы букетов теряют ценность за 1–3 дня.",
      "Веди к мысли: «вопрос не вложиться или нет, а войти сейчас дёшево или потом дорого».",
    ],
    counter: "Если скажут «рынок маленький» — переводи на оборот, а не на цветы: 50 000 сделок/день = 2,74 млрд ₽ выручки/год только на комиссии.",
  },
  {
    id: "why-share",
    icon: "PieChart",
    color: "#a855f7",
    title: "Почему именно 25%, а не больше",
    opening:
      "«Мы предлагаем 25% за 60 миллионов. Это честная оценка post-money в 240 миллионов — она основана не на воздухе, а на работающей модели и метриках. Я сознательно не отдаю контрольную долю: основатель, потерявший контроль и мотивацию, убивает стартап. Вам выгодно, чтобы я остался голодным и вовлечённым.»",
    focus: [
      "Якорение: называй 25% уверенно и первым, чтобы это стало точкой отсчёта.",
      "Аргумент мотивации: инвестору НЕвыгодно размывать основателя — это снижает его шансы на возврат.",
      "Показывай математику оценки (выручка × мультипликатор), а не «я так хочу».",
      "Если давят на бОльшую долю — предлагай транши вместо доли (см. путь C), а не уступай %.",
    ],
    counter: "На «хочу 40%» отвечай: «Тогда давайте поэтапно — первый транш за меньшую долю, остальное по достижению KPI. Так вы снижаете риск, а я сохраняю мотивацию».",
  },
  {
    id: "valuation",
    icon: "Gem",
    color: "#06d6de",
    title: "Откуда оценка в 240 млн",
    opening:
      "«Оценка построена снизу вверх. Маркетплейсы оцениваются в 4–10 годовых выручек. При среднем сценарии наша выручка — 2,74 миллиарда в год. Даже по консервативному мультипликатору это миллиарды. 240 миллионов сейчас — это вход с дисконтом до того, как мы докажем цифры. Вы платите за раннюю стадию, а не за готовый бизнес.»",
    focus: [
      "Привязывай оценку к публичным мультипликаторам маркетплейсов — это объективно.",
      "Разделяй «оценка сейчас» (дёшево, риск) и «оценка на выходе» (8–60 млрд) — продаёшь рост.",
      "Никогда не оправдывайся за цифру — объясняй методологию спокойно и уверенно.",
    ],
    counter: "На «слишком дорого» — предложи convertible note: оценку зафиксируем на следующем раунде с дисконтом 20%. Это снимает спор о цифре здесь и сейчас.",
  },
  {
    id: "profit",
    icon: "Coins",
    color: "#22c55e",
    title: "Почему не отдаём % с прибыли / дивиденды",
    opening:
      "«Я предлагаю долю в капитале, а не процент с прибыли. И вот почему это выгоднее вам: если мы будем выплачивать дивиденды, мы замедлим рост и ваша доля будет стоить меньше. А если всю прибыль реинвестируем — стоимость ваших акций вырастет в 10–40 раз к выходу. Дивиденды — это для зрелых компаний, а мы — ракета на старте.»",
    focus: [
      "Переводи разговор с «дохода сейчас» на «капитализацию на выходе» — это в разы больше.",
      "Используй цифру возврата x10–x40 — она работает сильнее любого дивиденда.",
      "Покажи liquidation preference 1x — инвестор защищён, первым вернёт вложенное.",
    ],
    counter: "Если инвестор хочет кэш-флоу — предложи небольшой приоритетный дивиденд ПОСЛЕ выхода на операционную прибыль, но не раньше.",
  },
  {
    id: "team",
    icon: "Users",
    color: "#ff6b2b",
    title: "Почему нужна такая команда и зарплаты",
    opening:
      "«Мы держим деньги пользователей в эскроу — это финтех. Поэтому в команде CISO, пентестер и антифрод-инженер не роскошь, а условие выживания. Один взлом — и мы потеряли доверие и бизнес. Зарплаты рыночные: дешёвый специалист по безопасности обойдётся в десятки миллионов убытка от утечки.»",
    focus: [
      "Связывай каждую дорогую позицию с защитой денег инвестора, а не с «хотелками».",
      "Безопасность подавай как страховку капитала, а не как расход.",
      "Покажи, что ФОТ — это 30% бюджета с запасом на 6 месяцев, а не бесконтрольные траты.",
    ],
    counter: "На «слишком много людей» — покажи, что почти все в продукте и безопасности, а не в офисе. Никаких лишних менеджеров.",
  },
  {
    id: "security",
    icon: "ShieldCheck",
    color: "#06d6de",
    title: "Почему столько на безопасность и инфраструктуру",
    opening:
      "«1,5–2 миллиона в месяц на защиту — это меньше, чем стоимость одного успешного взлома. Мы храним платежи, персональные данные, реквизиты. По 152-ФЗ за утечку — штрафы и блокировки. Anti-DDoS, антифрод, мониторинг 24/7 и Bug Bounty — это то, что отличает серьёзную платформу от той, которую закроют через полгода.»",
    focus: [
      "Считай безопасность в деньгах: «взлом = минус всё», страховка = копейки на этом фоне.",
      "Ссылайся на закон (152-ФЗ) — это снимает вопрос «а нужно ли вообще».",
      "Позиционируй как конкурентное преимущество и доверие пользователей.",
    ],
    counter: "Если хотят урезать — покажи минимальный безопасный набор и объясни, что каждый вырезанный пункт = конкретный риск для денег инвестора.",
  },
  {
    id: "marketing",
    icon: "Megaphone",
    color: "#eab308",
    title: "Почему 6–8 млн/мес на рекламу",
    opening:
      "«Маркетплейс — это игра объёмов: чем больше продавцов и покупателей, тем сильнее сетевой эффект и тем дороже компания. 40% инвестиций идут в рост, потому что окно «первого на рынке» не вечно. Самый дешёвый канал — реферальная программа: пользователи приводят пользователей сами. Платный трафик — только чтобы разогнать маховик.»",
    focus: [
      "Объясняй маркетинг как инвестицию в капитализацию, а не как «слив бюджета».",
      "Делай упор на ROI реферальной программы и блогеров — это окупаемые каналы.",
      "Покажи, что есть метрики (CAC, LTV) и A/B-тесты — деньги под контролем.",
    ],
    counter: "На «как поймём, что не сольём» — предложи KPI: фиксированный CAC и отчётность по каналам каждый месяц.",
  },
  {
    id: "risk",
    icon: "ShieldAlert",
    color: "#ef4444",
    title: "Что если не взлетит (работа с рисками)",
    opening:
      "«Я не буду говорить, что рисков нет — это было бы непрофессионально. Поэтому я предлагаю liquidation preference 1x: если что-то пойдёт не так и мы продаём компанию, вы первым возвращаете свои деньги. Плюс поэтапное финансирование — вы вкладываете следующий транш, только увидев результат первого.»",
    focus: [
      "Не прячь риски — назови их сам, это повышает доверие к тебе.",
      "На каждый риск давай механизм защиты (preference, транши, KPI).",
      "Покажи, что у тебя «шкура в игре» — ты тоже теряешь, если не взлетит.",
    ],
    counter: "Если боятся сильно — предложи транши: минимальный первый чек, остальное по достижению метрик. Это лучшая защита от страха инвестора.",
  },
  {
    id: "exit",
    icon: "TrendingUp",
    color: "#a855f7",
    title: "Как инвестор заработает (выход)",
    opening:
      "«Ваш горизонт — 4–6 лет. Сценарии выхода: IPO на Мосбирже или продажа стратегу — Сберу, Яндексу, VK, которым интересна наша аудитория и оборот. Целевая оценка на выходе — от 8 до 60 миллиардов. Это возврат x10–x40 на вложенные 60 миллионов. Вот ради чего стоит зайти сейчас.»",
    focus: [
      "Всегда заканчивай переговоры картинкой выхода — это финальный крючок.",
      "Называй конкретных покупателей (Сбер, Яндекс, VK) — это делает выход реальным.",
      "Цифра x10–x40 должна остаться последней, что он услышит.",
    ],
    counter: "На «а если не будет IPO» — покажи, что стратегическая продажа даже без IPO даёт кратный возврат, примеры поглощений маркетплейсов в РФ.",
  },
];

const GOLDEN_RULES = [
  { icon: "Anchor", text: "Якори первым: называй свои цифры (25%, 240 млн) до того, как инвестор назовёт свои." },
  { icon: "Eye", text: "Создавай дефицит: «я веду переговоры ещё с двумя фондами» — повышает твою позицию." },
  { icon: "Pause", text: "Молчи после своего предложения. Кто первый заговорит — тот уступает." },
  { icon: "Layers", text: "Уступай не долей, а условиями: транши, KPI, сроки — но держи % и контроль." },
  { icon: "Heart", text: "Продавай не цветы, а эмоцию и масштаб: первый рынок, ракета, упущенная выгода." },
  { icon: "FileCheck", text: "Всё, о чём договорились устно — фиксируй в term sheet сразу, не откладывай." },
];

/* ─── КОМПОНЕНТЫ ─────────────────────────────────────────── */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl p-4 ${className}`} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>{children}</div>;
}

export default function Negotiation() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState<string | null>(TOPICS[0].id);

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

  return (
    <div className="min-h-screen pb-16" style={{ background: "#0d0d14" }}>
      {/* HEADER */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(13,13,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <a href="/investor" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <Icon name="ChevronLeft" size={20} className="text-white" />
        </a>
        <div className="flex-1">
          <p className="font-oswald text-base font-bold text-white leading-tight">Сценарии переговоров</p>
          <p className="text-white/40 text-xs">FlowerFlip · как продавить свою позицию</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,61,139,0.15)", color: "#ff3d8b" }}>ADMIN</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* INTRO */}
        <div className="rounded-3xl p-6 mb-6 text-center" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(255,61,139,0.25)" }}>
          <span className="text-4xl block mb-2">🤝</span>
          <h1 className="font-oswald text-2xl font-bold gradient-text mb-1">Переговоры с инвестором</h1>
          <p className="text-white/60 text-sm">Готовые фразы-открытия для каждого спорного момента и на чём делать упор, чтобы продавить свою позицию</p>
        </div>

        {/* СВЯЗЬ СО СТРАНИЦЕЙ ЦИФР */}
        <a href="/investor" className="flex items-center gap-3 mb-6 rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="FileBarChart" size={18} className="text-pink-400" />
          <span className="flex-1 text-white/70 text-sm">Цифры, оценка и Term Sheet — на странице стратегии</span>
          <Icon name="ArrowRight" size={16} className="text-white/40" />
        </a>

        {/* ТЕМЫ-АККОРДЕОНЫ */}
        <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-3">Сценарии по моментам</p>
        <div className="space-y-2.5 mb-8">
          {TOPICS.map((t, i) => {
            const isOpen = open === t.id;
            return (
              <div key={t.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${isOpen ? t.color + "55" : "rgba(255,255,255,0.08)"}` }}>
                <button onClick={() => setOpen(isOpen ? null : t.id)} className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${t.color}22` }}>
                    <Icon name={t.icon} size={17} style={{ color: t.color }} />
                  </div>
                  <span className="flex-1 font-oswald font-bold text-white text-sm">{i + 1}. {t.title}</span>
                  <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={18} className="text-white/40 shrink-0" />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 animate-fade-in">
                    {/* Фраза-открытие */}
                    <div className="rounded-xl p-3.5 mb-3" style={{ background: `${t.color}14`, borderLeft: `3px solid ${t.color}` }}>
                      <p className="text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: t.color }}>
                        <Icon name="MessageSquareQuote" size={12} className="inline mr-1" />Начало диалога
                      </p>
                      <p className="text-white/85 text-sm leading-relaxed italic">{t.opening}</p>
                    </div>

                    {/* На чём делать упор */}
                    <p className="text-[10px] uppercase tracking-wide mb-2 font-medium text-white/40">
                      <Icon name="Crosshair" size={12} className="inline mr-1" />На чём делать упор
                    </p>
                    <ul className="space-y-1.5 mb-3">
                      {t.focus.map((f, fi) => (
                        <li key={fi} className="flex gap-2 text-white/65 text-xs leading-relaxed">
                          <Icon name="Check" size={13} className="shrink-0 mt-0.5" style={{ color: t.color }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Контраргумент */}
                    <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                      <p className="text-[10px] uppercase tracking-wide mb-1 font-medium" style={{ color: "#ef4444" }}>
                        <Icon name="Swords" size={12} className="inline mr-1" />Если возразят
                      </p>
                      <p className="text-white/70 text-xs leading-relaxed">{t.counter}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ЗОЛОТЫЕ ПРАВИЛА */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--grad-main)" }}>
            <Icon name="Crown" size={18} className="text-white" />
          </div>
          <h2 className="font-oswald text-xl font-bold text-white">Золотые правила переговорщика</h2>
        </div>
        <div className="space-y-2 mb-8">
          {GOLDEN_RULES.map((r, i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,61,139,0.12)" }}>
                  <Icon name={r.icon} size={15} className="text-pink-400" />
                </div>
                <p className="text-white/70 text-sm leading-snug">{r.text}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* ФИНАЛЬНЫЙ СКРИПТ ЗАКРЫТИЯ */}
        <div className="rounded-3xl p-5 mb-6" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(168,85,247,0.12))", border: "1px solid rgba(34,197,94,0.25)" }}>
          <p className="font-oswald text-lg font-bold mb-2" style={{ color: "#22c55e" }}>
            <Icon name="Flag" size={18} className="inline mr-1.5" />Фраза для закрытия сделки
          </p>
          <p className="text-white/85 text-sm leading-relaxed italic">
            «Давайте резюмируем: 60 миллионов за 25%, оценка 240, защита через preference 1x, выход через 4–6 лет с возвратом x10–x40. Вы заходите в первого игрока на рынке 180 миллионов человек до того, как это станет очевидно всем. Я готов подписать term sheet на этой неделе. Что скажете?»
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
