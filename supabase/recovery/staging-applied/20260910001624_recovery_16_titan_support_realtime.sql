DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_messages') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_cases') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_cases; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_case_events') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_case_events; END IF;
END $$;