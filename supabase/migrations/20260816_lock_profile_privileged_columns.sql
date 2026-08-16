-- Harden public.profiles against self-service privilege/entitlement escalation.
--
-- profiles_update intentionally lets an authenticated user edit their own row,
-- but table-level UPDATE previously allowed every column, including role and
-- billing/entitlement state. Restrict direct client updates to the same bounded
-- set of user-editable fields used by TitanOS's updateMe path.

revoke update on table public.profiles from authenticated;
revoke insert, delete, truncate, references, trigger on table public.profiles from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon;

grant update (
  full_name,
  phone,
  username,
  avatar_url,
  bio,
  city,
  state,
  company_name,
  company_address,
  company_city,
  company_state,
  company_zip,
  company_logo_url,
  theme_pref,
  notification_prefs,
  marketing_prefs,
  privacy_prefs,
  professional_profile,
  community_opt_in,
  referral_code,
  referred_by_code,
  active_company_id,
  updated_at
) on table public.profiles to authenticated;

comment on table public.profiles is
  'TitanOS user profiles. Client UPDATE is column-restricted; admin, entitlement, founding, verification, and billing state are server-owned.';
