const URLS = {
  auth: "https://functions.poehali.dev/160e4bcc-5354-4955-b417-dcd385abfe11",
  bouquets: "https://functions.poehali.dev/c984e344-489c-4df8-b265-e621f407f1c2",
  profile: "https://functions.poehali.dev/e0242723-8c00-4366-807f-86615a61bb2e",
  upload: "https://functions.poehali.dev/3da42e9b-d4f0-4fa7-91fa-b25481552ce1",
  escrow: "https://functions.poehali.dev/e88eb917-34d3-4efd-b11e-fdea4f137322",
  oauth: "https://functions.poehali.dev/385e4ac7-d359-47f0-bbde-f564f4a774ac",
  vkidSdk: "https://functions.poehali.dev/04a40261-2f46-44d9-9585-2ca604773192",
  cities: "https://functions.poehali.dev/926ae37d-af28-4725-9ea2-1fb3bad5cefc",
  admin: "https://functions.poehali.dev/a5f90f0f-a62a-4230-ba88-9bc4c17060ff",
  payment: "https://functions.poehali.dev/87035cc4-779f-49b8-a18c-1ed92268c9e4",
  shops: "https://functions.poehali.dev/4e696c75-7ccd-435f-bcad-c1cc0b4ac528",
  banners: "https://functions.poehali.dev/7efb814d-6696-46cc-99c4-b9eb27ac3f11",
  notifications: "https://functions.poehali.dev/4e31bfb6-d58a-479b-a49c-c8f515de2d4c",
  ai: "https://functions.poehali.dev/651432b0-8591-4557-9212-2d16386a9d79",
  coins: "https://functions.poehali.dev/a6016fdc-9b75-4bad-b7e8-eb64bc754965",
  articles: "https://functions.poehali.dev/3aa82265-f2fc-482e-a1c1-d857bd25cfcd",
  shopParser: "https://functions.poehali.dev/374718a7-66b5-484f-a55e-c5141f428484",
};

export async function fetchAllCities(): Promise<string[]> {
  try {
    const res = await fetch(`${URLS.cities}/`);
    const data = await res.json();
    return Array.isArray(data.cities) ? data.cities : [];
  } catch {
    return [];
  }
}

function getToken(): string {
  return localStorage.getItem("ff_token") || "";
}

// POST-запрос: action кладём И в query string, И в body — чтобы бэкенд точно получил
async function req(url: string, options: RequestInit = {}) {
  const token = getToken();
  try {
    // Если есть body (POST) — добавляем action в него тоже
    let finalOptions = options;
    if (options.body && typeof options.body === "string") {
      try {
        const parsed = JSON.parse(options.body);
        // Извлекаем action из URL и добавляем в body
        const urlObj = new URL(url);
        const actionFromQS = urlObj.searchParams.get("action");
        if (actionFromQS && !parsed.action) {
          parsed.__action = actionFromQS; // доп. поле для надёжности
        }
        finalOptions = { ...options, body: JSON.stringify(parsed) };
      } catch { /* не JSON — не трогаем */ }
    }
    const res = await fetch(url, {
      ...finalOptions,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    try {
      let data = JSON.parse(text);
      if (typeof data === "string") data = JSON.parse(data);
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: res.status, data: { error: text } };
    }
  } catch (e) {
    console.error("Fetch error:", e, "for", url);
    return { ok: false, status: 0, data: { error: "Нет соединения с сервером" } };
  }
}

// AUTH
export const authApi = {
  register: (name: string, phone: string, password: string, city?: string, email?: string, ref_code?: string) =>
    req(`${URLS.auth}/?action=register`, { method: "POST", body: JSON.stringify({ action: "register", name, phone, password, city, email, ref_code }) }),
  login: (login: string, password: string) =>
    req(`${URLS.auth}/?action=login`, { method: "POST", body: JSON.stringify({ action: "login", phone: login, email: login, password }) }),
  me: () => req(`${URLS.auth}/?action=me`),
  update: (data: { name?: string; avatar_url?: string | null; city?: string; email?: string; phone?: string }) =>
    req(`${URLS.auth}/?action=update`, { method: "POST", body: JSON.stringify({ action: "update", ...data }) }),
  changePassword: (old_password: string, new_password: string) =>
    req(`${URLS.auth}/?action=change_password`, { method: "POST", body: JSON.stringify({ action: "change_password", old_password, new_password }) }),
  forgotPassword: (email: string) =>
    req(`${URLS.auth}/?action=forgot_password`, { method: "POST", body: JSON.stringify({ action: "forgot_password", email }) }),
  resetPassword: (token: string, password: string) =>
    req(`${URLS.auth}/?action=reset_password`, { method: "POST", body: JSON.stringify({ action: "reset_password", token, password }) }),
  logout: () => req(`${URLS.auth}/?action=logout`, { method: "POST", body: JSON.stringify({ action: "logout" }) }),
  verifyEmail: (token: string) =>
    req(`${URLS.auth}/?action=verify_email&token=${token}`),
  resendVerify: (email?: string) =>
    req(`${URLS.auth}/?action=resend_verify`, { method: "POST", body: JSON.stringify({ action: "resend_verify", ...(email ? { email } : {}) }) }),
};

// BOUQUETS
export const bouquetsApi = {
  list: (params?: { status?: string; tag?: string; sort?: string; max_price?: number; city?: string; district?: string; sale_type?: string }) => {
    const qs = new URLSearchParams({ action: "list" });
    if (params?.status) qs.set("status", params.status);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.max_price) qs.set("max_price", String(params.max_price));
    if (params?.city) qs.set("city", params.city);
    if (params?.district) qs.set("district", params.district);
    if (params?.sale_type) qs.set("sale_type", params.sale_type);
    return req(`${URLS.bouquets}/?${qs}`);
  },
  flowers: () => req(`${URLS.bouquets}/?action=flowers`),
  detail: (id: number) => req(`${URLS.bouquets}/?action=detail&id=${id}`),
  create: (data: {
    title: string; description?: string; flowers: string[];
    freshness: string; image_urls: string[];
    start_price: number; duration_hours: number;
    city?: string; district?: string; meet_point?: string;
    sale_type?: string; fixed_price?: number; reserve_enabled?: boolean;
  }) => req(`${URLS.bouquets}/?action=create`, { method: "POST", body: JSON.stringify({ action: "create", ...data }) }),
  bid: (bouquet_id: number, amount: number) =>
    req(`${URLS.bouquets}/?action=bid`, { method: "POST", body: JSON.stringify({ action: "bid", bouquet_id, amount }) }),
  buyFixed: (bouquet_id: number) =>
    req(`${URLS.bouquets}/?action=buy_fixed`, { method: "POST", body: JSON.stringify({ action: "buy_fixed", bouquet_id }) }),
  reserve: (bouquet_id: number, hours?: number) =>
    req(`${URLS.bouquets}/?action=reserve`, { method: "POST", body: JSON.stringify({ action: "reserve", bouquet_id, hours: hours || 24 }) }),
  cancelReserve: (bouquet_id: number) =>
    req(`${URLS.bouquets}/?action=cancel_reserve`, { method: "POST", body: JSON.stringify({ action: "cancel_reserve", bouquet_id }) }),
  favorite: (bouquet_id: number, add: boolean) =>
    req(`${URLS.bouquets}/?action=favorite`, { method: "POST", body: JSON.stringify({ action: "favorite", bouquet_id, add }) }),
  favorites: () => req(`${URLS.bouquets}/?action=favorites`),
  cancel: (bouquet_id: number) =>
    req(`${URLS.bouquets}/?action=cancel`, { method: "POST", body: JSON.stringify({ action: "cancel", bouquet_id }) }),
};

// NOTIFICATIONS
export const notificationsApi = {
  list: (limit?: number) => req(`${URLS.notifications}/?action=list${limit ? `&limit=${limit}` : ""}`),
  read: (id?: number) => req(`${URLS.notifications}/?action=read`, { method: "POST", body: JSON.stringify({ action: "read", ...(id ? { id } : {}) }) }),
  subscribePush: (sub: { endpoint: string; p256dh?: string; auth?: string }) =>
    req(`${URLS.notifications}/?action=subscribe_push`, { method: "POST", body: JSON.stringify({ action: "subscribe_push", ...sub }) }),
  send: (data: { user_id?: number; broadcast?: boolean; type: string; title: string; body: string; data?: unknown }) =>
    req(`${URLS.notifications}/?action=send`, { method: "POST", body: JSON.stringify({ action: "send", ...data }) }),
};

// SHOPS
export const shopsApi = {
  myStatus: () => req(`${URLS.shops}/?action=my_status`),
  profile: (user_id?: number) => req(`${URLS.shops}/?action=profile${user_id ? `&user_id=${user_id}` : ""}`),
  saveProfile: (data: { shop_name: string; logo_url?: string; description?: string; address?: string; phone?: string; city?: string }) =>
    req(`${URLS.shops}/?action=save_profile`, { method: "POST", body: JSON.stringify({ action: "save_profile", ...data }) }),
  list: (city?: string) => req(`${URLS.shops}/?action=list${city ? `&city=${encodeURIComponent(city)}` : ""}`),
  shopBouquets: (user_id: number) => req(`${URLS.shops}/?action=shop_bouquets&user_id=${user_id}`),
  locations: (user_id: number) => req(`${URLS.shops}/?action=locations&user_id=${user_id}`),
  saveLocation: (data: { id?: number; city: string; address: string; phone?: string; is_main?: boolean }) =>
    req(`${URLS.shops}/?action=save_location`, { method: "POST", body: JSON.stringify({ action: "save_location", ...data }) }),
  deleteLocation: (id: number) =>
    req(`${URLS.shops}/?action=delete_location`, { method: "POST", body: JSON.stringify({ action: "delete_location", id }) }),
};

// BANNERS
export const bannersApi = {
  list: () => req(`${URLS.banners}/?action=list`),
  click: (banner_id: number) =>
    req(`${URLS.banners}/?action=click`, { method: "POST", body: JSON.stringify({ action: "click", banner_id }) }),
  adminList: () => req(`${URLS.banners}/?action=admin_list`),
  create: (data: { title: string; media_url: string; media_type?: string; link_url?: string; description?: string; duration_seconds?: number; is_active?: boolean; sort_order?: number; contact_email?: string }) =>
    req(`${URLS.banners}/?action=create_banner`, { method: "POST", body: JSON.stringify({ action: "create_banner", ...data }) }),
  update: (data: { id: number; [key: string]: unknown }) =>
    req(`${URLS.banners}/?action=update_banner`, { method: "POST", body: JSON.stringify({ action: "update_banner", ...data }) }),
  delete: (id: number) =>
    req(`${URLS.banners}/?action=delete_banner`, { method: "POST", body: JSON.stringify({ action: "delete_banner", id }) }),
  stats: (banner_id?: number) =>
    req(`${URLS.banners}/?action=banner_stats${banner_id ? `&banner_id=${banner_id}` : ""}`),
};

// PROFILE
export const profileApi = {
  orders: () => req(`${URLS.profile}/?action=orders`),
  mySales: () => req(`${URLS.profile}/?action=my_sales`),
  reviews: (user_id?: number) => {
    const qs = new URLSearchParams({ action: "reviews" });
    if (user_id) qs.set("user_id", String(user_id));
    return req(`${URLS.profile}/?${qs}`);
  },
  chats: () => req(`${URLS.profile}/?action=chats`),
  messages: (other_id: number, bouquet_id?: number) => {
    const qs = new URLSearchParams({ action: "messages", other_id: String(other_id) });
    if (bouquet_id) qs.set("bouquet_id", String(bouquet_id));
    return req(`${URLS.profile}/?${qs}`);
  },
  sendMessage: (receiver_id: number, text: string, bouquet_id?: number) =>
    req(`${URLS.profile}/?action=send_message`, { method: "POST", body: JSON.stringify({ action: "send_message", receiver_id, text, bouquet_id }) }),
  withdraw: (amount: number, method?: string, details?: string) =>
    req(`${URLS.profile}/?action=withdraw`, { method: "POST", body: JSON.stringify({ action: "withdraw", amount, method, details }) }),
  savePayout: (method: string, details: string) =>
    req(`${URLS.profile}/?action=save_payout`, { method: "POST", body: JSON.stringify({ action: "save_payout", method, details }) }),
  withdrawals: () => req(`${URLS.profile}/?action=withdrawals`),
  addReview: (target_id: number, stars: number, text: string, order_id?: number) =>
    req(`${URLS.profile}/?action=add_review`, { method: "POST", body: JSON.stringify({ action: "add_review", target_id, stars, text, order_id }) }),
};

// ADMIN
export const adminApi = {
  withdrawals: (status?: string) =>
    req(`${URLS.admin}/?action=withdrawals${status ? `&status=${status}` : ""}`),
  approve: (withdrawal_id: number, comment?: string) =>
    req(`${URLS.admin}/?action=approve`, { method: "POST", body: JSON.stringify({ action: "approve", withdrawal_id, comment }) }),
  reject: (withdrawal_id: number, comment?: string) =>
    req(`${URLS.admin}/?action=reject`, { method: "POST", body: JSON.stringify({ action: "reject", withdrawal_id, comment }) }),
  stats: () => req(`${URLS.admin}/?action=stats`),
  subscriptions: () => req(`${URLS.admin}/?action=subscriptions`),
  activateSubscription: (user_id: number, months: number, banner_addon: boolean, deduct_balance = false, ai_recommend = false) =>
    req(`${URLS.admin}/?action=activate_subscription`, { method: "POST", body: JSON.stringify({ action: "activate_subscription", user_id, months, banner_addon, deduct_balance, ai_recommend }) }),
  deactivateSubscription: (user_id: number) =>
    req(`${URLS.admin}/?action=deactivate_subscription`, { method: "POST", body: JSON.stringify({ action: "deactivate_subscription", user_id }) }),
  chats: (flaggedOnly = false) =>
    req(`${URLS.admin}/?action=chats${flaggedOnly ? "&flagged=1" : ""}`),
  chatMessages: (user_a_id: number, user_b_id: number) =>
    req(`${URLS.admin}/?action=chat_messages&user_a_id=${user_a_id}&user_b_id=${user_b_id}`),
  settings: () => req(`${URLS.admin}/?action=settings`),
  setMaintenance: (enabled: boolean) =>
    req(`${URLS.admin}/?action=set_maintenance`, { method: "POST", body: JSON.stringify({ action: "set_maintenance", enabled }) }),
  // Управление пользователями
  users: (q?: string) =>
    req(`${URLS.admin}/?action=users${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  userDetail: (user_id: number) =>
    req(`${URLS.admin}/?action=user_detail&user_id=${user_id}`),
  blockUser: (user_id: number, reason?: string) =>
    req(`${URLS.admin}/?action=block_user`, { method: "POST", body: JSON.stringify({ action: "block_user", user_id, reason }) }),
  unblockUser: (user_id: number) =>
    req(`${URLS.admin}/?action=unblock_user`, { method: "POST", body: JSON.stringify({ action: "unblock_user", user_id }) }),
  deleteUser: (user_id: number) =>
    req(`${URLS.admin}/?action=delete_user`, { method: "POST", body: JSON.stringify({ action: "delete_user", user_id }) }),
  referralPool: () => req(`${URLS.admin}/?action=referral_pool`),
};

// COINS «Лепестки»
export const coinsApi = {
  balance: () => req(`${URLS.coins}/?action=balance`),
  history: () => req(`${URLS.coins}/?action=history`),
  purchase: (amount: number) =>
    req(`${URLS.coins}/?action=purchase`, { method: "POST", body: JSON.stringify({ action: "purchase", amount }) }),
  spend: (kind: string, bouquet_id: number) =>
    req(`${URLS.coins}/?action=spend`, { method: "POST", body: JSON.stringify({ action: "spend", kind, bouquet_id }) }),
  vkSubscribe: () =>
    req(`${URLS.coins}/?action=vk_subscribe`, { method: "POST", body: JSON.stringify({ action: "vk_subscribe" }) }),
};

// ARTICLES (статьи)
export const articlesApi = {
  list: () => req(`${URLS.articles}/?action=list`),
  get: (slug: string) => req(`${URLS.articles}/?action=get&slug=${encodeURIComponent(slug)}`),
  adminList: () => req(`${URLS.articles}/?action=admin_list`),
  generate: (topic: string, category?: string) =>
    req(`${URLS.articles}/?action=generate`, { method: "POST", body: JSON.stringify({ action: "generate", topic, category }) }),
  save: (data: { id?: number; title: string; excerpt?: string; body: string; cover_url?: string; category?: string; is_published?: boolean }) =>
    req(`${URLS.articles}/?action=save`, { method: "POST", body: JSON.stringify({ action: "save", ...data }) }),
  delete: (id: number) =>
    req(`${URLS.articles}/?action=delete`, { method: "POST", body: JSON.stringify({ action: "delete", id }) }),
};

// SHOP PARSER (парсер магазинов)
export const shopParserApi = {
  list: (city?: string) => req(`${URLS.shopParser}/?action=list${city ? `&city=${encodeURIComponent(city)}` : ""}`),
  parse: (city: string, kind?: string, count?: number) =>
    req(`${URLS.shopParser}/?action=parse`, { method: "POST", body: JSON.stringify({ action: "parse", city, kind, count }) }),
  toggleContacted: (id: number) =>
    req(`${URLS.shopParser}/?action=toggle_contacted`, { method: "POST", body: JSON.stringify({ action: "toggle_contacted", id }) }),
  delete: (id: number) =>
    req(`${URLS.shopParser}/?action=delete`, { method: "POST", body: JSON.stringify({ action: "delete", id }) }),
  exportUrl: (city?: string) => `${URLS.shopParser}/?action=export${city ? `&city=${encodeURIComponent(city)}` : ""}`,
};

// Публичный флаг режима доработки (без авторизации)
export const publicApi = {
  maintenance: () => req(`${URLS.admin}/?action=public_settings`),
};

// AI (Mistral): консультант по букетам
export const aiApi = {
  consult: (message: string, history: { role: string; content: string }[], city?: string) =>
    req(`${URLS.ai}/?action=consult`, { method: "POST", body: JSON.stringify({ action: "consult", message, history, city }) }),
};

// PAYMENT (пополнение через ЮKassa)
export const paymentApi = {
  topup: (amount: number) =>
    req(`${URLS.payment}/?action=topup`, { method: "POST", body: JSON.stringify({ action: "topup", amount, return_url: window.location.origin }) }),
};

// ESCROW
export const escrowApi = {
  createOrder: (bouquet_id: number) =>
    req(`${URLS.escrow}/?action=create_order`, { method: "POST", body: JSON.stringify({ action: "create_order", bouquet_id }) }),
  pay: (order_id: number) =>
    req(`${URLS.escrow}/?action=pay`, { method: "POST", body: JSON.stringify({ action: "pay", order_id }) }),
  orderDetail: (id: number) => req(`${URLS.escrow}/?action=order_detail&id=${id}`),
  confirm: (order_id: number) =>
    req(`${URLS.escrow}/?action=confirm`, { method: "POST", body: JSON.stringify({ action: "confirm", order_id }) }),
  dispute: (order_id: number, reason: string) =>
    req(`${URLS.escrow}/?action=dispute`, { method: "POST", body: JSON.stringify({ action: "dispute", order_id, reason }) }),
  myDeals: () => req(`${URLS.escrow}/?action=my_deals`),
};

// OAUTH
// redirect_uri = просто origin без параметров (требование VK Security)
// провайдера передаём через state, он вернётся в URL как ?state=vk
const getRedirectUri = () => window.location.origin;

export const oauthApi = {
  getVkUrl: () => req(`${URLS.oauth}/?action=vk_url&redirect_uri=${encodeURIComponent(getRedirectUri())}&state=vk`),
  vkCallback: (code: string) =>
    req(`${URLS.oauth}/?action=vk_callback`, {
      method: "POST",
      body: JSON.stringify({ action: "vk_callback", code, redirect_uri: getRedirectUri() }),
    }),
  // VK ID SDK (OneTap) — code + device_id от VKID.Auth.exchangeCode
  vkidCallback: (code: string, device_id: string) =>
    req(`${URLS.oauth}/?action=vkid_callback`, {
      method: "POST",
      body: JSON.stringify({ code, device_id }),
    }),
  // URL прокси для загрузки VK ID SDK (обход блокировки CDN браузером)
  vkidSdkUrl: () => URLS.vkidSdk,
  getGoogleUrl: () => req(`${URLS.oauth}/?action=google_url&redirect_uri=${encodeURIComponent(getRedirectUri())}&state=google`),
  googleCallback: (code: string) =>
    req(`${URLS.oauth}/?action=google_callback`, {
      method: "POST",
      body: JSON.stringify({ action: "google_callback", code, redirect_uri: getRedirectUri() }),
    }),
  telegramCallback: (tgData: Record<string, string>) =>
    req(`${URLS.oauth}/?action=telegram_callback`, { method: "POST", body: JSON.stringify({ action: "telegram_callback", telegram_data: tgData }) }),
};

// UPLOAD
export const uploadApi = {
  upload: async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = (reader.result as string).split(",")[1];
        const r = await req(`${URLS.upload}/`, {
          method: "POST",
          body: JSON.stringify({ image: b64, content_type: file.type }),
        });
        resolve(r.ok ? r.data.url : null);
      };
      reader.readAsDataURL(file);
    });
  },
};