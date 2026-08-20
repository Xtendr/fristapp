-- Phase 1B: household-scoped inventory. No product table, barcode, or AI.

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  quantity integer not null default 1 check (quantity between 1 and 99),
  expiry_date date not null,
  expiry_type text not null default 'unknown'
    check (expiry_type in ('best_before', 'use_by', 'unknown')),
  storage_location text not null
    check (storage_location in ('fridge', 'freezer', 'pantry')),
  source text not null default 'manual'
    check (source in ('manual', 'barcode', 'ai', 'batch')),
  added_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_household_expiry_idx
  on public.inventory_items (household_id, expiry_date);

revoke all on table public.inventory_items from public, anon, authenticated;

grant select on table public.inventory_items to authenticated;
grant insert (
  household_id,
  display_name,
  quantity,
  expiry_date,
  expiry_type,
  storage_location,
  source
) on table public.inventory_items to authenticated;
grant update (
  display_name,
  quantity,
  expiry_date,
  expiry_type,
  storage_location
) on table public.inventory_items to authenticated;
grant delete on table public.inventory_items to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function private.set_updated_at();

revoke all on function private.set_updated_at() from public, anon, authenticated;

alter table public.inventory_items enable row level security;
alter table public.inventory_items force row level security;

create policy inventory_items_select on public.inventory_items
  for select to authenticated
  using (private.is_household_member(household_id));

create policy inventory_items_insert on public.inventory_items
  for insert to authenticated
  with check (private.is_household_member(household_id));

create policy inventory_items_update on public.inventory_items
  for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy inventory_items_delete on public.inventory_items
  for delete to authenticated
  using (private.is_household_member(household_id));
