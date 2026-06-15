import Icon from "@/components/ui/icon";

interface LegalSection {
  title: string;
  paragraphs: string[];
}

interface LegalLayoutProps {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

export default function LegalLayout({ title, updated, intro, sections }: LegalLayoutProps) {
  return (
    <div className="min-h-screen pb-20" style={{ background: "#0d0d14" }}>
      {/* HEADER */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(13,13,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <a href="/" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <Icon name="ChevronLeft" size={20} className="text-white" />
        </a>
        <div className="flex-1 min-w-0">
          <p className="font-oswald text-base font-bold text-white leading-tight truncate">{title}</p>
          <p className="text-white/40 text-xs">FlowerFlip · {updated}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="rounded-3xl p-6 mb-6 text-center"
          style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.13), rgba(168,85,247,0.13))", border: "1px solid rgba(255,61,139,0.2)" }}>
          <h1 className="font-oswald text-2xl font-bold gradient-text mb-1">{title}</h1>
          {intro && <p className="text-white/60 text-sm leading-relaxed mt-2">{intro}</p>}
        </div>

        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start gap-2 mb-3">
                <span className="font-oswald font-bold text-pink-400 text-sm shrink-0">{i + 1}.</span>
                <h2 className="font-oswald font-bold text-white text-base leading-snug">{s.title}</h2>
              </div>
              <div className="space-y-2 pl-1">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-white/65 text-sm leading-relaxed">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-white/25 text-xs mt-8 leading-relaxed">
          Оператор: ИП Никитин Никита Александрович · ИНН 290205459711.<br />
          FlowerFlip © {new Date().getFullYear()} · Все права защищены
        </p>
      </div>
    </div>
  );
}