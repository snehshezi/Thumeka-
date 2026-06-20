create or replace function public.is_approved_provider_profile(
  provider_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.provider_profiles
    where id = provider_profile_id
      and status = 'approved'
  );
$$;

revoke all on function public.is_approved_provider_profile(uuid) from public;
grant execute on function public.is_approved_provider_profile(uuid) to anon, authenticated;

drop policy if exists "Public can read approved active listings"
on public.listings;

create policy "Public can read approved active listings"
on public.listings for select
using (
  is_active = true
  and admin_disabled = false
  and public.is_approved_provider_profile(provider_id)
);
