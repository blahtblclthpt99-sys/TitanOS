-- Marketplace modules: $1.99 catalog price (listings stay free).
BEGIN;

UPDATE public.marketplace_modules
SET
  price = 1.99,
  price_label = COALESCE(NULLIF(btrim(price_label), 'Free'), '')
WHERE true;

COMMIT;
