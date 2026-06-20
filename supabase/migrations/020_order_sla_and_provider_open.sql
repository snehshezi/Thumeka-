-- Migration 020: Order SLA timers + Provider open/closed status
--
-- Three intertwined changes that together turn the marketplace from a
-- silent async surface into a live, time-pressured one:
--
--   1. Provider availability — open/closed toggle separate from the
--      existing approval `status`. Denormalised onto listings so the
--      marketplace query (which can't read provider_profiles thanks to
--      that table's banking-details RLS guard from migration 013) can
--      filter / sort / badge without a join.
--
--   2. Per-order SLA deadline columns (`expires_at`,
--      `eft_confirm_due_at`, `driver_assign_due_at`). Set on the order
--      row at each stage transition; UI reads them to render
--      countdowns; the cron sweep uses `expires_at` to auto-expire
--      provider-ignored orders.
--
--   3. New terminal status `expired` (distinct from `cancelled` so
--      buyers see "Seller didn't respond" rather than "Cancelled"),
--      plus a `consecutive_missed_orders` counter + auto-close at the
--      threshold so providers who chronically ignore orders close
--      themselves and must manually reopen.

-- ────────────────────────────────────────────────────────────────────
-- A. Provider availability + accountability fields
-- ────────────────────────────────────────────────────────────────────

alter table public.provider_profiles
  add column if not exists is_open boolean not null default true,
  add column if not exists consecutive_missed_orders integer not null default 0,
  add column if not exists response_rate_pct numeric(5,2) not null default 100.00,
  add column if not exists closed_at timestamptz;

comment on column public.provider_profiles.is_open is
  'True when the store accepts new orders. Toggled manually by the provider OR flipped to false by the cron when consecutive_missed_orders crosses the threshold.';
comment on column public.provider_profiles.consecutive_missed_orders is
  'Reset to 0 on every accept, incremented by 1 on every cron auto-expire. Threshold is hard-coded in sweep_expired_orders() — keep them in sync if you change it.';
comment on column public.provider_profiles.response_rate_pct is
  'Rolling 30-day accept rate, recomputed by the relevant server actions on accept/expire. Denormalised onto listings for marketplace display.';

-- ────────────────────────────────────────────────────────────────────
-- B. Denormalised public-facing provider fields on listings
-- (mirrors the business_name denormalisation from migration 013)
-- ────────────────────────────────────────────────────────────────────

alter table public.listings
  add column if not exists provider_is_open boolean not null default true,
  add column if not exists provider_response_rate_pct numeric(5,2) not null default 100.00;

comment on column public.listings.provider_is_open is
  'Denormalised copy of provider_profiles.is_open. Synced by updateProviderOpenStatusAction and by sweep_expired_orders(). Marketplace sorts by this DESC so open stores show first.';

create index if not exists listings_provider_is_open_idx
  on public.listings (provider_is_open, created_at desc)
  where is_active and not admin_disabled;

-- ────────────────────────────────────────────────────────────────────
-- C. Order deadline columns + admin_settings windows
-- ────────────────────────────────────────────────────────────────────

alter table public.orders
  add column if not exists expires_at timestamptz,
  add column if not exists eft_confirm_due_at timestamptz,
  add column if not exists driver_assign_due_at timestamptz;

comment on column public.orders.expires_at is
  'Provider must accept (or reject) before this point. Set at order creation from admin_settings.provider_acceptance_window_minutes. NULL once the order has moved past order_requested.';
comment on column public.orders.eft_confirm_due_at is
  'Admin should confirm the EFT before this point. Set when the buyer marks the order as EFT-paid (status -> eft_submitted). Cleared on confirm.';
comment on column public.orders.driver_assign_due_at is
  'Admin should assign a driver before this point. Set on payment_confirmed; cleared on driver_assigned.';

alter table public.admin_settings
  add column if not exists eft_confirm_window_minutes integer not null default 30,
  add column if not exists driver_assign_window_minutes integer not null default 60;

-- Useful indexes for the sweep cron + the urgent-action lookups.
create index if not exists orders_expires_at_idx
  on public.orders (expires_at)
  where status = 'order_requested' and expires_at is not null;
create index if not exists orders_eft_confirm_due_at_idx
  on public.orders (eft_confirm_due_at)
  where status = 'eft_submitted' and eft_confirm_due_at is not null;
create index if not exists orders_driver_assign_due_at_idx
  on public.orders (driver_assign_due_at)
  where status = 'payment_confirmed' and driver_assign_due_at is not null;

-- ────────────────────────────────────────────────────────────────────
-- D. New 'expired' terminal status
-- ────────────────────────────────────────────────────────────────────

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (
    status in (
      'order_requested',
      'awaiting_provider_acceptance',
      'provider_rejected',
      'provider_location_warning',
      'accepted_by_provider',
      'delivery_fee_calculated',
      'awaiting_buyer_eft',
      'eft_submitted',
      'payment_confirmed',
      'preparing_or_scheduled',
      'awaiting_driver_assignment',
      'driver_assigned',
      'picked_up',
      'out_for_delivery',
      'service_in_progress',
      'completed',
      'cancelled',
      'issue_reported',
      'expired'
    )
  );

-- ────────────────────────────────────────────────────────────────────
-- E. Sweep function — runs every minute via pg_cron
-- ────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

create or replace function public.sweep_expired_orders() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_order record;
  miss_threshold constant int := 3;
begin
  -- 1. Expire any order_requested past its deadline. `for update skip locked`
  --    keeps overlapping cron runs safe; the row-level lock also serialises
  --    against an in-flight accept (which holds the row for the duration of
  --    its update).
  for expired_order in
    select id, provider_id
      from public.orders
     where status = 'order_requested'
       and expires_at is not null
       and expires_at < now()
     for update skip locked
  loop
    update public.orders
       set status = 'expired',
           cancelled_at = now()
     where id = expired_order.id;

    update public.provider_profiles
       set consecutive_missed_orders = consecutive_missed_orders + 1
     where id = expired_order.provider_id;

    insert into public.order_status_events
      (order_id, old_status, new_status, note)
      values (expired_order.id, 'order_requested', 'expired',
              'Auto-expired — provider did not respond in time');
  end loop;

  -- 2. Auto-close providers that crossed the threshold. The trigger
  --    is "consecutive misses ≥ threshold AND store is currently open"
  --    so a manual close doesn't get clobbered.
  update public.provider_profiles
     set is_open = false,
         closed_at = now()
   where consecutive_missed_orders >= miss_threshold
     and is_open = true;

  -- 3. Cascade-sync the denormalised flag onto listings. Same
  --    transaction so the marketplace can never show "OPEN" on a
  --    listing whose provider just got auto-closed.
  update public.listings l
     set provider_is_open = false
    from public.provider_profiles pp
   where l.provider_id = pp.id
     and pp.is_open = false
     and l.provider_is_open = true;
end;
$$;

comment on function public.sweep_expired_orders() is
  'Run by pg_cron every minute. Auto-expires orders whose acceptance window has passed, increments the misses counter on the relevant provider_profiles, and auto-closes stores that crossed the threshold. Safe to run multiple times concurrently (FOR UPDATE SKIP LOCKED).';

-- Schedule. select-pattern is idempotent: cron.schedule on an existing
-- jobname is treated as no-op by pg_cron 1.4+ but errors on older —
-- guard with the conditional unschedule.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sweep-expired-orders') then
    perform cron.unschedule('sweep-expired-orders');
  end if;
  perform cron.schedule(
    'sweep-expired-orders',
    '* * * * *',
    'select public.sweep_expired_orders()'
  );
end$$;

-- ────────────────────────────────────────────────────────────────────
-- F. Backfill — existing orders + provider stats stay sensible
-- ────────────────────────────────────────────────────────────────────
-- No backfill of `expires_at` is needed for existing orders: anything
-- still in order_requested is from before the timer existed, and the
-- sweep guard `expires_at is not null` means it'll never auto-expire
-- those grandfathered rows. New orders will all carry the column.
--
-- is_open defaults to true → every existing provider opens by
-- default; the marketplace immediately renders everyone with the open
-- glow. The migration is a single transaction; rolling it back is a
-- straight `drop column` per the columns above.
