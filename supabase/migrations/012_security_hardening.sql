-- Harden public contract access: stop enumerating all sent contracts.
-- Replace broad "share_token IS NOT NULL" with token-equality RPC pattern.

DROP POLICY IF EXISTS contracts_public_read ON public.contracts;

-- Authenticated owners keep existing policies (if any). Public access goes through RPCs.

CREATE OR REPLACE FUNCTION public.get_contract_by_share_token(p_token text)
RETURNS SETOF public.contracts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.contracts
  WHERE share_token = p_token
    AND share_token IS NOT NULL
    AND length(p_token) >= 16
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sign_contract_by_share_token(
  p_token text,
  p_signature text,
  p_signature_image text DEFAULT NULL
)
RETURNS SETOF public.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts
  SET
    customer_signature = COALESCE(NULLIF(p_signature, ''), customer_signature),
    customer_signature_image = COALESCE(p_signature_image, customer_signature_image),
    status = CASE
      WHEN owner_signature IS NOT NULL AND NULLIF(p_signature, '') IS NOT NULL THEN 'signed'
      ELSE status
    END,
    signed_at = CASE
      WHEN owner_signature IS NOT NULL AND NULLIF(p_signature, '') IS NOT NULL THEN now()
      ELSE signed_at
    END,
    updated_at = now()
  WHERE share_token = p_token
    AND share_token IS NOT NULL
    AND length(p_token) >= 16;

  RETURN QUERY SELECT * FROM public.contracts WHERE share_token = p_token LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_contract_by_share_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sign_contract_by_share_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_by_share_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_by_share_token(text, text, text) TO anon, authenticated;
