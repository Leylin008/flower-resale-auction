import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const STORAGE_KEY = "ff_onboarding_done_v2";

interface Step {
  targetId: string;
  title: string;
  text: string;
  position: "top" | "bottom";
}

const STEPS: Step[] = [
  {
    targetId: "tab-auctions",
    title: "🌸 Аукционы — живые ставки",
    text: "В реальном времени идут торги на свежие букеты. Делай ставку — кто предложил больше, тот и купил. Таймер создаёт азарт!",
    position: "top",
  },
  {
    targetId: "tab-catalog",
    title: "🔍 Каталог букетов",
    text: "Все активные предложения с фильтрами по городу, виду цветов и цене. Найди букет по вкусу — аукционный или по фиксированной цене.",
    position: "top",
  },
  {
    targetId: "tab-shops",
    title: "🏪 Магазины цветов",
    text: "Проверенные цветочные магазины с подпиской. Смотри витрину, все форматы продажи, фильтруй по городу.",
    position: "top",
  },
  {
    targetId: "tab-sell",
    title: "💐 Продать букет",
    text: "Выставь букет за 30 секунд! Три формата на выбор: аукцион со ставками, фиксированная цена или оба варианта с опцией брони.",
    position: "top",
  },
  {
    targetId: "tab-deals",
    title: "🤝 Безопасные сделки",
    text: "Деньги хранятся в эскроу до подтверждения получения — полная защита. Чат открывается только после оплаты.",
    position: "top",
  },
  {
    targetId: "tab-profile",
    title: "👤 Профиль и магазин",
    text: "Баланс, история выводов, реферальная программа. Флористам — вкладка «Магазин» для открытия витрины с подпиской.",
    position: "top",
  },
  {
    targetId: "onboarding-finish",
    title: "🚀 Всё готово!",
    text: "FlowerFlip — безопасный маркетплейс живых букетов. Аукцион, фикс. цена, бронь, магазины, реклама. Деньги защищены эскроу. Удачных торгов!",
    position: "bottom",
  },
];

interface Props {
  onFinish: () => void;
}

export function OnboardingTour({ onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const current = STEPS[step];

  useEffect(() => {
    const el = document.getElementById(current.targetId);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      setTargetRect(null);
    }
  }, [step, current.targetId]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onFinish();
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const PAD = 6;
  const highlight = targetRect
    ? {
        left: targetRect.left - PAD,
        top: targetRect.top - PAD,
        width: targetRect.width + PAD * 2,
        height: targetRect.height + PAD * 2,
      }
    : null;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { bottom: 120, left: 16, right: 16 };
    const vw = window.innerWidth;
    const tooltipW = Math.min(vw - 32, 360);
    const left = Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - tooltipW / 2, vw - tooltipW - 16));
    if (current.position === "top") {
      return { bottom: window.innerHeight - targetRect.top + 12, left, width: tooltipW };
    } else {
      return { top: targetRect.bottom + 12, left, width: tooltipW };
    }
  };

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }}>
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="spotlight">
            <rect width="100%" height="100%" fill="white" />
            {highlight && (
              <rect x={highlight.left} y={highlight.top} width={highlight.width} height={highlight.height} rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#spotlight)" />
      </svg>

      {highlight && (
        <div className="absolute rounded-xl pointer-events-none" style={{
          left: highlight.left, top: highlight.top,
          width: highlight.width, height: highlight.height,
          boxShadow: "0 0 0 2px #ff3d8b, 0 0 20px rgba(255,61,139,0.5)",
          transition: "all 0.3s ease",
        }} />
      )}

      <div ref={tooltipRef} className="absolute animate-fade-in-up" style={{ ...getTooltipStyle(), transition: "all 0.3s ease" }}>
        <div className="rounded-2xl p-5 shadow-2xl"
          style={{ background: "linear-gradient(135deg, #1a0f2e 0%, #150f1c 100%)", border: "1px solid rgba(255,61,139,0.4)" }}>

          <div className="flex items-center gap-1.5 mb-3">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1 rounded-full flex-1 transition-all duration-300"
                style={{ background: i <= step ? "var(--grad-main)" : "rgba(255,255,255,0.1)" }} />
            ))}
          </div>

          <div className="flex items-center justify-between mb-1">
            <h3 className="font-oswald text-lg font-bold text-white">{current.title}</h3>
            <span className="text-white/30 text-xs">{step + 1}/{STEPS.length}</span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">{current.text}</p>

          <div className="flex items-center gap-2 mt-4">
            {step > 0 && (
              <button onClick={prev} className="glass rounded-xl px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5">
                <Icon name="ArrowLeft" size={14} />
                Назад
              </button>
            )}
            <button onClick={next} className="flex-1 btn-gradient rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
              {step < STEPS.length - 1 ? (<>Далее <Icon name="ArrowRight" size={14} /></>) : (<>Начать! <Icon name="Zap" size={14} /></>)}
            </button>
            <button onClick={finish} className="glass rounded-xl px-4 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors">
              Пропустить
            </button>
          </div>
        </div>
      </div>

      <div id="onboarding-finish" className="fixed top-1/2 left-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export function useOnboarding() {
  const [show, setShow] = useState(false);
  const triggered = useRef(false);

  const triggerIfNew = useCallback(() => {
    if (triggered.current) return;
    triggered.current = true;
    setTimeout(() => {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    }, 900);
  }, []);

  const start = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShow(true);
  };

  const finish = () => setShow(false);

  return { show, start, finish, triggerIfNew };
}
