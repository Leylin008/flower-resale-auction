
-- Уведомления пользователей
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON t_p84229990_flower_resale_auctio.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON t_p84229990_flower_resale_auctio.notifications(user_id, is_read) WHERE is_read = FALSE;

-- Push-подписки браузера/телефона (Web Push)
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);
