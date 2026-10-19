-- Manarat V17.1: run once in the EXISTING project's SQL Editor before deploying.
-- Transactional and repeatable. No application rows are deleted.
begin;
create schema if not exists manarat_private;
revoke all on schema manarat_private from public;
grant usage on schema manarat_private to anon, authenticated, service_role;

-- Preserve the V17 private main row and publish only its safe settings.
insert into public.platform_state(id,data,updated_at)
select 'v17_0_backup',data,updated_at from public.platform_state where id='main'
on conflict(id) do nothing;
insert into public.platform_state(id,data,updated_at)
select 'public',jsonb_build_object('platform',coalesce(data->'platform','{}'::jsonb)),updated_at from public.platform_state where id='main'
on conflict(id) do nothing;
drop trigger if exists manarat_protect_profile_identity on public.profiles;
drop trigger if exists manarat_profile_after_signup on auth.users;
drop trigger if exists on_auth_user_created on auth.users;

-- Read trusted Auth records and protected profiles, never raw_user_meta_data.role.
create or replace function manarat_private.is_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from auth.users u left join public.profiles p on p.id=u.id
  where u.id=auth.uid() and u.email_confirmed_at is not null
    and coalesce(p.status,'نشط')<>'موقوف'
    and (lower(u.email)='m.samra103@gmail.com' or p.role='admin' or exists(
      select 1 from public.platform_state s,
      jsonb_array_elements(case when jsonb_typeof(s.data->'admins')='array' then s.data->'admins' else '[]'::jsonb end) a
      where s.id='main' and lower(a->>'email')=lower(u.email)
        and coalesce((a->>'active')::boolean,true)
    ))
 );
$$;
revoke all on function manarat_private.is_admin() from public;
grant execute on function manarat_private.is_admin() to anon,authenticated,service_role;
create or replace function manarat_private.is_admin(uid uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select uid=auth.uid() and manarat_private.is_admin();
$$;
revoke all on function manarat_private.is_admin(uuid) from public;
grant execute on function manarat_private.is_admin(uuid) to anon,authenticated,service_role;
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select uid=auth.uid() and manarat_private.is_admin();
$$;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon,authenticated,service_role;

create or replace function manarat_private.protect_profile()
returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is not null and not manarat_private.is_admin() then
  if TG_OP='INSERT' then
   new.role:='teacher'; new.status:='نشط'; new.school_id:=null;
  elsif new.role is distinct from old.role or new.status is distinct from old.status
        or new.school_id is distinct from old.school_id then
   raise exception 'Only an administrator can change account permissions' using errcode='42501';
  end if;
  if new.id<>auth.uid() or lower(coalesce(new.email,''))<>lower(coalesce(auth.jwt()->>'email','')) then
   raise exception 'Profile identity must match the authenticated account' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function manarat_private.protect_profile() from public;
drop trigger if exists manarat_protect_profile on public.profiles;
create trigger manarat_protect_profile before insert or update on public.profiles for each row execute function manarat_private.protect_profile();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,name,school,role,status,educator_gender)
 values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'school',''),'teacher','نشط',case when new.raw_user_meta_data->>'educator_gender'='male' then 'male' else 'female' end)
 on conflict(id) do nothing;
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
create trigger manarat_profile_after_signup after insert on auth.users for each row execute function public.handle_new_user();
-- The configured owner must already have a verified Auth account.
update public.profiles p set role='admin' from auth.users u
where p.id=u.id and lower(u.email)='m.samra103@gmail.com' and u.email_confirmed_at is not null;

create or replace function manarat_private.sanitize_main_state()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.id='public' then
  new.data:=jsonb_build_object('version','17.1.0-reviewed','platform',coalesce(new.data->'platform','{}'::jsonb));
  new.data:=new.data #- '{platform,ai,apiKey}';
 end if;
 return new;
end $$;
revoke all on function manarat_private.sanitize_main_state() from public;
drop trigger if exists manarat_sanitize_main on public.platform_state;
create trigger manarat_sanitize_main before insert or update on public.platform_state for each row execute function manarat_private.sanitize_main_state();
update public.platform_state set data=data where id='public';

-- Reconcile the audit schema with the payload actually sent by the app.
alter table public.manarat_audit_logs add column if not exists target text;
alter table public.manarat_audit_logs add column if not exists details jsonb default '{}'::jsonb;
alter table public.manarat_audit_logs add column if not exists admin_email text;
alter table public.manarat_audit_logs add column if not exists admin_name text;

-- Replace legacy permissive policies, using exact table names.
do $$ declare r record; t text; begin
 for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','platform_state','manarat_games','manarat_question_banks','manarat_rosters','manarat_attempts','manarat_messages','manarat_audit_logs','manarat_schools') loop
  execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
 end loop;
 foreach t in array array['profiles','platform_state','manarat_games','manarat_question_banks','manarat_rosters','manarat_attempts','manarat_messages','manarat_audit_logs','manarat_schools'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon',t);
  execute format('grant select,insert,update,delete on table public.%I to authenticated,service_role',t);
 end loop;
end $$;
grant usage on schema public to anon,authenticated,service_role;
grant select on public.platform_state,public.manarat_games to anon;

create policy "state read" on public.platform_state for select to anon,authenticated using(id='public' or manarat_private.is_admin());
create policy "state insert" on public.platform_state for insert to authenticated with check(manarat_private.is_admin());
create policy "state update" on public.platform_state for update to authenticated using(manarat_private.is_admin()) with check(manarat_private.is_admin());
create policy "state delete" on public.platform_state for delete to authenticated using(manarat_private.is_admin());
create policy "profile read" on public.profiles for select to authenticated using(id=auth.uid() or manarat_private.is_admin());
create policy "profile insert" on public.profiles for insert to authenticated with check(id=auth.uid() or manarat_private.is_admin());
create policy "profile update" on public.profiles for update to authenticated using(id=auth.uid() or manarat_private.is_admin()) with check(id=auth.uid() or manarat_private.is_admin());
create policy "profile delete" on public.profiles for delete to authenticated using(manarat_private.is_admin());
-- Published games are playable by link; homepage visibility remains is_public.
create policy "games read" on public.manarat_games for select to anon,authenticated using(status='published' or teacher_id=auth.uid() or manarat_private.is_admin());
create policy "games insert" on public.manarat_games for insert to authenticated with check(teacher_id=auth.uid() or manarat_private.is_admin());
create policy "games update" on public.manarat_games for update to authenticated using(teacher_id=auth.uid() or manarat_private.is_admin()) with check(teacher_id=auth.uid() or manarat_private.is_admin());
create policy "games delete" on public.manarat_games for delete to authenticated using(teacher_id=auth.uid() or manarat_private.is_admin());
create policy "banks own" on public.manarat_question_banks for all to authenticated using(owner_id=auth.uid() or manarat_private.is_admin()) with check(owner_id=auth.uid() or manarat_private.is_admin());
create policy "rosters own" on public.manarat_rosters for all to authenticated using(teacher_id=auth.uid() or manarat_private.is_admin()) with check(teacher_id=auth.uid() or manarat_private.is_admin());
create policy "attempts read" on public.manarat_attempts for select to authenticated using(manarat_private.is_admin() or exists(select 1 from public.manarat_games g where g.id=game_id and g.teacher_id=auth.uid()));
create policy "attempts admin" on public.manarat_attempts for all to authenticated using(manarat_private.is_admin()) with check(manarat_private.is_admin());
create policy "messages read" on public.manarat_messages for select to authenticated using(manarat_private.is_admin() or from_id=auth.uid() or to_id=auth.uid() or to_role='all');
create policy "messages insert" on public.manarat_messages for insert to authenticated with check(manarat_private.is_admin() or (from_id=auth.uid() and to_role='admins'));
create policy "messages update" on public.manarat_messages for update to authenticated using(manarat_private.is_admin()) with check(manarat_private.is_admin());
create policy "messages delete" on public.manarat_messages for delete to authenticated using(manarat_private.is_admin());
create policy "audit admin" on public.manarat_audit_logs for all to authenticated using(manarat_private.is_admin()) with check(manarat_private.is_admin());
create policy "schools read" on public.manarat_schools for select to authenticated using(manarat_private.is_admin() or supervisor_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.school_id=manarat_schools.id));
create policy "schools admin" on public.manarat_schools for all to authenticated using(manarat_private.is_admin()) with check(manarat_private.is_admin());

-- Anonymous players can submit one bounded result, but cannot read/write tables.
-- This narrow guest RPC intentionally accepts an unauthenticated caller.
create or replace function manarat_private.submit_attempt(p jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare g public.manarat_games; aid text; points integer;
begin
 if octet_length(p::text)>262144 then raise exception 'Result is too large'; end if;
 select * into g from public.manarat_games where id=p->>'game_id' and status='published';
 if not found then raise exception 'Published game not found' using errcode='42501'; end if;
 aid:=p->>'id'; points:=(p->>'score')::integer;
 if aid is null or length(aid)>100 or points is null or points<0 or points>100 or length(coalesce(p->>'student_name',''))>200 then raise exception 'Invalid result'; end if;
 insert into public.manarat_attempts(id,game_id,teacher_id,teacher_email,student_name,score,data,created_at)
 values(aid,g.id,g.teacher_id,g.teacher_email,coalesce(p->>'student_name',''),points,p,now())
 on conflict(id) do nothing;
 return aid;
end $$;
revoke all on function manarat_private.submit_attempt(jsonb) from public;
grant execute on function manarat_private.submit_attempt(jsonb) to anon,authenticated,service_role;
create or replace function public.submit_manarat_attempt(p jsonb)
returns text language sql security invoker set search_path='' as $$ select manarat_private.submit_attempt(p); $$;
revoke all on function public.submit_manarat_attempt(jsonb) from public;
grant execute on function public.submit_manarat_attempt(jsonb) to anon,authenticated,service_role;

-- Storage writes must target the uploader's own folder/<uid>/file path.
do $$ declare r record; begin
 for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (policyname like 'manarat assets%' or policyname like 'v12 manarat assets%' or policyname like 'manarat_assets_%') loop
 execute format('drop policy %I on storage.objects',r.policyname); end loop;
end $$;
create policy "manarat assets read" on storage.objects for select to anon,authenticated using(bucket_id='manarat-assets');
create policy "manarat assets insert" on storage.objects for insert to authenticated with check(bucket_id='manarat-assets' and ((string_to_array(name,'/'))[2]=auth.uid()::text or manarat_private.is_admin()));
create policy "manarat assets update" on storage.objects for update to authenticated using(bucket_id='manarat-assets' and ((string_to_array(name,'/'))[2]=auth.uid()::text or manarat_private.is_admin())) with check(bucket_id='manarat-assets' and ((string_to_array(name,'/'))[2]=auth.uid()::text or manarat_private.is_admin()));
create policy "manarat assets delete" on storage.objects for delete to authenticated using(bucket_id='manarat-assets' and ((string_to_array(name,'/'))[2]=auth.uid()::text or manarat_private.is_admin()));

-- Only administrators approve games for the public/shared library.
create or replace function manarat_private.protect_game_approval()
returns trigger language plpgsql set search_path='' as $$
declare approval_required boolean;
begin
 if auth.uid() is not null and not manarat_private.is_admin() then
  select coalesce((data#>>'{platform,publicLibraryRequiresApproval}')::boolean,true) into approval_required from public.platform_state where id='public';
  if coalesce(approval_required,true) then
   if TG_OP='INSERT' then new.is_public:=false;new.is_shared:=false;
   else
    if new.is_public and not coalesce(old.is_public,false) then new.is_public:=false;end if;
    if new.is_shared and not coalesce(old.is_shared,false) then new.is_shared:=false;end if;
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function manarat_private.protect_game_approval() from public;
drop trigger if exists manarat_game_approval on public.manarat_games;
create trigger manarat_game_approval before insert or update on public.manarat_games for each row execute function manarat_private.protect_game_approval();

create index if not exists manarat_games_teacher_idx on public.manarat_games(teacher_id);
create index if not exists manarat_attempts_game_idx on public.manarat_attempts(game_id);
create index if not exists manarat_banks_owner_idx on public.manarat_question_banks(owner_id);
create index if not exists manarat_rosters_teacher_idx on public.manarat_rosters(teacher_id);
commit;
