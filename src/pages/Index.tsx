import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { authApi, bouquetsApi, profileApi, uploadApi, escrowApi, oauthApi, adminApi, paymentApi, shopsApi, bannersApi, notificationsApi, coinsApi, articlesApi, shopParserApi } from "@/lib/api";
import AdBanners from "@/components/AdBanners";
import AiConsultant from "@/components/AiConsultant";
import NotificationBell from "@/components/NotificationBell";
import { useMaintenance, MAINTENANCE_TEXT } from "@/lib/maintenance";
import { OnboardingTour, useOnboarding } from "@/components/OnboardingTour";
import { useCities } from "@/lib/cities";
import Partners from "@/pages/Partners";

/* ─── TYPES ─────────────────────────────────────────────── */
interface Bouquet {
  id: number; seller_id: number; seller_name: string; seller_rating: number;
  title: string; description?: string; flowers: string[]; freshness: string;
  image_urls: string[]; start_price: number; current_price: number;
  min_step: number; bids_count: number; status: string; ends_at: string;
  liked: boolean; city?: string; district?: string; meet_point?: string;
}
interface User {
  id: number; name: string; phone: string; avatar_url?: string;
  rating: number; reviews_count: number; sales_count: number;
  purchases_count: number; balance: number; created_at: string; city?: string;
  is_admin?: boolean; payout_method?: string; payout_details?: string;
  email?: string; email_verified?: boolean;
  ref_code?: string; ref_earnings?: number;
  coins?: number;
}
interface Deal {
  id: number; amount: number; commission: number; escrow_status: string;
  created_at: string; updated_at: string; auto_confirm_at?: string;
  dispute_reason?: string; seller_phone_revealed: boolean;
  title: string; image_urls: string[]; city?: string; district?: string;
  seller_name: string; seller_id: number; buyer_name: string; buyer_id: number;
  seller_phone?: string; buyer_phone?: string;
  seller_email?: string; buyer_email?: string;
  is_buyer: boolean; is_seller: boolean;
}
interface Review { id: number; stars: number; text: string; created_at: string; reviewer_name: string; }
interface Chat { last_message: string; created_at: string; other_id: number; other_name: string; bouquet_title?: string; unread: number; bouquet_id?: number; }
interface Message { id: number; sender_id: number; text: string; created_at: string; is_read: boolean; }

const TABS = [
  { id: "auctions", label: "Аукционы", icon: "Zap" },
  { id: "catalog", label: "Каталог", icon: "Grid3X3" },
  { id: "sell", label: "Продать", icon: "PlusCircle" },
  { id: "deals", label: "Сделки", icon: "Handshake" },
  { id: "profile", label: "Профиль", icon: "User" },
];
const ALL_TAGS = ["все", "розы", "тюльпаны", "пионы", "орхидеи", "герберы", "каллы", "подсолнухи"];

/* ─── UTILS ─────────────────────────────────────────────── */
function formatTime(endsAt: string) {
  const diff = Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000);
  if (diff <= 0) return "Завершён";
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${String(s).padStart(2, "0")}с`;
  return `${String(s).padStart(2, "0")}с`;
}
function isUrgent(endsAt: string) {
  const diff = (new Date(endsAt).getTime() - Date.now()) / 1000;
  return diff > 0 && diff < 300;
}
function formatPrice(n: number | undefined | null) { return (n ?? 0).toLocaleString("ru-RU") + " ₽"; }
function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(t => t + 1), 1000); return () => clearInterval(id); }, []);
}

/* ─── CITIES DATA — полный список грузится с бэкенда (см. src/lib/cities.ts) ─── */

const DISTRICTS: Record<string, string[]> = {
  "Москва": [
    "Центральный", "Северный", "Северо-Восточный", "Восточный",
    "Юго-Восточный", "Южный", "Юго-Западный", "Западный",
    "Северо-Западный", "Зеленоградский", "Новомосковский", "Троицкий",
  ],
  "Санкт-Петербург": [
    "Адмиралтейский", "Василеостровский", "Выборгский", "Калининский",
    "Кировский", "Колпинский", "Красногвардейский", "Красносельский",
    "Кронштадтский", "Курортный", "Московский", "Невский",
    "Петроградский", "Петродворцовый", "Приморский", "Пушкинский",
    "Фрунзенский", "Центральный",
  ],
  "Екатеринбург": [
    "Верх-Исетский", "Железнодорожный", "Кировский", "Ленинский",
    "Октябрьский", "Орджоникидзевский", "Чкаловский",
  ],
  "Новосибирск": [
    "Дзержинский", "Железнодорожный", "Заельцовский", "Калининский",
    "Кировский", "Ленинский", "Октябрьский", "Первомайский", "Советский",
    "Центральный",
  ],
  "Казань": ["Авиастроительный", "Вахитовский", "Кировский", "Московский", "Ново-Савиновский", "Приволжский", "Советский"],
};

function getDistricts(city: string): string[] {
  return DISTRICTS[city] || [];
}

const ESCROW_STATUS: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  waiting_payment: { label: "Ожидает оплаты", color: "#a855f7", icon: "Clock", desc: "Оплатите, чтобы получить контакт продавца" },
  paid:            { label: "Оплачен", color: "#06d6de", icon: "CreditCard", desc: "Договоритесь о встрече с продавцом" },
  completed:       { label: "Завершён", color: "#4ade80", icon: "CheckCircle2", desc: "Сделка успешно закрыта" },
  dispute:         { label: "Спор", color: "#ff6b2b", icon: "AlertTriangle", desc: "Разбирается модератором" },
  archived:        { label: "Архив", color: "#6b7280", icon: "Archive", desc: "Сделка в архиве" },
  cancelled:       { label: "Отменён", color: "#6b7280", icon: "XCircle", desc: "Аукцион был снят" },
  expired:         { label: "Истёк", color: "#6b7280", icon: "Clock", desc: "Аукцион завершился без ставок" },
};

/* ─── INSTALL BANNER ─────────────────────────────────────── */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Глобально храним событие установки — оно может прийти до монтирования компонентов
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("ff-install-ready"));
  });
}

// Хук установки PWA — используется и баннером, и кнопкой в профиле
function usePwaInstall() {
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
    const onInstalled = () => { setPrompt(null); deferredInstallPrompt = null; setIsStandalone(true); };
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
    if (outcome === "accepted") { setPrompt(null); deferredInstallPrompt = null; }
    return outcome;
  };

  // canInstall: можно показать кнопку (есть prompt или iOS) и приложение ещё не установлено
  return { isIos, isStandalone, canInstall: (!!prompt || isIos) && !isStandalone, promptInstall };
}

function InstallBanner() {
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
    <>
      <div className="fixed bottom-20 left-3 right-3 z-50 animate-fade-in-up">
        <div className="glass-strong rounded-2xl p-4 flex items-center gap-3"
          style={{ border: "1px solid rgba(255,61,139,0.3)", boxShadow: "0 8px 32px rgba(255,61,139,0.2)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ background: "var(--grad-main)" }}>🌸</div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Установить FlowerFlip</p>
            <p className="text-white/40 text-xs mt-0.5">
              {isIos ? "Добавьте на экран «Домой»" : "Работает без интернета"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={install}
              className="btn-gradient px-3 py-1.5 rounded-xl text-xs font-bold">
              {isIos ? "Как?" : "Установить"}
            </button>
            <button onClick={dismiss} className="text-white/30 hover:text-white transition-colors p-1">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS guide modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowIosGuide(false)}>
          <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-fade-in-up"
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <span className="text-4xl block mb-2">📱</span>
              <h3 className="font-oswald text-xl font-bold text-white">Установить на iPhone</h3>
            </div>
            <div className="space-y-4">
              {[
                { step: "1", icon: "Share2", text: "Нажмите кнопку «Поделиться»", sub: "значок снизу экрана браузера Safari" },
                { step: "2", icon: "PlusSquare", text: "Выберите «На экран «Домой»»", sub: "прокрутите список действий вниз" },
                { step: "3", icon: "CheckCircle2", text: "Нажмите «Добавить»", sub: "приложение появится на рабочем столе" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
                    style={{ background: "var(--grad-main)" }}>{s.step}</div>
                  <div>
                    <p className="text-white text-sm font-medium">{s.text}</p>
                    <p className="text-white/40 text-xs mt-0.5">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowIosGuide(false); dismiss(); }}
              className="btn-gradient w-full rounded-2xl py-3 mt-5 font-oswald tracking-wide">
              ПОНЯТНО
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── AUTH SCREEN ────────────────────────────────────────── */
function AuthScreen({ onAuth }: { onAuth: (user: User, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginInput, setLoginInput] = useState(""); // телефон или email при входе
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [showCitySuggest, setShowCitySuggest] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regRefCode, setRegRefCode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("ref") || "";
  });
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);
  const [needCity, setNeedCity] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const vkContainerRef = useRef<HTMLDivElement>(null);
  const [vkSdkLoaded, setVkSdkLoaded] = useState(false);



  const cities = useCities();
  const citySuggestions = cityInput.length > 0
    ? cities.filter(c => c.toLowerCase().includes(cityInput.toLowerCase())).slice(0, 8)
    : [];

  // Финализация после OAuth: если новый пользователь — показываем выбор города
  const finishOAuth = useCallback(async (token: string, isNew?: boolean) => {
    localStorage.setItem("ff_token", token);
    setOauthLoading(null);
    if (isNew) {
      setPendingToken(token);
      setNeedCity(true);
      return;
    }
    const me = await authApi.me();
    if (me.ok) onAuth(me.data.user, token);
    else setError("Не удалось загрузить профиль");
  }, [onAuth]);

  // Сохраняем город и входим
  const saveCity = useCallback(async (selectedCity: string) => {
    if (!pendingToken) return;
    if (selectedCity) await authApi.update({ city: selectedCity });
    const me = await authApi.me();
    if (me.ok) onAuth(me.data.user, pendingToken);
    else setError("Не удалось загрузить профиль");
    setNeedCity(false);
    setPendingToken(null);
  }, [pendingToken, onAuth]);

  // OAuth callback — VK возвращает ?code=...&state=vk, Google — ?code=...&state=google
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state"); // "vk" или "google"
    if (!code || !state) return;
    window.history.replaceState({}, "", "/");

    if (state === "vk") {
      setOauthLoading("vk");
      oauthApi.vkCallback(code).then(async r => {
        if (!r.ok) { setError(r.data.error || "Ошибка VK"); setOauthLoading(null); return; }
        await finishOAuth(r.data.token, r.data.is_new);
      });
    } else if (state === "google") {
      setOauthLoading("google");
      oauthApi.googleCallback(code).then(async r => {
        if (!r.ok) { setError(r.data.error || "Ошибка Google"); setOauthLoading(null); return; }
        await finishOAuth(r.data.token, r.data.is_new);
      });
    }
  }, [finishOAuth]);



  // VK ID OneTap — временно отключено
  const VK_LOGIN_ENABLED = false;
  useEffect(() => {
    if (!VK_LOGIN_ENABLED) return;
    let rendered = false;

    const renderWidget = () => {
      if (rendered) return;
      const container = vkContainerRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const VKID = (window as any).VKIDSDK;
      if (!container || !VKID) return;
      rendered = true;
      setVkSdkLoaded(true);

      VKID.Config.init({
        app: 54627734,
        redirectUrl: window.location.origin,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: "",
      });

      const oneTap = new VKID.OneTap();
      oneTap.render({ container, showAlternativeLogin: false })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on(VKID.WidgetEvents.ERROR, (e: any) => { console.error("VKID error:", e); })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload: { code: string; device_id: string }) => {
          setOauthLoading("vk");
          const { code, device_id } = payload;
          VKID.Auth.exchangeCode(code, device_id)
            .then(async () => {
              const r = await oauthApi.vkidCallback(code, device_id);
              if (!r.ok) { setError(r.data.error || "Ошибка VK"); setOauthLoading(null); return; }
              await finishOAuth(r.data.token, r.data.is_new);
            })
            .catch(() => { setError("Ошибка VK"); setOauthLoading(null); });
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).VKIDSDK) {
      renderWidget();
      return;
    }

    // SDK ещё не загружен — грузим через наш бэкенд-прокси (CDN блокируются ORB)
    const existing = document.getElementById("vkid-sdk-script");
    if (existing) {
      existing.addEventListener("load", renderWidget);
      return () => existing.removeEventListener("load", renderWidget);
    }

    const script = document.createElement("script");
    script.id = "vkid-sdk-script";
    script.src = oauthApi.vkidSdkUrl();
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [finishOAuth]);

  const submit = async () => {
    if (mode === "register" && !agreeTerms) {
      setError("Подтвердите согласие с условиями, политикой конфиденциальности и офертой");
      return;
    }
    setError(""); setEmailNotVerified(null); setResendSent(false); setLoading(true);
    if (mode === "forgot") {
      const r = await authApi.forgotPassword(forgotEmail);
      setLoading(false);
      if (r.ok) setForgotSent(true);
      else setError(r.data.error || "Ошибка");
      return;
    }
    const r = mode === "login"
      ? await authApi.login(loginInput, password)
      : await authApi.register(name, phone, password, city || cityInput, regEmail, regRefCode || undefined);
    setLoading(false);
    if (!r.ok) {
      if (r.data.email_not_verified) { setEmailNotVerified(r.data.email || loginInput); return; }
      setError(r.data.error || "Ошибка"); return;
    }
    await finishOAuth(r.data.token);
  };

  const resendVerify = async () => {
    if (!emailNotVerified) return;
    setResendSent(false);
    const r = await authApi.resendVerify(emailNotVerified);
    if (r.ok) setResendSent(true);
  };





  const loginWithGoogle = async () => {
    setOauthLoading("google");
    const r = await oauthApi.getGoogleUrl();
    setOauthLoading(null);
    if (r.ok) window.location.href = r.data.url;
    else setError(r.data.error || "Google недоступен");
  };

  if (oauthLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
      <div className="text-center animate-fade-in">
        <div className="text-5xl block mb-4 animate-float" style={{ display: "inline-block" }}>🌸</div>
        <p className="text-white/50 text-sm">
          Входим через {oauthLoading === "vk" ? "ВКонтакте" : "Google"}...
        </p>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
        </div>
      </div>
    </div>
  );

  // Новый пользователь через VK/Google — просим выбрать город
  if (needCity) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "hsl(var(--background))" }}>
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 animate-float" style={{ display: "inline-block" }}>📍</div>
          <h2 className="font-oswald text-3xl font-bold text-white mb-2">Ваш город?</h2>
          <p className="text-white/40 text-sm">Это поможет находить букеты рядом с вами</p>
        </div>
        <div className="glass-strong rounded-3xl p-5 space-y-3">
          <div className="relative">
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
              <Icon name="MapPin" size={16} className="text-white/30 flex-shrink-0" />
              <input
                value={cityInput}
                onChange={e => { setCityInput(e.target.value); setCity(""); setShowCitySuggest(true); }}
                onFocus={() => setShowCitySuggest(true)}
                onBlur={() => setTimeout(() => setShowCitySuggest(false), 150)}
                className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="Начните вводить город..."
                autoFocus
              />
              {city && <Icon name="CheckCircle2" size={14} className="text-green-400 flex-shrink-0" />}
            </div>
            {showCitySuggest && citySuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto shadow-2xl" style={{ background: "#150f1c", border: "1px solid rgba(255,255,255,0.1)", maxHeight: 260, backdropFilter: "blur(12px)" }}>
                {citySuggestions.map(c => (
                  <button key={c} onMouseDown={() => { setCity(c); setCityInput(c); setShowCitySuggest(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0">
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => saveCity(city || cityInput)}
            className="btn-gradient w-full rounded-2xl py-4 font-oswald text-lg tracking-wide"
            disabled={!city && !cityInput}>
            {city || cityInput ? "ПРОДОЛЖИТЬ" : "ПРОПУСТИТЬ"}
          </button>
          <button onClick={() => saveCity("")}
            className="w-full text-white/30 text-sm py-2 hover:text-white/50 transition-colors">
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10" style={{ background: "hsl(var(--background))" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10 animate-spin-slow" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />
      </div>
      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 text-4xl animate-float"
            style={{ background: "var(--grad-main)", boxShadow: "0 16px 48px rgba(255,61,139,0.4)" }}>
            🌸
          </div>
          <h1 className="font-oswald text-4xl font-bold shimmer-text">FlowerFlip</h1>
          <p className="text-white/40 mt-1.5 text-sm">Аукцион живых букетов</p>
        </div>

        {/* OAuth блок */}
        <div className="glass-strong rounded-3xl p-5 mb-4">

          {/* VK ID OneTap виджет (появляется когда SDK загрузится) */}
          {VK_LOGIN_ENABLED && (
            <>
              <div ref={vkContainerRef} className="w-full flex justify-center" style={{ minHeight: vkSdkLoaded ? 44 : 0, marginBottom: vkSdkLoaded ? 8 : 0 }} />
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                <span className="text-white/25 text-xs">или по телефону</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              </div>
            </>
          )}

          {/* Переключатель режима */}
          {mode !== "forgot" && (
            <div className="flex gap-2 mb-4">
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(""); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={mode === m
                    ? { background: "var(--grad-main)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                  {m === "login" ? "Войти" : "Регистрация"}
                </button>
              ))}
            </div>
          )}

          {/* Форма восстановления пароля */}
          {mode === "forgot" && (
            <div className="space-y-3">
              <button onClick={() => { setMode("login"); setError(""); setForgotSent(false); }}
                className="flex items-center gap-2 text-white/40 text-sm hover:text-white/60 transition-colors mb-2">
                <Icon name="ArrowLeft" size={14} /> Назад
              </button>
              <h3 className="font-oswald text-xl text-white mb-1">Восстановление пароля</h3>
              {forgotSent ? (
                <div className="text-center py-4">
                  <span className="text-4xl block mb-3">📬</span>
                  <p className="text-white/70 text-sm">Письмо отправлено! Проверьте почту и перейдите по ссылке для сброса пароля.</p>
                  <button onClick={() => { setMode("login"); setForgotSent(false); setError(""); }}
                    className="btn-gradient w-full rounded-2xl py-3 mt-4 font-oswald tracking-wide">
                    ВОЙТИ
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-white/40 text-sm">Укажите email — отправим ссылку для сброса пароля</p>
                  <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} type="email"
                    className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                    placeholder="your@email.com" onKeyDown={e => e.key === "Enter" && submit()} />
                  {error && (
                    <div className="px-3 py-2.5 rounded-xl text-sm text-red-400 text-center"
                      style={{ background: "rgba(255,61,61,0.1)", border: "1px solid rgba(255,61,61,0.2)" }}>
                      {error}
                    </div>
                  )}
                  <button onClick={submit} disabled={loading}
                    className="btn-gradient w-full rounded-2xl py-4 font-oswald text-lg tracking-wide disabled:opacity-50">
                    {loading ? "Отправляем..." : "ОТПРАВИТЬ ССЫЛКУ"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Основная форма входа/регистрации */}
          {mode !== "forgot" && (
            <>
              <div className="space-y-3">
                {mode === "register" && (
                  <>
                    <div>
                      <label className="text-white/50 text-sm mb-1.5 block">Имя</label>
                      <input value={name} onChange={e => setName(e.target.value)}
                        className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                        placeholder="Ваше имя" />
                    </div>
                    <div className="relative">
                      <label className="text-white/50 text-sm mb-1.5 block">Город</label>
                      <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
                        <Icon name="MapPin" size={16} className="text-white/30 flex-shrink-0" />
                        <input value={cityInput}
                          onChange={e => { setCityInput(e.target.value); setCity(""); setShowCitySuggest(true); }}
                          onFocus={() => setShowCitySuggest(true)}
                          onBlur={() => setTimeout(() => setShowCitySuggest(false), 150)}
                          className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
                          placeholder="Начните вводить город..." />
                        {city && <Icon name="CheckCircle2" size={14} className="text-green-400 flex-shrink-0" />}
                      </div>
                      {showCitySuggest && citySuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto shadow-2xl" style={{ background: "#150f1c", border: "1px solid rgba(255,255,255,0.1)", maxHeight: 260, backdropFilter: "blur(12px)" }}>
                          {citySuggestions.map(c => (
                            <button key={c} onMouseDown={() => { setCity(c); setCityInput(c); setShowCitySuggest(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0">
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {mode === "login" ? (
                  <div>
                    <label className="text-white/50 text-sm mb-1.5 block">Телефон или Email</label>
                    <input value={loginInput} onChange={e => setLoginInput(e.target.value)}
                      className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                      placeholder="+7 999 000 00 00 или email" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-white/50 text-sm mb-1.5 block">Телефон</label>
                      <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                        className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                        placeholder="+7 999 000 00 00" />
                    </div>
                    <div>
                      <label className="text-white/50 text-sm mb-1.5 block">Email</label>
                      <input value={regEmail} onChange={e => setRegEmail(e.target.value)} type="email"
                        className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                        placeholder="your@email.com" />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-white/50 text-sm mb-1.5 block">Пароль</label>
                  <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                    className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                    placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} />
                </div>

                {mode === "register" && (
                  <div>
                    <label className="text-white/50 text-sm mb-1.5 block">
                      Реферальный код <span className="text-white/25 text-xs font-normal">(если есть)</span>
                    </label>
                    <input value={regRefCode} onChange={e => setRegRefCode(e.target.value.toUpperCase())} type="text"
                      className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-purple-500 font-mono tracking-widest"
                      placeholder="ABCD1234" maxLength={8} />
                  </div>
                )}
              </div>

              {mode === "register" && (
                <label className="flex items-start gap-2.5 mt-4 cursor-pointer select-none">
                  <button type="button" onClick={() => setAgreeTerms(v => !v)}
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                    style={agreeTerms
                      ? { background: "var(--grad-main)" }
                      : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    {agreeTerms && <Icon name="Check" size={13} className="text-white" />}
                  </button>
                  <span className="text-white/50 text-xs leading-relaxed" onClick={() => setAgreeTerms(v => !v)}>
                    Я принимаю{" "}
                    <a href="/terms" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">пользовательское соглашение</a>,{" "}
                    <a href="/offer" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">оферту</a>{" "}
                    и даю согласие на обработку данных согласно{" "}
                    <a href="/privacy" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">политике конфиденциальности</a>
                  </span>
                </label>
              )}

              {error && (
                <div className="mt-3 px-3 py-2.5 rounded-xl text-sm text-red-400 text-center"
                  style={{ background: "rgba(255,61,61,0.1)", border: "1px solid rgba(255,61,61,0.2)" }}>
                  {error}
                </div>
              )}
              {emailNotVerified && (
                <div className="mt-3 px-4 py-3 rounded-xl text-sm text-center"
                  style={{ background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.3)" }}>
                  <p className="text-orange-400 font-medium mb-1">📧 Email не подтверждён</p>
                  <p className="text-white/50 text-xs mb-2">Проверьте почту <b className="text-white/70">{emailNotVerified}</b> и перейдите по ссылке из письма</p>
                  {resendSent
                    ? <p className="text-green-400 text-xs">✅ Письмо отправлено повторно</p>
                    : <button onClick={resendVerify} className="text-xs text-orange-400 underline underline-offset-2">Выслать письмо повторно</button>
                  }
                </div>
              )}

              <button onClick={submit} disabled={loading}
                className="btn-gradient w-full rounded-2xl py-4 mt-4 font-oswald text-lg tracking-wide disabled:opacity-50">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full w-5 h-5 border-2 border-white border-t-transparent" />
                    {mode === "login" ? "Входим..." : "Создаём..."}
                  </span>
                ) : mode === "login" ? "ВОЙТИ" : "СОЗДАТЬ АККАУНТ"}
              </button>

              {mode === "login" && (
                <button onClick={() => { setMode("forgot"); setError(""); setForgotEmail(loginInput.includes("@") ? loginInput : ""); }}
                  className="w-full text-center text-white/30 text-xs mt-2 hover:text-white/50 transition-colors py-1">
                  Забыли пароль?
                </button>
              )}
            </>
          )}
        </div>

        {/* Дисклеймер */}
        <p className="text-center text-white/20 text-xs px-4">
          Регистрируясь, вы принимаете условия использования сервиса
        </p>
      </div>
    </div>
  );
}

/* ─── BID MODAL ─────────────────────────────────────────── */
function BidModal({ bouquet, onClose, onBid }: { bouquet: Bouquet; onClose: () => void; onBid: (id: number, amount: number) => void }) {
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
function AuctionsScreen({ onBid, user }: { onBid: (b: Bouquet) => void; user: User | null }) {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState(user?.city || "");
  const [district, setDistrict] = useState("");

  const load = useCallback(async () => {
    const r = await bouquetsApi.list({
      status: "active", sort: "ends_at",
      sale_type: "auction",
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
function CatalogScreen({ user }: { user: User | null }) {
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
function ShopsScreen({ user }: { user: User | null }) {
  const [shops, setShops] = useState<{ id: number; user_id: number; shop_name: string; logo_url?: string; description?: string; rating: number; reviews_count: number; sales_count: number; city?: string }[]>([]);
  const [selected, setSelected] = useState<{ user_id: number; shop_name: string; logo_url?: string; description?: string; address?: string; phone?: string; rating: number; reviews_count: number } | null>(null);
  const [bouquets, setBouquets] = useState<{ id: number; title: string; image_urls: string[]; current_price?: number; fixed_price?: number; sale_type: string; status: string; bids_count: number; reserve_enabled: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBouquets, setLoadingBouquets] = useState(false);
  const [cityFilter, setCityFilter] = useState(user?.city || "");
  const [shopCitiesFromApi, setShopCitiesFromApi] = useState<string[]>([]);
  const cities = useCities();

  const loadShops = useCallback((city?: string) => {
    setLoading(true);
    shopsApi.list(city || undefined).then(r => {
      if (r.ok) {
        setShops(r.data.shops || []);
        if (r.data.cities?.length) setShopCitiesFromApi(r.data.cities);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadShops(cityFilter || undefined); }, [cityFilter, loadShops]);

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
                {b.sale_type === "fixed" || b.sale_type === "reserve" ? (
                  <div className="mt-1">
                    <p className="gradient-text font-oswald font-bold">
                      {formatPrice(Math.round((b.fixed_price || 0) * 1.025))}
                    </p>
                    <p className="text-white/30 text-xs">продавец: {formatPrice(b.fixed_price)}</p>
                  </div>
                ) : (
                  <>
                    <p className="gradient-text font-oswald font-bold mt-1">
                      {formatPrice(b.current_price)}
                    </p>
                    {b.bids_count > 0 && (
                      <p className="text-white/30 text-xs mt-0.5">{b.bids_count} ставок</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const allShopCities = shopCitiesFromApi.length > 0
    ? shopCitiesFromApi
    : [...new Set(shops.map(s => s.city).filter(Boolean))] as string[];

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Магазины</h2>
      <p className="text-white/40 text-sm mb-3">Проверенные цветочные магазины на платформе</p>

      {/* Фильтр по городу */}
      <div className="glass rounded-2xl p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="MapPin" size={14} className="text-pink-400 flex-shrink-0" />
          <span className="text-white/50 text-xs">Город</span>
          {cityFilter && (
            <button onClick={() => setCityFilter("")} className="ml-auto text-white/30 hover:text-white/60 transition-colors">
              <Icon name="X" size={12} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCityFilter("")}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={!cityFilter ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
            Все
          </button>
          {allShopCities.map(c => (
            <button key={c} onClick={() => setCityFilter(c)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={cityFilter === c ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              {c}
            </button>
          ))}
          {allShopCities.length === 0 && (
            <span className="text-white/25 text-xs py-1.5">Города появятся когда откроются магазины</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
        </div>
      ) : shops.length === 0 ? (
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
          {shops.map(s => (
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
                  {s.city && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Icon name="MapPin" size={9} className="text-pink-400 flex-shrink-0" />
                      <span className="text-white/35 text-xs">{s.city}</span>
                    </div>
                  )}
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
function SellScreen({ user }: { user: User | null }) {
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
            {[
              ["Комиссия платформы", saleType === "auction" ? "15% (аукцион)" : "5% (фикс./бронь)"],
              ["Выплата продавцу", "после подтверждения"],
              ["Передача букета", "лично, без курьера"],
              ["Способы вывода", "Карта, СБП, кошелёк"]
            ].map(([k, v]) => (
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

/* ─── ORDERS SCREEN ──────────────────────────────────────── */


/* ─── DEALS SCREEN (ESCROW) ──────────────────────────────── */
function DealsScreen({ user, onPaySuccess }: { user: User | null; onPaySuccess?: () => void }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Deal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const { maintenance } = useMaintenance();
  const [disputeText, setDisputeText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ deal: Deal } | null>(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [dealMessages, setDealMessages] = useState<Message[]>([]);
  const [dealChatText, setDealChatText] = useState("");
  const [dealChatSending, setDealChatSending] = useState(false);
  const [dealChatErr, setDealChatErr] = useState("");
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
    const r = await profileApi.messages(otherId);
    if (r.ok) setDealMessages(r.data.messages);
  }, [user]);

  useEffect(() => {
    if (active) { setDealMessages([]); setDealChatText(""); loadDealChat(active); }
  }, [active, loadDealChat]);

  useEffect(() => { dealChatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dealMessages]);

  const sendDealMessage = async () => {
    if (!active || !dealChatText.trim() || dealChatSending || !user) return;
    setDealChatSending(true); setDealChatErr("");
    const otherId = active.is_buyer ? active.seller_id : active.buyer_id;
    const r = await profileApi.sendMessage(otherId, dealChatText.trim());
    setDealChatSending(false);
    if (r.ok) {
      setDealMessages(prev => [...prev, { id: r.data.id, sender_id: user.id, text: dealChatText.trim(), created_at: r.data.created_at, is_read: false }]);
      setDealChatText("");
    } else if (r.status === 422 || r.data?.blocked) {
      setDealChatErr(r.data.error || "Сообщение нарушает правила площадки");
    } else {
      setDealChatErr(r.data?.error || "Не удалось отправить сообщение");
    }
  };

  const doPay = async (deal: Deal) => {
    if (maintenance) { setMsg("Платформа на этапе доработки — оплата временно недоступна"); return; }
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
            ) : maintenance ? (
              <div className="text-center">
                <div className="w-full rounded-2xl py-4 font-oswald text-lg tracking-wide flex items-center justify-center gap-2 text-white/40"
                  style={{ background: "rgba(255,255,255,0.05)" }}>
                  <Icon name="Wrench" size={18} />
                  ОПЛАТА ОТКЛЮЧЕНА
                </div>
                <p className="text-amber-400 text-xs mt-2">Платформа на этапе доработки — оплата временно недоступна</p>
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
              <div>
                {dealChatErr && (
                  <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                    <Icon name="ShieldAlert" size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{dealChatErr}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={dealChatText} onChange={e => { setDealChatText(e.target.value); if (dealChatErr) setDealChatErr(""); }}
                    onKeyDown={e => e.key === "Enter" && sendDealMessage()}
                    className="flex-1 glass rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                    placeholder="Сообщение продавцу..." />
                  <button onClick={sendDealMessage} disabled={dealChatSending || !dealChatText.trim()}
                    className="btn-gradient w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                    <Icon name="Send" size={14} className="text-white" />
                  </button>
                </div>
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

/* ─── CHAT WINDOW ────────────────────────────────────────── */
function ChatWindow({ chat, user, onBack }: { chat: Chat; user: User; onBack: () => void }) {
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

/* ─── PRICE CALCULATOR ──────────────────────────────────── */
const DISCOUNT_TABLE: Record<number, number> = { 1: 0, 2: 5, 3: 10, 6: 15, 12: 25 };
const MONTH_OPTIONS = [
  { value: 1, label: "1 мес." },
  { value: 2, label: "2 мес.", discount: 5 },
  { value: 3, label: "3 мес.", discount: 10 },
  { value: 6, label: "6 мес.", discount: 15 },
  { value: 12, label: "12 мес.", discount: 25 },
];

function calcTotal(basePrice: number, months: number): number {
  const discount = DISCOUNT_TABLE[months] ?? 0;
  return Math.floor(basePrice * months * (100 - discount) / 100);
}

function PriceBreakdown({ basePrice, months, label = "Итого" }: { basePrice: number; months: number; label?: string }) {
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

/* ─── SHOP BANNER REQUEST FORM ──────────────────────────── */
function ShopBannerRequestForm({ user, isShopSubscriber, bannerPrice = 990 }: { user: { id: number; name: string; email?: string; phone: string } | null; isShopSubscriber?: boolean; bannerPrice?: number }) {
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState(user?.name || "");
  const [contactPhone, setContactPhone] = useState(user?.phone || "");
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [months, setMonths] = useState(1);
  const [sent, setSent] = useState(false);
  const [agree, setAgree] = useState(false);
  const { maintenance } = useMaintenance();

  const total = calcTotal(bannerPrice, months);
  const discount = DISCOUNT_TABLE[months] ?? 0;

  const emailBody = `Заявка на рекламный баннер\n\n` +
    `Название/заголовок: ${title}\n` +
    `Ссылка при клике: ${linkUrl || "не указана"}\n` +
    `Описание: ${description || "не указано"}\n` +
    `Срок размещения: ${months} мес.\n` +
    `Сумма: ${total.toLocaleString("ru-RU")} ₽${discount > 0 ? ` (скидка ${discount}%)` : ""}\n\n` +
    `Контактное лицо: ${contactName}\n` +
    `Телефон: ${contactPhone}\n` +
    `Email: ${contactEmail}\n` +
    (isShopSubscriber ? `\nПодписка магазина активна — добавить баннер\n` : "") +
    `\nID пользователя: ${user?.id || "—"}`;

  return sent ? (
    <div className="text-center py-3">
      <span className="text-2xl block mb-1">✅</span>
      <p className="text-green-400 text-sm font-medium">Заявка отправлена!</p>
      <p className="text-white/30 text-xs mt-1">Мы свяжемся с вами в течение 24 часов</p>
    </div>
  ) : (
    <div className="space-y-2">
      <div>
        <label className="text-white/40 text-xs mb-1 block">Заголовок баннера *</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="Розы от 990 ₽ — магазин ЦветОК" />
      </div>
      <div>
        <label className="text-white/40 text-xs mb-1 block">Ссылка при клике</label>
        <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
          className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="https://ваш-сайт.ru или телефон" />
      </div>
      <div>
        <label className="text-white/40 text-xs mb-1 block">Описание под баннером</label>
        <input value={description} onChange={e => setDescription(e.target.value)}
          className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="Доставка цветов по всему городу" />
      </div>
      <div>
        <label className="text-white/40 text-xs mb-1 block">Срок размещения</label>
        <div className="flex gap-1.5 flex-wrap">
          {MONTH_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setMonths(opt.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all relative"
              style={months === opt.value
                ? { background: "var(--grad-main)", color: "#fff" }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              {opt.label}
              {opt.discount && <span className="ml-1 text-green-400">−{opt.discount}%</span>}
            </button>
          ))}
        </div>
      </div>
      <PriceBreakdown basePrice={bannerPrice} months={months} label="Стоимость баннера" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-white/40 text-xs mb-1 block">Ваше имя *</label>
          <input value={contactName} onChange={e => setContactName(e.target.value)}
            className="glass w-full rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
            placeholder="Иван Иванов" />
        </div>
        <div>
          <label className="text-white/40 text-xs mb-1 block">Телефон *</label>
          <input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
            className="glass w-full rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
            placeholder="+7 999 000 00" />
        </div>
      </div>
      <div>
        <label className="text-white/40 text-xs mb-1 block">Email для подтверждения</label>
        <input value={contactEmail} onChange={e => setContactEmail(e.target.value)}
          className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="your@email.ru" />
      </div>
      <p className="text-white/25 text-xs">После отправки мы вышлем реквизиты для оплаты и разместим ваш баннер в течение 24 часов</p>
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <button type="button" onClick={() => setAgree(v => !v)}
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
          style={agree
            ? { background: "var(--grad-main)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)" }}>
          {agree && <Icon name="Check" size={13} className="text-white" />}
        </button>
        <span className="text-white/45 text-xs leading-relaxed">
          Я принимаю{" "}
          <a href="/offer" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">оферту</a>,{" "}
          <a href="/terms" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">соглашение</a>{" "}
          и согласен на обработку данных по{" "}
          <a href="/privacy" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">политике</a>
        </span>
      </label>
      {maintenance ? (
        <div className="text-center">
          <div className="w-full rounded-2xl py-3 font-oswald tracking-wide text-white/40 text-center"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            ЗАЯВКИ ВРЕМЕННО ОТКЛЮЧЕНЫ
          </div>
          <p className="text-amber-400 text-xs mt-2">Платформа на этапе доработки</p>
        </div>
      ) : agree ? (
        <a
          href={`mailto:flowerflip@flowerflip.ru?subject=${encodeURIComponent("Заявка на рекламный баннер")}&body=${encodeURIComponent(emailBody)}`}
          onClick={() => { if (title && contactPhone) setSent(true); }}
          className="btn-gradient w-full rounded-2xl py-3 font-oswald tracking-wide text-white text-center block">
          ОТПРАВИТЬ ЗАЯВКУ — {total.toLocaleString("ru-RU")} ₽
        </a>
      ) : (
        <div className="w-full rounded-2xl py-3 font-oswald tracking-wide text-white/40 text-center"
          style={{ background: "rgba(255,255,255,0.05)" }}>
          ОТПРАВИТЬ ЗАЯВКУ — {total.toLocaleString("ru-RU")} ₽
        </div>
      )}
    </div>
  );
}

/* ─── COINS MODAL «Лепестки» ─────────────────────────────── */
interface CoinHistoryItem { amount: number; balance_after: number; type: string; reason: string; created_at: string; }
function CoinsModal({ user, onClose, onUpdated }: { user: User | null; onClose: () => void; onUpdated: () => void }) {
  const [coins, setCoins] = useState<number>(user?.coins ?? 0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CoinHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshBalance = useCallback(() => {
    coinsApi.balance().then(r => { if (r.ok) setCoins(r.data.coins); });
  }, []);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  const buy = async (amount: number) => {
    setLoading(true); setMessage("");
    const r = await coinsApi.purchase(amount);
    setLoading(false);
    if (r.ok) {
      setCoins(r.data.coins);
      setMessage(`Начислено ${amount} 🌸`);
      onUpdated();
    } else {
      setMessage(r.data.error || "Не удалось купить баллы");
    }
  };

  const toggleHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) {
      setHistoryLoading(true);
      const r = await coinsApi.history();
      setHistoryLoading(false);
      if (r.ok) setHistory(r.data.items);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="glass-strong rounded-2xl p-6 w-full max-w-sm animate-fade-in-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon name="Flower2" size={20} style={{ color: "#ec4899" }} />
            <h3 className="font-oswald text-xl font-bold text-white">Лепестки 🌸</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="text-center mb-4">
          <p className="font-oswald text-4xl font-bold gradient-text">🌸 {coins}</p>
          <p className="text-white/40 text-xs mt-1">Ваш баланс баллов</p>
        </div>

        <p className="text-white/50 text-sm leading-relaxed mb-4">
          Внутренние баллы FlowerFlip. Тратьте на продвижение букетов: поднятие в топ, выделение цветом, продление аукциона.
        </p>

        <p className="text-white/50 text-xs font-medium mb-2">Купить баллы (1 ₽ = 1 балл)</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[50, 100, 250, 500].map(amount => (
            <button key={amount} disabled={loading} onClick={() => buy(amount)}
              className="rounded-xl py-2.5 text-sm font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: "var(--grad-main)" }}>
              <Icon name="Plus" size={14} /> {amount} 🌸
            </button>
          ))}
        </div>
        <p className="text-white/30 text-[11px] mb-3">Списывается с рублёвого баланса. Минимум 50 баллов.</p>

        {message && (
          <p className="text-sm text-center mb-3"
            style={{ color: message.includes("Начислено") ? "#4ade80" : "#f87171" }}>
            {message}
          </p>
        )}

        <button onClick={toggleHistory}
          className="w-full glass rounded-xl py-2.5 text-sm font-medium text-white/60 flex items-center justify-center gap-2">
          <Icon name="Clock" size={14} /> {showHistory ? "Скрыть историю" : "История"}
        </button>

        {showHistory && (
          <div className="mt-3 space-y-1.5 max-h-52 overflow-y-auto">
            {historyLoading ? (
              <p className="text-white/30 text-xs text-center py-3">Загрузка...</p>
            ) : history.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-3">Операций пока нет</p>
            ) : history.map((h, i) => (
              <div key={i} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs truncate">{h.reason}</p>
                  <p className="text-white/30 text-[10px]">{new Date(h.created_at).toLocaleString("ru-RU")}</p>
                </div>
                <span className="text-sm font-semibold flex-shrink-0 ml-2"
                  style={{ color: h.amount >= 0 ? "#4ade80" : "#f87171" }}>
                  {h.amount >= 0 ? "+" : ""}{h.amount} 🌸
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PROFILE SCREEN ─────────────────────────────────────── */
function ProfileScreen({ user, onLogout, onUpdate, onStartTour }: { user: User | null; onLogout: () => void; onUpdate?: () => void; onStartTour?: () => void }) {
  const [tab, setTab] = useState<"about" | "reviews" | "referral" | "settings" | "shop">("about");
  const [copied, setCopied] = useState(false);
  const { maintenance } = useMaintenance();

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sales, setSales] = useState<{ id: number; title: string; current_price: number; status: string; bids_count: number }[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [payoutMethod, setPayoutMethod] = useState(user?.payout_method || "card");
  const [payoutDetails, setPayoutDetails] = useState(user?.payout_details || "");
  const [payoutSaved, setPayoutSaved] = useState("");
  const [withdrawals, setWithdrawals] = useState<{ id: number; amount: number; method: string; details: string; status: string; admin_comment?: string; created_at: string }[]>([]);
  const { isIos, isStandalone, canInstall, promptInstall } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Настройки профиля
  const [settingsName, setSettingsName] = useState(user?.name || "");
  const [settingsPhone, setSettingsPhone] = useState(user?.phone || "");
  const [settingsEmail, setSettingsEmail] = useState(user?.email || "");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const installApp = async () => {
    const res = await promptInstall();
    if (res === "ios") setShowIosGuide(true);
  };

  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);
  const [cancelMsg, setCancelMsg] = useState("");
  const [emailInput, setEmailInput] = useState(user?.email || "");

  // Магазин
  const [shopStatus, setShopStatus] = useState<{ subscription: { is_active: boolean; plan: string; expires_at?: string; banner_addon: boolean } | null; profile: { shop_name: string; logo_url?: string } | null; subscription_price: number; banner_addon_price: number } | null>(null);
  const [shopName, setShopName] = useState("");
  const [shopDesc, setShopDesc] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopCity, setShopCity] = useState("");
  const [shopMonths, setShopMonths] = useState(1);
  const [shopLogoUrl, setShopLogoUrl] = useState("");
  const [shopLogoUploading, setShopLogoUploading] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopMsg, setShopMsg] = useState("");
  const [shopAgree, setShopAgree] = useState(false);
  const shopLogoRef = useRef<HTMLInputElement>(null);
  // Адреса (мульти-локации)
  const [shopLocations, setShopLocations] = useState<{ id: number; city: string; address: string; phone?: string; is_main: boolean }[]>([]);
  const [locForm, setLocForm] = useState<{ id?: number; city: string; address: string; phone: string; is_main: boolean } | null>(null);
  const [locMsg, setLocMsg] = useState("");
  const [locSaving, setLocSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  const saveEmail = async () => {
    if (!emailInput.trim() || emailInput === user?.email) return;
    setEmailSaving(true); setEmailMsg("");
    const r = await authApi.update({ email: emailInput.trim() });
    setEmailSaving(false);
    if (r.ok) setEmailMsg(r.data.email_sent ? "Письмо отправлено — проверьте почту" : "Сохранено");
    else setEmailMsg(r.data.error || "Ошибка");
  };

  const resendVerify = async () => {
    setEmailMsg("");
    const r = await authApi.resendVerify();
    setEmailMsg(r.ok ? "Письмо отправлено повторно" : (r.data.error || "Ошибка"));
  };

  const loadWithdrawals = useCallback(() => {
    profileApi.withdrawals().then(r => { if (r.ok) setWithdrawals(r.data.withdrawals); });
  }, []);

  const loadSales = useCallback(() => {
    profileApi.mySales().then(r => { if (r.ok) setSales(r.data.sales); });
  }, []);

  const cancelSale = async (id: number) => {
    const r = await bouquetsApi.cancel(id);
    if (r.ok) { setCancelConfirm(null); setCancelMsg(""); loadSales(); }
    else { setCancelMsg(r.data.error || "Ошибка"); }
  };

  // Продвижение букетов за лепестки
  const [promoteMsg, setPromoteMsg] = useState("");
  const [promoteBusy, setPromoteBusy] = useState(false);
  const promote = async (kind: string, bouquetId: number, cost: number, label: string) => {
    if (!confirm(`${label} за ${cost} 🌸? Баллы спишутся с вашего баланса лепестков.`)) return;
    setPromoteBusy(true); setPromoteMsg("");
    const r = await coinsApi.spend(kind, bouquetId);
    setPromoteBusy(false);
    if (r.ok) {
      setPromoteMsg(`Готово! Осталось ${r.data.coins} 🌸`);
      loadSales();
      onUpdate?.();
    } else {
      setPromoteMsg(r.data.error || "Недостаточно баллов");
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true); setSettingsMsg("");
    const updates: Record<string, string> = {};
    if (settingsName.trim() && settingsName !== user?.name) updates.name = settingsName.trim();
    if (settingsPhone.trim() && settingsPhone !== user?.phone) updates.phone = settingsPhone.trim();
    if (settingsEmail.trim() && settingsEmail !== user?.email) updates.email = settingsEmail.trim();
    if (Object.keys(updates).length === 0) { setSettingsSaving(false); setSettingsMsg("Нет изменений"); return; }
    const r = await authApi.update(updates);
    setSettingsSaving(false);
    if (r.ok) { setSettingsMsg(r.data.email_sent ? "Сохранено. Проверьте почту для подтверждения email" : "Сохранено!"); onUpdate?.(); }
    else setSettingsMsg(r.data.error || "Ошибка");
  };

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    const url = await uploadApi.upload(file);
    if (url) {
      const r2 = await authApi.update({ avatar_url: url });
      if (r2.ok) onUpdate?.();
    }
    setAvatarUploading(false);
  };

  const changePassword = async () => {
    if (!oldPassword || !newPassword) { setPwdMsg("Заполните оба поля"); return; }
    setPwdSaving(true); setPwdMsg("");
    const r = await authApi.changePassword(oldPassword, newPassword);
    setPwdSaving(false);
    if (r.ok) { setPwdMsg("Пароль изменён!"); setOldPassword(""); setNewPassword(""); }
    else setPwdMsg(r.data.error || "Ошибка");
  };

  useEffect(() => {
    if (!user) return;
    if (tab === "reviews") profileApi.reviews().then(r => { if (r.ok) setReviews(r.data.reviews); });
    if (tab === "about") { loadSales(); loadWithdrawals(); }
    if (tab === "shop") {
      shopsApi.myStatus().then(r => {
        if (r.ok) {
          setShopStatus(r.data);
          if (r.data.profile) {
            setShopName(r.data.profile.shop_name || "");
            setShopLogoUrl(r.data.profile.logo_url || "");
            setShopCity(r.data.profile.city || "");
          }
        }
      });
      shopsApi.locations(user.id).then(r => {
        if (r.ok) setShopLocations(r.data.locations || []);
      });
    }
  }, [tab, user, loadSales, loadWithdrawals]);

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">👤</span>
      <p className="text-white/50 font-oswald text-xl">Войдите в аккаунт</p>
    </div>
  );



  const savePayout = async () => {
    if (!payoutDetails.trim()) { setPayoutSaved("Укажите реквизиты"); return; }
    const r = await profileApi.savePayout(payoutMethod, payoutDetails.trim());
    setPayoutSaved(r.ok ? "Реквизиты сохранены" : (r.data.error || "Ошибка"));
  };

  const doWithdraw = async () => {
    if (maintenance) { setWithdrawMsg("Платформа на этапе доработки — вывод временно недоступен"); return; }
    const amount = parseFloat(withdrawAmount);
    if (!amount) { setWithdrawMsg("Укажите сумму"); return; }
    const r = await profileApi.withdraw(amount, payoutMethod, payoutDetails.trim());
    setWithdrawMsg(r.ok ? r.data.message : r.data.error);
    if (r.ok) { setWithdrawAmount(""); loadWithdrawals(); }
  };

  const doTopup = async () => {
    if (maintenance) { setWithdrawMsg("Платформа на этапе доработки — пополнение временно недоступно"); return; }
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 10) { setWithdrawMsg("Минимальная сумма пополнения 10 ₽"); return; }
    const r = await paymentApi.topup(amount);
    if (r.ok && r.data.confirmation_url) {
      window.location.href = r.data.confirmation_url;
    } else {
      setWithdrawMsg(r.data.error || "Оплата временно недоступна");
    }
  };

  const methodLabel: Record<string, string> = { card: "Карта", sbp: "СБП", wallet: "Кошелёк" };
  const statusLabel: Record<string, string> = { pending: "В обработке", paid: "Выплачено", rejected: "Отклонено" };
  const statusColor: Record<string, string> = { pending: "text-yellow-400", paid: "text-green-400", rejected: "text-red-400" };

  return (
    <div className="animate-fade-in">
      <div className="rounded-3xl p-5 mb-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15) 0%, rgba(168,85,247,0.15) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl overflow-hidden"
              style={{ background: user.avatar_url ? "transparent" : "var(--grad-main)" }}>
              {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : "🌸"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1">
            <h2 className="font-oswald text-xl font-bold text-white">{user.name}</h2>
            <div className="flex items-center gap-1 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Icon key={i} name="Star" size={12} className={i < Math.round(user.rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
              ))}
              <span className="text-white/50 text-xs ml-1">{user.rating?.toFixed(1)} · {user.reviews_count} отзывов</span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">{user.phone}</p>
            {user.email && (
              <div className="flex items-center gap-1 mt-0.5">
                <Icon name="Mail" size={10} className="text-white/30" />
                <span className="text-white/40 text-xs">{user.email}</span>
                {user.email_verified
                  ? <Icon name="CheckCircle2" size={10} className="text-green-400" />
                  : <span className="text-yellow-400 text-xs">· не подтверждён</span>
                }
              </div>
            )}
          </div>
          <button onClick={onLogout} className="glass p-2 rounded-xl" title="Выйти">
            <Icon name="LogOut" size={16} className="text-white/40" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[{ label: "Продано", value: user.sales_count }, { label: "Куплено", value: user.purchases_count }, { label: "Рейтинг", value: user.rating?.toFixed(1) }].map(s => (
            <div key={s.label} className="glass rounded-xl p-2.5 text-center">
              <p className="gradient-text font-oswald text-lg font-bold">{s.value}</p>
              <p className="text-white/40 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {([["about", "Кабинет"], ["shop", "Магазин"], ["reviews", "Отзывы"], ["referral", "Рефералы"], ["settings", "Настройки"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)}
            className="flex-shrink-0 py-2.5 px-3 rounded-xl text-xs font-medium transition-all"
            style={tab === k ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "about" && (
        <div className="space-y-3 animate-fade-in-up">

          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm mb-3 font-medium">Баланс и выплаты</p>
            <p className="gradient-text font-oswald text-3xl font-bold mb-1">{formatPrice(user.balance)}</p>
            <p className="text-white/40 text-xs mb-4">Доступно к выводу</p>

            {/* Способ вывода */}
            <p className="text-white/40 text-xs mb-2">Способ получения</p>
            <div className="flex gap-2 mb-3">
              {[["card", "Карта", "CreditCard"], ["sbp", "СБП", "Smartphone"], ["wallet", "Кошелёк", "Wallet"]].map(([m, l, ic]) => (
                <button key={m} onClick={() => setPayoutMethod(m)}
                  className="flex-1 rounded-xl py-2.5 flex flex-col items-center gap-1 transition-colors text-xs"
                  style={payoutMethod === m
                    ? { background: "var(--grad-main)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  <Icon name={ic as "CreditCard"} size={16} />
                  <span>{l}</span>
                </button>
              ))}
            </div>

            {/* Реквизиты */}
            <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 mb-2">
              <Icon name="CreditCard" size={14} className="text-white/30 flex-shrink-0" />
              <input value={payoutDetails} onChange={e => { setPayoutDetails(e.target.value); setPayoutSaved(""); }}
                className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-white/30"
                placeholder={payoutMethod === "sbp" ? "Номер телефона" : payoutMethod === "wallet" ? "Номер кошелька" : "Номер карты"} />
              <button onClick={savePayout} className="text-pink-400 text-xs font-medium hover:text-pink-300 flex-shrink-0">Сохранить</button>
            </div>
            {payoutSaved && <p className={`text-xs mb-2 ${payoutSaved.includes("сохранены") ? "text-green-400" : "text-red-400"}`}>{payoutSaved}</p>}

            {/* Сумма вывода */}
            <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 mb-3 mt-3">
              <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} type="number"
                className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-white/30"
                placeholder="Сумма для вывода" />
              <span className="text-white/40 text-sm">₽</span>
            </div>
            {withdrawMsg && <p className={`text-sm mb-3 ${withdrawMsg.includes("принята") ? "text-green-400" : "text-red-400"}`}>{withdrawMsg}</p>}
            {maintenance && (
              <p className="text-amber-400 text-xs mb-2 text-center">Платформа на этапе доработки — пополнение и вывод временно отключены</p>
            )}
            <div className="flex gap-2">
              <button onClick={doTopup} disabled={maintenance}
                className="flex-1 glass rounded-xl py-3 font-oswald text-base tracking-wide text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                ПОПОЛНИТЬ
              </button>
              <button onClick={doWithdraw}
                className="flex-1 btn-gradient rounded-xl py-3 font-oswald text-base tracking-wide disabled:opacity-40"
                disabled={user.balance <= 0 || maintenance}>
                ВЫВЕСТИ
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Icon name="Clock" size={12} className="text-white/25 flex-shrink-0" />
              <p className="text-white/25 text-xs">Выплата в течение 24 часов после подачи заявки</p>
            </div>

            {/* История выводов */}
            {withdrawals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-white/40 text-xs mb-2">История выводов</p>
                <div className="space-y-2">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-white/70">{formatPrice(w.amount)}</span>
                        <span className="text-white/30 text-xs ml-2">{methodLabel[w.method] || w.method}</span>
                      </div>
                      <span className={`text-xs ${statusColor[w.status]}`}>{statusLabel[w.status] || w.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm mb-3 font-medium">Мои аукционы</p>
            {cancelMsg && <p className="text-red-400 text-xs mb-2">{cancelMsg}</p>}
            {promoteMsg && <p className="text-xs mb-2" style={{ color: promoteMsg.includes("Готово") ? "#4ade80" : "#f87171" }}>{promoteMsg}</p>}
            {sales.length === 0 ? (
              <p className="text-white/30 text-sm">Вы ещё не выставляли букеты</p>
            ) : (
              <div className="space-y-2">
                {sales.map(s => (
                  <div key={s.id} className="rounded-xl p-3"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-sm truncate">{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="gradient-text text-sm font-semibold">{formatPrice(s.current_price)}</span>
                          <span className="text-white/30 text-xs">{s.bids_count} ст.</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{
                              background: s.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                              color: s.status === "active" ? "#4ade80" : "rgba(255,255,255,0.3)"
                            }}>
                            {s.status === "active" ? "активен" : s.status === "won" ? "продан" : s.status === "expired" ? "истёк" : s.status}
                          </span>
                        </div>
                      </div>
                      {s.status === "active" && s.bids_count === 0 && (
                        cancelConfirm === s.id ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => cancelSale(s.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                              style={{ background: "rgba(239,68,68,0.8)" }}>
                              Да, снять
                            </button>
                            <button onClick={() => { setCancelConfirm(null); setCancelMsg(""); }}
                              className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 glass">
                              Нет
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setCancelConfirm(s.id); setCancelMsg(""); }}
                            className="flex-shrink-0 glass p-2 rounded-xl hover:text-red-400 transition-colors text-white/30"
                            title="Снять с аукциона">
                            <Icon name="Trash2" size={15} />
                          </button>
                        )
                      )}
                      {s.status === "active" && s.bids_count > 0 && (
                        <span className="flex-shrink-0 text-white/20 text-xs" title="Есть ставки — нельзя снять">
                          <Icon name="Lock" size={13} />
                        </span>
                      )}
                    </div>
                    {s.status === "active" && (
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        <span className="text-white/30 text-[11px] mr-0.5">Продвижение 🌸:</span>
                        <button disabled={promoteBusy} onClick={() => promote("boost", s.id, 100, "Поднять в топ")}
                          className="glass rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 flex items-center gap-1 disabled:opacity-50">
                          <Icon name="ArrowUp" size={12} style={{ color: "#ec4899" }} /> В топ
                        </button>
                        <button disabled={promoteBusy} onClick={() => promote("highlight", s.id, 150, "Выделить цветом")}
                          className="glass rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 flex items-center gap-1 disabled:opacity-50">
                          <Icon name="Sparkles" size={12} style={{ color: "#a855f7" }} /> Выделить
                        </button>
                        <button disabled={promoteBusy} onClick={() => promote("extend", s.id, 80, "Продлить аукцион")}
                          className="glass rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 flex items-center gap-1 disabled:opacity-50">
                          <Icon name="Clock" size={12} style={{ color: "#4ade80" }} /> Продлить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Установка приложения */}
          {!isStandalone && (
            <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                  style={{ background: "var(--grad-main)" }}>🌸</div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">Установить приложение</p>
                  <p className="text-white/40 text-xs mt-0.5">Быстрый доступ с экрана телефона</p>
                </div>
              </div>
              {isIos ? (
                <button onClick={() => setShowIosGuide(true)}
                  className="btn-gradient w-full rounded-xl py-3 font-oswald text-base tracking-wide">
                  КАК УСТАНОВИТЬ НА IPHONE
                </button>
              ) : canInstall ? (
                <button onClick={installApp}
                  className="btn-gradient w-full rounded-xl py-3 font-oswald text-base tracking-wide">
                  УСТАНОВИТЬ
                </button>
              ) : (
                <p className="text-white/30 text-xs text-center py-2">
                  Откройте сайт в Chrome или Safari и используйте меню браузера → «Установить приложение»
                </p>
              )}
            </div>
          )}

          {/* iOS guide modal (в профиле) */}
          {showIosGuide && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center p-4"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
              onClick={() => setShowIosGuide(false)}>
              <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-fade-in-up"
                onClick={e => e.stopPropagation()}>
                <div className="text-center mb-5">
                  <span className="text-4xl block mb-2">📱</span>
                  <h3 className="font-oswald text-xl font-bold text-white">Установить на iPhone</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { step: "1", text: "Нажмите кнопку «Поделиться»", sub: "значок снизу экрана браузера Safari" },
                    { step: "2", text: "Выберите «На экран «Домой»»", sub: "прокрутите список действий вниз" },
                    { step: "3", text: "Нажмите «Добавить»", sub: "приложение появится на рабочем столе" },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
                        style={{ background: "var(--grad-main)" }}>{s.step}</div>
                      <div>
                        <p className="text-white text-sm font-medium">{s.text}</p>
                        <p className="text-white/40 text-xs mt-0.5">{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowIosGuide(false)}
                  className="btn-gradient w-full rounded-2xl py-3 mt-5 font-oswald tracking-wide">
                  ПОНЯТНО
                </button>
              </div>
            </div>
          )}

          {/* Поддержка */}
          <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/50 text-sm mb-3 font-medium">Поддержка и контакты</p>
            <div className="space-y-2">
              <a href="mailto:flowerflip@flowerflip.ru"
                className="flex items-center gap-3 glass rounded-xl px-4 py-3 hover:text-white transition-colors group">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,61,139,0.15)" }}>
                  <Icon name="Mail" size={15} style={{ color: "var(--neon-pink)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm group-hover:text-white transition-colors">flowerflip@flowerflip.ru</p>
                  <p className="text-white/30 text-xs">Напишите нам по любому вопросу</p>
                </div>
                <Icon name="ExternalLink" size={13} className="text-white/20 flex-shrink-0" />
              </a>
              <a href="/articles"
                className="flex items-center gap-3 glass rounded-xl px-4 py-3 hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,61,139,0.15)" }}>
                  <Icon name="BookOpen" size={15} style={{ color: "var(--neon-pink)" }} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-white/70 text-sm group-hover:text-white transition-colors">Статьи о платформе</p>
                  <p className="text-white/30 text-xs">Как работает аукцион, эскроу, баллы и рефералы</p>
                </div>
                <Icon name="ChevronRight" size={13} className="text-white/20 flex-shrink-0" />
              </a>
              <div className="flex items-center gap-3 px-4 py-2">
                <Icon name="Shield" size={13} className="text-white/20 flex-shrink-0" />
                <p className="text-white/25 text-xs">Все сделки защищены системой эскроу</p>
              </div>
              <div className="flex items-center gap-3 px-4 py-2">
                <Icon name="Clock" size={13} className="text-white/20 flex-shrink-0" />
                <p className="text-white/25 text-xs">Ответ в течение 24 часов в рабочие дни</p>
              </div>
              {onStartTour && (
                <button onClick={onStartTour}
                  className="flex items-center gap-3 glass rounded-xl px-4 py-3 w-full hover:bg-white/5 transition-colors group">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(168,85,247,0.15)" }}>
                    <Icon name="GraduationCap" size={15} style={{ color: "#a855f7" }} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white/70 text-sm group-hover:text-white transition-colors">Повторить обучение</p>
                    <p className="text-white/30 text-xs">Пройти тур по функциям заново</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Документы */}
          <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/50 text-sm mb-3 font-medium">Правовые документы</p>
            <div className="space-y-2">
              {[
                { href: "/privacy", icon: "ShieldCheck", title: "Политика конфиденциальности", sub: "Как мы обрабатываем ваши данные" },
                { href: "/cookies", icon: "Cookie", title: "Политика cookie", sub: "Какие файлы cookie мы используем" },
                { href: "/terms", icon: "FileText", title: "Пользовательское соглашение", sub: "Правила использования платформы" },
                { href: "/offer", icon: "Receipt", title: "Публичная оферта", sub: "Условия сделок и расчётов" },
              ].map((doc) => (
                <a key={doc.href} href={doc.href}
                  className="flex items-center gap-3 glass rounded-xl px-4 py-3 hover:bg-white/5 transition-colors group">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(168,85,247,0.15)" }}>
                    <Icon name={doc.icon} size={15} style={{ color: "#a855f7" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-sm group-hover:text-white transition-colors">{doc.title}</p>
                    <p className="text-white/30 text-xs">{doc.sub}</p>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-white/20 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "shop" && (
        <div className="space-y-4 animate-fade-in-up">
          {!shopStatus ? (
            <div className="text-center py-10 text-white/30">
              <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent mx-auto mb-3" />
              <p>Загрузка...</p>
            </div>
          ) : !shopStatus.subscription?.is_active ? (
            <div className="space-y-4">
              <div className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(255,61,139,0.15))", border: "1px solid rgba(168,85,247,0.3)" }}>
                <span className="text-4xl block mb-3 text-center">🏪</span>
                <h3 className="font-oswald text-xl font-bold text-white mb-2 text-center">Профиль магазина</h3>
                <p className="text-white/50 text-sm mb-4 text-center">Откройте витрину своего магазина на платформе</p>
                <div className="space-y-1.5 mb-4">
                  {["Отдельная страница магазина с логотипом", "Неограниченное кол-во букетов", "Все форматы: аукцион, фикс. цена, бронь"].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-green-400 text-sm">✓</span>
                      <span className="text-white/70 text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-2xl p-4">
                <p className="text-white/50 text-sm font-medium mb-3">Подать заявку на подключение магазина</p>
                <div className="space-y-2">
                  {([
                    { label: "Название магазина *", val: shopName, set: setShopName, placeholder: "Цветочный рай" },
                    { label: "Город", val: shopAddress, set: setShopAddress, placeholder: "Москва" },
                    { label: "Телефон для связи *", val: shopPhone, set: setShopPhone, placeholder: "+7 999 000 00 00" },
                    { label: "Описание магазина", val: shopDesc, set: setShopDesc, placeholder: "Свежие цветы, работаем с 2020 года..." },
                  ] as {label:string;val:string;set:(v:string)=>void;placeholder:string}[]).map(({ label, val, set, placeholder }) => (
                    <div key={label}>
                      <label className="text-white/40 text-xs mb-1 block">{label}</label>
                      <input value={val} onChange={e => set(e.target.value)}
                        className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                        placeholder={placeholder} />
                    </div>
                  ))}
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Срок подписки</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {MONTH_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setShopMonths(opt.value)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                          style={shopMonths === opt.value
                            ? { background: "var(--grad-main)", color: "#fff" }
                            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                          {opt.label}
                          {opt.discount ? <span className="ml-1 text-green-400">−{opt.discount}%</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PriceBreakdown basePrice={shopStatus.subscription_price || 1990} months={shopMonths} label="Стоимость магазина" />
                </div>
                <label className="flex items-start gap-2.5 mt-3 cursor-pointer select-none">
                  <button type="button" onClick={() => setShopAgree(v => !v)}
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                    style={shopAgree
                      ? { background: "var(--grad-main)" }
                      : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    {shopAgree && <Icon name="Check" size={13} className="text-white" />}
                  </button>
                  <span className="text-white/45 text-xs leading-relaxed">
                    Я принимаю{" "}
                    <a href="/offer" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">оферту</a>,{" "}
                    <a href="/terms" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">соглашение</a>{" "}
                    и согласен на обработку данных по{" "}
                    <a href="/privacy" target="_blank" onClick={e => e.stopPropagation()} className="text-pink-400 underline">политике</a>
                  </span>
                </label>
                {shopMsg && <p className={`text-xs mt-2 ${shopMsg.includes("отправлена") ? "text-green-400" : "text-red-400"}`}>{shopMsg}</p>}
                {maintenance ? (
                  <div className="text-center mt-3">
                    <div className="w-full rounded-2xl py-3 font-oswald tracking-wide text-white/40 text-center"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      ЗАЯВКИ ВРЕМЕННО ОТКЛЮЧЕНЫ
                    </div>
                    <p className="text-amber-400 text-xs mt-2">Платформа на этапе доработки</p>
                  </div>
                ) : shopAgree ? (
                  <a
                    href={`mailto:flowerflip@flowerflip.ru?subject=${encodeURIComponent("Заявка на подписку магазина")}&body=${encodeURIComponent(`Название: ${shopName}\nГород: ${shopAddress}\nТелефон: ${shopPhone}\nОписание: ${shopDesc}\nСрок: ${shopMonths} мес.\nСумма: ${calcTotal(shopStatus.subscription_price || 1990, shopMonths).toLocaleString("ru-RU")} ₽${DISCOUNT_TABLE[shopMonths] ? ` (скидка ${DISCOUNT_TABLE[shopMonths]}%)` : ""}\n\nПользователь ID: ${user?.id}\nEmail: ${user?.email || "не указан"}`)}`}
                    onClick={() => setShopMsg("Заявка отправлена! Мы свяжемся с вами в течение 24 часов.")}
                    className="btn-gradient w-full rounded-2xl py-3 mt-3 font-oswald tracking-wide text-white text-center block">
                    ОТПРАВИТЬ ЗАЯВКУ — {calcTotal(shopStatus.subscription_price || 1990, shopMonths).toLocaleString("ru-RU")} ₽
                  </a>
                ) : (
                  <button type="button" onClick={() => setShopMsg("Подтвердите согласие с условиями")}
                    className="w-full rounded-2xl py-3 mt-3 font-oswald tracking-wide text-white/40 text-center block"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    ОТПРАВИТЬ ЗАЯВКУ — {calcTotal(shopStatus.subscription_price || 1990, shopMonths).toLocaleString("ru-RU")} ₽
                  </button>
                )}
                <p className="text-white/25 text-xs text-center mt-2">Откроется ваш почтовый клиент</p>
              </div>
              <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,61,139,0.15)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📢</span>
                  <p className="text-white/60 text-sm font-medium">Только рекламный баннер</p>
                  <span className="ml-auto text-pink-400 font-oswald text-sm font-bold">от {(shopStatus.banner_addon_price || 990).toLocaleString("ru-RU")} ₽/мес</span>
                </div>
                <p className="text-white/40 text-xs mb-3">Разместите рекламу без открытия магазина. Баннер (фото/видео) показывается всем пользователям на главной.</p>
                <ShopBannerRequestForm user={user} bannerPrice={shopStatus.banner_addon_price || 990} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(168,85,247,0.3)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white/50 text-xs font-medium">ПОДПИСКА АКТИВНА</p>
                  {shopStatus.subscription?.banner_addon && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,61,139,0.2)", color: "#ff3d8b" }}>+ Баннеры</span>
                  )}
                </div>
                {shopStatus.subscription?.expires_at && (
                  <p className="text-white/40 text-xs">До {new Date(shopStatus.subscription.expires_at).toLocaleDateString("ru-RU")}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <Icon name="RefreshCw" size={11} className="text-purple-400 flex-shrink-0" />
                  <p className="text-white/35 text-xs">Автопродление активно — напишите нам для отмены</p>
                </div>
                <a href="mailto:flowerflip@flowerflip.ru?subject=Отмена автопродления подписки"
                  className="text-white/20 text-xs hover:text-white/40 transition-colors block mt-1 text-right">
                  Отменить автопродление →
                </a>
              </div>
              <div className="glass rounded-2xl p-4">
                <p className="text-white/50 text-sm font-medium mb-3">Профиль магазина</p>
                <input ref={shopLogoRef} type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setShopLogoUploading(true);
                    const url = await uploadApi.upload(f);
                    setShopLogoUploading(false);
                    if (url) setShopLogoUrl(url);
                  }} />
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    onClick={() => shopLogoRef.current?.click()}>
                    {shopLogoUploading
                      ? <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full w-5 h-5 border-2 border-pink-400 border-t-transparent" /></div>
                      : shopLogoUrl ? <img src={shopLogoUrl} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🏪</div>}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Логотип магазина</p>
                    <button onClick={() => shopLogoRef.current?.click()} className="text-pink-400 text-xs mt-1 hover:text-pink-300 transition-colors">
                      {shopLogoUrl ? "Изменить" : "Загрузить"}
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {([
                    { label: "Название магазина *", val: shopName, set: setShopName, placeholder: "Цветочный рай" },
                    { label: "Описание", val: shopDesc, set: setShopDesc, placeholder: "Продаём свежие букеты..." },
                    { label: "Основной город", val: shopCity, set: setShopCity, placeholder: "Москва" },
                    { label: "Основной адрес", val: shopAddress, set: setShopAddress, placeholder: "ул. Цветочная, 1" },
                    { label: "Телефон магазина", val: shopPhone, set: setShopPhone, placeholder: "+7 999 000 00 00" },
                  ] as {label:string;val:string;set:(v:string)=>void;placeholder:string}[]).map(({ label, val, set, placeholder }) => (
                    <div key={label}>
                      <label className="text-white/40 text-xs mb-1 block">{label}</label>
                      <input value={val} onChange={e => set(e.target.value)}
                        className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                        placeholder={placeholder} />
                    </div>
                  ))}
                </div>
                {shopMsg && <p className={`text-xs mt-2 ${shopMsg.includes("Сохранено") ? "text-green-400" : "text-red-400"}`}>{shopMsg}</p>}
                <button
                  onClick={async () => {
                    if (!shopName.trim()) { setShopMsg("Укажите название магазина"); return; }
                    setShopSaving(true); setShopMsg("");
                    const r = await shopsApi.saveProfile({ shop_name: shopName, logo_url: shopLogoUrl || undefined, description: shopDesc || undefined, address: shopAddress || undefined, phone: shopPhone || undefined, city: shopCity || undefined });
                    setShopSaving(false);
                    setShopMsg(r.ok ? "Сохранено!" : (r.data.error || "Ошибка"));
                  }}
                  disabled={shopSaving}
                  className="btn-gradient w-full rounded-2xl py-3 mt-4 font-oswald tracking-wide disabled:opacity-50">
                  {shopSaving ? "СОХРАНЕНИЕ..." : "СОХРАНИТЬ МАГАЗИН"}
                </button>

                {/* Мульти-адреса магазина */}
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white/40 text-xs font-medium">ТОЧКИ ПРИСУТСТВИЯ</p>
                    <button onClick={() => setLocForm({ city: "", address: "", phone: "", is_main: shopLocations.length === 0 })}
                      className="flex items-center gap-1 text-pink-400 text-xs hover:text-pink-300 transition-colors">
                      <Icon name="Plus" size={12} /> Добавить
                    </button>
                  </div>
                  {shopLocations.length === 0 && !locForm && (
                    <p className="text-white/25 text-xs">Добавьте адреса в разных городах</p>
                  )}
                  <div className="space-y-2">
                    {shopLocations.map(loc => (
                      <div key={loc.id} className="rounded-xl p-3 flex items-start justify-between gap-2"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Icon name="MapPin" size={11} className="text-pink-400 flex-shrink-0" />
                            <span className="text-white/70 text-xs font-medium">{loc.city}</span>
                            {loc.is_main && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(168,85,247,0.2)", color: "#a855f7" }}>Основная</span>}
                          </div>
                          <p className="text-white/50 text-xs mt-0.5 truncate">{loc.address}</p>
                          {loc.phone && <p className="text-white/35 text-xs mt-0.5">{loc.phone}</p>}
                        </div>
                        <button onClick={() => setLocForm({ id: loc.id, city: loc.city, address: loc.address, phone: loc.phone || "", is_main: loc.is_main })}
                          className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
                          <Icon name="Pencil" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {locForm !== null && (
                    <div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-white/50 text-xs font-medium">{locForm.id ? "Редактировать адрес" : "Новый адрес"}</p>
                      {[
                        { label: "Город *", val: locForm.city, key: "city" as const, placeholder: "Санкт-Петербург" },
                        { label: "Адрес *", val: locForm.address, key: "address" as const, placeholder: "Невский пр., 10" },
                        { label: "Телефон", val: locForm.phone, key: "phone" as const, placeholder: "+7 812 000 00 00" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-white/35 text-xs mb-1 block">{f.label}</label>
                          <input value={f.val} onChange={e => setLocForm(p => p ? { ...p, [f.key]: e.target.value } : null)}
                            className="glass w-full rounded-xl px-3 py-2 text-white placeholder:text-white/25 text-xs outline-none"
                            placeholder={f.placeholder} />
                        </div>
                      ))}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={locForm.is_main} onChange={e => setLocForm(p => p ? { ...p, is_main: e.target.checked } : null)} className="accent-pink-500" />
                        <span className="text-white/50 text-xs">Основная точка</span>
                      </label>
                      {locMsg && <p className={`text-xs ${locMsg.includes("ok") || locMsg.includes("Сохранено") ? "text-green-400" : "text-red-400"}`}>{locMsg}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => { setLocForm(null); setLocMsg(""); }} className="glass rounded-xl px-3 py-2 text-white/40 text-xs flex-1">Отмена</button>
                        <button onClick={async () => {
                          if (!locForm.city.trim() || !locForm.address.trim()) { setLocMsg("Укажите город и адрес"); return; }
                          setLocSaving(true); setLocMsg("");
                          const r = await shopsApi.saveLocation({ id: locForm.id, city: locForm.city, address: locForm.address, phone: locForm.phone || undefined, is_main: locForm.is_main });
                          setLocSaving(false);
                          if (r.ok) {
                            setLocMsg("Сохранено!");
                            setLocForm(null);
                            const lr = await shopsApi.locations(user.id);
                            if (lr.ok) setShopLocations(lr.data.locations || []);
                          } else setLocMsg(r.data.error || "Ошибка");
                        }} disabled={locSaving}
                          className="btn-gradient rounded-xl px-3 py-2 text-xs font-semibold flex-1 disabled:opacity-50">
                          {locSaving ? "..." : "Сохранить"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {shopStatus.subscription?.banner_addon ? (
                <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
                  <p className="text-white/50 text-sm font-medium mb-2">Рекламные баннеры — активны</p>
                  <p className="text-white/40 text-xs mb-2">Для управления баннерами напишите администратору:</p>
                  <a href="mailto:flowerflip@flowerflip.ru" className="text-pink-400 text-xs hover:text-pink-300 transition-colors block">flowerflip@flowerflip.ru</a>
                </div>
              ) : (
                <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,61,139,0.15)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white/50 text-sm font-medium">Добавить рекламный баннер</p>
                    <span className="text-pink-400 font-oswald text-sm font-bold">{(shopStatus.banner_addon_price || 990).toLocaleString("ru-RU")} ₽/мес</span>
                  </div>
                  <p className="text-white/40 text-xs mb-3">Ваш баннер (фото или видео) будет показан всем пользователям на главной странице</p>
                  <ShopBannerRequestForm user={user} isShopSubscriber />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-3 animate-fade-in-up">
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-white/30"><span className="text-4xl block mb-3">💬</span><p>Отзывов пока нет</p></div>
          ) : reviews.map((r, i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--grad-main)" }}>{r.reviewer_name[0]}</div>
                  <span className="text-white font-medium text-sm">{r.reviewer_name}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, si) => (
                    <Icon key={si} name="Star" size={11} className={si < r.stars ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
                  ))}
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{r.text}</p>
              <p className="text-white/30 text-xs mt-2">{timeAgo(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "referral" && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Заработок */}
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(255,61,139,0.15))", border: "1px solid rgba(168,85,247,0.3)" }}>
            <p className="text-white/50 text-xs font-medium uppercase tracking-wide mb-1">Реферальный заработок</p>
            <p className="font-oswald text-3xl font-bold" style={{ color: "#a855f7" }}>
              {formatPrice(user.ref_earnings || 0)}
            </p>
            <p className="text-white/40 text-xs mt-1">Зачисляется на баланс автоматически</p>
          </div>

          {/* Реферальный код */}
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm font-medium mb-3 flex items-center gap-2">
              <Icon name="Tag" size={14} />
              Ваш реферальный код
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 glass rounded-xl px-4 py-3 text-center">
                <span className="font-oswald text-2xl font-bold tracking-widest" style={{ color: "#a855f7" }}>
                  {user.ref_code || "—"}
                </span>
              </div>
              <button onClick={() => copyRef(user.ref_code || "")}
                className="glass px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                style={{ color: copied ? "#4ade80" : "rgba(255,255,255,0.6)" }}>
                <Icon name={copied ? "Check" : "Copy"} size={15} />
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          </div>

          {/* Реферальная ссылка */}
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm font-medium mb-3 flex items-center gap-2">
              <Icon name="Link" size={14} />
              Реферальная ссылка
            </p>
            <div className="glass rounded-xl px-3 py-2.5 text-xs text-white/50 mb-2 break-all">
              {`https://flowerflip.ru/?ref=${user.ref_code}`}
            </div>
            <div className="flex gap-2">
              <button onClick={() => copyRef(`https://flowerflip.ru/?ref=${user.ref_code}`)}
                className="flex-1 glass rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                style={{ color: "rgba(255,255,255,0.6)" }}>
                <Icon name="Copy" size={14} />
                Копировать ссылку
              </button>
              <button onClick={() => {
                const shareUrl = `https://flowerflip.ru/?ref=${user.ref_code}`;
                const text = `🌸 FlowerFlip — аукцион живых букетов!\nПокупай свежие цветы дешевле рынка.\n${shareUrl}`;
                if (navigator.share) navigator.share({ title: "FlowerFlip — аукцион живых букетов", text, url: shareUrl });
                else copyRef(shareUrl);
              }}
                className="flex-1 btn-gradient rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2">
                <Icon name="Share2" size={14} />
                Поделиться
              </button>
            </div>
          </div>

          {/* Общий годовой пул */}
          <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(168,85,247,0.2)" }}>
            <p className="text-white/50 text-sm font-medium mb-2 flex items-center gap-2">
              <Icon name="Sparkles" size={14} style={{ color: "#a855f7" }} />
              Общий годовой пул 🌸
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              С каждой покупки приглашённого друга вы получаете <span style={{ color: "#ec4899" }}>4,5%</span> сразу на баланс,
              а <span style={{ color: "#a855f7" }}>0,5%</span> идёт в общий пул. В конце года пул делится между всеми,
              кто привёл хотя бы одного пользователя.
            </p>
          </div>

          {/* Как работает */}
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm font-medium mb-3">Как работает</p>
            <div className="space-y-3">
              {[
                { icon: "Share2", text: "Поделитесь ссылкой или кодом с друзьями" },
                { icon: "UserPlus", text: "Друг регистрируется и вводит ваш код" },
                { icon: "ShoppingBag", text: "Когда друг совершает покупку — вы получаете 5% от суммы сделки" },
                { icon: "Wallet", text: "Деньги зачисляются на ваш баланс автоматически" },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(168,85,247,0.15)" }}>
                    <Icon name={s.icon as "Share2"} size={14} style={{ color: "#a855f7" }} />
                  </div>
                  <p className="text-white/60 text-sm pt-1.5">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-4 animate-fade-in-up">

          {/* Аватар */}
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm font-medium mb-3">Фото профиля</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center text-3xl"
                style={{ background: user.avatar_url ? "transparent" : "var(--grad-main)" }}>
                {user.avatar_url
                  ? <img src={user.avatar_url} className="w-full h-full object-cover" />
                  : "🌸"}
              </div>
              <div className="flex-1">
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                  className="btn-gradient px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  <Icon name={avatarUploading ? "Loader2" : "Camera"} size={14} className={avatarUploading ? "animate-spin" : ""} />
                  {avatarUploading ? "Загружаем..." : "Изменить фото"}
                </button>
                {user.avatar_url && (
                  <button onClick={async () => { await authApi.update({ avatar_url: null }); onUpdate?.(); }}
                    className="block mt-1.5 text-xs text-white/30 hover:text-red-400 transition-colors">
                    Удалить фото
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Основные данные */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-sm font-medium">Личные данные</p>
            <div>
              <label className="text-white/40 text-xs mb-1 block">Имя</label>
              <input value={settingsName} onChange={e => setSettingsName(e.target.value)}
                className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                placeholder="Ваше имя" />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block">Телефон</label>
              <input value={settingsPhone} onChange={e => setSettingsPhone(e.target.value)} type="tel"
                className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                placeholder="+7 999 000 00 00" />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block flex items-center gap-2">
                Email
                {user.email_verified
                  ? <span className="text-green-400 text-xs">✓ подтверждён</span>
                  : user.email ? <span className="text-yellow-400 text-xs">не подтверждён</span> : null}
              </label>
              <input value={settingsEmail} onChange={e => setSettingsEmail(e.target.value)} type="email"
                className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                placeholder="your@email.com" />
              {user.email && !user.email_verified && (
                <button onClick={resendVerify} className="mt-1.5 text-xs text-pink-400 hover:text-pink-300 transition-colors">
                  Отправить письмо повторно
                </button>
              )}
            </div>
            {settingsMsg && (
              <p className={`text-xs ${settingsMsg.includes("Ошибка") || settingsMsg.includes("занят") ? "text-red-400" : "text-green-400"}`}>
                {settingsMsg}
              </p>
            )}
            {emailMsg && <p className="text-xs text-green-400">{emailMsg}</p>}
            <button onClick={saveSettings} disabled={settingsSaving}
              className="btn-gradient w-full rounded-xl py-3 text-sm font-medium disabled:opacity-50">
              {settingsSaving ? "Сохраняем..." : "Сохранить изменения"}
            </button>
          </div>

          {/* Смена пароля */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-sm font-medium">Сменить пароль</p>
            <input value={oldPassword} onChange={e => setOldPassword(e.target.value)} type="password"
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
              placeholder="Текущий пароль" />
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
              placeholder="Новый пароль" />
            {pwdMsg && (
              <p className={`text-xs ${pwdMsg.includes("Ошибка") || pwdMsg.includes("Неверный") ? "text-red-400" : "text-green-400"}`}>
                {pwdMsg}
              </p>
            )}
            <button onClick={changePassword} disabled={pwdSaving}
              className="btn-gradient w-full rounded-xl py-3 text-sm font-medium disabled:opacity-50">
              {pwdSaving ? "Меняем..." : "Изменить пароль"}
            </button>
          </div>

          {/* Выход */}
          <button onClick={onLogout}
            className="w-full glass rounded-2xl py-3 text-sm font-medium flex items-center justify-center gap-2"
            style={{ color: "rgba(255,100,100,0.7)", border: "1px solid rgba(255,100,100,0.15)" }}>
            <Icon name="LogOut" size={15} />
            Выйти из аккаунта
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── ADMIN SCREEN ───────────────────────────────────────── */
interface AdminWithdrawal {
  id: number; amount: number; method: string; details: string; status: string;
  admin_comment?: string; created_at: string; user_id: number; user_name: string; user_phone: string;
}
interface AdminStats {
  total_commission: number; pending_count: number; pending_amount: number;
  paid_total: number; users_count: number; completed_orders: number;
}

interface AdminBanner {
  id: number; title: string; media_url: string; media_type: string;
  link_url?: string; description?: string; duration_seconds: number;
  is_active: boolean; sort_order: number; contact_email?: string;
  created_at: string; clicks: number;
}

function AdminScreen({ user }: { user: User | null }) {
  const [adminTab, setAdminTab] = useState<"withdrawals" | "banners" | "shops" | "chats" | "users" | "parser" | "articles">("withdrawals");
  const { maintenance, setMaintenance, refresh: refreshMaintenance } = useMaintenance();
  const [maintBusy, setMaintBusy] = useState(false);

  const toggleMaintenance = async () => {
    setMaintBusy(true);
    const next = !maintenance;
    const r = await adminApi.setMaintenance(next);
    setMaintBusy(false);
    if (r.ok) { setMaintenance(next); refreshMaintenance(); }
  };
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  // Баннеры
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [bannerForm, setBannerForm] = useState<Partial<AdminBanner> & { _open?: boolean }>({});
  const [bannerMsg, setBannerMsg] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  // Подписки магазинов
  const [subscriptions, setSubscriptions] = useState<{ id: number; user_id: number; user_name: string; user_email?: string; shop_name?: string; status: string; expires_at?: string; banner_addon: boolean; ai_recommend?: boolean }[]>([]);
  const [subForm, setSubForm] = useState<{ user_id: string; months: number; banner_addon: boolean; deduct_balance: boolean; ai_recommend: boolean }>({ user_id: "", months: 1, banner_addon: false, deduct_balance: false, ai_recommend: false });
  const [subMsg, setSubMsg] = useState("");

  // Чаты (модерация)
  const [chats, setChats] = useState<{ user_a_id: number; user_b_id: number; user_a_name: string; user_b_name: string; last_message: string; last_at: string; total: number; flagged_count: number }[]>([]);
  const [chatsFlaggedOnly, setChatsFlaggedOnly] = useState(false);
  const [openChat, setOpenChat] = useState<{ a: number; b: number; names: string } | null>(null);
  const [chatMsgs, setChatMsgs] = useState<{ id: number; sender_id: number; text: string; created_at: string; is_flagged: boolean; moderation_status: string; moderation_reason?: string; bouquet_title?: string; deal_id?: number }[]>([]);

  // Пользователи (управление)
  type AdminUser = { id: number; name: string; email?: string; phone?: string; city?: string; balance: number; coins: number; is_blocked: boolean; is_admin: boolean; created_at: string; sales_count: number; purchases_count: number; ref_code?: string };
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  type AdminUserDetail = {
    profile: { id: number; name: string; email?: string; phone?: string; city?: string; balance: number; coins: number; is_blocked: boolean; block_reason?: string; ref_earnings?: number; ref_code?: string; created_at?: string };
    subscription?: { status?: string; expires_at?: string; banner_addon?: boolean; shop_name?: string } | null;
    bouquets: { id: number; title: string; current_price?: number; status?: string }[];
    deals: { id: number; amount: number; status: string; role: string; created_at: string }[];
    referrals: { id: number; name: string; created_at: string }[];
    chats: { other_id: number; other_name: string }[];
  };
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userBusy, setUserBusy] = useState(false);

  // Парсер магазинов
  type ParsedShop = { id: number; name: string; city: string; phone?: string; email?: string; website?: string; instagram?: string; address?: string; contacted: boolean; created_at: string };
  const [parserShops, setParserShops] = useState<ParsedShop[]>([]);
  const [parserCity, setParserCity] = useState("");
  const [parserKind, setParserKind] = useState("цветочные магазины");
  const [parserCount, setParserCount] = useState(15);
  const [parserBusy, setParserBusy] = useState(false);
  const [parserMsg, setParserMsg] = useState("");

  // Статьи (генератор + список)
  type AdminArticle = { id: number; slug: string; title: string; excerpt?: string; cover_url?: string; category?: string; is_published: boolean; views: number; created_at: string };
  const [articlesList, setArticlesList] = useState<AdminArticle[]>([]);
  const [artTopic, setArtTopic] = useState("");
  const [artCategory, setArtCategory] = useState("Цветы и романтика");
  const [artBusy, setArtBusy] = useState(false);
  const [artMsg, setArtMsg] = useState("");
  const [artDraft, setArtDraft] = useState<{ id?: number; title: string; excerpt: string; body: string; cover_url: string; category: string; is_published: boolean } | null>(null);
  const [artCoverUploading, setArtCoverUploading] = useState(false);
  const artCoverRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    adminApi.stats().then(r => { if (r.ok) setStats(r.data); });
    adminApi.withdrawals(filter || undefined).then(r => { if (r.ok) setItems(r.data.withdrawals); });
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (adminTab === "banners") bannersApi.adminList().then(r => { if (r.ok) setBanners(r.data.banners); });
    if (adminTab === "shops") adminApi.subscriptions().then(r => { if (r.ok) setSubscriptions(r.data.subscriptions); });
    if (adminTab === "chats") adminApi.chats(chatsFlaggedOnly).then(r => { if (r.ok) setChats(r.data.chats); });
    if (adminTab === "users") adminApi.users().then(r => { if (r.ok) setUsersList(r.data.users); });
    if (adminTab === "parser") shopParserApi.list().then(r => { if (r.ok) setParserShops(r.data.shops); });
    if (adminTab === "articles") articlesApi.adminList().then(r => { if (r.ok) setArticlesList(r.data.articles); });
  }, [adminTab, chatsFlaggedOnly]);

  const loadChat = async (a: number, b: number, names: string) => {
    setOpenChat({ a, b, names });
    setChatMsgs([]);
    const r = await adminApi.chatMessages(a, b);
    if (r.ok) setChatMsgs(r.data.messages);
  };

  // ── Пользователи ──
  const reloadUsers = (q?: string) => adminApi.users(q).then(r => { if (r.ok) setUsersList(r.data.users); });
  const searchUsers = () => reloadUsers(userSearch.trim() || undefined);
  const openUserDetail = async (id: number) => {
    setUserDetail(null);
    const r = await adminApi.userDetail(id);
    if (r.ok) setUserDetail(r.data);
  };
  const blockUserAction = async (id: number) => {
    const reason = prompt("Причина блокировки (необязательно):") ?? undefined;
    setUserBusy(true);
    await adminApi.blockUser(id, reason || undefined);
    setUserBusy(false);
    await openUserDetail(id);
    reloadUsers(userSearch.trim() || undefined);
  };
  const unblockUserAction = async (id: number) => {
    setUserBusy(true);
    await adminApi.unblockUser(id);
    setUserBusy(false);
    await openUserDetail(id);
    reloadUsers(userSearch.trim() || undefined);
  };
  const deleteUserAction = async (id: number) => {
    if (!confirm("Удалить пользователя безвозвратно? Это действие нельзя отменить.")) return;
    setUserBusy(true);
    await adminApi.deleteUser(id);
    setUserBusy(false);
    setUserDetail(null);
    reloadUsers(userSearch.trim() || undefined);
  };

  // ── Парсер магазинов ──
  const runParser = async () => {
    if (!parserCity.trim()) { setParserMsg("Укажите город"); return; }
    setParserBusy(true); setParserMsg("");
    const r = await shopParserApi.parse(parserCity.trim(), parserKind, parserCount);
    setParserBusy(false);
    if (r.ok) {
      setParserMsg(`Сохранено: ${r.data.saved ?? 0}`);
      shopParserApi.list().then(rr => { if (rr.ok) setParserShops(rr.data.shops); });
    } else {
      setParserMsg(r.data.error || "Ошибка парсинга");
    }
  };
  const toggleShopContacted = async (id: number) => {
    await shopParserApi.toggleContacted(id);
    shopParserApi.list().then(r => { if (r.ok) setParserShops(r.data.shops); });
  };
  const deleteShop = async (id: number) => {
    if (!confirm("Удалить магазин из списка?")) return;
    await shopParserApi.delete(id);
    shopParserApi.list().then(r => { if (r.ok) setParserShops(r.data.shops); });
  };

  // ── Статьи ──
  const reloadArticles = () => articlesApi.adminList().then(r => { if (r.ok) setArticlesList(r.data.articles); });
  const generateArticle = async () => {
    if (!artTopic.trim()) { setArtMsg("Укажите тему"); return; }
    setArtBusy(true); setArtMsg("");
    const r = await articlesApi.generate(artTopic.trim(), artCategory);
    setArtBusy(false);
    if (r.ok && r.data.draft) {
      const d = r.data.draft;
      setArtDraft({ title: d.title || "", excerpt: d.excerpt || "", body: d.body || "", cover_url: "", category: d.category || artCategory, is_published: false });
    } else {
      setArtMsg(r.data.error || "Ошибка генерации");
    }
  };
  const newEmptyDraft = () => setArtDraft({ title: "", excerpt: "", body: "", cover_url: "", category: artCategory, is_published: false });
  const editArticle = (a: AdminArticle) => {
    setArtDraft({ id: a.id, title: a.title, excerpt: a.excerpt || "", body: "", cover_url: a.cover_url || "", category: a.category || artCategory, is_published: a.is_published });
    setArtMsg("Откройте тело статьи для редактирования (загрузится текущий черновик)");
  };
  const uploadArtCover = async (file: File) => {
    if (!file || !artDraft) return;
    setArtCoverUploading(true);
    const url = await uploadApi.upload(file);
    setArtCoverUploading(false);
    if (url) setArtDraft({ ...artDraft, cover_url: url });
  };
  const saveArticle = async () => {
    if (!artDraft) return;
    if (!artDraft.title.trim() || !artDraft.body.trim()) { setArtMsg("Заполните заголовок и текст"); return; }
    setArtBusy(true); setArtMsg("");
    const r = await articlesApi.save({
      id: artDraft.id,
      title: artDraft.title,
      excerpt: artDraft.excerpt,
      body: artDraft.body,
      cover_url: artDraft.cover_url || undefined,
      category: artDraft.category,
      is_published: artDraft.is_published,
    });
    setArtBusy(false);
    if (r.ok) { setArtMsg("Сохранено"); setArtDraft(null); reloadArticles(); }
    else setArtMsg(r.data.error || "Ошибка сохранения");
  };
  const deleteArticle = async (id: number) => {
    if (!confirm("Удалить статью?")) return;
    await articlesApi.delete(id);
    reloadArticles();
  };

  const act = async (id: number, type: "approve" | "reject") => {
    setBusy(id);
    const r = type === "approve" ? await adminApi.approve(id) : await adminApi.reject(id);
    setBusy(null);
    setMsg(r.ok ? r.data.message : (r.data.error || "Ошибка"));
    if (r.ok) load();
  };

  const saveBanner = async () => {
    setBannerMsg("");
    if (!bannerForm.title || !bannerForm.media_url) { setBannerMsg("Укажите название и файл"); return; }
    const r = bannerForm.id
      ? await bannersApi.update({ id: bannerForm.id, ...bannerForm })
      : await bannersApi.create({
          title: bannerForm.title!, media_url: bannerForm.media_url!,
          media_type: bannerForm.media_type || "image",
          link_url: bannerForm.link_url, description: bannerForm.description,
          duration_seconds: bannerForm.duration_seconds || 5,
          is_active: bannerForm.is_active !== false,
          sort_order: bannerForm.sort_order || 0,
          contact_email: bannerForm.contact_email,
        });
    if (r.ok) {
      setBannerMsg("Сохранено!");
      setBannerForm({});
      bannersApi.adminList().then(res => { if (res.ok) setBanners(res.data.banners); });
    } else setBannerMsg(r.data.error || "Ошибка");
  };

  const deleteBanner = async (id: number) => {
    await bannersApi.delete(id);
    bannersApi.adminList().then(r => { if (r.ok) setBanners(r.data.banners); });
  };

  const toggleBanner = async (b: AdminBanner) => {
    await bannersApi.update({ id: b.id, is_active: !b.is_active });
    bannersApi.adminList().then(r => { if (r.ok) setBanners(r.data.banners); });
  };

  const activateSub = async () => {
    if (!subForm.user_id) { setSubMsg("Укажите ID пользователя"); return; }
    const r = await adminApi.activateSubscription(parseInt(subForm.user_id), subForm.months, subForm.banner_addon, subForm.deduct_balance, subForm.ai_recommend);
    if (r.ok) {
      const deducted = r.data.deducted || 0;
      setSubMsg(`Подписка активирована!${deducted > 0 ? ` Списано ${deducted.toLocaleString("ru-RU")} ₽` : ""}`);
      adminApi.subscriptions().then(res => { if (res.ok) setSubscriptions(res.data.subscriptions); });
    } else {
      setSubMsg(r.data.error || "Ошибка");
    }
  };

  const methodLabel: Record<string, string> = { card: "Карта", sbp: "СБП", wallet: "Кошелёк" };
  const statusLabel: Record<string, string> = { pending: "В обработке", paid: "Выплачено", rejected: "Отклонено" };
  const statusColor: Record<string, string> = { pending: "text-yellow-400", paid: "text-green-400", rejected: "text-red-400" };

  if (!user?.is_admin) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🔒</span>
      <p className="text-white/50 font-oswald text-xl">Доступ только для администратора</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-3">Админ-панель</h2>

      <div className="glass rounded-2xl p-4 mb-4"
        style={{ border: maintenance ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(74,222,128,0.3)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: maintenance ? "rgba(245,158,11,0.15)" : "rgba(74,222,128,0.15)" }}>
            <Icon name={maintenance ? "Wrench" : "CheckCircle2"} size={18} style={{ color: maintenance ? "#fbbf24" : "#4ade80" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">Режим доработки</p>
            <p className="text-white/40 text-xs">{maintenance ? "Покупки, продажи и оплаты отключены" : "Все денежные функции работают"}</p>
          </div>
          <button onClick={toggleMaintenance} disabled={maintBusy}
            className="relative w-12 h-7 rounded-full transition-all flex-shrink-0 disabled:opacity-50"
            style={{ background: maintenance ? "#f59e0b" : "rgba(255,255,255,0.15)" }}>
            <span className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: maintenance ? "26px" : "4px" }} />
          </button>
        </div>
      </div>

      <a href="/investor"
        className="flex items-center gap-3 mb-4 rounded-2xl p-4 transition-all hover:scale-[1.01]"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.18), rgba(168,85,247,0.18))", border: "1px solid rgba(255,61,139,0.3)" }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--grad-main)" }}>
          <Icon name="TrendingUp" size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-oswald text-base font-bold text-white">Инвестиционная стратегия</p>
          <p className="text-white/50 text-xs">Оценка, команда, бюджет, переговоры с инвестором</p>
        </div>
        <Icon name="ChevronRight" size={20} className="text-white/40" />
      </a>

      {stats && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Комиссия", val: formatPrice(stats.total_commission), color: "gradient-text" },
            { label: `Выводов (${stats.pending_count})`, val: formatPrice(stats.pending_amount), color: "text-yellow-400" },
            { label: "Пользователей", val: stats.users_count, color: "text-white" },
            { label: "Сделок", val: stats.completed_orders, color: "text-white" },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl p-3">
              <p className={`font-oswald text-xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {([["withdrawals", "Выводы"], ["banners", "Баннеры"], ["shops", "Магазины"], ["chats", "Чаты"], ["users", "Пользователи"], ["parser", "Парсер"], ["articles", "Статьи"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setAdminTab(k)}
            className="flex-1 min-w-[70px] py-2.5 rounded-xl text-xs font-medium transition-all"
            style={adminTab === k ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            {l}
          </button>
        ))}
      </div>

      {adminTab === "withdrawals" && (
        <div>
          {msg && <p className="text-sm mb-3 text-center text-pink-400">{msg}</p>}
          <div className="flex gap-2 mb-4">
            {[["pending", "Новые"], ["paid", "Выплачено"], ["rejected", "Отклонено"], ["", "Все"]].map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                style={filter === f ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                {l}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <div className="text-center py-12"><span className="text-4xl block mb-3">📭</span><p className="text-white/40 text-sm">Нет заявок</p></div>
          ) : (
            <div className="space-y-3">
              {items.map(w => (
                <div key={w.id} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="text-white font-medium">{w.user_name}</p><p className="text-white/40 text-xs">{w.user_phone}</p></div>
                    <span className={`text-xs ${statusColor[w.status]}`}>{statusLabel[w.status] || w.status}</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="gradient-text font-oswald text-xl font-bold">{formatPrice(w.amount)}</span>
                    <span className="text-white/50 text-sm">{methodLabel[w.method] || w.method}</span>
                  </div>
                  <div className="glass rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                    <Icon name="CreditCard" size={14} className="text-white/30" />
                    <span className="text-white/70 text-sm font-mono">{w.details}</span>
                  </div>
                  {w.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => act(w.id, "approve")} disabled={busy === w.id}
                        className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white" style={{ background: "rgba(34,197,94,0.8)" }}>Выплачено</button>
                      <button onClick={() => act(w.id, "reject")} disabled={busy === w.id}
                        className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white" style={{ background: "rgba(239,68,68,0.8)" }}>Отклонить</button>
                    </div>
                  )}
                  <p className="text-white/30 text-xs mt-2">{new Date(w.created_at).toLocaleString("ru-RU")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === "banners" && (
        <div className="space-y-3">
          <input ref={bannerFileRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              setBannerUploading(true);
              const url = await uploadApi.upload(f);
              setBannerUploading(false);
              if (url) setBannerForm(p => ({ ...p, media_url: url, media_type: f.type.startsWith("video") ? "video" : "image" }));
            }} />

          <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
            <p className="text-white/50 text-sm font-medium mb-3">{bannerForm.id ? "Редактировать баннер" : "Добавить баннер"}</p>
            <div className="space-y-2">
              <input value={bannerForm.title || ""} onChange={e => setBannerForm(p => ({ ...p, title: e.target.value }))}
                className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="Название баннера" />
              <div className="flex gap-2">
                <div className="flex-1 glass rounded-xl px-3 py-2.5 flex items-center gap-2 cursor-pointer" onClick={() => bannerFileRef.current?.click()}>
                  {bannerUploading
                    ? <div className="animate-spin rounded-full w-4 h-4 border-2 border-pink-400 border-t-transparent" />
                    : <Icon name="Upload" size={14} className="text-white/40" />}
                  <span className="text-white/50 text-xs truncate">{bannerForm.media_url ? "Файл загружен ✓" : "Загрузить фото/видео"}</span>
                </div>
                <select value={bannerForm.media_type || "image"} onChange={e => setBannerForm(p => ({ ...p, media_type: e.target.value }))}
                  className="glass rounded-xl px-3 py-2.5 text-white/70 text-xs outline-none bg-transparent">
                  <option value="image">Фото</option>
                  <option value="video">Видео</option>
                </select>
              </div>
              <input value={bannerForm.link_url || ""} onChange={e => setBannerForm(p => ({ ...p, link_url: e.target.value }))}
                className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="Ссылка при клике (необязательно)" />
              <input value={bannerForm.description || ""} onChange={e => setBannerForm(p => ({ ...p, description: e.target.value }))}
                className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="Описание (необязательно)" />
              <input value={bannerForm.contact_email || ""} onChange={e => setBannerForm(p => ({ ...p, contact_email: e.target.value }))}
                className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="Email рекламодателя" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-white/40 text-xs block mb-1">Длительность (сек)</label>
                  <input type="number" min="1" max="30" value={bannerForm.duration_seconds || 5}
                    onChange={e => setBannerForm(p => ({ ...p, duration_seconds: parseInt(e.target.value) }))}
                    className="glass w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-white/40 text-xs block mb-1">Порядок</label>
                  <input type="number" min="0" value={bannerForm.sort_order || 0}
                    onChange={e => setBannerForm(p => ({ ...p, sort_order: parseInt(e.target.value) }))}
                    className="glass w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-white/40 text-xs block mb-1">Активен</label>
                  <button onClick={() => setBannerForm(p => ({ ...p, is_active: !p.is_active }))}
                    className="w-full rounded-xl py-2.5 text-sm transition-all"
                    style={bannerForm.is_active !== false ? { background: "rgba(34,197,94,0.2)", color: "#4ade80" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                    {bannerForm.is_active !== false ? "Вкл" : "Выкл"}
                  </button>
                </div>
              </div>
            </div>
            {bannerMsg && <p className={`text-xs mt-2 ${bannerMsg.includes("Сохранено") ? "text-green-400" : "text-red-400"}`}>{bannerMsg}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={saveBanner} className="btn-gradient flex-1 rounded-xl py-2.5 text-sm font-oswald">
                {bannerForm.id ? "СОХРАНИТЬ" : "ДОБАВИТЬ"}
              </button>
              {bannerForm.id && (
                <button onClick={() => setBannerForm({})} className="glass rounded-xl px-4 py-2.5 text-white/50 text-sm">Отмена</button>
              )}
            </div>
          </div>

          {banners.length === 0 ? (
            <div className="text-center py-8"><span className="text-3xl block mb-2">🖼</span><p className="text-white/30 text-sm">Баннеров нет</p></div>
          ) : (
            <div className="space-y-2">
              {banners.map(b => (
                <div key={b.id} className="glass rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-14 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                    {b.media_type === "video"
                      ? <div className="w-full h-full flex items-center justify-center text-white/40"><Icon name="Play" size={16} /></div>
                      : <img src={b.media_url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{b.title}</p>
                    <p className="text-white/40 text-xs">{b.duration_seconds}с · {b.clicks} кликов · {b.is_active ? "активен" : "выкл"}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleBanner(b)}
                      className="rounded-lg px-2 py-1.5 text-xs transition-all"
                      style={b.is_active ? { background: "rgba(34,197,94,0.15)", color: "#4ade80" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
                      {b.is_active ? "Вкл" : "Выкл"}
                    </button>
                    <button onClick={() => setBannerForm({ ...b })} className="glass rounded-lg px-2 py-1.5 text-white/50 text-xs">✏️</button>
                    <button onClick={() => deleteBanner(b.id)} className="rounded-lg px-2 py-1.5 text-xs" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === "shops" && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(168,85,247,0.2)" }}>
            <p className="text-white/50 text-sm font-medium mb-3">Активировать подписку</p>
            <div className="space-y-2">
              <input value={subForm.user_id} onChange={e => setSubForm(p => ({ ...p, user_id: e.target.value }))}
                className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="ID пользователя" type="number" />
              <div>
                <label className="text-white/40 text-xs block mb-1">Срок подписки</label>
                <div className="flex gap-1.5 flex-wrap">
                  {MONTH_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setSubForm(p => ({ ...p, months: opt.value }))}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                      style={subForm.months === opt.value
                        ? { background: "var(--grad-main)", color: "#fff" }
                        : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                      {opt.label}
                      {opt.discount ? <span className="ml-1 text-green-400">−{opt.discount}%</span> : null}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1">+ Баннеры</label>
                <button onClick={() => setSubForm(p => ({ ...p, banner_addon: !p.banner_addon }))}
                  className="w-full rounded-xl py-2.5 text-sm transition-all"
                  style={subForm.banner_addon ? { background: "rgba(255,61,139,0.2)", color: "#ff3d8b" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                  {subForm.banner_addon ? "Баннеры включены" : "Без баннеров"}
                </button>
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1">+ AI-рекомендации букетов</label>
                <button onClick={() => setSubForm(p => ({ ...p, ai_recommend: !p.ai_recommend }))}
                  className="w-full rounded-xl py-2.5 text-sm transition-all"
                  style={subForm.ai_recommend ? { background: "rgba(168,85,247,0.2)", color: "#a855f7" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                  {subForm.ai_recommend ? "AI-продвижение включено" : "Без AI-продвижения"}
                </button>
              </div>
              <PriceBreakdown
                basePrice={1990 + (subForm.banner_addon ? 990 : 0) + (subForm.ai_recommend ? 1490 : 0)}
                months={subForm.months}
                label="Итоговая сумма"
              />
              <button onClick={() => setSubForm(p => ({ ...p, deduct_balance: !p.deduct_balance }))}
                className="w-full rounded-xl py-2.5 text-sm transition-all flex items-center justify-center gap-2"
                style={subForm.deduct_balance ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                <Icon name={subForm.deduct_balance ? "CheckSquare" : "Square"} size={14} />
                {subForm.deduct_balance ? "Списать с баланса пользователя" : "Активировать без списания"}
              </button>
            </div>
            {subMsg && <p className={`text-xs mt-2 ${subMsg.includes("активирована") ? "text-green-400" : "text-red-400"}`}>{subMsg}</p>}
            <button onClick={activateSub} className="btn-gradient w-full rounded-xl py-2.5 mt-3 text-sm font-oswald">АКТИВИРОВАТЬ</button>
          </div>

          {subscriptions.length === 0 ? (
            <div className="text-center py-8"><span className="text-3xl block mb-2">🏪</span><p className="text-white/30 text-sm">Подписок нет</p></div>
          ) : (
            <div className="space-y-2">
              {subscriptions.map(s => (
                <div key={s.id} className="glass rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white text-sm font-medium">{s.shop_name || s.user_name}</p>
                    <span className={`text-xs ${s.status === "active" ? "text-green-400" : "text-white/30"}`}>{s.status === "active" ? "Активна" : "Неактивна"}</span>
                  </div>
                  <p className="text-white/40 text-xs">ID: {s.user_id} · {s.user_email || "—"}</p>
                  {s.expires_at && <p className="text-white/30 text-xs">До: {new Date(s.expires_at).toLocaleDateString("ru-RU")}</p>}
                  <div className="flex gap-2 mt-1">
                    {s.banner_addon && <span className="text-xs text-pink-400">+ баннеры</span>}
                    {s.ai_recommend && <span className="text-xs" style={{ color: "#a855f7" }}>+ AI-реклама</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === "chats" && (
        <div className="space-y-3">
          {openChat ? (
            <div>
              <button onClick={() => setOpenChat(null)} className="flex items-center gap-1 text-white/50 text-sm mb-3">
                <Icon name="ChevronLeft" size={16} /> Все чаты
              </button>
              <p className="text-white font-medium text-sm mb-1">{openChat.names}</p>
              <p className="text-white/30 text-xs mb-3">Полная переписка фиксируется и хранится</p>
              <div className="space-y-2">
                {chatMsgs.length === 0 ? (
                  <p className="text-white/20 text-xs text-center py-6">Загрузка...</p>
                ) : chatMsgs.map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === openChat.a ? "justify-start" : "justify-end"}`}>
                    <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm"
                      style={m.is_flagged
                        ? { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#fde68a" }
                        : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)" }}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] opacity-50">{new Date(m.created_at).toLocaleString("ru-RU")}</span>
                        {m.deal_id && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.2)", color: "#c4b5fd" }}>Сделка #{m.deal_id}</span>}
                        {m.bouquet_title && <span className="text-[10px] opacity-40 truncate max-w-[120px]">🌷 {m.bouquet_title}</span>}
                        {m.is_flagged && <span className="text-[10px] text-amber-400">⚠ {m.moderation_reason || "флаг модерации"}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setChatsFlaggedOnly(v => !v)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
                style={chatsFlaggedOnly ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                <Icon name={chatsFlaggedOnly ? "CheckSquare" : "Square"} size={14} />
                Только с пометками модерации
              </button>
              {chats.length === 0 ? (
                <div className="text-center py-10"><span className="text-3xl block mb-2">💬</span><p className="text-white/30 text-sm">Чатов нет</p></div>
              ) : (
                <div className="space-y-2">
                  {chats.map(c => (
                    <button key={`${c.user_a_id}-${c.user_b_id}`}
                      onClick={() => loadChat(c.user_a_id, c.user_b_id, `${c.user_a_name} ↔ ${c.user_b_name}`)}
                      className="w-full glass rounded-2xl p-3 text-left hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white text-sm font-medium truncate">{c.user_a_name} ↔ {c.user_b_name}</p>
                        {c.flagged_count > 0 && <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24" }}>⚠ {c.flagged_count}</span>}
                      </div>
                      <p className="text-white/40 text-xs truncate">{c.last_message}</p>
                      <p className="text-white/25 text-[10px] mt-1">{c.total} сообщений · ID {c.user_a_id}/{c.user_b_id} · {new Date(c.last_at).toLocaleDateString("ru-RU")}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {adminTab === "users" && (
        <div className="space-y-3">
          {userDetail ? (
            <div className="glass rounded-2xl p-4 space-y-4">
              <button onClick={() => setUserDetail(null)} className="flex items-center gap-1 text-white/50 text-sm">
                <Icon name="ChevronLeft" size={16} /> К списку
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-oswald text-lg font-bold">{userDetail.profile.name}</p>
                  {userDetail.profile.is_blocked && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>Заблокирован</span>}
                </div>
                <p className="text-white/40 text-xs mt-0.5">ID: {userDetail.profile.id} · {userDetail.profile.email || "—"} · {userDetail.profile.phone || "—"}</p>
                {userDetail.profile.block_reason && <p className="text-red-400 text-xs mt-1">Причина: {userDetail.profile.block_reason}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="glass rounded-xl p-2.5"><p className="font-oswald text-lg font-bold text-white">{formatPrice(userDetail.profile.balance)}</p><p className="text-white/40 text-[11px]">Баланс</p></div>
                <div className="glass rounded-xl p-2.5"><p className="font-oswald text-lg font-bold" style={{ color: "#ec4899" }}>{userDetail.profile.coins ?? 0} 🌸</p><p className="text-white/40 text-[11px]">Лепестки</p></div>
                <div className="glass rounded-xl p-2.5"><p className="font-oswald text-lg font-bold" style={{ color: "#a855f7" }}>{formatPrice(userDetail.profile.ref_earnings || 0)}</p><p className="text-white/40 text-[11px]">Реф. доход</p></div>
                <div className="glass rounded-xl p-2.5"><p className="font-oswald text-lg font-bold text-white tracking-widest">{userDetail.profile.ref_code || "—"}</p><p className="text-white/40 text-[11px]">Реф. код</p></div>
              </div>

              {userDetail.subscription && (
                <div className="glass rounded-xl p-3">
                  <p className="text-white/50 text-xs font-medium mb-1">Подписка магазина</p>
                  <p className="text-white/70 text-sm">{userDetail.subscription.shop_name || "—"} · {userDetail.subscription.status || "—"}</p>
                  {userDetail.subscription.expires_at && <p className="text-white/30 text-xs">До: {new Date(userDetail.subscription.expires_at).toLocaleDateString("ru-RU")}</p>}
                </div>
              )}

              <div>
                <p className="text-white/50 text-xs font-medium mb-2">Букеты ({userDetail.bouquets.length})</p>
                {userDetail.bouquets.length === 0 ? <p className="text-white/25 text-xs">Нет</p> : (
                  <div className="space-y-1.5">
                    {userDetail.bouquets.map(b => (
                      <div key={b.id} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-white/70 text-sm truncate">{b.title}</span>
                        <span className="text-white/40 text-xs flex-shrink-0">{b.current_price != null ? formatPrice(b.current_price) : ""} · {b.status || ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-white/50 text-xs font-medium mb-2">Сделки ({userDetail.deals.length})</p>
                {userDetail.deals.length === 0 ? <p className="text-white/25 text-xs">Нет</p> : (
                  <div className="space-y-1.5">
                    {userDetail.deals.map(d => (
                      <div key={d.id} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-white/70 text-sm">#{d.id} · {d.role === "seller" ? "Продавец" : "Покупатель"}</span>
                        <span className="text-white/40 text-xs flex-shrink-0">{formatPrice(d.amount)} · {d.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-white/50 text-xs font-medium mb-2">Кого привёл ({userDetail.referrals.length})</p>
                {userDetail.referrals.length === 0 ? <p className="text-white/25 text-xs">Нет</p> : (
                  <div className="space-y-1.5">
                    {userDetail.referrals.map(rf => (
                      <div key={rf.id} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-white/70 text-sm truncate">{rf.name}</span>
                        <span className="text-white/30 text-xs flex-shrink-0">{new Date(rf.created_at).toLocaleDateString("ru-RU")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-white/50 text-xs font-medium mb-2">Чаты ({userDetail.chats.length})</p>
                {userDetail.chats.length === 0 ? <p className="text-white/25 text-xs">Нет</p> : (
                  <div className="space-y-1.5">
                    {userDetail.chats.map(c => (
                      <div key={c.other_id} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-white/70 text-sm truncate">{c.other_name}</span>
                        <span className="text-white/30 text-xs flex-shrink-0">ID {c.other_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap pt-1">
                {userDetail.profile.is_blocked ? (
                  <button disabled={userBusy} onClick={() => unblockUserAction(userDetail.profile.id)}
                    className="flex-1 min-w-[120px] rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 glass"
                    style={{ color: "#4ade80" }}>
                    <Icon name="UserCheck" size={15} /> Разблокировать
                  </button>
                ) : (
                  <button disabled={userBusy} onClick={() => blockUserAction(userDetail.profile.id)}
                    className="flex-1 min-w-[120px] rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 glass"
                    style={{ color: "#fbbf24" }}>
                    <Icon name="UserX" size={15} /> Блокировать
                  </button>
                )}
                <button disabled={userBusy} onClick={() => deleteUserAction(userDetail.profile.id)}
                  className="flex-1 min-w-[120px] rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 glass"
                  style={{ color: "#f87171" }}>
                  <Icon name="Trash2" size={15} /> Удалить
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") searchUsers(); }}
                  placeholder="Поиск: имя, email, телефон"
                  className="flex-1 glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
                <button onClick={searchUsers}
                  className="px-4 rounded-xl text-sm font-medium flex items-center gap-2"
                  style={{ background: "var(--grad-main)", color: "#fff" }}>
                  <Icon name="Search" size={15} /> Найти
                </button>
              </div>
              {usersList.length === 0 ? (
                <div className="text-center py-10"><span className="text-3xl block mb-2">👥</span><p className="text-white/30 text-sm">Пользователей нет</p></div>
              ) : (
                <div className="space-y-2">
                  {usersList.map(u => (
                    <div key={u.id} className="glass rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-sm font-medium truncate">{u.name}</p>
                            {u.is_admin && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.2)", color: "#c4b5fd" }}>admin</span>}
                            {u.is_blocked && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>блок</span>}
                          </div>
                          <p className="text-white/40 text-xs truncate">{u.email || "—"} · {u.phone || "—"}</p>
                          <p className="text-white/30 text-[11px] mt-0.5">{formatPrice(u.balance)} · {u.coins ?? 0} 🌸 · ID {u.id}</p>
                        </div>
                        <button onClick={() => openUserDetail(u.id)}
                          className="flex-shrink-0 glass rounded-xl px-3 py-2 text-xs font-medium text-white/60 flex items-center gap-1">
                          <Icon name="Eye" size={13} /> Подробнее
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {adminTab === "parser" && (
        <div className="space-y-3">
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-sm font-medium flex items-center gap-2">
              <Icon name="Store" size={14} /> Парсер магазинов
            </p>
            <input value={parserCity} onChange={e => setParserCity(e.target.value)}
              placeholder="Город (например, Москва)"
              className="w-full glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
            <div className="flex gap-2">
              <select value={parserKind} onChange={e => setParserKind(e.target.value)}
                className="flex-1 glass rounded-xl px-3 py-2.5 text-white/70 text-sm outline-none bg-transparent">
                <option value="цветочные магазины" className="bg-gray-900">Цветочные магазины</option>
                <option value="свадебные агентства" className="bg-gray-900">Свадебные агентства</option>
              </select>
              <input type="number" min={1} max={50} value={parserCount}
                onChange={e => setParserCount(parseInt(e.target.value) || 1)}
                className="w-20 glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent" />
            </div>
            <button disabled={parserBusy} onClick={runParser}
              className="w-full rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2"
              style={{ background: "var(--grad-main)", color: "#fff", opacity: parserBusy ? 0.6 : 1 }}>
              <Icon name="Sparkles" size={15} /> {parserBusy ? "Сбор данных..." : "Запустить парсинг"}
            </button>
            {parserMsg && <p className="text-sm text-center text-pink-400">{parserMsg}</p>}
            <button onClick={() => window.open(shopParserApi.exportUrl(parserCity.trim() || undefined))}
              className="w-full glass rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 text-white/60">
              <Icon name="Download" size={15} /> Скачать CSV
            </button>
            <p className="text-white/30 text-[11px] leading-relaxed">
              Данные собираются с помощью ИИ и могут содержать неточности — проверяйте контакты перед использованием.
            </p>
          </div>

          {parserShops.length === 0 ? (
            <div className="text-center py-10"><span className="text-3xl block mb-2">🏪</span><p className="text-white/30 text-sm">Магазинов нет</p></div>
          ) : (
            <div className="space-y-2">
              {parserShops.map(s => (
                <div key={s.id} className="glass rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-white text-sm font-medium truncate">{s.name}</p>
                    {s.contacted && <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(74,222,128,0.18)", color: "#4ade80" }}>связались</span>}
                  </div>
                  <p className="text-white/40 text-xs">{s.city}{s.address ? ` · ${s.address}` : ""}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {s.phone && <span className="text-white/50 text-xs">📞 {s.phone}</span>}
                    {s.email && <span className="text-white/50 text-xs">✉ {s.email}</span>}
                    {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="text-xs" style={{ color: "#a855f7" }}>🌐 сайт</a>}
                    {s.instagram && <span className="text-white/50 text-xs">📷 {s.instagram}</span>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => toggleShopContacted(s.id)}
                      className="flex-1 glass rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1.5"
                      style={{ color: s.contacted ? "#4ade80" : "rgba(255,255,255,0.5)" }}>
                      <Icon name={s.contacted ? "CheckSquare" : "Square"} size={13} /> Связались
                    </button>
                    <button onClick={() => deleteShop(s.id)}
                      className="glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                      style={{ color: "#f87171" }}>
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === "articles" && (
        <div className="space-y-3">
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-sm font-medium flex items-center gap-2">
              <Icon name="Sparkles" size={14} /> Генератор статей
            </p>
            <input value={artTopic} onChange={e => setArtTopic(e.target.value)}
              placeholder="Тема статьи"
              className="w-full glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
            <input value={artCategory} onChange={e => setArtCategory(e.target.value)}
              placeholder="Категория"
              className="w-full glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
            <div className="flex gap-2">
              <button disabled={artBusy} onClick={generateArticle}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: "var(--grad-main)", color: "#fff", opacity: artBusy ? 0.6 : 1 }}>
                <Icon name="Sparkles" size={15} /> {artBusy ? "Генерация..." : "Сгенерировать через AI"}
              </button>
              <button onClick={newEmptyDraft}
                className="glass rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 flex items-center gap-2">
                <Icon name="FileText" size={15} /> Вручную
              </button>
            </div>
            {artMsg && <p className="text-sm text-center text-pink-400">{artMsg}</p>}
          </div>

          {artDraft && (
            <div className="glass rounded-2xl p-4 space-y-3" style={{ border: "1px solid rgba(255,61,139,0.15)" }}>
              <p className="text-white/50 text-sm font-medium">{artDraft.id ? "Редактирование статьи" : "Черновик"}</p>
              <input value={artDraft.title} onChange={e => setArtDraft({ ...artDraft, title: e.target.value })}
                placeholder="Заголовок"
                className="w-full glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
              <input value={artDraft.excerpt} onChange={e => setArtDraft({ ...artDraft, excerpt: e.target.value })}
                placeholder="Краткое описание"
                className="w-full glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
              <textarea value={artDraft.body} onChange={e => setArtDraft({ ...artDraft, body: e.target.value })}
                placeholder="Текст статьи"
                rows={10}
                className="w-full glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30 resize-y" />
              <input value={artDraft.category} onChange={e => setArtDraft({ ...artDraft, category: e.target.value })}
                placeholder="Категория"
                className="w-full glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
              <div className="flex items-center gap-2">
                <input value={artDraft.cover_url} onChange={e => setArtDraft({ ...artDraft, cover_url: e.target.value })}
                  placeholder="URL обложки"
                  className="flex-1 glass rounded-xl px-3 py-2.5 text-white text-sm outline-none bg-transparent placeholder:text-white/30" />
                <button onClick={() => artCoverRef.current?.click()}
                  className="glass rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 flex items-center gap-2">
                  <Icon name="Upload" size={15} /> {artCoverUploading ? "..." : "Загрузить"}
                </button>
                <input ref={artCoverRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadArtCover(f); }} />
              </div>
              {artDraft.cover_url && <img src={artDraft.cover_url} alt="" className="w-full h-32 object-cover rounded-xl" />}
              <label className="flex items-center gap-2 text-white/60 text-sm cursor-pointer">
                <input type="checkbox" checked={artDraft.is_published} onChange={e => setArtDraft({ ...artDraft, is_published: e.target.checked })} />
                Опубликовать
              </label>
              <div className="flex gap-2">
                <button disabled={artBusy} onClick={saveArticle}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                  style={{ background: "var(--grad-main)", color: "#fff", opacity: artBusy ? 0.6 : 1 }}>
                  <Icon name="Check" size={15} /> Сохранить
                </button>
                <button onClick={() => setArtDraft(null)}
                  className="glass rounded-xl px-4 py-2.5 text-sm font-medium text-white/50">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {articlesList.length === 0 ? (
            <div className="text-center py-10"><span className="text-3xl block mb-2">📝</span><p className="text-white/30 text-sm">Статей нет</p></div>
          ) : (
            <div className="space-y-2">
              {articlesList.map(a => (
                <div key={a.id} className="glass rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-white text-sm font-medium truncate">{a.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={a.is_published ? { background: "rgba(74,222,128,0.18)", color: "#4ade80" } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                      {a.is_published ? "опубл." : "черновик"}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs truncate">{a.excerpt || "—"}</p>
                  <p className="text-white/30 text-[11px] mt-0.5">{a.category || "—"} · 👁 {a.views} · {new Date(a.created_at).toLocaleDateString("ru-RU")}</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => editArticle(a)}
                      className="flex-1 glass rounded-lg py-1.5 text-xs font-medium text-white/60 flex items-center justify-center gap-1.5">
                      <Icon name="Pencil" size={13} /> Редактировать
                    </button>
                    <button onClick={() => deleteArticle(a.id)}
                      className="glass rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                      style={{ color: "#f87171" }}>
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Рассылка уведомлений */}
      <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,61,139,0.15)" }}>
        <p className="text-white/50 text-sm font-medium mb-3">Отправить уведомление</p>
        <AdminNotifyForm />
      </div>

      <a href="https://flowerflip.ru/partners" target="_blank" rel="noreferrer"
        className="flex items-center gap-2 glass rounded-2xl px-4 py-3 mt-4 text-sm font-medium"
        style={{ color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>
        <Icon name="Presentation" size={16} />
        Страница для партнёров
      </a>
    </div>
  );
}

function AdminNotifyForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [broadcast, setBroadcast] = useState(true);
  const [userId, setUserId] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title || !body) { setMsg("Заполните заголовок и текст"); return; }
    setSending(true); setMsg("");
    const r = await notificationsApi.send({
      type,
      title,
      body,
      ...(broadcast ? { broadcast: true } : { user_id: parseInt(userId) }),
    });
    setSending(false);
    setMsg(r.ok ? `Отправлено: ${r.data.sent} получателей` : (r.data.error || "Ошибка"));
    if (r.ok) { setTitle(""); setBody(""); }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={type} onChange={e => setType(e.target.value)}
          className="glass rounded-xl px-3 py-2.5 text-white/70 text-xs outline-none bg-transparent flex-shrink-0">
          <option value="info" className="bg-gray-900">Инфо</option>
          <option value="system" className="bg-gray-900">Системное</option>
          <option value="banner" className="bg-gray-900">Реклама</option>
          <option value="sale" className="bg-gray-900">Продажа</option>
          <option value="shop" className="bg-gray-900">Магазины</option>
        </select>
        <button onClick={() => setBroadcast(b => !b)}
          className="flex-1 rounded-xl px-3 py-2.5 text-xs font-medium transition-all"
          style={broadcast ? { background: "rgba(255,61,139,0.2)", color: "#ff3d8b" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
          {broadcast ? "Всем пользователям" : "Конкретному ID"}
        </button>
      </div>
      {!broadcast && (
        <input value={userId} onChange={e => setUserId(e.target.value)} type="number"
          className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="ID пользователя" />
      )}
      <input value={title} onChange={e => setTitle(e.target.value)}
        className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
        placeholder="Заголовок уведомления" />
      <textarea value={body} onChange={e => setBody(e.target.value)}
        className="glass w-full rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm outline-none resize-none"
        placeholder="Текст уведомления" rows={2} />
      {msg && <p className={`text-xs ${msg.includes("Отправлено") ? "text-green-400" : "text-red-400"}`}>{msg}</p>}
      <button onClick={send} disabled={sending}
        className="btn-gradient w-full rounded-xl py-2.5 text-sm font-oswald tracking-wide disabled:opacity-50">
        {sending ? "ОТПРАВКА..." : "ОТПРАВИТЬ"}
      </button>
    </div>
  );
}

/* ─── ROOT ───────────────────────────────────────────────── */
export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState("auctions");
  const [bidModal, setBidModal] = useState<Bouquet | null>(null);
  const [showCoins, setShowCoins] = useState(false);
  const { maintenance } = useMaintenance();
  const { show: showOnboarding, start: startOnboarding, finish: finishOnboarding, triggerIfNew } = useOnboarding();

  useEffect(() => {
    const token = localStorage.getItem("ff_token");
    if (!token) { setAuthChecked(true); return; }
    authApi.me().then(r => {
      if (r.ok) setUser(r.data.user);
      else localStorage.removeItem("ff_token");
      setAuthChecked(true);
    });
  }, []);

  // Запускаем онбординг при первом входе — навигация уже отрендерена
  useEffect(() => {
    if (user && authChecked) triggerIfNew();
  }, [user, authChecked, triggerIfNew]);

  // Обработка подтверждения email (?verify_email=TOKEN)
  const [verifyMsg, setVerifyMsg] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vtoken = params.get("verify_email");
    if (!vtoken) return;
    authApi.verifyEmail(vtoken).then(r => {
      setVerifyMsg(r.ok ? "✅ Email подтверждён!" : (r.data.error || "Ссылка недействительна"));
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, []);

  // Сброс пароля (?reset_password=TOKEN)
  const [resetToken, setResetToken] = useState("");
  const [resetPwd, setResetPwd] = useState("");
  const [resetPwd2, setResetPwd2] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rtoken = params.get("reset_password");
    if (!rtoken) return;
    setResetToken(rtoken);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const doResetPassword = async () => {
    if (!resetPwd || resetPwd !== resetPwd2) { setResetMsg("Пароли не совпадают"); return; }
    setResetLoading(true); setResetMsg("");
    const r = await authApi.resetPassword(resetToken, resetPwd);
    setResetLoading(false);
    if (r.ok) { setResetDone(true); setResetToken(""); }
    else setResetMsg(r.data.error || "Ссылка устарела");
  };

  const refreshUser = useCallback(() => {
    authApi.me().then(r => { if (r.ok) setUser(r.data.user); });
  }, []);

  const handleAuth = (u: User, _token?: string) => { setUser(u); };
  const handleLogout = async () => {
    await authApi.logout();
    localStorage.removeItem("ff_token");
    setUser(null);
  };

  const handleBid = (_id: number, _amount: number) => {
    setBidModal(null);
  };

  if (!authChecked) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
      <div className="animate-float text-4xl">🌸</div>
    </div>
  );

  // Модал сброса пароля (переход по ссылке из письма)
  if (resetToken) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "hsl(var(--background))" }}>
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-6">
          <span className="text-5xl block mb-3">🔑</span>
          <h2 className="font-oswald text-2xl font-bold text-white">Новый пароль</h2>
          <p className="text-white/40 text-sm mt-1">Придумайте надёжный пароль</p>
        </div>
        <div className="glass-strong rounded-3xl p-5 space-y-3">
          <input value={resetPwd} onChange={e => setResetPwd(e.target.value)} type="password"
            className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
            placeholder="Новый пароль" />
          <input value={resetPwd2} onChange={e => setResetPwd2(e.target.value)} type="password"
            className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
            placeholder="Повторите пароль" onKeyDown={e => e.key === "Enter" && doResetPassword()} />
          {resetMsg && (
            <p className="text-red-400 text-sm text-center">{resetMsg}</p>
          )}
          <button onClick={doResetPassword} disabled={resetLoading}
            className="btn-gradient w-full rounded-2xl py-4 font-oswald text-lg tracking-wide disabled:opacity-50">
            {resetLoading ? "Сохраняем..." : "СОХРАНИТЬ ПАРОЛЬ"}
          </button>
        </div>
      </div>
    </div>
  );

  if (resetDone) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "hsl(var(--background))" }}>
      <div className="text-center animate-fade-in-up">
        <span className="text-6xl block mb-4">✅</span>
        <h2 className="font-oswald text-2xl font-bold text-white mb-2">Пароль изменён!</h2>
        <p className="text-white/40 text-sm mb-6">Теперь войдите с новым паролем</p>
        <button onClick={() => setResetDone(false)}
          className="btn-gradient px-8 py-3 rounded-2xl font-oswald text-lg tracking-wide">
          ВОЙТИ
        </button>
      </div>
    </div>
  );

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  return (
    <div className="min-h-screen noise" style={{ background: "hsl(var(--background))" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="absolute top-1/3 -right-40 w-80 h-80 rounded-full opacity-8" style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />
      </div>

      {maintenance && (
        <div className="relative z-50 px-4 py-2.5 text-center"
          style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.95), rgba(249,115,22,0.95))" }}>
          <div className="max-w-lg mx-auto flex items-center justify-center gap-2">
            <Icon name="Wrench" size={15} className="text-white flex-shrink-0" />
            <p className="text-white text-xs font-medium leading-snug">{MAINTENANCE_TEXT}</p>
          </div>
        </div>
      )}

      <InstallBanner />

      <header className="sticky top-0 z-40 glass-strong px-4 pt-10 pb-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-float" style={{ display: "inline-block" }}>🌸</span>
            <span className="font-oswald text-xl font-bold shimmer-text">FlowerFlip</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("shops")}
              className="glass px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
              style={activeTab === "shops" ? { border: "1px solid rgba(168,85,247,0.5)", color: "#a855f7" } : { color: "rgba(255,255,255,0.4)" }}>
              <Icon name="Store" size={14} />
              <span className="font-oswald text-xs font-bold">Магазины</span>
            </button>
            <NotificationBell userId={user.id} />
            <button onClick={() => setShowCoins(true)}
              className="glass px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
              title="Лепестки">
              <span className="font-oswald text-sm font-bold" style={{ color: "#ec4899" }}>🌸 {user.coins ?? 0}</span>
            </button>
            <div className="glass px-3 py-1.5 rounded-xl">
              <span className="gradient-text font-oswald text-sm font-bold">{formatPrice(user.balance)}</span>
            </div>
          </div>
        </div>
      </header>

      {verifyMsg && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium"
            style={{
              background: verifyMsg.includes("✅") ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${verifyMsg.includes("✅") ? "rgba(74,222,128,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: verifyMsg.includes("✅") ? "#4ade80" : "#f87171"
            }}>
            {verifyMsg}
            <button onClick={() => setVerifyMsg("")} className="ml-3 opacity-60 hover:opacity-100">
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-5 pb-28">
        {(activeTab === "auctions" || activeTab === "catalog" || activeTab === "shops") && <AdBanners />}
        {activeTab === "auctions" && <AuctionsScreen onBid={setBidModal} user={user} />}
        {activeTab === "catalog" && <CatalogScreen user={user} />}
        {activeTab === "shops" && <ShopsScreen user={user} />}
        {activeTab === "sell" && <SellScreen user={user} />}
        {activeTab === "deals" && <DealsScreen user={user} onPaySuccess={refreshUser} />}
        {activeTab === "profile" && <ProfileScreen user={user} onLogout={handleLogout} onUpdate={refreshUser} onStartTour={startOnboarding} />}
        {activeTab === "admin" && <AdminScreen user={user} />}
        {activeTab === "partners" && <Partners />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-strong">
        <div className="max-w-lg mx-auto px-1 py-2 flex items-center justify-around">
          {(user?.is_admin ? [...TABS, { id: "admin", label: "Админ", icon: "ShieldCheck" }] : TABS).map(tab => {
            const isActive = activeTab === tab.id;
            const isAdmin = tab.id === "admin";
            return (
              <button key={tab.id} id={`tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 rounded-2xl transition-all duration-200 relative"
                style={{
                  padding: isAdmin ? "6px 8px" : "6px 10px",
                  background: isActive ? (isAdmin ? "rgba(168,85,247,0.15)" : "rgba(255,61,139,0.12)") : "transparent"
                }}>
                {tab.id === "sell" ? (
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center -mt-5 shadow-lg" style={{ background: "var(--grad-main)" }}>
                    <Icon name={tab.icon as "PlusCircle"} size={20} className="text-white" />
                  </div>
                ) : (
                  <Icon name={tab.icon as "Zap"} size={isAdmin ? 18 : 20}
                    style={{ color: isActive ? (isAdmin ? "#a855f7" : "var(--neon-pink)") : "rgba(255,255,255,0.35)" }} />
                )}
                <span className="font-medium" style={{
                  fontSize: isAdmin ? "9px" : "12px",
                  color: isActive ? (isAdmin ? "#a855f7" : "var(--neon-pink)") : "rgba(255,255,255,0.35)",
                  marginTop: tab.id === "sell" ? "2px" : "0"
                }}>
                  {tab.label}
                </span>
                {isActive && tab.id !== "sell" && <div className="absolute -bottom-0.5 w-1 h-1 rounded-full" style={{ background: "var(--neon-pink)" }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {bidModal && <BidModal bouquet={bidModal} onClose={() => setBidModal(null)} onBid={handleBid} />}
      {showCoins && <CoinsModal user={user} onClose={() => setShowCoins(false)} onUpdated={refreshUser} />}
      {showOnboarding && <OnboardingTour onFinish={finishOnboarding} />}

      {user && (
        <AiConsultant
          city={user.city}
          onOpenBouquet={async (id) => {
            const r = await bouquetsApi.detail(id);
            if (r.ok && r.data.bouquet) setBidModal(r.data.bouquet);
            else setActiveTab("catalog");
          }}
        />
      )}
    </div>
  );
}