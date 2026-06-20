-- Driver payouts: split the delivery_fee into driver_earning (92%) and a new
-- delivery_commission_amount (8%) kept by the platform. Allow a single order
-- to appear in both a provider payout AND a driver payout by relaxing the
-- payout_items idempotency to be per recipient_type.

-- 1. Order columns -----------------------------------------------------------

alter table public.orders
  add column if not exists delivery_commission_amount numeric(12, 2) not null default 0;

-- 2. Admin settings ----------------------------------------------------------

alter table public.admin_settings
  add column if not exists delivery_commission_percentage numeric(5, 2) not null default 8;

-- 3. Transactions: new ledger row type ---------------------------------------

alter table public.transactions
  drop constraint if exists transactions_transaction_type_check;

alter table public.transactions
  add constraint transactions_transaction_type_check
    check (
      transaction_type in (
        'buyer_eft_expected',
        'buyer_eft_confirmed',
        'platform_commission',
        'delivery_commission',
        'provider_earning',
        'driver_earning',
        'provider_payout',
        'driver_payout',
        'refund_manual',
        'adjustment'
      )
    );

-- 4. Payout items: per-recipient uniqueness ----------------------------------

alter table public.payout_items
  add column if not exists recipient_type text;

-- Backfill recipient_type from the parent payout for any existing rows.
update public.payout_items pi
set recipient_type = p.recipient_type
from public.payouts p
where pi.payout_id = p.id
  and pi.recipient_type is null;

alter table public.payout_items
  alter column recipient_type set not null;

alter table public.payout_items
  add constraint payout_items_recipient_type_check
    check (recipient_type in ('provider', 'driver'));

-- Drop the old "one order per payout_items row" idempotency and replace with a
-- per-recipient guard so a completed delivery can be in BOTH a provider payout
-- AND a driver payout, but never twice for the same recipient.
drop index if exists public.idx_payout_items_order_id_unique;

create unique index if not exists idx_payout_items_order_recipient_unique
  on public.payout_items (order_id, recipient_type);

-- 5. Backfill existing orders to the new split ------------------------------
--
-- Existing orders with a non-zero delivery fee currently have driver_earning
-- equal to the full delivery fee. Move 8% into delivery_commission_amount and
-- reduce driver_earning so the math reconciles. Only touches rows where
-- delivery_fee > 0 so quote-less orders are left alone.

update public.orders
set
  delivery_commission_amount = round(delivery_fee * 0.08, 2),
  driver_earning = delivery_fee - round(delivery_fee * 0.08, 2)
where delivery_fee > 0
  and delivery_commission_amount = 0;
