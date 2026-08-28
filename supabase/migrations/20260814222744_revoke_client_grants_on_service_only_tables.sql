revoke all privileges on table public.portal_sessions from anon, authenticated;
revoke all privileges on table public.titan_comms_channel_secrets from anon, authenticated;

grant select, insert, update, delete on table public.portal_sessions to service_role;
grant select, insert, update, delete on table public.titan_comms_channel_secrets to service_role;
