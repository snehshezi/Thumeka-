create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  role text not null check (role in ('buyer', 'provider', 'driver', 'admin')),
  full_name text,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  business_name text,
  provider_type text check (provider_type in ('individual', 'business')),
  description text,
  suburb text,
  address text,
  bank_account_name text,
  bank_name text,
  bank_account_number text,
  bank_branch_code text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  rejection_reason text,
  admin_notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  vehicle_type text,
  vehicle_licence_number text,
  bank_account_name text,
  bank_name text,
  bank_account_number text,
  bank_branch_code text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'suspended')),
  availability_status text not null default 'unavailable'
    check (availability_status in ('unavailable', 'available', 'busy', 'suspended')),
  rejection_reason text,
  admin_notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  owner_type text not null check (owner_type in ('provider', 'driver')),
  document_type text not null,
  file_url text,
  submitted_via text not null default 'upload'
    check (submitted_via in ('upload', 'email', 'admin_note')),
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.listings (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  title text not null,
  description text not null,
  listing_type text not null check (listing_type in ('product', 'service', 'errand')),
  price numeric(12,2) not null check (price >= 0),
  pricing_type text not null default 'fixed'
    check (pricing_type in ('fixed', 'from', 'quote_required', 'hourly', 'daily')),
  suburb text,
  location_notes text,
  fulfillment_address text,
  fulfillment_lat numeric(10,7),
  fulfillment_lng numeric(10,7),
  image_url text,
  gallery_urls text[],
  requires_datetime boolean not null default false,
  requires_location boolean not null default false,
  requires_instructions boolean not null default false,
  requires_quote boolean not null default false,
  availability_notes text,
  is_active boolean not null default true,
  admin_disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.provider_profiles(id),
  listing_id uuid not null references public.listings(id),
  driver_id uuid references public.driver_profiles(id),
  order_type text not null check (order_type in ('product', 'service', 'errand')),
  status text not null default 'order_requested'
    check (
      status in (
        'order_requested',
        'awaiting_provider_acceptance',
        'provider_rejected',
        'provider_location_warning',
        'accepted_by_provider',
        'delivery_fee_calculated',
        'awaiting_buyer_eft',
        'eft_submitted',
        'payment_confirmed',
        'preparing_or_scheduled',
        'awaiting_driver_assignment',
        'driver_assigned',
        'picked_up',
        'out_for_delivery',
        'service_in_progress',
        'completed',
        'cancelled',
        'issue_reported'
      )
    ),
  buyer_name text not null,
  buyer_phone text not null,
  buyer_email text not null,
  delivery_address text,
  delivery_lat numeric(10,7),
  delivery_lng numeric(10,7),
  suburb text,
  buyer_notes text,
  requested_date date,
  requested_time time,
  listing_price numeric(12,2) not null,
  delivery_distance_km numeric(10,2),
  delivery_base_fee numeric(12,2) default 36,
  delivery_price_per_km numeric(12,2),
  delivery_fee numeric(12,2) not null default 0,
  delivery_fee_overridden boolean not null default false,
  buyer_total numeric(12,2) not null default 0,
  commission_percentage numeric(5,2) not null default 12,
  commission_amount numeric(12,2) not null default 0,
  provider_earning numeric(12,2) not null default 0,
  driver_earning numeric(12,2) not null default 0,
  payment_method text not null default 'eft' check (payment_method = 'eft'),
  payment_status text not null default 'not_requested'
    check (
      payment_status in (
        'not_requested',
        'awaiting_buyer_eft',
        'eft_submitted',
        'confirmed',
        'failed',
        'refunded_manual'
      )
    ),
  payment_reference text,
  provider_location_checked boolean not null default false,
  provider_accept_lat numeric(10,7),
  provider_accept_lng numeric(10,7),
  provider_location_distance_km numeric(10,2),
  provider_location_warning boolean not null default false,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_status_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.admin_settings (
  id uuid primary key default uuid_generate_v4(),
  commission_percentage numeric(5,2) not null default 12,
  commission_change_requires_confirmation boolean not null default true,
  driver_payout_day text not null default 'Monday',
  provider_payout_day text not null default 'Wednesday',
  support_whatsapp_number text,
  support_email text,
  driver_base_rate numeric(12,2) not null default 36,
  driver_per_km_rate numeric(12,2),
  default_delivery_fee numeric(12,2),
  eft_payment_instructions text,
  provider_location_warning_threshold_km numeric(8,2) not null default 3,
  provider_acceptance_window_minutes integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id),
  transaction_type text not null
    check (
      transaction_type in (
        'buyer_eft_expected',
        'buyer_eft_confirmed',
        'platform_commission',
        'provider_earning',
        'driver_earning',
        'provider_payout',
        'driver_payout',
        'refund_manual',
        'adjustment'
      )
    ),
  amount numeric(12,2) not null,
  direction text not null check (direction in ('debit', 'credit')),
  status text not null,
  reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default uuid_generate_v4(),
  recipient_user_id uuid not null references public.profiles(id),
  recipient_type text not null check (recipient_type in ('provider', 'driver')),
  period_start date not null,
  period_end date not null,
  gross_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  payment_reference text,
  admin_notes text,
  created_at timestamptz not null default now()
);

create table public.payout_items (
  id uuid primary key default uuid_generate_v4(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references public.profiles(id),
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index idx_profiles_auth_user_id on public.profiles(auth_user_id);
create index idx_profiles_role on public.profiles(role);
create index idx_provider_profiles_user_id on public.provider_profiles(user_id);
create index idx_provider_profiles_status on public.provider_profiles(status);
create index idx_driver_profiles_user_id on public.driver_profiles(user_id);
create index idx_driver_profiles_approval_status on public.driver_profiles(approval_status);
create index idx_driver_profiles_availability_status on public.driver_profiles(availability_status);
create index idx_documents_owner on public.documents(owner_user_id, owner_type);
create index idx_listings_provider_id on public.listings(provider_id);
create index idx_listings_category_id on public.listings(category_id);
create index idx_listings_public on public.listings(is_active, admin_disabled);
create index idx_orders_buyer_id on public.orders(buyer_id);
create index idx_orders_provider_id on public.orders(provider_id);
create index idx_orders_driver_id on public.orders(driver_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_payment_status on public.orders(payment_status);
create index idx_transactions_order_id on public.transactions(order_id);
create index idx_payouts_recipient on public.payouts(recipient_user_id, recipient_type);
create index idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger provider_profiles_set_updated_at
before update on public.provider_profiles
for each row execute function public.set_updated_at();

create trigger driver_profiles_set_updated_at
before update on public.driver_profiles
for each row execute function public.set_updated_at();

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger admin_settings_set_updated_at
before update on public.admin_settings
for each row execute function public.set_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.is_approved_provider(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.provider_profiles
    where user_id = profile_id
      and status = 'approved'
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  profile_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'buyer');

  if requested_role not in ('buyer', 'provider', 'driver') then
    requested_role := 'buyer';
  end if;

  if lower(coalesce(new.email, '')) = 'admin@thumeka.co.za' then
    profile_role := 'admin';
  else
    profile_role := requested_role;
  end if;

  insert into public.profiles (
    auth_user_id,
    role,
    full_name,
    email,
    phone
  )
  values (
    new.id,
    profile_role,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (auth_user_id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.categories (name, slug, sort_order)
values
  ('Food', 'food', 1),
  ('Groceries', 'groceries', 2),
  ('Clothing', 'clothing', 3),
  ('Beauty', 'beauty', 4),
  ('Home services', 'home-services', 5),
  ('Cleaning', 'cleaning', 6),
  ('Repairs', 'repairs', 7),
  ('Errands', 'errands', 8),
  ('Transport', 'transport', 9),
  ('Digital services', 'digital-services', 10),
  ('Other', 'other', 11)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.admin_settings (
  commission_percentage,
  driver_payout_day,
  provider_payout_day,
  driver_base_rate,
  default_delivery_fee
)
select
  12,
  'Monday',
  'Wednesday',
  36,
  36
where not exists (select 1 from public.admin_settings);

alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.documents enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_events enable row level security;
alter table public.admin_settings enable row level security;
alter table public.transactions enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_items enable row level security;
alter table public.audit_logs enable row level security;

create policy "Profiles are readable by owner or admin"
on public.profiles for select
using (auth_user_id = auth.uid() or public.is_admin());

create policy "Users can create their own profile"
on public.profiles for insert
with check (
  auth_user_id = auth.uid()
  and (
    role <> 'admin'
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@thumeka.co.za'
  )
);

create policy "Users can update their own profile"
on public.profiles for update
using (auth_user_id = auth.uid())
with check (
  auth_user_id = auth.uid()
  and role = public.current_profile_role()
);

create policy "Admins can manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Provider profiles are readable by owner or admin"
on public.provider_profiles for select
using (user_id = public.current_profile_id() or public.is_admin());

create policy "Providers can create their own application"
on public.provider_profiles for insert
with check (
  user_id = public.current_profile_id()
  and public.current_profile_role() = 'provider'
);

create policy "Providers can update their own application"
on public.provider_profiles for update
using (user_id = public.current_profile_id() or public.is_admin())
with check (
  (user_id = public.current_profile_id() and public.current_profile_role() = 'provider')
  or public.is_admin()
);

create policy "Driver profiles are readable by owner or admin"
on public.driver_profiles for select
using (user_id = public.current_profile_id() or public.is_admin());

create policy "Drivers can create their own application"
on public.driver_profiles for insert
with check (
  user_id = public.current_profile_id()
  and public.current_profile_role() = 'driver'
);

create policy "Drivers can update their own application"
on public.driver_profiles for update
using (user_id = public.current_profile_id() or public.is_admin())
with check (
  (user_id = public.current_profile_id() and public.current_profile_role() = 'driver')
  or public.is_admin()
);

create policy "Owners and admins can read documents"
on public.documents for select
using (owner_user_id = public.current_profile_id() or public.is_admin());

create policy "Owners can create documents"
on public.documents for insert
with check (owner_user_id = public.current_profile_id());

create policy "Owners and admins can update documents"
on public.documents for update
using (owner_user_id = public.current_profile_id() or public.is_admin())
with check (owner_user_id = public.current_profile_id() or public.is_admin());

create policy "Active categories are public"
on public.categories for select
using (is_active = true or public.is_admin());

create policy "Admins can manage categories"
on public.categories for all
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read approved active listings"
on public.listings for select
using (
  is_active = true
  and admin_disabled = false
  and exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = listings.provider_id
      and provider_profiles.status = 'approved'
  )
);

create policy "Providers can read own listings"
on public.listings for select
using (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = listings.provider_id
      and provider_profiles.user_id = public.current_profile_id()
  )
  or public.is_admin()
);

create policy "Approved providers can create listings"
on public.listings for insert
with check (
  exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = listings.provider_id
      and provider_profiles.user_id = public.current_profile_id()
      and provider_profiles.status = 'approved'
  )
);

create policy "Providers and admins can update listings"
on public.listings for update
using (
  public.is_admin()
  or exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = listings.provider_id
      and provider_profiles.user_id = public.current_profile_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = listings.provider_id
      and provider_profiles.user_id = public.current_profile_id()
  )
);

create policy "Order participants can read orders"
on public.orders for select
using (
  public.is_admin()
  or buyer_id = public.current_profile_id()
  or exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = orders.provider_id
      and provider_profiles.user_id = public.current_profile_id()
  )
  or exists (
    select 1
    from public.driver_profiles
    where driver_profiles.id = orders.driver_id
      and driver_profiles.user_id = public.current_profile_id()
  )
);

create policy "Buyers can create own orders"
on public.orders for insert
with check (buyer_id = public.current_profile_id());

create policy "Order participants can update orders"
on public.orders for update
using (
  public.is_admin()
  or buyer_id = public.current_profile_id()
  or exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = orders.provider_id
      and provider_profiles.user_id = public.current_profile_id()
  )
  or exists (
    select 1
    from public.driver_profiles
    where driver_profiles.id = orders.driver_id
      and driver_profiles.user_id = public.current_profile_id()
  )
)
with check (
  public.is_admin()
  or buyer_id = public.current_profile_id()
  or exists (
    select 1
    from public.provider_profiles
    where provider_profiles.id = orders.provider_id
      and provider_profiles.user_id = public.current_profile_id()
  )
  or exists (
    select 1
    from public.driver_profiles
    where driver_profiles.id = orders.driver_id
      and driver_profiles.user_id = public.current_profile_id()
  )
);

create policy "Order participants can read status events"
on public.order_status_events for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_status_events.order_id
  )
);

create policy "Authenticated participants can create status events"
on public.order_status_events for insert
with check (changed_by = public.current_profile_id() or public.is_admin());

create policy "Settings are readable"
on public.admin_settings for select
using (true);

create policy "Admins can manage settings"
on public.admin_settings for all
using (public.is_admin())
with check (public.is_admin());

create policy "Order participants can read transactions"
on public.transactions for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.orders
    where orders.id = transactions.order_id
  )
);

create policy "Admins can create transactions"
on public.transactions for insert
with check (public.is_admin());

create policy "Admins can update transactions"
on public.transactions for update
using (public.is_admin())
with check (public.is_admin());

create policy "Recipients and admins can read payouts"
on public.payouts for select
using (recipient_user_id = public.current_profile_id() or public.is_admin());

create policy "Admins can manage payouts"
on public.payouts for all
using (public.is_admin())
with check (public.is_admin());

create policy "Recipients and admins can read payout items"
on public.payout_items for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.payouts
    where payouts.id = payout_items.payout_id
      and payouts.recipient_user_id = public.current_profile_id()
  )
);

create policy "Admins can manage payout items"
on public.payout_items for all
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can read audit logs"
on public.audit_logs for select
using (public.is_admin());

create policy "Admins can create audit logs"
on public.audit_logs for insert
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'public-listing-images',
    'public-listing-images',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'private-documents',
    'private-documents',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public listing images are readable"
on storage.objects for select
using (bucket_id = 'public-listing-images');

create policy "Approved providers can upload listing images"
on storage.objects for insert
with check (
  bucket_id = 'public-listing-images'
  and public.current_profile_role() = 'provider'
  and public.is_approved_provider(public.current_profile_id())
);

create policy "Listing image owners can update files"
on storage.objects for update
using (
  bucket_id = 'public-listing-images'
  and owner = auth.uid()
)
with check (
  bucket_id = 'public-listing-images'
  and owner = auth.uid()
);

create policy "Private documents are readable by owner or admin"
on storage.objects for select
using (
  bucket_id = 'private-documents'
  and (owner = auth.uid() or public.is_admin())
);

create policy "Authenticated users can upload private documents"
on storage.objects for insert
with check (
  bucket_id = 'private-documents'
  and auth.role() = 'authenticated'
);

create policy "Document owners and admins can update private documents"
on storage.objects for update
using (
  bucket_id = 'private-documents'
  and (owner = auth.uid() or public.is_admin())
)
with check (
  bucket_id = 'private-documents'
  and (owner = auth.uid() or public.is_admin())
);
