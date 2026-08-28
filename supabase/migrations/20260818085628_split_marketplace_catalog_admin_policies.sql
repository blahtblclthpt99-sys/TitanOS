-- RECOVERY PROVENANCE: restored verbatim from the authoritative applied
-- migration ledger of TitanOS Supabase project xcfjpxcmokdfwkarwomy.

drop policy if exists marketplace_modules_admin on public.marketplace_modules;

create policy marketplace_modules_admin_insert
  on public.marketplace_modules
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy marketplace_modules_admin_update
  on public.marketplace_modules
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy marketplace_modules_admin_delete
  on public.marketplace_modules
  for delete
  to authenticated
  using ((select public.is_admin()));
