-- TitanOS 2.0 / 5000X: Stripe settlement integrity
-- Additive and safe to re-run. Production webhook already writes invoices.paid_at.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_paid_at
  ON public.invoices (paid_at DESC)
  WHERE paid_at IS NOT NULL;

COMMENT ON COLUMN public.invoices.paid_at IS
  'Authoritative payment settlement timestamp. Set only by trusted server/payment lifecycle paths.';
