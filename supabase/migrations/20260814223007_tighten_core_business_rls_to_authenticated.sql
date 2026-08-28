alter policy customers_all on public.customers to authenticated;
alter policy estimates_all on public.estimates to authenticated;
alter policy expenses_all on public.expenses to authenticated;
alter policy invoices_all on public.invoices to authenticated;
alter policy jobs_all on public.jobs to authenticated;

alter policy employees_select on public.employees to authenticated;
alter policy employees_insert on public.employees to authenticated;
alter policy employees_delete on public.employees to authenticated;
alter policy employees_update on public.employees
  to authenticated
  using ((created_by_id = auth.uid()) or public.is_admin())
  with check ((created_by_id = auth.uid()) or public.is_admin());
