-- Migration 013: Denormalise provider business_name onto listings
--
-- The marketplace UI shows the seller's business name on listing cards and
-- on the listing detail page. Joining provider_profiles publicly is blocked
-- by RLS — the provider_profiles SELECT policy is owner/admin only, so
-- anonymous visitors get NULL for the join.
--
-- We could open provider_profiles up with a permissive SELECT policy, but
-- the table also holds bank account numbers and physical addresses. Since
-- Supabase RLS gates rows and not columns, a permissive policy would expose
-- bank details to anyone with the publishable anon key.
--
-- Storing business_name on the listing row is the simplest secure fix:
--   * the marketplace SELECTs it like any other listing column
--   * the existing listings RLS already controls who sees them
--   * no risk of leaking sensitive provider fields via the REST API
--
-- Sellers rarely rename their business; if they do, existing listings keep
-- the old name until edited. That's acceptable for the MVP — we can sync
-- via a trigger later if it becomes a problem.

alter table public.listings
  add column if not exists business_name text;

-- Backfill from approved providers so existing listings get their seller
-- attribution. Listings under not-yet-approved providers stay NULL — they
-- shouldn't be visible publicly anyway (gated by listings.is_active).
update public.listings l
   set business_name = pp.business_name
  from public.provider_profiles pp
 where l.provider_id = pp.id
   and l.business_name is null;

comment on column public.listings.business_name is
  'Denormalised copy of provider_profiles.business_name. Populated by submitListingAction on create and (later) on seller edits. Avoids joining provider_profiles publicly, which would expose bank details + address via the REST API given the RLS gates rows but not columns.';
