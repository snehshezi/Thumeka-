-- Retire orders.delivery_fee_overridden.
--
-- The column was a flag for "admin manually overrode the auto-calculated
-- delivery fee" but it was never set by any code path. The accompanying UI
-- (a manual distance-entry / fee-override form) was removed when the
-- un-priced acceptance fallback was retired — every order now arrives priced
-- from the buyer's checkout quote. The column is dead weight.

alter table public.orders
  drop column if exists delivery_fee_overridden;
