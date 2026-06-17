ALTER TABLE t_p84229990_flower_resale_auctio.articles ADD COLUMN IF NOT EXISTS slug VARCHAR(160);
ALTER TABLE t_p84229990_flower_resale_auctio.articles ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE t_p84229990_flower_resale_auctio.articles ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE t_p84229990_flower_resale_auctio.articles ADD COLUMN IF NOT EXISTS category VARCHAR(60) DEFAULT 'Цветы';
ALTER TABLE t_p84229990_flower_resale_auctio.articles ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE t_p84229990_flower_resale_auctio.articles ALTER COLUMN content SET DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON t_p84229990_flower_resale_auctio.articles(slug);