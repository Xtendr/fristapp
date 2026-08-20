create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

comment on schema private is
  'Internal helpers. Not an exposed PostgREST schema. Do not add to api.schemas.';

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index household_invites_household_id_idx on public.household_invites (household_id);

-- ---------------------------------------------------------------------------
-- Table privileges: rows via RLS, columns via GRANT
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.households from public, anon, authenticated;
revoke all on table public.household_members from public, anon, authenticated;
revoke all on table public.household_invites from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select on table public.households to authenticated;
grant select on table public.household_members to authenticated;
grant select on table public.household_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Private helpers (SECURITY DEFINER, empty search_path, fully qualified)
-- ---------------------------------------------------------------------------

create function private.invite_token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

create function private.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = auth.uid()
  );
$$;

create function private.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create function private.shares_household_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as mine
    inner join public.household_members as theirs
      on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_other_user_id
  );
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;
  if v_name is null or v_name = '' then
    v_name := 'User';
  end if;
  if char_length(v_name) > 80 then
    v_name := left(v_name, 80);
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_name);

  return new;
end;
$$;

create function private.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and not exists (
       select 1
       from public.household_members
       where household_id = old.household_id
         and role = 'owner'
         and user_id <> old.user_id
     )
  then
    raise exception 'Cannot remove the last owner of a household';
  end if;

  return old;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger household_members_prevent_last_owner
  before delete on public.household_members
  for each row execute function private.prevent_last_owner_removal();

revoke all on function private.invite_token_hash(text) from public, anon, authenticated;
revoke all on function private.is_household_member(uuid) from public, anon, authenticated;
revoke all on function private.is_household_owner(uuid) from public, anon, authenticated;
revoke all on function private.shares_household_with(uuid) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.prevent_last_owner_removal() from public, anon, authenticated;

grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;
grant execute on function private.shares_household_with(uuid) to authenticated;

-- Hashing is only used inside other definer functions (owner = postgres).
grant execute on function private.invite_token_hash(text) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

alter table public.profiles force row level security;
alter table public.households force row level security;
alter table public.household_members force row level security;
alter table public.household_invites force row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or private.shares_household_with(id)
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy households_select on public.households
  for select to authenticated
  using (private.is_household_member(id));

create policy household_members_select on public.household_members
  for select to authenticated
  using (private.is_household_member(household_id));

create policy household_invites_select on public.household_invites
  for select to authenticated
  using (private.is_household_owner(household_id));

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

create function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_name text := nullif(btrim(p_name), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_name is null or char_length(v_name) > 80 then
    raise exception 'Enter a household name up to 80 characters';
  end if;

  insert into public.households (name, created_by)
  values (v_name, v_user_id)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, v_user_id, 'owner');

  return v_household_id;
end;
$$;

create function public.rename_household(p_household_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_name), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only an owner can rename this household';
  end if;
  if v_name is null or char_length(v_name) > 80 then
    raise exception 'Enter a household name up to 80 characters';
  end if;

  update public.households
  set name = v_name
  where id = p_household_id;
end;
$$;

create function public.create_invite(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only an owner can create an invite';
  end if;

  v_token := replace(
    replace(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+', '-'),
    '/',
    '_'
  );

  insert into public.household_invites (
    household_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    p_household_id,
    private.invite_token_hash(v_token),
    auth.uid(),
    now() + interval '7 days'
  );

  return v_token;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select household_id into v_household_id
  from public.household_invites
  where id = p_invite_id;

  if v_household_id is null then
    raise exception 'Invite not found';
  end if;
  if not private.is_household_owner(v_household_id) then
    raise exception 'Only an owner can revoke an invite';
  end if;

  update public.household_invites
  set revoked_at = now()
  where id = p_invite_id
    and revoked_at is null;
end;
$$;

create function public.get_invite_preview(p_token text)
returns table (
  household_name text,
  expires_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_name text;
  v_expires timestamptz;
  v_revoked timestamptz;
begin
  if p_token is null or btrim(p_token) = '' then
    return query select null::text, null::timestamptz, 'unknown'::text;
    return;
  end if;

  v_hash := private.invite_token_hash(p_token);

  select h.name, i.expires_at, i.revoked_at
  into v_name, v_expires, v_revoked
  from public.household_invites as i
  inner join public.households as h on h.id = i.household_id
  where i.token_hash = v_hash;

  if v_name is null then
    return query select null::text, null::timestamptz, 'unknown'::text;
    return;
  end if;

  if v_revoked is not null then
    return query select v_name, v_expires, 'revoked'::text;
    return;
  end if;

  if v_expires <= now() then
    return query select v_name, v_expires, 'expired'::text;
    return;
  end if;

  return query select v_name, v_expires, 'valid'::text;
end;
$$;

create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_hash text;
  v_invite public.household_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invite is invalid';
  end if;

  v_hash := private.invite_token_hash(p_token);

  select * into v_invite
  from public.household_invites
  where token_hash = v_hash;

  if not found then
    raise exception 'Invite is invalid';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Invite has been revoked';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'Invite has expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  return v_invite.household_id;
end;
$$;

create function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not private.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;
  if private.is_household_owner(p_household_id)
     and not exists (
       select 1
       from public.household_members
       where household_id = p_household_id
         and role = 'owner'
         and user_id <> v_user_id
     )
  then
    raise exception 'Cannot leave as the last owner of a household';
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = v_user_id;
end;
$$;

create function public.remove_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only an owner can remove a member';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Use leave household to remove yourself';
  end if;
  if not exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = p_user_id
  ) then
    raise exception 'Member not found';
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.create_household(text) from public, anon, authenticated;
revoke all on function public.rename_household(uuid, text) from public, anon, authenticated;
revoke all on function public.create_invite(uuid) from public, anon, authenticated;
revoke all on function public.revoke_invite(uuid) from public, anon, authenticated;
revoke all on function public.get_invite_preview(text) from public, anon, authenticated;
revoke all on function public.accept_invite(text) from public, anon, authenticated;
revoke all on function public.leave_household(uuid) from public, anon, authenticated;
revoke all on function public.remove_member(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.rename_household(uuid, text) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
