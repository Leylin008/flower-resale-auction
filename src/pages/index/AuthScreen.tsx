import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { authApi, oauthApi } from "@/lib/api";
import { useCities } from "@/lib/cities";
import type { User } from "./shared";

/* ─── AUTH SCREEN ────────────────────────────────────────── */
export function AuthScreen({ onAuth }: { onAuth: (user: User, token: string) => void }) {
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
