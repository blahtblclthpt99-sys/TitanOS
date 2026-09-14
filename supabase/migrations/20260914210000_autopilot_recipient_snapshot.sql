-- Titan Autopilot recipient approval contract.
-- Invoices keep the customer email that was attached when the invoice/customer
-- relationship was created. Autopilot orders/claims then persist the exact email
-- approved for delivery so later customer/invoice edits cannot redirect a send.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Backfill historical invoices only from an owner-matched customer relationship.
UPDATE public.invoices AS i
SET customer_email = NULLIF(BTRIM(c.email), '')
FROM public.customers AS c
WHERE NULLIF(BTRIM(i.customer_email), '') IS NULL
  AND NULLIF(BTRIM(i.customer_id), '') IS NOT NULL
  AND c.id::text = i.customer_id
  AND c.created_by_id = i.created_by_id
  AND NULLIF(BTRIM(c.email), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.snapshot_invoice_customer_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NULLIF(BTRIM(NEW.customer_id), '') IS NULL THEN
    NEW.customer_email := NULL;
    RETURN NEW;
  END IF;

  SELECT NULLIF(BTRIM(c.email), '')
    INTO NEW.customer_email
  FROM public.customers AS c
  WHERE c.id::text = NEW.customer_id
    AND c.created_by_id = NEW.created_by_id
  LIMIT 1;

  -- Fail closed: an invoice cannot carry a caller-supplied recovery address
  -- when its customer relationship does not resolve to an owned customer.
  IF NOT FOUND THEN
    NEW.customer_email := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_invoice_customer_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_snapshot_invoice_customer_email ON public.invoices;
CREATE TRIGGER trg_snapshot_invoice_customer_email
BEFORE INSERT OR UPDATE OF customer_id, created_by_id
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_invoice_customer_email();

ALTER TABLE public.autopilot_membership_claims
  ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.autopilot_membership_claims
    ADD CONSTRAINT autopilot_membership_claims_recipient_snapshot_array
    CHECK (jsonb_typeof(recipient_snapshot) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.invoices.customer_email IS
  'Invoice-time customer email snapshot used for explicit Autopilot recipient approval.';
COMMENT ON COLUMN public.autopilot_membership_claims.recipient_snapshot IS
  'Exact invoice_id/customer_email pairs approved when the monthly Autopilot claim was created.';
