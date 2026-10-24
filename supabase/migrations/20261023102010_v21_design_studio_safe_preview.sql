begin;
-- Separate persistent review configuration. No production settings are overwritten.
create table if not exists public.school_design_studio (
 id boolean primary key default true check(id),
 data jsonb not null,
 history jsonb not null default '[]',
 revision integer not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.school_design_studio enable row level security;
revoke all on public.school_design_studio from anon, authenticated;
grant select,insert,update,delete on public.school_design_studio to service_role;
insert into public.school_design_studio(id,data)
select true,data from public.school_settings where id=true on conflict do nothing;
-- Immutable public presentation images; no direct public/authenticated write policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('manarat-brand-assets','manarat-brand-assets',true,4194304,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
-- Explicit service grants for existing checked API boundaries. Browser access remains RLS controlled.
grant select,insert,update,delete on public.school_settings, public.school_assignments,
 public.school_sessions, public.school_videos, public.school_rate_limits to service_role;
grant select,insert,update,delete on public.platform_state, public.profiles,
 public.manarat_games, public.manarat_question_banks, public.manarat_attempts to service_role;
-- Existing browser tables retain row-scoped policies verified in pg_policies.
grant select on public.profiles, public.manarat_games, public.manarat_question_banks,
 public.manarat_attempts to authenticated;
grant select on public.platform_state to anon,authenticated;
-- Settings, answer keys, student results and revisions are never anonymously selectable.
revoke all on public.school_settings, public.school_assignments, public.school_sessions,
 public.school_videos, public.school_rate_limits from anon,authenticated;
commit;
