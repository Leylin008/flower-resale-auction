ALTER TABLE t_p84229990_flower_resale_auctio.shop_profiles ADD COLUMN IF NOT EXISTS city text NULL;

CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.shop_locations (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES t_p84229990_flower_resale_auctio.shop_profiles(id),
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NULL,
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shop_locations_shop_id ON t_p84229990_flower_resale_auctio.shop_locations(shop_id);