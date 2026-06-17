import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const INVITE_OG_IMAGE = "https://cdn.poehali.dev/projects/c3c15f66-a71a-4790-a1f7-f67719eb241e/files/6e80bb24-7891-4a2f-a0a3-6bffd37bf150.jpg";

function setMeta(kind: "property" | "name", key: string, value: string) {
  let el = document.head.querySelector(`meta[${kind}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(kind, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

// Короткая реферальная ссылка /i/КОД → OG-превью приглашения + редирект на главную
export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Тебя пригласили в FlowerFlip 🌸";
    setMeta("property", "og:title", "🌸 Тебя пригласили в FlowerFlip!");
    setMeta("property", "og:description", "Аукцион живых букетов — свежие цветы дешевле магазина. Заходи и забирай красивые букеты выгодно!");
    setMeta("property", "og:image", INVITE_OG_IMAGE);
    setMeta("name", "twitter:image", INVITE_OG_IMAGE);
    setMeta("name", "twitter:title", "🌸 Тебя пригласили в FlowerFlip!");

    if (code) {
      try { localStorage.setItem("ff_ref", code.toUpperCase()); } catch { /* ignore */ }
    }
    // Небольшая задержка, чтобы боты-парсеры успели прочитать OG-теги до редиректа
    const t = setTimeout(() => {
      navigate(`/?ref=${encodeURIComponent(code || "")}`, { replace: true });
    }, 400);
    return () => clearTimeout(t);
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "hsl(var(--background))" }}>
      <span className="text-5xl animate-float" style={{ display: "inline-block" }}>🌸</span>
      <p className="text-white/60 text-base font-medium">Тебя пригласили в FlowerFlip!</p>
      <p className="text-white/40 text-sm">Открываем аукцион живых букетов...</p>
    </div>
  );
}
