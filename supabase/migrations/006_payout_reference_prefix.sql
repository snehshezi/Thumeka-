-- Admin-configurable prefix used when auto-filling the "payment reference"
-- field on the Mark-as-paid form. Reset-safe default keeps existing behaviour.

alter table public.admin_settings
  add column if not exists payout_reference_prefix text not null default 'EFT-';
