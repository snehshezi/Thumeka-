# Thumeka Database Schema

## 1. Database Notes

Database: Supabase Postgres.

Use UUID primary keys.

Use `created_at` and `updated_at` timestamps on main operational tables.

Use Supabase Auth for authentication and `profiles` for app-level user data.

---

## 2. Extensions

Recommended:

```sql
create extension if not exists "uuid-ossp";
```

---

## 3. Enums / Check Values

Use text fields with check constraints for speed, or create Postgres enums if preferred.

Recommended status values are documented below.

---

## 4. Tables

### profiles

App-level user profile linked to Supabase Auth.

```sql
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique not null,
  role text not null check (role in ('buyer', 'provider', 'driver', 'admin')),
  full_name text,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

### provider_profiles

```sql
create table provider_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
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
```

---

### driver_profiles

```sql
create table driver_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
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
```

---

### documents

Stores uploaded or email-recorded provider/driver document records.

```sql
create table documents (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references profiles(id) on delete cascade,
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
```

Provider document types:

```txt
id_copy
selfie
proof_of_bank_account
proof_of_address
```

Driver document types:

```txt
car_picture
drivers_license
pdp_license
id_copy
proof_of_account
driver_photo
```

---

### categories

```sql
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);
```

Seed categories:

```sql
insert into categories (name, slug, sort_order) values
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
('Other', 'other', 11);
```

---

### listings

```sql
create table listings (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  category_id uuid not null references categories(id),
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
```

---

### orders

```sql
create table orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references profiles(id),
  provider_id uuid not null references provider_profiles(id),
  listing_id uuid not null references listings(id),
  driver_id uuid references driver_profiles(id),
  order_type text not null check (order_type in ('product', 'service', 'errand')),
  status text not null default 'order_requested',
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
  payment_method text not null default 'eft',
  payment_status text not null default 'not_requested',
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
```

---

### order_status_events

```sql
create table order_status_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);
```

---

### admin_settings

```sql
create table admin_settings (
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
```

Seed:

```sql
insert into admin_settings (
  commission_percentage,
  driver_payout_day,
  provider_payout_day,
  driver_base_rate
) values (
  12,
  'Monday',
  'Wednesday',
  36
);
```

---

### transactions

```sql
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id),
  transaction_type text not null,
  amount numeric(12,2) not null,
  direction text not null check (direction in ('debit', 'credit')),
  status text not null,
  reference text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
```

Transaction types:

```txt
buyer_eft_expected
buyer_eft_confirmed
platform_commission
provider_earning
driver_earning
provider_payout
driver_payout
refund_manual
adjustment
```

---

### payouts

```sql
create table payouts (
  id uuid primary key default uuid_generate_v4(),
  recipient_user_id uuid not null references profiles(id),
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
```

---

### payout_items

```sql
create table payout_items (
  id uuid primary key default uuid_generate_v4(),
  payout_id uuid not null references payouts(id) on delete cascade,
  order_id uuid not null references orders(id),
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
```

---

### audit_logs

```sql
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references profiles(id),
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);
```

Audit these actions:

- commission changed
- driver base fee changed
- driver price per km changed
- payout day changed
- provider approved/rejected/suspended
- driver approved/rejected/suspended
- listing disabled
- EFT payment confirmed
- order cancelled
- payout marked paid
- delivery fee manually overridden
- driver assigned or changed

---

## 5. Suggested Indexes

```sql
create index idx_profiles_auth_user_id on profiles(auth_user_id);
create index idx_profiles_role on profiles(role);

create index idx_provider_profiles_user_id on provider_profiles(user_id);
create index idx_provider_profiles_status on provider_profiles(status);

create index idx_driver_profiles_user_id on driver_profiles(user_id);
create index idx_driver_profiles_approval_status on driver_profiles(approval_status);
create index idx_driver_profiles_availability_status on driver_profiles(availability_status);

create index idx_listings_provider_id on listings(provider_id);
create index idx_listings_category_id on listings(category_id);
create index idx_listings_public on listings(is_active, admin_disabled);

create index idx_orders_buyer_id on orders(buyer_id);
create index idx_orders_provider_id on orders(provider_id);
create index idx_orders_driver_id on orders(driver_id);
create index idx_orders_status on orders(status);
create index idx_orders_payment_status on orders(payment_status);

create index idx_transactions_order_id on transactions(order_id);
create index idx_payouts_recipient on payouts(recipient_user_id, recipient_type);
create index idx_audit_logs_actor on audit_logs(actor_user_id);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
```

---

## 6. RLS Guidance

Enable RLS on all tables.

Minimum policy guidance:

- Public can read active, non-disabled listings whose provider is approved.
- Buyer can read own profile and own orders.
- Provider can read/update own provider profile.
- Provider can create/update own listings after approval.
- Provider can read orders assigned to their provider profile.
- Driver can read/update assigned delivery orders.
- Admin can read and update all operational records.
- Documents are private; owner can upload/read own documents, admin can read all.

For MVP speed, implement strict server-side checks even where RLS policies are still being refined.
