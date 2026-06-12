
-- Push-подписки для браузерных уведомлений
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Уведомления в приложении (колокольчик)
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p84229990_flower_resale_auctio.users(id),
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Автопродление подписок магазинов и баннеров
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.subscription_renewals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
  sub_type TEXT NOT NULL DEFAULT 'shop',
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method_id TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 1990,
  last_payment_id TEXT,
  last_renewed_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sub_type)
);
