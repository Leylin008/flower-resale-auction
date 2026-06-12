
-- Тип продажи букета: auction, fixed, reserve
ALTER TABLE t_p84229990_flower_resale_auctio.bouquets
  ADD COLUMN IF NOT EXISTS sale_type TEXT NOT NULL DEFAULT 'auction',
  ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS reserve_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reserve_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reserved_by INTEGER REFERENCES t_p84229990_flower_resale_auctio.users(id),
  ADD COLUMN IF NOT EXISTS shop_id INTEGER;

-- Профили магазинов цветов
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.shop_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
  shop_name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Подписки магазинов
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.shop_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  banner_addon BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Рекламные баннеры (управляются администратором)
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.banners (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  link_url TEXT,
  description TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Клики по баннерам
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.banner_clicks (
  id SERIAL PRIMARY KEY,
  banner_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.banners(id),
  user_id INTEGER REFERENCES t_p84229990_flower_resale_auctio.users(id),
  ip TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
