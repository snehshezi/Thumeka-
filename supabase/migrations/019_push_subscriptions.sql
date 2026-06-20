-- Migration 019: Browser Web Push subscriptions
--
-- When a user grants notification permission in the browser, the
-- PushManager hands back a subscription with three fields we need to
-- persist so the server-side `lib/push.ts` helper can deliver
-- notifications via webpush.sendNotification():
--
--   * endpoint - the push service URL (Chrome's FCM, Mozilla's
--     autopush, etc.). Unique per browser per profile.
--   * p256dh   - the public key the push service uses to encrypt
--     payloads. Provided by PushSubscription.getKey('p256dh').
--   * auth     - shared secret for authenticated encryption.
--
-- Why `unique (user_id, endpoint)`: re-running the subscribe API from
-- the same device is idempotent — the upsert refreshes the keys without
-- creating duplicate rows.

create table public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- RLS: a user can manage only their own subscriptions; admins read all.
-- The webhook (lib/push.ts) uses the service-role client, which bypasses
-- RLS — so the policy is mostly defensive against direct REST calls.
alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
on public.push_subscriptions for all
using (user_id = public.current_profile_id() or public.is_admin())
with check (user_id = public.current_profile_id());

comment on table public.push_subscriptions is
  'Web Push subscriptions per (user, browser/device). Populated by POST /api/push/subscribe after the user grants Notification permission; 410 responses from the push service prune the row.';
