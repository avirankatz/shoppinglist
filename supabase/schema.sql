create extension if not exists pgcrypto;

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  name text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_members (
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  text text not null,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_items_list_id_idx on public.shopping_items (list_id);
create index if not exists list_members_user_id_idx on public.list_members (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shopping_lists_set_updated_at on public.shopping_lists;
create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row
execute function public.set_updated_at();

drop trigger if exists shopping_items_set_updated_at on public.shopping_items;
create trigger shopping_items_set_updated_at
before update on public.shopping_items
for each row
execute function public.set_updated_at();

alter table public.shopping_lists replica identity full;
alter table public.list_members replica identity full;
alter table public.shopping_items replica identity full;

alter publication supabase_realtime add table public.shopping_lists;
alter publication supabase_realtime add table public.list_members;
alter publication supabase_realtime add table public.shopping_items;

alter table public.shopping_lists enable row level security;
alter table public.list_members enable row level security;
alter table public.shopping_items enable row level security;

create or replace function public.is_list_member(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_members member
    where member.list_id = target_list_id
      and member.user_id = auth.uid()
  );
$$;

grant execute on function public.is_list_member(uuid) to authenticated;

drop policy if exists shopping_lists_select_member on public.shopping_lists;
create policy shopping_lists_select_member
on public.shopping_lists
for select
to authenticated
using (public.is_list_member(id));

drop policy if exists shopping_lists_insert_owner on public.shopping_lists;
create policy shopping_lists_insert_owner
on public.shopping_lists
for insert
to authenticated
with check (
  owner_id is null or owner_id = auth.uid()
);

drop policy if exists shopping_lists_update_owner on public.shopping_lists;
create policy shopping_lists_update_owner
on public.shopping_lists
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists shopping_lists_delete_owner on public.shopping_lists;
create policy shopping_lists_delete_owner
on public.shopping_lists
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists list_members_select_member on public.list_members;
create policy list_members_select_member
on public.list_members
for select
to authenticated
using (public.is_list_member(list_id));

drop policy if exists list_members_insert_self on public.list_members;
create policy list_members_insert_self
on public.list_members
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists list_members_update_self on public.list_members;
create policy list_members_update_self
on public.list_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists list_members_delete_self on public.list_members;
create policy list_members_delete_self
on public.list_members
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists shopping_items_select_member on public.shopping_items;
create policy shopping_items_select_member
on public.shopping_items
for select
to authenticated
using (public.is_list_member(list_id));

drop policy if exists shopping_items_insert_member on public.shopping_items;
create policy shopping_items_insert_member
on public.shopping_items
for insert
to authenticated
with check (public.is_list_member(list_id));

drop policy if exists shopping_items_update_member on public.shopping_items;
create policy shopping_items_update_member
on public.shopping_items
for update
to authenticated
using (public.is_list_member(list_id))
with check (public.is_list_member(list_id));

drop policy if exists shopping_items_delete_member on public.shopping_items;
create policy shopping_items_delete_member
on public.shopping_items
for delete
to authenticated
using (public.is_list_member(list_id));

create or replace function public.join_list_by_code(
  invite_code_input text,
  display_name_input text default null
)
returns table (id uuid, invite_code text, name text, owner_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  found_list public.shopping_lists;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into found_list
  from public.shopping_lists
  where shopping_lists.invite_code = upper(trim(invite_code_input))
  limit 1;

  if found_list.id is null then
    raise exception 'List not found';
  end if;

  insert into public.list_members (list_id, user_id, role, display_name)
  values (
    found_list.id,
    current_user_id,
    case when found_list.owner_id = current_user_id then 'owner' else 'member' end,
    nullif(trim(display_name_input), '')
  )
  on conflict (list_id, user_id)
  do update set
    display_name = coalesce(excluded.display_name, public.list_members.display_name);

  return query
  select found_list.id, found_list.invite_code, found_list.name, found_list.owner_id;
end;
$$;

create or replace function public.create_list(
  invite_code_input text,
  name_input text,
  display_name_input text default null
)
returns table (id uuid, invite_code text, name text, owner_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_list public.shopping_lists;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.shopping_lists (invite_code, name, owner_id)
  values (upper(trim(invite_code_input)), trim(name_input), current_user_id)
  returning * into created_list;

  insert into public.list_members (list_id, user_id, role, display_name)
  values (
    created_list.id,
    current_user_id,
    'owner',
    nullif(trim(display_name_input), '')
  )
  on conflict (list_id, user_id)
  do update set
    display_name = coalesce(excluded.display_name, public.list_members.display_name),
    role = 'owner';

  return query
  select created_list.id, created_list.invite_code, created_list.name, created_list.owner_id;
end;
$$;

grant execute on function public.join_list_by_code(text, text) to authenticated;
grant execute on function public.create_list(text, text, text) to authenticated;
