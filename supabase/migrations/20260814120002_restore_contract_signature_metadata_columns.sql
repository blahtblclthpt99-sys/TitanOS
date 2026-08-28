-- RECOVERY PROVENANCE: restored verbatim from the authoritative applied
-- migration ledger of TitanOS Supabase project xcfjpxcmokdfwkarwomy.

alter table public.contracts add column if not exists customer_signature_image text;
alter table public.contracts add column if not exists owner_signature_image text;
alter table public.contracts add column if not exists signed_user_agent text;
