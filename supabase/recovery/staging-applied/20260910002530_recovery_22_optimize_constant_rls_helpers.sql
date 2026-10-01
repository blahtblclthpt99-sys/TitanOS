DO $$
DECLARE r record; q2 text; w2 text; stmt text;
BEGIN
  FOR r IN SELECT schemaname,tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname='public'
  LOOP
    q2 := replace(replace(replace(r.qual,'is_support_admin()','(select public.is_support_admin())'),'is_support_staff()','(select public.is_support_staff())'),'is_admin()','(select public.is_admin())');
    w2 := replace(replace(replace(r.with_check,'is_support_admin()','(select public.is_support_admin())'),'is_support_staff()','(select public.is_support_staff())'),'is_admin()','(select public.is_admin())');
    IF q2 IS DISTINCT FROM r.qual OR w2 IS DISTINCT FROM r.with_check THEN
      stmt := format('ALTER POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
      IF q2 IS NOT NULL THEN stmt := stmt || format(' USING (%s)',q2); END IF;
      IF w2 IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)',w2); END IF;
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;