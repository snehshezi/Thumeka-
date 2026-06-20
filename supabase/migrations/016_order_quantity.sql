-- Migration 016: Add per-order quantity
--
-- Until now every order was implicitly one unit of the listing. A buyer
-- wanting "3 loaves" had to place three separate orders. Adding a
-- `quantity` column lets the cart, checkout, and provider dashboard all
-- speak the same language: "this order is N units of this listing".
--
-- - `default 1` backfills every existing row to qty=1 — no separate
--   update statement needed and the new column never violates NOT NULL.
-- - The positive-check is the only constraint that's a real business
--   rule (zero or negative quantity is nonsense).
-- - The max-99 check is a sanity bound, not a business rule. It catches
--   typos and a misbehaving client that tries to submit qty=10000;
--   the cart UI caps at 99 too. Bump it later if real demand needs it.
--
-- `listing_price` stays as the *unit* price (per the snapshot semantics
-- the schema has always had). The aggregate columns — `buyer_total`,
-- `commission_amount`, `provider_earning` — store amounts that already
-- incorporate quantity. So downstream payout/transactions/emails don't
-- need to know about quantity; they read the same total fields as
-- before. UI surfaces that show "Subtotal" can derive it as
-- `listing_price * quantity` on the fly.

alter table public.orders
  add column if not exists quantity integer not null default 1;

alter table public.orders
  add constraint orders_quantity_positive check (quantity > 0);
alter table public.orders
  add constraint orders_quantity_max check (quantity <= 99);

comment on column public.orders.quantity is
  'Number of units of listing_id ordered. listing_price stays as the *unit* price; buyer_total / commission_amount / provider_earning already incorporate this multiplier so downstream payout/transactions code is unchanged. UI shows "Subtotal" as listing_price * quantity.';
