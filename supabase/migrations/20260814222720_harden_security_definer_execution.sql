alter function public.get_public_contract_by_share_token(text) set search_path = '';
alter function public.sign_public_contract_by_share_token(text,text,text) set search_path = '';
alter function public.is_admin() set search_path = '';
alter function public.is_company_member(text) set search_path = '';

revoke execute on function public.get_public_contract_by_share_token(text) from public;
revoke execute on function public.sign_public_contract_by_share_token(text,text,text) from public;
revoke execute on function public.get_driver_performance_benchmark() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_company_member(text) from public;

grant execute on function public.get_public_contract_by_share_token(text) to anon, authenticated, service_role;
grant execute on function public.sign_public_contract_by_share_token(text,text,text) to anon, authenticated, service_role;
grant execute on function public.get_driver_performance_benchmark() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_company_member(text) to authenticated, service_role;
