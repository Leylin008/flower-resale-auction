-- Пополняем баланс для тестов
UPDATE t_p84229990_flower_resale_auctio.users SET balance = 10000.00 WHERE id = 2;
UPDATE t_p84229990_flower_resale_auctio.users SET balance = 5000.00, email_verified = TRUE WHERE id = 5;