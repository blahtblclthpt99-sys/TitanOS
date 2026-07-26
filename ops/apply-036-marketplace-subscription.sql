-- Marketplace modules: included with Premium/Business subscriptions (no $1.99 fee).
BEGIN;

UPDATE public.marketplace_modules
SET
  price = 0,
  price_label = 'Included with Premium'
WHERE true;

COMMIT;
