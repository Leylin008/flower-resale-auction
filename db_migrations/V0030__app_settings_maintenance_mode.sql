CREATE TABLE IF NOT EXISTS t_p84229990_flower_resale_auctio.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO t_p84229990_flower_resale_auctio.app_settings (key, value)
VALUES ('maintenance_mode', 'true')
ON CONFLICT (key) DO NOTHING;