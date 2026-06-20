-- Provider geocoded coordinates, captured during application and defaulted onto
-- listings so delivery distance can be calculated automatically.
alter table public.provider_profiles
  add column if not exists provider_lat numeric(10, 7),
  add column if not exists provider_lng numeric(10, 7);
