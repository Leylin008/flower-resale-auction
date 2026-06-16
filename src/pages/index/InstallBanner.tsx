import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

/* ─── INSTALL BANNER ─────────────────────────────────────── */
export interface BeforeInstallPromptEvent extends Event {
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
export function usePwaInstall() {
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

export function InstallBanner() {
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
