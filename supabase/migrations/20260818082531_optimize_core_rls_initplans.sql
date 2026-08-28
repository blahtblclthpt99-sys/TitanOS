-- RECOVERY PROVENANCE: restored verbatim from the authoritative applied
-- migration ledger of TitanOS Supabase project xcfjpxcmokdfwkarwomy.

-- TitanOS scalability hardening.
--
-- Preserve the existing access rules while making request-constant Auth/admin
-- predicates PostgreSQL init plans instead of reevaluating them for every row.
-- This follows Supabase's RLS performance guidance: wrap auth.uid()/stable
-- request predicates in scalar SELECTs when they do not depend on the row.
--
-- Do not broaden company-member permissions here. Row-dependent
-- is_company_member(company_id) remains row-dependent by design.

-- Core money-path FK and membership lookup indexes.
create index if not exists idx_payments_created_by_id
  on public.payments(created_by_id);

create index if not exists idx_company_members_company_user_active
  on public.company_members(company_id, user_id)
  where status = 'active';

-- Profiles.
alter policy profiles_select on public.profiles
  using (
    id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy profiles_update on public.profiles
  using (
    id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    id = (select auth.uid())
    or (select public.is_admin())
  );

-- Customers.
alter policy customers_all on public.customers
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy customers_company_read on public.customers
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

alter policy customers_company_update on public.customers
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

-- Estimates.
alter policy estimates_all on public.estimates
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy estimates_company_read on public.estimates
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

alter policy estimates_company_update on public.estimates
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

-- Invoices.
alter policy invoices_all on public.invoices
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy invoices_company_read on public.invoices
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

alter policy invoices_company_update on public.invoices
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

-- Jobs. Assigned workers keep read/update access under the existing ALL policy;
-- writes still require owner/admin through WITH CHECK.
alter policy jobs_all on public.jobs
  using (
    created_by_id = (select auth.uid())
    or assigned_to = (select auth.uid())::text
    or (select public.is_admin())
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy jobs_company_read on public.jobs
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

alter policy jobs_company_update on public.jobs
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(company_id)
  );

-- Payments. Status authority remains unchanged: non-admin users cannot write
-- succeeded/refunded states.
alter policy payments_insert on public.payments
  with check (
    (
      created_by_id = (select auth.uid())
      or user_id = (select auth.uid())::text
    )
    and coalesce(status, 'pending') <> all (array['succeeded'::text, 'refunded'::text])
  );

alter policy payments_select on public.payments
  using (
    created_by_id = (select auth.uid())
    or user_id = (select auth.uid())::text
    or (select public.is_admin())
  );

alter policy payments_update on public.payments
  using (
    created_by_id = (select auth.uid())
    or user_id = (select auth.uid())::text
    or (select public.is_admin())
  )
  with check (
    (select public.is_admin())
    or (
      (
        created_by_id = (select auth.uid())
        or user_id = (select auth.uid())::text
      )
      and coalesce(status, 'pending') <> all (array['succeeded'::text, 'refunded'::text])
    )
  );

alter policy payments_delete on public.payments
  using ((select public.is_admin()));
