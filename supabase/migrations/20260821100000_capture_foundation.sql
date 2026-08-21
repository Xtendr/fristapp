-- Phases 3-6: product lookup cache and private, household-scoped capture.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  gtin text not null unique check (gtin ~ '^[0-9]{8,14}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  brand text,
  variant text,
  package_size text,
  image_url text,
  locale text,
  source text not null check (source in ('open_food_facts', 'user_confirmed')),
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

revoke all on table public.products from public, anon, authenticated;
alter table public.products enable row level security;
alter table public.products force row level security;

create table public.capture_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id),
  mode text not null check (mode in ('photo', 'batch')),
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'review', 'committed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  committed_at timestamptz
);

create index capture_sessions_household_created_idx
  on public.capture_sessions (household_id, created_at desc);

create trigger capture_sessions_set_updated_at
  before update on public.capture_sessions
  for each row execute function private.set_updated_at();

revoke all on table public.capture_sessions from public, anon, authenticated;
grant select, delete on table public.capture_sessions to authenticated;
grant insert (household_id, mode) on table public.capture_sessions to authenticated;

alter table public.capture_sessions enable row level security;
alter table public.capture_sessions force row level security;

create policy capture_sessions_select on public.capture_sessions
  for select to authenticated
  using (
    created_by = auth.uid()
    and private.is_household_member(household_id)
  );

create policy capture_sessions_insert on public.capture_sessions
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.is_household_member(household_id)
  );

create policy capture_sessions_delete on public.capture_sessions
  for delete to authenticated
  using (
    created_by = auth.uid()
    and private.is_household_member(household_id)
    and status in ('draft', 'review', 'cancelled', 'expired')
  );

create table public.capture_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.capture_sessions (id) on delete cascade,
  position integer not null check (position between 0 and 49),
  product_image_path text,
  expiry_image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'uploaded', 'processing', 'review', 'failed', 'confirmed')),
  proposal jsonb,
  confirmed_data jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, position)
);

create index capture_items_session_position_idx
  on public.capture_items (session_id, position);

create trigger capture_items_set_updated_at
  before update on public.capture_items
  for each row execute function private.set_updated_at();

revoke all on table public.capture_items from public, anon, authenticated;
grant select, delete on table public.capture_items to authenticated;
grant insert (session_id, position, product_image_path, expiry_image_path)
  on table public.capture_items to authenticated;
grant update (product_image_path, expiry_image_path)
  on table public.capture_items to authenticated;

alter table public.capture_items enable row level security;
alter table public.capture_items force row level security;

create policy capture_items_select on public.capture_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.capture_sessions as capture_session
      where capture_session.id = capture_items.session_id
        and capture_session.created_by = auth.uid()
        and private.is_household_member(capture_session.household_id)
    )
  );

create policy capture_items_insert on public.capture_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.capture_sessions as capture_session
      where capture_session.id = capture_items.session_id
        and capture_session.created_by = auth.uid()
        and capture_session.status = 'draft'
        and capture_session.expires_at > now()
        and private.is_household_member(capture_session.household_id)
    )
  );

create policy capture_items_update on public.capture_items
  for update to authenticated
  using (
    exists (
      select 1
      from public.capture_sessions as capture_session
      where capture_session.id = capture_items.session_id
        and capture_session.created_by = auth.uid()
        and capture_session.status in ('draft', 'review')
        and capture_session.expires_at > now()
        and private.is_household_member(capture_session.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.capture_sessions as capture_session
      where capture_session.id = capture_items.session_id
        and capture_session.created_by = auth.uid()
        and capture_session.status in ('draft', 'review')
        and capture_session.expires_at > now()
        and private.is_household_member(capture_session.household_id)
    )
  );

create policy capture_items_delete on public.capture_items
  for delete to authenticated
  using (
    exists (
      select 1
      from public.capture_sessions as capture_session
      where capture_session.id = capture_items.session_id
        and capture_session.created_by = auth.uid()
        and capture_session.status in ('draft', 'review', 'cancelled', 'expired')
        and private.is_household_member(capture_session.household_id)
    )
  );

alter table public.inventory_items
  add column product_id uuid references public.products (id) on delete set null,
  add column source_capture_item_id uuid unique
    references public.capture_items (id) on delete set null;

create index inventory_items_product_idx
  on public.inventory_items (product_id)
  where product_id is not null;

grant insert (product_id) on table public.inventory_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'capture-images',
  'capture-images',
  false,
  2097152,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy capture_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'capture-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy capture_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'capture-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy capture_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'capture-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'capture-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy capture_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'capture-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create function public.commit_capture_session(
  p_session_id uuid,
  p_confirmed_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_mode text;
  v_entry jsonb;
  v_capture_item public.capture_items%rowtype;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if pg_catalog.jsonb_typeof(p_confirmed_items) <> 'array'
    or pg_catalog.jsonb_array_length(p_confirmed_items) < 1
    or pg_catalog.jsonb_array_length(p_confirmed_items) > 50 then
    raise exception 'Confirmed items must contain between 1 and 50 entries.';
  end if;

  select household_id, mode
  into v_household_id, v_mode
  from public.capture_sessions
  where id = p_session_id
    and created_by = v_user_id
    and status in ('draft', 'review')
    and expires_at > pg_catalog.now()
  for update;

  if v_household_id is null
    or not private.is_household_member(v_household_id) then
    raise exception 'Capture session is unavailable.';
  end if;

  if (
    select pg_catalog.count(*)
    from public.capture_items
    where session_id = p_session_id
  ) <> pg_catalog.jsonb_array_length(p_confirmed_items) then
    raise exception 'Every capture item must be confirmed together.';
  end if;

  for v_entry in
    select value from pg_catalog.jsonb_array_elements(p_confirmed_items)
  loop
    if not (v_entry ? 'captureItemId')
      or not (v_entry ? 'displayName')
      or not (v_entry ? 'expiryDate')
      or not (v_entry ? 'storageLocation')
      or not (v_entry ? 'quantity') then
      raise exception 'A confirmed item is incomplete.';
    end if;

    select *
    into v_capture_item
    from public.capture_items
    where id = (v_entry->>'captureItemId')::uuid
      and session_id = p_session_id
    for update;

    if v_capture_item.id is null then
      raise exception 'A capture item is unavailable.';
    end if;

    if exists (
      select 1
      from public.inventory_items
      where source_capture_item_id = v_capture_item.id
    ) then
      raise exception 'A capture item has already been committed.';
    end if;

    if char_length(btrim(v_entry->>'displayName')) not between 1 and 80
      or (v_entry->>'expiryDate')::date is null
      or (v_entry->>'storageLocation') not in ('fridge', 'freezer', 'pantry')
      or (v_entry->>'quantity')::integer not between 1 and 99 then
      raise exception 'A confirmed item is invalid.';
    end if;

    insert into public.inventory_items (
      household_id,
      display_name,
      quantity,
      expiry_date,
      expiry_type,
      storage_location,
      source,
      product_id,
      source_capture_item_id,
      added_by
    ) values (
      v_household_id,
      btrim(v_entry->>'displayName'),
      (v_entry->>'quantity')::integer,
      (v_entry->>'expiryDate')::date,
      'unknown',
      v_entry->>'storageLocation',
      case when v_mode = 'batch' then 'batch' else 'ai' end,
      nullif(v_entry->>'productId', '')::uuid,
      v_capture_item.id,
      v_user_id
    );

    update public.capture_items
    set status = 'confirmed',
        confirmed_data = v_entry,
        error_code = null
    where id = v_capture_item.id;

    v_count := v_count + 1;
  end loop;

  if v_count <> pg_catalog.jsonb_array_length(p_confirmed_items) then
    raise exception 'Capture commit was incomplete.';
  end if;

  update public.capture_sessions
  set status = 'committed', committed_at = pg_catalog.now()
  where id = p_session_id;

  return v_count;
end;
$$;

revoke all on function public.commit_capture_session(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_capture_session(uuid, jsonb)
  to authenticated;
