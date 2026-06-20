-- Migration 018: order_items + buyer_whatsapp
--
-- Two checkout changes bundled here because they ship together:
--
--   1. order_items table. Until now every order was implicitly one line
--      (orders.listing_id + orders.quantity). The cart already supported
--      multi-line carts; only the checkout flow blocked them. This adds
--      the line-item join so a single order can hold N listings from
--      one seller.
--
--   2. orders.buyer_whatsapp. We're dropping the visible email input at
--      checkout in favour of a buyer-provided WhatsApp number — used
--      for the post-acceptance "send proof of payment" flow via
--      wa.me/<support>. buyer_email keeps being populated silently from
--      profile.email so any backend emails (provider notification,
--      etc.) still work.
--
-- Design notes:
--   - orders.listing_id / orders.listing_price / orders.quantity stay
--     NOT NULL. New multi-item orders set them from the *primary* line
--     (first cart item) + total qty. They become informational at the
--     order level; the authoritative line list lives in order_items.
--     Existing UI surfaces that read these columns keep working.
--   - The quantity <= 99 per-order check is dropped because a 3-line
--     order with qty 50/50/50 = 150 total. The per-line cap of 99 in
--     order_items still applies.

create table public.order_items (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  listing_id      uuid not null references public.listings(id),
  -- Snapshots so historical orders render correctly even if the listing
  -- is renamed or re-priced later.
  listing_title   text not null,
  listing_price   numeric(12,2) not null,
  quantity        integer not null check (quantity > 0 and quantity <= 99),
  line_subtotal   numeric(12,2) not null,
  -- Display ordering. Multi-item orders should render in the order the
  -- buyer added them to the cart, so the checkout action stamps an
  -- incrementing position starting at 0.
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_order_items_order_id on public.order_items(order_id);

-- Backfill: every existing order has exactly one implicit line item.
-- left join on listings to tolerate orders whose listing was hard-deleted
-- (shouldn't happen — orders.listing_id is FK-constrained — but defensive).
insert into public.order_items
  (order_id, listing_id, listing_title, listing_price, quantity, line_subtotal, position)
select
  o.id,
  o.listing_id,
  coalesce(l.title, 'Listing'),
  o.listing_price,
  o.quantity,
  o.listing_price * o.quantity,
  0
from public.orders o
left join public.listings l on l.id = o.listing_id;

-- Per-order quantity cap retired. Per-line cap of 99 lives on
-- order_items.quantity now.
alter table public.orders drop constraint if exists orders_quantity_max;

-- Buyer's WhatsApp number, ZA-format. Distinct from buyer_phone (which
-- stays for the provider's reach-out-by-call channel) — some buyers
-- have one number for calls and another for WhatsApp. Nullable so
-- historical orders parse.
alter table public.orders
  add column if not exists buyer_whatsapp text;

-- RLS on order_items mirrors the orders + transactions policies: the
-- buyer, the provider, and admins can SELECT; only admins can write.
-- The application's checkout helper uses the user's authenticated
-- session for inserts, so we also allow the buyer to insert items
-- linked to their own orders (mirrors the buyer-can-insert-orders
-- policy on orders).
alter table public.order_items enable row level security;

create policy "Order participants can read their order items"
on public.order_items for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (
        orders.buyer_id = public.current_profile_id()
        or orders.provider_id in (
          select id from public.provider_profiles
          where user_id = public.current_profile_id()
        )
        or public.is_admin()
      )
  )
);

create policy "Buyers can insert items for their own orders"
on public.order_items for insert
with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.buyer_id = public.current_profile_id()
  )
);

create policy "Admins can write order items"
on public.order_items for all
using (public.is_admin())
with check (public.is_admin());

comment on table public.order_items is
  'Line items for an order. orders.listing_id / listing_price / quantity remain populated from the *primary* (first) line for back-compat; the authoritative list of what was ordered lives here.';
comment on column public.orders.buyer_whatsapp is
  'Buyer''s WhatsApp number (ZA format). Captured at checkout for the post-acceptance "send proof of payment via wa.me/<support>" flow.';
