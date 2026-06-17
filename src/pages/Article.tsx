import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { articlesApi } from "@/lib/api";

interface ArticleFull {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  category: string;
  views: number;
  created_at: string;
}

// Лёгкий рендер Markdown в HTML-элементы
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const blocks: JSX.Element[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: number) => {
    if (listBuffer.length) {
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 my-3 text-white/70">
          {listBuffer.map((li, i) => <li key={i}>{li}</li>)}
        </ul>
      );
      listBuffer = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) { flushList(idx); return; }
    if (line.startsWith("## ")) {
      flushList(idx);
      blocks.push(<h2 key={idx} className="font-oswald text-xl text-white mt-6 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      flushList(idx);
      blocks.push(<h1 key={idx} className="font-oswald text-2xl text-white mt-6 mb-2">{line.slice(2)}</h1>);
    } else if (/^[-*]\s/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s/, ""));
    } else if (/^\d+\.\s/.test(line)) {
      flushList(idx);
      blocks.push(<p key={idx} className="text-white/70 my-1.5 leading-relaxed">{line}</p>);
    } else {
      flushList(idx);
      blocks.push(<p key={idx} className="text-white/70 my-2.5 leading-relaxed">{line}</p>);
    }
  });
  flushList(lines.length);
  return blocks;
}

export default function Article() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    articlesApi.get(slug).then(r => {
      if (r.ok) setArticle(r.data.article);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/40" style={{ background: "hsl(var(--background))" }}>Загружаем...</div>;
  if (!article) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "hsl(var(--background))" }}>
      <span className="text-4xl">🥀</span>
      <p className="text-white/50">Статья не найдена</p>
      <Link to="/articles" className="text-pink-400 underline">Все статьи</Link>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Link to="/articles" className="inline-flex items-center gap-2 text-white/50 text-sm mb-6 hover:text-white/80 transition-colors">
          <Icon name="ArrowLeft" size={16} /> Все статьи
        </Link>
        {article.cover_url && (
          <img src={article.cover_url} alt={article.title} className="w-full h-56 object-cover rounded-2xl mb-6" />
        )}
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,61,139,0.15)", color: "#ff6da6" }}>
          {article.category}
        </span>
        <h1 className="font-oswald text-3xl font-bold text-white mt-3 mb-4">{article.title}</h1>
        <div className="article-body">{renderMarkdown(article.body)}</div>
        <div className="mt-10 p-5 rounded-2xl text-center" style={{ background: "var(--grad-main)" }}>
          <p className="text-white font-medium mb-3">Хотите свежие букеты выгодно?</p>
          <Link to="/" className="inline-block bg-white/90 text-pink-600 font-bold rounded-xl px-6 py-2.5 text-sm">
            Открыть FlowerFlip
          </Link>
        </div>
      </div>
    </div>
  );
}
