-- Откат тестовых балансов
UPDATE t_p84229990_flower_resale_auctio.users SET balance = 0.88 WHERE id = 2;
UPDATE t_p84229990_flower_resale_auctio.users SET balance = 9.00 WHERE id = 5;

-- Деактивируем тестовую сессию user 5
UPDATE t_p84229990_flower_resale_auctio.sessions SET expires_at = NOW() WHERE token = 'test_buyer_token_12345678901234567890123456789012';

-- Деактивируем тестовый баннер
UPDATE t_p84229990_flower_resale_auctio.banners SET is_active = FALSE WHERE title LIKE '[ТЕСТ]%';

-- Архивируем тестовый букет
UPDATE t_p84229990_flower_resale_auctio.bouquets SET status = 'archived' WHERE title LIKE '[ТЕСТ]%';

-- Деактивируем тестовую подписку магазина
UPDATE t_p84229990_flower_resale_auctio.shop_subscriptions SET status = 'expired' WHERE user_id = 2;

-- Убираем тестовый профиль магазина
UPDATE t_p84229990_flower_resale_auctio.shop_profiles SET shop_name = '[ТЕСТ-АРХИВ] ' || shop_name WHERE user_id = 2 AND shop_name LIKE '[ТЕСТ]%';

-- Помечаем тестовую запись platform_earnings
UPDATE t_p84229990_flower_resale_auctio.platform_earnings SET amount = 0 WHERE id = 3 AND order_id = 4;