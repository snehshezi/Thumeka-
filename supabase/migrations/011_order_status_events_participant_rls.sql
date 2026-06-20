-- Tighten the order_status_events INSERT policy. The original only checked
-- `changed_by = current_profile_id()`, which let any authenticated user
-- fabricate status events for other people's orders as long as they set the
-- changed_by field to themselves. Now we additionally require the caller to
-- be a participant in the parent order (buyer, provider's user, driver's
-- user) — or an admin.
--
-- SELECT policy already gates via `exists (select 1 from public.orders ...)`
-- which respects the orders table's own RLS, so reads were already safe.

drop policy if exists "Authenticated participants can create status events"
  on public.order_status_events;

create policy "Order participants can create status events"
on public.order_status_events for insert
with check (
  (changed_by = public.current_profile_id() or public.is_admin())
  and (
    public.is_admin()
    or exists (
      select 1
      from public.orders o
      where o.id = order_status_events.order_id
        and (
          o.buyer_id = public.current_profile_id()
          or o.provider_id in (
            select pp.id from public.provider_profiles pp
            where pp.user_id = public.current_profile_id()
          )
          or o.driver_id in (
            select dp.id from public.driver_profiles dp
            where dp.user_id = public.current_profile_id()
          )
        )
    )
  )
);
