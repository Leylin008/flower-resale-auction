-- Модерация сообщений: флаги от AI-проверки
ALTER TABLE t_p84229990_flower_resale_auctio.messages
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;

-- Доп-подписка магазина: AI-рекомендации его букетов в консультанте
ALTER TABLE t_p84229990_flower_resale_auctio.shop_subscriptions
  ADD COLUMN IF NOT EXISTS ai_recommend boolean NOT NULL DEFAULT false;

-- Индекс для быстрого поиска флагнутых сообщений админом
CREATE INDEX IF NOT EXISTS idx_messages_flagged
  ON t_p84229990_flower_resale_auctio.messages (is_flagged)
  WHERE is_flagged = true;