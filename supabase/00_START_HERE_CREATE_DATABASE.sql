-- Manarat Platform V16.13 — secure schema for m.samra103@gmail.com
-- Applied to the Supabase project connected to the new account.
-- This script is idempotent and does not alter unrelated application tables.

create extension if not exists pgcrypto;

create schema if not exists manarat_private;
revoke all on schema manarat_private from public;
grant usage on schema manarat_private to anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, school text,
  role text default 'teacher' check (role in ('teacher','admin','school_supervisor')),
  status text default 'نشط', avatar text, icon text,
  educator_gender text default 'female', school_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.manarat_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null, logo_url text,
  supervisor_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

do $$ begin
  alter table public.profiles add constraint profiles_school_id_fkey foreign key (school_id) references public.manarat_schools(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.platform_state (
  id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz default now()
);

create table if not exists public.manarat_games (
  id text primary key,
  teacher_id uuid references public.profiles(id) on delete set null,
  teacher_email text, school_id uuid references public.manarat_schools(id) on delete set null,
  title text not null default 'لعبة جديدة', subject text, grade text,
  status text default 'published' check (status in ('draft','published','archived')),
  is_public boolean default false, is_shared boolean default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.manarat_question_banks (
  id text primary key, owner_id uuid references public.profiles(id) on delete set null, owner_email text,
  title text, subject text, grade text, data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.manarat_rosters (
  id text primary key, teacher_id uuid references public.profiles(id) on delete set null, teacher_email text,
  title text, data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.manarat_attempts (
  id text primary key, game_id text references public.manarat_games(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null, teacher_email text,
  school_id uuid references public.manarat_schools(id) on delete set null,
  student_name text, score int check (score is null or (score >= 0 and score <= 1000000)),
  data jsonb not null default '{}'::jsonb, created_at timestamptz default now()
);

create table if not exists public.manarat_messages (
  id text primary key, from_id uuid, from_email text, to_id uuid, to_email text, to_role text,
  subject text, body text, read boolean default false, data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.manarat_audit_logs (
  id text primary key, actor_id uuid, actor_email text, action text, entity_type text, entity_id text,
  target text, details jsonb default '{}'::jsonb, admin_email text, admin_name text,
  data jsonb default '{}'::jsonb, created_at timestamptz default now()
);

-- Compatibility upgrades for databases created by older Manarat releases.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists school text;
alter table public.profiles add column if not exists role text default 'teacher';
alter table public.profiles add column if not exists status text default 'نشط';
alter table public.profiles add column if not exists avatar text;
alter table public.profiles add column if not exists icon text;
alter table public.profiles add column if not exists educator_gender text default 'female';
alter table public.profiles add column if not exists school_id uuid;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.manarat_games add column if not exists teacher_id uuid references public.profiles(id) on delete set null;
alter table public.manarat_games add column if not exists teacher_email text;
alter table public.manarat_games add column if not exists school_id uuid references public.manarat_schools(id) on delete set null;
alter table public.manarat_games add column if not exists is_public boolean default false;
alter table public.manarat_games add column if not exists is_shared boolean default false;
alter table public.manarat_games add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.manarat_question_banks add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.manarat_question_banks add column if not exists owner_email text;
alter table public.manarat_rosters add column if not exists teacher_id uuid references public.profiles(id) on delete set null;
alter table public.manarat_rosters add column if not exists teacher_email text;
alter table public.manarat_attempts add column if not exists teacher_id uuid references public.profiles(id) on delete set null;
alter table public.manarat_attempts add column if not exists teacher_email text;
alter table public.manarat_attempts add column if not exists school_id uuid references public.manarat_schools(id) on delete set null;
alter table public.manarat_audit_logs add column if not exists target text;
alter table public.manarat_audit_logs add column if not exists details jsonb default '{}'::jsonb;
alter table public.manarat_audit_logs add column if not exists admin_email text;
alter table public.manarat_audit_logs add column if not exists admin_name text;

create or replace function manarat_private.is_admin(uid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(
    select 1 from public.profiles p
    where p.id=uid and p.role='admin' and coalesce(p.status,'نشط') <> 'موقوف'
  );
$$;
revoke all on function manarat_private.is_admin(uuid) from public;
grant execute on function manarat_private.is_admin(uuid) to anon, authenticated;

create or replace function manarat_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
declare assigned_role text;
begin
  assigned_role := case when lower(coalesce(new.email,''))=lower('m.samra103@gmail.com') then 'admin' else 'teacher' end;
  insert into public.profiles(id,email,name,school,role,status,avatar,icon,educator_gender,created_at,updated_at)
  values (new.id,new.email,
    coalesce(nullif(meta->>'name',''),split_part(coalesce(new.email,''),'@',1),'حساب منارة'),
    coalesce(nullif(meta->>'school',''),''),assigned_role,'نشط',meta->>'avatar',meta->>'icon',
    coalesce(nullif(meta->>'educator_gender',''),'female'),now(),now())
  on conflict(id) do update set
    email=excluded.email, name=coalesce(nullif(excluded.name,''),public.profiles.name),
    school=coalesce(nullif(excluded.school,''),public.profiles.school),
    role=case when lower(coalesce(excluded.email,''))=lower('m.samra103@gmail.com') then 'admin' else public.profiles.role end,
    avatar=coalesce(nullif(excluded.avatar,''),public.profiles.avatar),
    icon=coalesce(nullif(excluded.icon,''),public.profiles.icon),
    educator_gender=coalesce(nullif(excluded.educator_gender,''),public.profiles.educator_gender),
    updated_at=now();
  return new;
end; $$;
revoke all on function manarat_private.handle_new_user() from public;

drop trigger if exists manarat_profile_after_signup on auth.users;
create trigger manarat_profile_after_signup after insert on auth.users
for each row execute function manarat_private.handle_new_user();

create or replace function manarat_private.protect_profile_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
declare actual_email text;
begin
  if caller is null then return new; end if;
  if caller=new.id then
    select u.email into actual_email from auth.users u where u.id=caller;
    new.email := actual_email;
    if lower(coalesce(actual_email,''))=lower('m.samra103@gmail.com') then
      new.role := 'admin';
    elsif tg_op='INSERT' then
      new.role := 'teacher';
    elsif new.role is distinct from old.role then
      new.role := old.role;
    end if;
  elsif not manarat_private.is_admin(caller) then
    raise exception 'not authorized to edit this profile';
  end if;
  return new;
end; $$;
revoke all on function manarat_private.protect_profile_identity() from public;

drop trigger if exists manarat_protect_profile_identity on public.profiles;
create trigger manarat_protect_profile_identity before insert or update on public.profiles
for each row execute function manarat_private.protect_profile_identity();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('manarat-assets','manarat-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'];

-- Explicit Data API grants. RLS below remains the authorization boundary.
grant usage on schema public to anon, authenticated;
revoke all on public.profiles, public.platform_state, public.manarat_games, public.manarat_question_banks,
  public.manarat_rosters, public.manarat_attempts, public.manarat_messages, public.manarat_audit_logs, public.manarat_schools from anon, authenticated;
grant select on public.platform_state, public.manarat_games to anon;
grant insert on public.manarat_attempts to anon;
grant select, insert, update, delete on public.profiles, public.platform_state, public.manarat_games,
  public.manarat_question_banks, public.manarat_rosters, public.manarat_messages, public.manarat_schools to authenticated;
grant select, insert, update, delete on public.manarat_attempts to authenticated;
grant select, insert on public.manarat_audit_logs to authenticated;

alter table public.profiles enable row level security;
alter table public.platform_state enable row level security;
alter table public.manarat_games enable row level security;
alter table public.manarat_question_banks enable row level security;
alter table public.manarat_rosters enable row level security;
alter table public.manarat_attempts enable row level security;
alter table public.manarat_messages enable row level security;
alter table public.manarat_audit_logs enable row level security;
alter table public.manarat_schools enable row level security;

do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and tablename in ('profiles','platform_state','manarat_games','manarat_question_banks','manarat_rosters','manarat_attempts','manarat_messages','manarat_audit_logs','manarat_schools')
  loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop;
end $$;

create policy "profiles_read_own_or_admin" on public.profiles for select to authenticated
using ((select auth.uid())=id or manarat_private.is_admin((select auth.uid())));
create policy "profiles_insert_own_or_admin" on public.profiles for insert to authenticated
with check ((select auth.uid())=id or manarat_private.is_admin((select auth.uid())));
create policy "profiles_update_own_or_admin" on public.profiles for update to authenticated
using ((select auth.uid())=id or manarat_private.is_admin((select auth.uid())))
with check ((select auth.uid())=id or manarat_private.is_admin((select auth.uid())));
create policy "profiles_delete_admin" on public.profiles for delete to authenticated
using (manarat_private.is_admin((select auth.uid())));

create policy "platform_public_read" on public.platform_state for select to anon, authenticated
using (id='public' or manarat_private.is_admin((select auth.uid())));
create policy "platform_admin_insert" on public.platform_state for insert to authenticated
with check (manarat_private.is_admin((select auth.uid())));
create policy "platform_admin_update" on public.platform_state for update to authenticated
using (manarat_private.is_admin((select auth.uid()))) with check (manarat_private.is_admin((select auth.uid())));
create policy "platform_admin_delete" on public.platform_state for delete to authenticated
using (manarat_private.is_admin((select auth.uid())));

create policy "games_public_or_owner_read" on public.manarat_games for select to anon, authenticated
using (status='published' or is_public=true or is_shared=true or teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "games_owner_insert" on public.manarat_games for insert to authenticated
with check (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "games_owner_update" on public.manarat_games for update to authenticated
using (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())))
with check (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "games_owner_delete" on public.manarat_games for delete to authenticated
using (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));

create policy "banks_owner_read" on public.manarat_question_banks for select to authenticated
using (owner_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "banks_owner_insert" on public.manarat_question_banks for insert to authenticated
with check (owner_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "banks_owner_update" on public.manarat_question_banks for update to authenticated
using (owner_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())))
with check (owner_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "banks_owner_delete" on public.manarat_question_banks for delete to authenticated
using (owner_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));

create policy "rosters_owner_read" on public.manarat_rosters for select to authenticated
using (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "rosters_owner_insert" on public.manarat_rosters for insert to authenticated
with check (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "rosters_owner_update" on public.manarat_rosters for update to authenticated
using (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())))
with check (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));
create policy "rosters_owner_delete" on public.manarat_rosters for delete to authenticated
using (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid())));

create policy "attempts_public_insert" on public.manarat_attempts for insert to anon, authenticated
with check (exists(select 1 from public.manarat_games g where g.id=game_id and (g.status='published' or g.is_public=true or g.is_shared=true)));
create policy "attempts_owner_read" on public.manarat_attempts for select to authenticated
using (teacher_id=(select auth.uid()) or manarat_private.is_admin((select auth.uid()))
  or exists(select 1 from public.manarat_games g where g.id=game_id and g.teacher_id=(select auth.uid())));
create policy "attempts_admin_update" on public.manarat_attempts for update to authenticated
using (manarat_private.is_admin((select auth.uid()))) with check (manarat_private.is_admin((select auth.uid())));
create policy "attempts_admin_delete" on public.manarat_attempts for delete to authenticated
using (manarat_private.is_admin((select auth.uid())));

create policy "messages_related_read" on public.manarat_messages for select to authenticated
using (manarat_private.is_admin((select auth.uid())) or from_id=(select auth.uid()) or to_id=(select auth.uid()) or to_role='all');
create policy "messages_sender_insert" on public.manarat_messages for insert to authenticated
with check (manarat_private.is_admin((select auth.uid())) or from_id=(select auth.uid()));
create policy "messages_recipient_update" on public.manarat_messages for update to authenticated
using (manarat_private.is_admin((select auth.uid())) or to_id=(select auth.uid()))
with check (manarat_private.is_admin((select auth.uid())) or to_id=(select auth.uid()));
create policy "messages_admin_delete" on public.manarat_messages for delete to authenticated
using (manarat_private.is_admin((select auth.uid())));

create policy "audit_authenticated_insert" on public.manarat_audit_logs for insert to authenticated
with check (true);
create policy "audit_admin_read" on public.manarat_audit_logs for select to authenticated
using (manarat_private.is_admin((select auth.uid())));

create policy "schools_related_read" on public.manarat_schools for select to authenticated
using (manarat_private.is_admin((select auth.uid())) or supervisor_id=(select auth.uid())
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.school_id=public.manarat_schools.id));
create policy "schools_admin_insert" on public.manarat_schools for insert to authenticated
with check (manarat_private.is_admin((select auth.uid())));
create policy "schools_admin_update" on public.manarat_schools for update to authenticated
using (manarat_private.is_admin((select auth.uid())) or supervisor_id=(select auth.uid()))
with check (manarat_private.is_admin((select auth.uid())) or supervisor_id=(select auth.uid()));
create policy "schools_admin_delete" on public.manarat_schools for delete to authenticated
using (manarat_private.is_admin((select auth.uid())));

-- Storage: public reads, authenticated writes only.
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'manarat_assets_%'
  loop execute format('drop policy if exists %I on storage.objects',r.policyname); end loop;
end $$;
create policy "manarat_assets_public_read" on storage.objects for select to anon, authenticated
using (bucket_id='manarat-assets');
create policy "manarat_assets_authenticated_insert" on storage.objects for insert to authenticated
with check (bucket_id='manarat-assets');
create policy "manarat_assets_authenticated_update" on storage.objects for update to authenticated
using (bucket_id='manarat-assets') with check (bucket_id='manarat-assets');
create policy "manarat_assets_authenticated_delete" on storage.objects for delete to authenticated
using (bucket_id='manarat-assets');

-- Public state is safe for anonymous home-page configuration. The full main state is created on first admin sync.
insert into public.platform_state(id,data,updated_at) values ('public','{}'::jsonb,now())
on conflict(id) do nothing;
