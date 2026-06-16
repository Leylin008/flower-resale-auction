import { useState, useEffect } from "react";

/* ─── TYPES ─────────────────────────────────────────────── */
export interface Bouquet {
  id: number; seller_id: number; seller_name: string; seller_rating: number;
  title: string; description?: string; flowers: string[]; freshness: string;
  image_urls: string[]; start_price: number; current_price: number;
  min_step: number; bids_count: number; status: string; ends_at: string;
  liked: boolean; city?: string; district?: string; meet_point?: string;
}
export interface User {
  id: number; name: string; phone: string; avatar_url?: string;
  rating: number; reviews_count: number; sales_count: number;
  purchases_count: number; balance: number; created_at: string; city?: string;
  is_admin?: boolean; payout_method?: string; payout_details?: string;
  email?: string; email_verified?: boolean;
  ref_code?: string; ref_earnings?: number;
}
export interface Deal {
  id: number; amount: number; commission: number; escrow_status: string;
  created_at: string; updated_at: string; auto_confirm_at?: string;
  dispute_reason?: string; seller_phone_revealed: boolean;
  title: string; image_urls: string[]; city?: string; district?: string;
  seller_name: string; seller_id: number; buyer_name: string; buyer_id: number;
  seller_phone?: string; buyer_phone?: string;
  seller_email?: string; buyer_email?: string;
  is_buyer: boolean; is_seller: boolean;
}
export interface Review { id: number; stars: number; text: string; created_at: string; reviewer_name: string; }
export interface Chat { last_message: string; created_at: string; other_id: number; other_name: string; bouquet_title?: string; unread: number; bouquet_id?: number; }
export interface Message { id: number; sender_id: number; text: string; created_at: string; is_read: boolean; }

export const TABS = [
  { id: "auctions", label: "Аукционы", icon: "Zap" },
  { id: "catalog", label: "Каталог", icon: "Grid3X3" },
  { id: "sell", label: "Продать", icon: "PlusCircle" },
  { id: "deals", label: "Сделки", icon: "Handshake" },
  { id: "profile", label: "Профиль", icon: "User" },
];
export const ALL_TAGS = ["все", "розы", "тюльпаны", "пионы", "орхидеи", "герберы", "каллы", "подсолнухи"];

/* ─── UTILS ─────────────────────────────────────────────── */
export function formatTime(endsAt: string) {
  const diff = Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000);
  if (diff <= 0) return "Завершён";
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${String(s).padStart(2, "0")}с`;
  return `${String(s).padStart(2, "0")}с`;
}
export function isUrgent(endsAt: string) {
  const diff = (new Date(endsAt).getTime() - Date.now()) / 1000;
  return diff > 0 && diff < 300;
}
export function formatPrice(n: number | undefined | null) { return (n ?? 0).toLocaleString("ru-RU") + " ₽"; }
export function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

export function useTick() {
  const [, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(t => t + 1), 1000); return () => clearInterval(id); }, []);
}

/* ─── CITIES DATA — полный список грузится с бэкенда (см. src/lib/cities.ts) ─── */

export const DISTRICTS: Record<string, string[]> = {
  "Москва": [
    "Центральный", "Северный", "Северо-Восточный", "Восточный",
    "Юго-Восточный", "Южный", "Юго-Западный", "Западный",
    "Северо-Западный", "Зеленоградский", "Новомосковский", "Троицкий",
  ],
  "Санкт-Петербург": [
    "Адмиралтейский", "Василеостровский", "Выборгский", "Калининский",
    "Кировский", "Колпинский", "Красногвардейский", "Красносельский",
    "Кронштадтский", "Курортный", "Московский", "Невский",
    "Петроградский", "Петродворцовый", "Приморский", "Пушкинский",
    "Фрунзенский", "Центральный",
  ],
  "Екатеринбург": [
    "Верх-Исетский", "Железнодорожный", "Кировский", "Ленинский",
    "Октябрьский", "Орджоникидзевский", "Чкаловский",
  ],
  "Новосибирск": [
    "Дзержинский", "Железнодорожный", "Заельцовский", "Калининский",
    "Кировский", "Ленинский", "Октябрьский", "Первомайский", "Советский",
    "Центральный",
  ],
  "Казань": ["Авиастроительный", "Вахитовский", "Кировский", "Московский", "Ново-Савиновский", "Приволжский", "Советский"],
};

export function getDistricts(city: string): string[] {
  return DISTRICTS[city] || [];
}

export const ESCROW_STATUS: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  waiting_payment: { label: "Ожидает оплаты", color: "#a855f7", icon: "Clock", desc: "Оплатите, чтобы получить контакт продавца" },
  paid:            { label: "Оплачен", color: "#06d6de", icon: "CreditCard", desc: "Договоритесь о встрече с продавцом" },
  completed:       { label: "Завершён", color: "#4ade80", icon: "CheckCircle2", desc: "Сделка успешно закрыта" },
  dispute:         { label: "Спор", color: "#ff6b2b", icon: "AlertTriangle", desc: "Разбирается модератором" },
  archived:        { label: "Архив", color: "#6b7280", icon: "Archive", desc: "Сделка в архиве" },
  cancelled:       { label: "Отменён", color: "#6b7280", icon: "XCircle", desc: "Аукцион был снят" },
  expired:         { label: "Истёк", color: "#6b7280", icon: "Clock", desc: "Аукцион завершился без ставок" },
};
