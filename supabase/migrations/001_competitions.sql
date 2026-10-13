-- Versioned aggregate storage. PostgreSQL commits state, version and audit together.
-- Only the authenticated Next.js server can mutate using the server-only service key.
create table public.competitions (
 id uuid primary key,
 slug text unique not null,
 owner_user_id uuid not null references auth.users(id),
 visibility text not null check (visibility in ('public','unlisted','private')),
 status text not null check (status in ('draft','published','in_progress','completed','archived','cancelled')),
 version integer not null default 0,
 data jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (data->>'id'=id::text),
 check ((data->>'version')::int=version)
);
create table public.competition_members (
 competition_id uuid not null references public.competitions(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('owner','admin','score_operator')),
 primary key (competition_id,user_id)
);
create table public.competition_invites (
 token_hash text primary key,
 competition_id uuid not null references public.competitions(id) on delete cascade,
 role text not null check (role in ('admin','score_operator')),
 email text,
 expires_at bigint not null,
 accepted_at bigint
);
-- Safe realtime signals contain no score, email, slug or audit payload.
create table public.competition_events (
 competition_id uuid primary key references public.competitions(id) on delete cascade,
 version integer not null,
 updated_at timestamptz not null default now()
);
alter table public.competition_events enable row level security;
create function public.can_read_competition(cid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from competitions c where c.id=cid and ((c.visibility in ('public','unlisted') and c.status<>'draft') or exists(select 1 from competition_members m where m.competition_id=cid and m.user_id=auth.uid())));
$$;
revoke all on function public.can_read_competition(uuid) from public;
grant execute on function public.can_read_competition(uuid) to anon,authenticated;
create policy event_read on public.competition_events for select to anon,authenticated using (public.can_read_competition(competition_id));
revoke all on public.competition_events from anon,authenticated;
grant select on public.competition_events to anon,authenticated;
grant all on public.competition_events to service_role;
create index competitions_owner_status on public.competitions(owner_user_id,status);
create index competitions_visibility_status on public.competitions(visibility,status);
create index members_user on public.competition_members(user_id,competition_id);
alter table public.competitions enable row level security;
alter table public.competition_members enable row level security;
alter table public.competition_invites enable row level security;
-- Do not expose aggregate payloads (member emails and audit identities) to public clients.
-- Public snapshots come from /api; Realtime is member-only. Guests poll sanitized API.
create policy member_read on public.competition_members for select to authenticated using (user_id=auth.uid());
create policy authorized_read on public.competitions for select to authenticated using (exists(select 1 from public.competition_members m where m.competition_id=id and m.user_id=auth.uid()));
revoke all on public.competitions,public.competition_members,public.competition_invites from anon,authenticated;
grant select on public.competitions,public.competition_members to authenticated;
grant all on public.competitions,public.competition_members,public.competition_invites to service_role;
create or replace function public.save_competition(payload jsonb,expected_version integer default null) returns void language plpgsql security invoker set search_path=public as $$
declare cid uuid := (payload->>'id')::uuid;
begin
 if expected_version is null then
  insert into competitions(id,slug,owner_user_id,visibility,status,version,data) values(cid,payload->>'slug',(payload->>'ownerId')::uuid,payload->>'visibility',payload->>'status',(payload->>'version')::int,payload);
 else
  update competitions set owner_user_id=(payload->>'ownerId')::uuid,visibility=payload->>'visibility',status=payload->>'status',version=(payload->>'version')::int,data=payload,updated_at=now() where id=cid and version=expected_version;
  if not found then raise exception 'version conflict'; end if;
 end if;
 insert into competition_events(competition_id,version) values(cid,(payload->>'version')::int) on conflict(competition_id) do update set version=excluded.version,updated_at=now();
 delete from competition_members where competition_id=cid;
 insert into competition_members(competition_id,user_id,role) select cid,(m->>'userId')::uuid,m->>'role' from jsonb_array_elements(payload->'members') m;
end; $$;
revoke all on function public.save_competition(jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_competition(jsonb,integer) to service_role;
create or replace function public.accept_competition_invite(payload jsonb,expected_version integer,invite_hash text) returns void language plpgsql security invoker set search_path=public as $$
begin
 update competition_invites set accepted_at=(extract(epoch from now())*1000)::bigint where token_hash=invite_hash and competition_id=(payload->>'id')::uuid and accepted_at is null and expires_at>(extract(epoch from now())*1000)::bigint;
 if not found then raise exception 'invite unavailable'; end if;
 perform save_competition(payload,expected_version);
end; $$;
revoke all on function public.accept_competition_invite(jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.accept_competition_invite(jsonb,integer,text) to service_role;
-- Supabase commonly already enables the publication; add this table once.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='competition_events') then
  alter publication supabase_realtime add table public.competition_events;
 end if;
end $$;
