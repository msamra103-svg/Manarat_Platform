begin;
-- Preserve previously granted administrators, then use protected profiles as the sole role source.
update public.profiles p set role='admin'
from auth.users u where u.id=p.id and u.email_confirmed_at is not null
and exists(select 1 from public.platform_state s,
 jsonb_array_elements(case when jsonb_typeof(s.data->'admins')='array' then s.data->'admins' else '[]'::jsonb end) a
 where s.id='main' and lower(a->>'email')=lower(u.email) and coalesce((a->>'active')::boolean,true));
create or replace function manarat_private.is_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from auth.users u join public.profiles p on p.id=u.id
 where u.id=auth.uid() and u.email_confirmed_at is not null and p.status<>'موقوف'
 and (lower(u.email)='m.samra103@gmail.com' or p.role='admin'));
$$;
commit;
