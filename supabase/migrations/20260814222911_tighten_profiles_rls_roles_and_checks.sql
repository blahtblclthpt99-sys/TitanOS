alter policy profiles_select on public.profiles
  to authenticated
  using ((id = auth.uid()) or public.is_admin());

alter policy profiles_update on public.profiles
  to authenticated
  using ((id = auth.uid()) or public.is_admin())
  with check ((id = auth.uid()) or public.is_admin());

alter function public.protect_profile_privileges() set search_path = '';
alter function public.profiles_auto_claim_founding() set search_path = '';
revoke execute on function public.protect_profile_privileges() from public, anon, authenticated;
revoke execute on function public.profiles_auto_claim_founding() from public, anon, authenticated;
