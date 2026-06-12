import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { notificationsApi } from "@/lib/api";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  bid: "Zap",
  sale: "ShoppingBag",
  deal: "Handshake",
  message: "MessageCircle",
  shop: "Store",
  banner: "Megaphone",
  payment: "CreditCard",
  system: "Bell",
  info: "Info",
};

const TYPE_COLOR: Record<string, string> = {
  bid: "#ff3d8b",
  sale: "#4ade80",
  deal: "#a855f7",
  message: "#06d6de",
  shop: "#a855f7",
  banner: "#ff6b2b",
  payment: "#4ade80",
  system: "#fff",
  info: "#a3a3a3",
};

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

async function requestPushPermission(userId: number) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: undefined,
    }).catch(() => null);
    if (!sub) return;
    const json = sub.toJSON();
    await notificationsApi.subscribePush({
      endpoint: json.endpoint || "",
      p256dh: (json.keys as Record<string, string>)?.p256dh,
      auth: (json.keys as Record<string, string>)?.auth,
    });
  } catch {
    // push недоступен — показываем in-app уведомления
  }
}

interface Props {
  userId: number;
}

export default function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushAsked, setPushAsked] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    notificationsApi.list(20).then(r => {
      if (r.ok) {
        setNotifications(r.data.notifications || []);
        setUnread(r.data.unread || 0);
      }
    });
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  // Предложить push через 5 секунд если ещё не спрашивали
  useEffect(() => {
    const asked = localStorage.getItem("ff_push_asked");
    if (asked || !("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    const t = setTimeout(() => setShowPushBanner(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Закрытие по клику вне панели
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(o => !o);
  };

  const markAllRead = async () => {
    await notificationsApi.read();
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    setUnread(0);
  };

  const markRead = async (id: number) => {
    await notificationsApi.read(id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    setUnread(u => Math.max(0, u - 1));
  };

  const acceptPush = async () => {
    localStorage.setItem("ff_push_asked", "1");
    setShowPushBanner(false);
    setPushAsked(true);
    await requestPushPermission(userId);
  };

  const declinePush = () => {
    localStorage.setItem("ff_push_asked", "1");
    setShowPushBanner(false);
  };

  return (
    <>
      {/* Push-баннер */}
      {showPushBanner && (
        <div className="fixed bottom-24 left-3 right-3 z-50 animate-fade-in-up">
          <div className="glass-strong rounded-2xl p-4 flex items-start gap-3"
            style={{ border: "1px solid rgba(168,85,247,0.3)", boxShadow: "0 8px 32px rgba(168,85,247,0.2)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(255,61,139,0.3))" }}>
              <Icon name="Bell" size={18} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Включить уведомления?</p>
              <p className="text-white/40 text-xs mt-0.5">Узнавайте о новых ставках, сообщениях и продажах первым</p>
              <div className="flex gap-2 mt-3">
                <button onClick={acceptPush}
                  className="btn-gradient px-4 py-1.5 rounded-xl text-xs font-bold">
                  Включить
                </button>
                <button onClick={declinePush}
                  className="glass px-4 py-1.5 rounded-xl text-xs text-white/50">
                  Не сейчас
                </button>
              </div>
            </div>
            <button onClick={declinePush} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0">
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Кнопка колокольчика */}
      <div className="relative" ref={panelRef}>
        <button onClick={handleOpen}
          className="relative glass p-2 rounded-xl transition-all hover:scale-105"
          style={open ? { border: "1px solid rgba(168,85,247,0.4)" } : {}}>
          <Icon name="Bell" size={18} style={{ color: unread > 0 ? "#a855f7" : "rgba(255,255,255,0.4)" }} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-white font-bold"
              style={{ background: "var(--grad-main)", fontSize: 9, padding: "0 4px" }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Панель уведомлений */}
        {open && (
          <div className="absolute right-0 top-12 w-80 z-50 animate-fade-in-up"
            style={{ maxHeight: "70vh" }}>
            <div className="glass-strong rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(168,85,247,0.25)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white font-semibold text-sm">Уведомления</p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-purple-400 text-xs hover:text-purple-300 transition-colors">
                      Прочитать все
                    </button>
                  )}
                  {!pushAsked && Notification.permission !== "granted" && "Notification" in window && (
                    <button onClick={acceptPush}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                      <Icon name="BellRing" size={11} />
                      Push
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 52px)" }}>
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="text-3xl block mb-2">🔔</span>
                    <p className="text-white/30 text-sm">Нет уведомлений</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <button key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                      className="w-full text-left px-4 py-3 transition-all hover:bg-white/5 flex items-start gap-3"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: n.is_read ? "transparent" : "rgba(168,85,247,0.05)" }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${TYPE_COLOR[n.type] || "#a855f7"}18` }}>
                        <Icon name={(TYPE_ICON[n.type] || "Bell") as "Bell"} size={14}
                          style={{ color: TYPE_COLOR[n.type] || "#a855f7" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold leading-tight">{n.title}</p>
                        <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{n.body}</p>
                        <p className="text-white/25 text-xs mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                          style={{ background: "#a855f7" }} />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
