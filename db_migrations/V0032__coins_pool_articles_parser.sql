-- Таблица транзакций баллов «Лепестки»
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.coin_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.users(id),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    type VARCHAR(32) NOT NULL,
    reason TEXT,
    ref_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON t_p84229990_flower_resale_auctio.coin_transactions(user_id);

-- Реферальный пул: накопление 0,5% по годам
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.referral_pool (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    distributed BOOLEAN NOT NULL DEFAULT FALSE,
    distributed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(year)
);

-- Вклады в реферальный пул (для прозрачности)
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.referral_pool_contributions (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    order_id INTEGER,
    amount NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Статьи (генерируемые через Mistral + ручные)
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.articles (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(160) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    excerpt TEXT,
    body TEXT NOT NULL,
    cover_url TEXT,
    category VARCHAR(60) DEFAULT 'Цветы',
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    views INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articles_published ON t_p84229990_flower_resale_auctio.articles(is_published);

-- Спарсенные контакты магазинов (парсер через Mistral)
CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.parsed_shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    city VARCHAR(100),
    phone VARCHAR(64),
    email VARCHAR(255),
    website VARCHAR(255),
    instagram VARCHAR(255),
    address TEXT,
    note TEXT,
    contacted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parsed_shops_city ON t_p84229990_flower_resale_auctio.parsed_shops(city);