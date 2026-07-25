-- Marketplace is free: zero catalog prices + marketplace fee categories.
-- Invoice/payment fees (service_requests) are unchanged.

BEGIN;

UPDATE public.marketplace_modules
SET
  price = 0,
  price_label = 'Free'
WHERE COALESCE(price, 0) <> 0
   OR COALESCE(price_label, '') IS DISTINCT FROM 'Free';

-- Zero marketplace sales fee (keep service_requests rates intact)
UPDATE public.fee_rules
SET
  percentage_rate = 0,
  flat_amount = 0,
  rule_type = 'percentage',
  label = 'Marketplace free 0%',
  notes = COALESCE(notes, '') || ' | free marketplace 028'
WHERE category_id = 'marketplace_sales'
  AND enabled = true;

UPDATE public.fee_rules
SET
  percentage_rate = 0,
  flat_amount = 0,
  rule_type = 'flat',
  label = 'Featured listing free',
  notes = COALESCE(notes, '') || ' | free marketplace 028'
WHERE category_id = 'featured_listings'
  AND enabled = true;

COMMIT;
