import { useState, useEffect, useRef } from "react";
import { bannersApi } from "@/lib/api";

interface Banner {
  id: number;
  title: string;
  media_url: string;
  media_type: string;
  link_url?: string;
  description?: string;
  duration_seconds: number;
  contact_email?: string;
}

export default function AdBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const [contactEmail, setContactEmail] = useState("flowerflip@flowerflip.ru");
  const [imgError, setImgError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bannersApi.list().then(r => {
      if (r.ok && r.data.banners?.length) {
        setBanners(r.data.banners);
        if (r.data.contact_email) setContactEmail(r.data.contact_email);
      }
    });
  }, []);

  useEffect(() => {
    setImgError(false);
    if (banners.length < 2) return;
    const dur = (banners[current]?.duration_seconds || 5) * 1000;
    timerRef.current = setTimeout(() => {
      setCurrent(c => (c + 1) % banners.length);
    }, dur);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, banners]);

  const handleClick = (banner: Banner) => {
    bannersApi.click(banner.id);
    if (banner.link_url) window.open(banner.link_url, "_blank");
  };

  if (banners.length === 0) {
    return (
      <div className="mb-4 rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-white/20 text-xs">Реклама</span>
          <a href={`mailto:${contactEmail}`} className="text-white/30 text-xs hover:text-pink-400 transition-colors">
            Разместить → {contactEmail}
          </a>
        </div>
      </div>
    );
  }

  const banner = banners[current];

  return (
    <div className="mb-4">
      {/* Квадратный баннер — aspect-ratio 1:1 */}
      <div
        className="relative rounded-2xl overflow-hidden cursor-pointer w-full"
        style={{ aspectRatio: "1 / 1", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={() => handleClick(banner)}
      >
        {banner.media_type === "video" ? (
          <video
            key={banner.id}
            src={banner.media_url}
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : imgError ? (
          /* Заглушка при ошибке загрузки */
          <div className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15), rgba(168,85,247,0.15))" }}>
            <span className="text-5xl mb-3">🌸</span>
            <p className="text-white/50 text-sm font-semibold">{banner.title}</p>
            {banner.description && <p className="text-white/30 text-xs mt-1">{banner.description}</p>}
          </div>
        ) : (
          <img
            key={banner.id}
            src={banner.media_url}
            alt={banner.title}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Градиентный оверлей снизу */}
        {(banner.title || banner.description) && !imgError && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-4"
            style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
            {banner.title && <p className="text-white font-semibold text-sm leading-tight">{banner.title}</p>}
            {banner.description && <p className="text-white/70 text-xs mt-0.5">{banner.description}</p>}
          </div>
        )}

        {/* Метка Реклама */}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span className="text-white/50 text-xs">Реклама</span>
        </div>

        {/* Ссылка */}
        {banner.link_url && (
          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <span className="text-white/60 text-xs">Перейти →</span>
          </div>
        )}
      </div>

      {/* Навигация */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 18 : 6,
                height: 6,
                background: i === current ? "var(--grad-main)" : "rgba(255,255,255,0.2)"
              }} />
          ))}
        </div>
        <a href={`mailto:${contactEmail}`}
          className="text-white/25 text-xs hover:text-pink-400 transition-colors"
          onClick={e => e.stopPropagation()}>
          Разместить рекламу
        </a>
      </div>
    </div>
  );
}
