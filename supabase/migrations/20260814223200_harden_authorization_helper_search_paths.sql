alter function public.is_admin() set search_path = '';
alter function public.is_company_member(text) set search_path = '';
alter function public.get_public_contract_by_share_token(text) set search_path = '';
alter function public.sign_public_contract_by_share_token(text,text,text) set search_path = '';
