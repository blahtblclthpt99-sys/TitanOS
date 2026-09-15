-- Recovery-compatible durable rate limiting for sensitive TitanOS API routes.
-- Idempotently restores the service-role-only Supabase fallback when a recovered
-- environment does not include the historical durable-rate-limit migration.

CREATE TABLE IF NOT EXISTS public.titan_rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.titan_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.titan_rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titan_rate_limit_buckets TO service_role;

DROP POLICY IF EXISTS titan_rate_limit_buckets_no_client ON public.titan_rate_limit_buckets;
CREATE POLICY titan_rate_limit_buckets_no_client
  ON public.titan_rate_limit_buckets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row public.titan_rate_limit_buckets%ROWTYPE;
  v_window_seconds INTEGER := greatest(1, least(coalesce(p_window_seconds, 60), 86400));
  v_limit INTEGER := greatest(1, least(coalesce(p_limit, 60), 100000));
BEGIN
  IF p_bucket_key IS NULL OR length(p_bucket_key) < 1 OR length(p_bucket_key) > 512 THEN
    RAISE EXCEPTION 'invalid rate-limit bucket';
  END IF;

  INSERT INTO public.titan_rate_limit_buckets (
    bucket_key, request_count, window_started_at, updated_at
  ) VALUES (
    p_bucket_key, 0, v_now, v_now
  ) ON CONFLICT (bucket_key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.titan_rate_limit_buckets
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF v_row.window_started_at + make_interval(secs => v_window_seconds) <= v_now THEN
    UPDATE public.titan_rate_limit_buckets
    SET request_count = 1,
        window_started_at = v_now,
        updated_at = v_now
    WHERE bucket_key = p_bucket_key;
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  IF v_row.request_count >= v_limit THEN
    RETURN QUERY
      SELECT false,
        greatest(
          1,
          ceil(extract(epoch FROM (
            (v_row.window_started_at + make_interval(secs => v_window_seconds)) - v_now
          )))::INTEGER
        );
    RETURN;
  END IF;

  UPDATE public.titan_rate_limit_buckets
  SET request_count = request_count + 1,
      updated_at = v_now
  WHERE bucket_key = p_bucket_key;

  RETURN QUERY SELECT true, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) IS
  'Server-only durable fixed-window rate limiter used by sensitive TitanOS API routes.';
