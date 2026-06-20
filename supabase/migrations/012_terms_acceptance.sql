-- Audit trail for Terms & Conditions acceptance at registration.
-- Nullable so existing rows (test users, pre-migration sign-ups) survive
-- without backfill. The registration form ticks this for every new account
-- via app/auth/actions.ts and lib/profile.ts.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_accepted_at is
  'ISO timestamp at which the user ticked "I agree to the T&Cs" on the registration form. NULL for accounts that pre-date the T&C gate.';
