import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Короткая реферальная ссылка /i/КОД → сохраняем код и ведём на главную
export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      try { localStorage.setItem("ff_ref", code.toUpperCase()); } catch { /* ignore */ }
    }
    navigate(`/?ref=${encodeURIComponent(code || "")}`, { replace: true });
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "hsl(var(--background))" }}>
      <span className="text-5xl animate-float" style={{ display: "inline-block" }}>🌸</span>
      <p className="text-white/50 text-sm">Открываем FlowerFlip...</p>
    </div>
  );
}
