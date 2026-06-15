import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const STORAGE_KEY = "ff_cookie_consent";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 animate-fade-in-up">
      <div className="max-w-2xl mx-auto rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ background: "rgba(20,20,30,0.96)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,61,139,0.25)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#ff3d8b,#a855f7)" }}>
          <Icon name="Cookie" size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm leading-snug">
            Мы используем cookie для работы сайта и улучшения сервиса. Продолжая, вы соглашаетесь с{" "}
            <a href="/cookies" className="text-pink-400 underline">политикой cookie</a> и{" "}
            <a href="/privacy" className="text-pink-400 underline">обработкой данных</a>.
          </p>
        </div>
        <button onClick={accept}
          className="btn-gradient rounded-xl px-6 py-2.5 font-oswald tracking-wide text-sm shrink-0 text-white">
          ПРИНЯТЬ
        </button>
      </div>
    </div>
  );
}
