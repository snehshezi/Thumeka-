-- Migration 014: Allow providers (and admins) to DELETE their own listings.
--
-- Without an explicit DELETE policy, Supabase RLS denies the operation
-- silently — the DELETE statement runs against zero matching rows, the
-- client gets back { error: null, count: 0 }, and our server action thinks
-- the delete succeeded. Result: seller clicks Delete, dashboard shows
-- "Listing deleted", but the row stays in the database and the listing
-- still renders on the marketplace.
--
-- This policy mirrors the existing UPDATE policy on listings — a row is
-- deletable when the caller is either an admin or the provider that owns
-- it (via provider_profiles.user_id == current_profile_id()).
--
-- Listings with orders still can't be deleted: the orders.listing_id FK
-- is RESTRICT, so Postgres blocks the delete at the constraint layer
-- (which our action catches as error code 23503 and surfaces as a
-- "deactivate instead" message). RLS is the layer this migration unlocks;
-- the FK is the safety net beneath it.

create policy "Providers and admins can delete listings"
on public.listings for delete
using (
  public.is_admin()
  or exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = listings.provider_id
      and provider_profiles.user_id = public.current_profile_id()
  )
);
