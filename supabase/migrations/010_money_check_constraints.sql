-- Defensive money constraints. The app never writes negative values for any
-- of these columns, but a buggy commit or a stray SQL edit could corrupt the
-- ledger silently. Add CHECKs so Postgres refuses bad data at the boundary.

alter table public.orders
  add constraint orders_money_nonneg check (
    listing_price >= 0
    and coalesce(delivery_fee, 0) >= 0
    and coalesce(buyer_total, 0) >= 0
    and coalesce(commission_amount, 0) >= 0
    and coalesce(delivery_commission_amount, 0) >= 0
    and coalesce(provider_earning, 0) >= 0
    and coalesce(driver_earning, 0) >= 0
  );

alter table public.payouts
  add constraint payouts_money_nonneg check (
    gross_amount >= 0
    and commission_amount >= 0
    and net_amount >= 0
  );

alter table public.payout_items
  add constraint payout_items_money_nonneg check (amount >= 0);

alter table public.transactions
  add constraint transactions_money_nonneg check (amount >= 0);
