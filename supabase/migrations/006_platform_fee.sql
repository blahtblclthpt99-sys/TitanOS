-- Platform fee fields on payments (0.76% TitanOS fee)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS base_amount NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS platform_fee NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS platform_fee_rate NUMERIC NOT NULL DEFAULT 0.0076;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_total NUMERIC;

COMMENT ON COLUMN public.payments.base_amount IS 'Invoice/service amount before TitanOS fee';
COMMENT ON COLUMN public.payments.platform_fee IS 'TitanOS platform fee (0.76% of base)';
COMMENT ON COLUMN public.payments.amount_total IS 'Total charged to customer (base + platform_fee)';
COMMENT ON COLUMN public.payments.amount IS 'Legacy amount field; prefer amount_total for charged total';
