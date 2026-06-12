ALTER TABLE t_p84229990_flower_resale_auctio.orders
  ADD COLUMN IF NOT EXISTS seller_amount numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'auction';