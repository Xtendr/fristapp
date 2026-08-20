-- Phase 2: user/device Web Push subscriptions and per-subscription reminder deliveries.
-- No notification preference table. Recipients are current household members.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 256),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_endpoint_https
    check (endpoint like 'https://%' and char_length(endpoint) between 16 and 2048)
);

create index push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  push_subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  reminder_offset smallint not null check (reminder_offset in (0, 1, 3)),
  expiry_date date not null,
  delivered_at timestamptz not null default now(),
  constraint notification_deliveries_subscription_offset_key
    unique (inventory_item_id, push_subscription_id, reminder_offset, expiry_date)
);

create index notification_deliveries_user_item_idx
  on public.notification_deliveries (user_id, inventory_item_id);

revoke all on table public.push_subscriptions from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;

grant select on table public.push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth, user_agent) on table public.push_subscriptions to authenticated;
grant update (p256dh, auth, user_agent) on table public.push_subscriptions to authenticated;
grant delete on table public.push_subscriptions to authenticated;

grant all on table public.push_subscriptions to service_role;
grant all on table public.notification_deliveries to service_role;

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function private.set_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force row level security;

create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());
