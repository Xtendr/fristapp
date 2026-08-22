-- Frist intelligence, household categories, learned product preferences, and
-- per-member reminder settings. The existing capture and notification paths
-- remain available during rollout; new clients use the additive v2 RPCs.

-- ---------------------------------------------------------------------------
-- Household-owned categories
-- ---------------------------------------------------------------------------

create table public.household_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 32),
  system_key text check (
    system_key is null or system_key in (
      'dairy_eggs',
      'fruit_vegetables',
      'meat_fish',
      'bread_bakery',
      'meals_leftovers',
      'drinks',
      'pantry_staples',
      'condiments',
      'snacks',
      'other'
    )
  ),
  icon_key text not null check (
    icon_key in (
      'milk', 'apple', 'drumstick', 'wheat', 'utensils',
      'cup', 'package', 'bottle', 'cookie', 'shapes'
    )
  ),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create unique index household_categories_system_key_idx
  on public.household_categories (household_id, system_key)
  where system_key is not null;

create unique index household_categories_active_name_idx
  on public.household_categories (household_id, lower(btrim(name)))
  where archived_at is null;

create index household_categories_household_sort_idx
  on public.household_categories (household_id, archived_at, sort_order, name);

create trigger household_categories_set_updated_at
  before update on public.household_categories
  for each row execute function private.set_updated_at();

create function private.seed_household_categories(
  p_household_id uuid,
  p_created_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_categories (
    household_id,
    name,
    system_key,
    icon_key,
    sort_order,
    created_by
  ) values
    (p_household_id, 'Dairy & eggs', 'dairy_eggs', 'milk', 10, p_created_by),
    (p_household_id, 'Fruit & vegetables', 'fruit_vegetables', 'apple', 20, p_created_by),
    (p_household_id, 'Meat & fish', 'meat_fish', 'drumstick', 30, p_created_by),
    (p_household_id, 'Bread & bakery', 'bread_bakery', 'wheat', 40, p_created_by),
    (p_household_id, 'Meals & leftovers', 'meals_leftovers', 'utensils', 50, p_created_by),
    (p_household_id, 'Drinks', 'drinks', 'cup', 60, p_created_by),
    (p_household_id, 'Pantry staples', 'pantry_staples', 'package', 70, p_created_by),
    (p_household_id, 'Condiments', 'condiments', 'bottle', 80, p_created_by),
    (p_household_id, 'Snacks', 'snacks', 'cookie', 90, p_created_by),
    (p_household_id, 'Other', 'other', 'shapes', 100, p_created_by)
  on conflict do nothing;
end;
$$;

create function private.seed_categories_for_new_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_household_categories(new.id, new.created_by);
  return new;
end;
$$;

create trigger households_seed_categories
  after insert on public.households
  for each row execute function private.seed_categories_for_new_household();

do $$
declare
  v_household record;
begin
  for v_household in
    select id, created_by from public.households
  loop
    perform private.seed_household_categories(v_household.id, v_household.created_by);
  end loop;
end;
$$;

revoke all on table public.household_categories from public, anon, authenticated;
grant select on table public.household_categories to authenticated;

alter table public.household_categories enable row level security;
alter table public.household_categories force row level security;

create policy household_categories_select on public.household_categories
  for select to authenticated
  using (private.is_household_member(household_id));

alter table public.inventory_items
  add column category_id uuid;

-- Keep the database migration compatible with the currently deployed web app
-- and the original capture commit RPC. Both may omit category_id until the web
-- deployment reaches users, so the database assigns the household's protected
-- Other category at the security boundary.
create function private.assign_default_inventory_category()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.category_id is null then
    select id
    into new.category_id
    from public.household_categories
    where household_id = new.household_id
      and system_key = 'other'
      and archived_at is null;
  end if;

  if new.category_id is null then
    raise exception 'Household is missing its default category';
  end if;

  return new;
end;
$$;

create trigger inventory_items_assign_default_category
  before insert on public.inventory_items
  for each row execute function private.assign_default_inventory_category();

update public.inventory_items as inventory_item
set category_id = category.id
from public.household_categories as category
where category.household_id = inventory_item.household_id
  and category.system_key = 'other';

alter table public.inventory_items
  alter column category_id set not null,
  add constraint inventory_items_category_household_fkey
    foreign key (category_id, household_id)
    references public.household_categories (id, household_id);

create index inventory_items_household_category_idx
  on public.inventory_items (household_id, category_id, expiry_date);

grant insert (category_id) on table public.inventory_items to authenticated;
grant update (category_id) on table public.inventory_items to authenticated;

-- ---------------------------------------------------------------------------
-- Household product memory and product resolver metadata
-- ---------------------------------------------------------------------------

alter table public.products
  add column category_key text check (
    category_key is null or category_key in (
      'dairy_eggs', 'fruit_vegetables', 'meat_fish', 'bread_bakery',
      'meals_leftovers', 'drinks', 'pantry_staples', 'condiments',
      'snacks', 'other'
    )
  );

create table public.household_product_preferences (
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  preferred_category_id uuid not null,
  usual_storage_location text not null
    check (usual_storage_location in ('fridge', 'freezer', 'pantry')),
  last_confirmed_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, product_id),
  foreign key (preferred_category_id, household_id)
    references public.household_categories (id, household_id)
);

create trigger household_product_preferences_set_updated_at
  before update on public.household_product_preferences
  for each row execute function private.set_updated_at();

revoke all on table public.household_product_preferences
  from public, anon, authenticated;
grant select on table public.household_product_preferences to authenticated;

alter table public.household_product_preferences enable row level security;
alter table public.household_product_preferences force row level security;

create policy household_product_preferences_select
  on public.household_product_preferences
  for select to authenticated
  using (private.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Per-user, per-household reminder preferences
-- ---------------------------------------------------------------------------

create table public.household_notification_preferences (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  household_reminders_enabled boolean not null default true,
  remind_three_days_before boolean not null default true,
  remind_one_day_before boolean not null default true,
  remind_on_expiry boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id),
  foreign key (household_id, user_id)
    references public.household_members (household_id, user_id) on delete cascade
);

insert into public.household_notification_preferences (household_id, user_id)
select household_id, user_id from public.household_members
on conflict do nothing;

create function private.seed_notification_preferences_for_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_notification_preferences (household_id, user_id)
  values (new.household_id, new.user_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger household_members_seed_notification_preferences
  after insert on public.household_members
  for each row execute function private.seed_notification_preferences_for_member();

create trigger household_notification_preferences_set_updated_at
  before update on public.household_notification_preferences
  for each row execute function private.set_updated_at();

revoke all on table public.household_notification_preferences
  from public, anon, authenticated;
grant select on table public.household_notification_preferences to authenticated;
grant insert (
  household_id,
  household_reminders_enabled,
  remind_three_days_before,
  remind_one_day_before,
  remind_on_expiry
) on table public.household_notification_preferences to authenticated;
grant update (
  household_reminders_enabled,
  remind_three_days_before,
  remind_one_day_before,
  remind_on_expiry
) on table public.household_notification_preferences to authenticated;

alter table public.household_notification_preferences enable row level security;
alter table public.household_notification_preferences force row level security;

create policy household_notification_preferences_select
  on public.household_notification_preferences
  for select to authenticated
  using (
    user_id = auth.uid()
    and private.is_household_member(household_id)
  );

create policy household_notification_preferences_insert
  on public.household_notification_preferences
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.is_household_member(household_id)
  );

create policy household_notification_preferences_update
  on public.household_notification_preferences
  for update to authenticated
  using (
    user_id = auth.uid()
    and private.is_household_member(household_id)
  )
  with check (
    user_id = auth.uid()
    and private.is_household_member(household_id)
  );

-- ---------------------------------------------------------------------------
-- Capture analysis metadata and image limits
-- ---------------------------------------------------------------------------

alter table public.capture_items
  add column analysis_metadata jsonb,
  add column images_deleted_at timestamptz;

update storage.buckets
set file_size_limit = 4194304
where id = 'capture-images';

-- ---------------------------------------------------------------------------
-- Protected category and preference mutation RPCs
-- ---------------------------------------------------------------------------

create function public.create_household_category(
  p_household_id uuid,
  p_name text,
  p_icon_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_sort_order integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only a household owner can create categories.';
  end if;
  if v_name is null or char_length(v_name) > 32 then
    raise exception 'Category names must contain 1 to 32 characters.';
  end if;
  if p_icon_key not in (
    'milk', 'apple', 'drumstick', 'wheat', 'utensils',
    'cup', 'package', 'bottle', 'cookie', 'shapes'
  ) then raise exception 'Choose an available category icon.'; end if;
  if (
    select count(*) from public.household_categories
    where household_id = p_household_id and archived_at is null
  ) >= 24 then raise exception 'A household can have up to 24 active categories.'; end if;

  select coalesce(max(sort_order), 0) + 10 into v_sort_order
  from public.household_categories
  where household_id = p_household_id and archived_at is null;

  insert into public.household_categories (
    household_id, name, icon_key, sort_order, created_by
  ) values (
    p_household_id, v_name, p_icon_key, v_sort_order, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create function public.update_household_category(
  p_category_id uuid,
  p_name text,
  p_icon_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.household_categories%rowtype;
  v_name text := nullif(btrim(p_name), '');
begin
  select * into v_category from public.household_categories where id = p_category_id;
  if v_category.id is null then raise exception 'Category not found.'; end if;
  if not private.is_household_owner(v_category.household_id) then
    raise exception 'Only a household owner can edit categories.';
  end if;
  if v_category.archived_at is not null then raise exception 'Category is archived.'; end if;
  if v_name is null or char_length(v_name) > 32 then
    raise exception 'Category names must contain 1 to 32 characters.';
  end if;
  if p_icon_key not in (
    'milk', 'apple', 'drumstick', 'wheat', 'utensils',
    'cup', 'package', 'bottle', 'cookie', 'shapes'
  ) then raise exception 'Choose an available category icon.'; end if;

  update public.household_categories
  set name = v_name, icon_key = p_icon_key
  where id = p_category_id;
end;
$$;

create function public.reorder_household_categories(
  p_household_id uuid,
  p_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only a household owner can reorder categories.';
  end if;
  if coalesce(array_length(p_category_ids, 1), 0) <> (
    select count(*) from public.household_categories
    where household_id = p_household_id and archived_at is null
  ) or coalesce(array_length(p_category_ids, 1), 0) <> (
    select count(distinct listed.category_id)
    from unnest(p_category_ids) as listed(category_id)
  ) or exists (
    select 1 from unnest(p_category_ids) as listed(category_id)
    where not exists (
      select 1 from public.household_categories
      where id = listed.category_id
        and household_id = p_household_id
        and archived_at is null
    )
  ) then raise exception 'Category order is invalid.'; end if;

  update public.household_categories as category
  set sort_order = ordered.ordinality * 10
  from unnest(p_category_ids) with ordinality as ordered(id, ordinality)
  where category.id = ordered.id and category.household_id = p_household_id;
end;
$$;

create function public.archive_household_category(p_category_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.household_categories%rowtype;
  v_other_id uuid;
  v_count integer;
begin
  select * into v_category from public.household_categories where id = p_category_id for update;
  if v_category.id is null then raise exception 'Category not found.'; end if;
  if not private.is_household_owner(v_category.household_id) then
    raise exception 'Only a household owner can archive categories.';
  end if;
  if v_category.system_key = 'other' then raise exception 'Other cannot be archived.'; end if;
  if v_category.archived_at is not null then return 0; end if;

  select id into v_other_id from public.household_categories
  where household_id = v_category.household_id and system_key = 'other';

  update public.inventory_items
  set category_id = v_other_id
  where household_id = v_category.household_id and category_id = v_category.id;
  get diagnostics v_count = row_count;

  update public.household_product_preferences
  set preferred_category_id = v_other_id,
      last_confirmed_by = auth.uid()
  where household_id = v_category.household_id
    and preferred_category_id = v_category.id;

  update public.household_categories set archived_at = now() where id = v_category.id;
  return v_count;
end;
$$;

create function public.remember_product_preference(
  p_household_id uuid,
  p_product_id uuid,
  p_category_id uuid,
  p_storage_location text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_household_member(p_household_id) then
    raise exception 'Household membership required.';
  end if;
  if p_storage_location not in ('fridge', 'freezer', 'pantry') then
    raise exception 'Storage location is invalid.';
  end if;
  if not exists (
    select 1 from public.household_categories
    where id = p_category_id
      and household_id = p_household_id
      and archived_at is null
  ) then raise exception 'Category is unavailable.'; end if;

  insert into public.household_product_preferences (
    household_id,
    product_id,
    preferred_category_id,
    usual_storage_location,
    last_confirmed_by
  ) values (
    p_household_id,
    p_product_id,
    p_category_id,
    p_storage_location,
    auth.uid()
  )
  on conflict (household_id, product_id) do update set
    preferred_category_id = excluded.preferred_category_id,
    usual_storage_location = excluded.usual_storage_location,
    last_confirmed_by = excluded.last_confirmed_by;
end;
$$;

create function public.apply_category_assignments(
  p_household_id uuid,
  p_assignments jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment jsonb;
  v_count integer := 0;
  v_product_id uuid;
  v_storage_location text;
begin
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only a household owner can organize items.';
  end if;
  if jsonb_typeof(p_assignments) <> 'array'
    or jsonb_array_length(p_assignments) > 200 then
    raise exception 'Assignments are invalid.';
  end if;
  if jsonb_array_length(p_assignments) <> (
    select count(distinct assignment.value->>'itemId')
    from jsonb_array_elements(p_assignments) as assignment(value)
  ) or exists (
    select 1
    from jsonb_array_elements(p_assignments) as assignment(value)
    where not exists (
      select 1 from public.inventory_items
      where id = (assignment.value->>'itemId')::uuid
        and household_id = p_household_id
    ) or not exists (
      select 1 from public.household_categories
      where id = (assignment.value->>'categoryId')::uuid
        and household_id = p_household_id
        and archived_at is null
    )
  ) then
    raise exception 'Assignments contain unavailable items or categories.';
  end if;

  for v_assignment in select value from jsonb_array_elements(p_assignments)
  loop
    v_product_id := null;
    v_storage_location := null;
    update public.inventory_items as inventory_item
    set category_id = category.id
    from public.household_categories as category
    where inventory_item.id = (v_assignment->>'itemId')::uuid
      and inventory_item.household_id = p_household_id
      and category.id = (v_assignment->>'categoryId')::uuid
      and category.household_id = p_household_id
      and category.archived_at is null
    returning inventory_item.product_id, inventory_item.storage_location
      into v_product_id, v_storage_location;
    if found then
      v_count := v_count + 1;
      if v_product_id is not null then
        perform public.remember_product_preference(
          p_household_id,
          v_product_id,
          (v_assignment->>'categoryId')::uuid,
          v_storage_location
        );
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Additive commit RPC. It returns the rows needed by the mounted client shell,
-- while the original count-returning RPC remains usable during deployment.
create function public.commit_capture_session_v2(
  p_session_id uuid,
  p_confirmed_items jsonb
)
returns table (
  id uuid,
  display_name text,
  quantity integer,
  expiry_date date,
  expiry_type text,
  storage_location text,
  product_id uuid,
  category_id uuid,
  category_name text,
  category_icon_key text,
  added_by uuid,
  added_by_name text
)
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
  v_category public.household_categories%rowtype;
  v_inventory_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(p_confirmed_items) <> 'array'
    or jsonb_array_length(p_confirmed_items) not between 1 and 50 then
    raise exception 'Confirmed items must contain between 1 and 50 entries.';
  end if;

  select capture_session.household_id, capture_session.mode
  into v_household_id, v_mode
  from public.capture_sessions as capture_session
  where capture_session.id = p_session_id
    and capture_session.created_by = v_user_id
    and capture_session.status in ('draft', 'review')
    and capture_session.expires_at > now()
  for update;

  if v_household_id is null or not private.is_household_member(v_household_id) then
    raise exception 'Capture session is unavailable.';
  end if;
  if (
    select count(*) from public.capture_items where session_id = p_session_id
  ) <> jsonb_array_length(p_confirmed_items) then
    raise exception 'Every capture item must be confirmed together.';
  end if;

  for v_entry in select value from jsonb_array_elements(p_confirmed_items)
  loop
    if not (v_entry ?& array[
      'captureItemId', 'displayName', 'expiryDate', 'storageLocation',
      'quantity', 'categoryId'
    ]) then raise exception 'A confirmed item is incomplete.'; end if;

    select * into v_capture_item
    from public.capture_items
    where capture_items.id = (v_entry->>'captureItemId')::uuid
      and capture_items.session_id = p_session_id
    for update;
    if v_capture_item.id is null then raise exception 'A capture item is unavailable.'; end if;
    if exists (
      select 1 from public.inventory_items
      where source_capture_item_id = v_capture_item.id
    ) then raise exception 'A capture item has already been committed.'; end if;

    select * into v_category from public.household_categories
    where household_categories.id = (v_entry->>'categoryId')::uuid
      and household_categories.household_id = v_household_id
      and household_categories.archived_at is null;
    if v_category.id is null then raise exception 'Category is unavailable.'; end if;

    if char_length(btrim(v_entry->>'displayName')) not between 1 and 80
      or (v_entry->>'expiryDate')::date is null
      or (v_entry->>'storageLocation') not in ('fridge', 'freezer', 'pantry')
      or (v_entry->>'quantity')::integer not between 1 and 99
      or coalesce(v_entry->>'expiryType', 'unknown') not in ('best_before', 'use_by', 'unknown') then
      raise exception 'A confirmed item is invalid.';
    end if;

    insert into public.inventory_items (
      household_id, display_name, quantity, expiry_date, expiry_type,
      storage_location, source, product_id, source_capture_item_id,
      category_id, added_by
    ) values (
      v_household_id,
      btrim(v_entry->>'displayName'),
      (v_entry->>'quantity')::integer,
      (v_entry->>'expiryDate')::date,
      coalesce(v_entry->>'expiryType', 'unknown'),
      v_entry->>'storageLocation',
      case when v_mode = 'batch' then 'batch' else 'ai' end,
      nullif(v_entry->>'productId', '')::uuid,
      v_capture_item.id,
      v_category.id,
      v_user_id
    ) returning inventory_items.id into v_inventory_id;

    if nullif(v_entry->>'productId', '') is not null then
      perform public.remember_product_preference(
        v_household_id,
        (v_entry->>'productId')::uuid,
        v_category.id,
        v_entry->>'storageLocation'
      );
    end if;

    update public.capture_items
    set status = 'confirmed', confirmed_data = v_entry, error_code = null
    where capture_items.id = v_capture_item.id;

    return query
      select
        inventory_item.id,
        inventory_item.display_name,
        inventory_item.quantity,
        inventory_item.expiry_date,
        inventory_item.expiry_type,
        inventory_item.storage_location,
        inventory_item.product_id,
        inventory_item.category_id,
        v_category.name,
        v_category.icon_key,
        inventory_item.added_by,
        profile.display_name
      from public.inventory_items as inventory_item
      inner join public.profiles as profile on profile.id = inventory_item.added_by
      where inventory_item.id = v_inventory_id;
  end loop;

  update public.capture_sessions
  set status = 'committed', committed_at = now()
  where capture_sessions.id = p_session_id;
end;
$$;

revoke all on function private.seed_household_categories(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.assign_default_inventory_category()
  from public, anon, authenticated;
revoke all on function private.seed_categories_for_new_household()
  from public, anon, authenticated;
revoke all on function private.seed_notification_preferences_for_member()
  from public, anon, authenticated;

revoke all on function public.create_household_category(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.update_household_category(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.reorder_household_categories(uuid, uuid[])
  from public, anon, authenticated;
revoke all on function public.archive_household_category(uuid)
  from public, anon, authenticated;
revoke all on function public.remember_product_preference(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.apply_category_assignments(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.commit_capture_session_v2(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.create_household_category(uuid, text, text)
  to authenticated;
grant execute on function public.update_household_category(uuid, text, text)
  to authenticated;
grant execute on function public.reorder_household_categories(uuid, uuid[])
  to authenticated;
grant execute on function public.archive_household_category(uuid)
  to authenticated;
grant execute on function public.remember_product_preference(uuid, uuid, uuid, text)
  to authenticated;
grant execute on function public.apply_category_assignments(uuid, jsonb)
  to authenticated;
grant execute on function public.commit_capture_session_v2(uuid, jsonb)
  to authenticated;

grant all on table public.household_categories to service_role;
grant all on table public.household_product_preferences to service_role;
grant all on table public.household_notification_preferences to service_role;
