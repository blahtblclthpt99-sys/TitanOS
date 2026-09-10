DO $$
DECLARE
  rec record;
  idx_name text;
  cols_sql text;
BEGIN
  FOR rec IN
    WITH fk AS (
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name,
        con.conkey AS attnums,
        array_agg(a.attname ORDER BY u.ord) AS columns
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = u.attnum
      WHERE con.contype = 'f'
        AND n.nspname = 'public'
        AND c.relname = ANY (ARRAY[
          'activity_events','availability_slots','beta_feedbacks','beta_signups','booking_pages','booking_requests',
          'community_comments','community_likes','community_posts','companies','company_members','contracts','credentials',
          'customer_communications','customer_files','customers','developer_applications','emergency_jobs','employees',
          'equipment','escrow_holds','estimates','expenses','fee_calculation_logs','fee_categories','fee_rule_history',
          'fee_rules','follow_up_queue','follow_up_rules','hire_applications','hire_jobs','hire_saves','insurance_docs',
          'inventory_items','invoices','job_checkins','job_photos','job_reviews','jobs','leads','loyalty_events',
          'loyalty_members','marketing_assets','marketplace_favorites','marketplace_listings','marketplace_messages',
          'marketplace_modules','marketplace_reports','marketplace_reviews','mileage_trips','module_installs','module_waitlists',
          'notifications','payment_accounts','payments','phone_scripts','portal_actions','portal_sessions','price_estimates',
          'profiles','receipt_scans','referrals','stripe_webhook_events','support_agent_assignments','support_article_versions',
          'support_articles','support_attachments','support_audit_logs','support_case_events','support_cases','support_csat',
          'support_diagnostics','support_incident_cases','support_incidents','support_messages','titan_comms_channel_secrets',
          'titan_comms_channels','titan_comms_members','titan_comms_messages'
        ])
      GROUP BY n.nspname,c.relname,con.conname,con.conkey,c.oid
    )
    SELECT fk.*
    FROM fk
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = format('%I.%I', fk.schema_name, fk.table_name)::regclass
        AND i.indisvalid
        AND (i.indkey::smallint[])[0:cardinality(fk.attnums)-1] = fk.attnums
    )
    ORDER BY table_name, constraint_name
  LOOP
    idx_name := left('idx_fk_' || rec.table_name || '_' || array_to_string(rec.columns, '_'), 60);
    SELECT string_agg(quote_ident(col), ', ')
      INTO cols_sql
      FROM unnest(rec.columns) AS col;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)', idx_name, rec.schema_name, rec.table_name, cols_sql);
  END LOOP;
END $$;