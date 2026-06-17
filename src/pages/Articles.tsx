import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { articlesApi } from "@/lib/api";

interface ArticleCard {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string | null;
  category: string;
  views: number;
  created_at: string;
}

export default function Articles() {
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    articlesApi.list().then(r => {
      if (r.ok) setArticles(r.data.articles || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      <div className="max-w-3xl mx-auto px-5 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-white/50 text-sm mb-6 hover:text-white/80 transition-colors">
          <Icon name="ArrowLeft" size={16} /> На главную
        </Link>
        <h1 className="font-oswald text-3xl font-bold text-white mb-2">Статьи 🌸</h1>
        <p className="text-white/40 text-sm mb-8">Истории про цветы, романтику и возможности FlowerFlip</p>

        {loading ? (
          <div className="text-center py-16 text-white/40">Загружаем...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 text-white/40">Пока нет статей</div>
        ) : (
          <div className="grid gap-4">
            {articles.map(a => (
              <Link key={a.id} to={`/articles/${a.slug}`}
                className="glass rounded-2xl p-5 hover:scale-[1.01] transition-transform block">
                {a.cover_url && (
                  <img src={a.cover_url} alt={a.title} className="w-full h-44 object-cover rounded-xl mb-4" />
                )}
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,61,139,0.15)", color: "#ff6da6" }}>
                  {a.category}
                </span>
                <h2 className="font-oswald text-xl text-white mt-3 mb-1.5">{a.title}</h2>
                <p className="text-white/50 text-sm leading-relaxed">{a.excerpt}</p>
                <div className="flex items-center gap-2 mt-3 text-white/30 text-xs">
                  <Icon name="Eye" size={13} /> {a.views}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
