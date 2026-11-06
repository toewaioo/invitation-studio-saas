-- Public invitations are addressable by username alone once published.
-- A supplied legacy public key must still match exactly; owner table/RLS policies are unchanged.
create or replace function public.public_project(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'customer_name', '',
    'customer_email', '',
    'customer_phone', '',
    'private_notes', '',
    'person_a', p.person_a,
    'person_b', p.person_b,
    'parent_a', p.parent_a,
    'parent_b', p.parent_b,
    'event_date', p.event_date,
    'event_time', p.event_time,
    'venue', p.venue,
    'message', p.message,
    'map_url', p.map_url,
    'schedule', p.schedule,
    'username', p.username,
    'template', p.template,
    'theme', p.theme,
    'project_type', p.project_type,
    'status', p.status,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'url', x.storage_path, 'path', x.storage_path,
        'caption', x.caption, 'position', x.position
      ) order by x.position)
      from public.project_photos x where x.project_id = p.id
    ), '[]'::jsonb),
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'public_key', null
  )
  from public.projects p
  where p.username = trim(p_username)
    and (nullif(p_public_key, '') is null or p.public_key = p_public_key)
    and p.status = 'published';
$$;
revoke all on function public.public_project(text, text) from public;
grant execute on function public.public_project(text, text) to anon, authenticated;

-- Existing cross-table collisions cannot be routed safely by /i/:username.
do $$
begin
  if exists (
    select 1
    from (
      select lower(username) as normalized from public.projects
      union all
      select lower(username) from public.guest_invitations
    ) names
    group by normalized
    having count(*) > 1
  ) then
    raise exception 'Username-only links require unique invitation usernames; resolve existing projects/guest_invitations collisions before applying this migration';
  end if;
end;
$$;

-- Preserve every claimed name, even if its project is renamed or deleted, so an
-- old public URL can never later point to a different invitation.
create table if not exists public.share_username_claims (
  username text primary key check (username ~ '^[a-z][a-z0-9-]{2,39}$'),
  source text not null check (source in ('project', 'guest')),
  record_id uuid not null
);
alter table public.share_username_claims enable row level security;
revoke all on table public.share_username_claims from public, anon, authenticated, service_role;

insert into public.share_username_claims(username, source, record_id)
select lower(username), 'project', id from public.projects
union all
select lower(username), 'guest', id from public.guest_invitations
on conflict (username) do nothing;

create or replace function public.claim_invitation_username()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  claim_source text := case when tg_table_name = 'projects' then 'project' else 'guest' end;
  normalized_username text := lower(trim(new.username));
begin
  if tg_op = 'UPDATE' then
    if normalized_username = lower(trim(old.username)) then return new; end if;
  end if;

  insert into public.share_username_claims(username, source, record_id)
  values (normalized_username, claim_source, new.id)
  on conflict (username) do update
    set username = excluded.username
    where share_username_claims.source = excluded.source
      and share_username_claims.record_id = excluded.record_id;

  if not found then
    raise exception 'Username is already in use';
  end if;
  return new;
end;
$$;
revoke all on function public.claim_invitation_username() from public, anon, authenticated;

drop trigger if exists projects_claim_share_username on public.projects;
create trigger projects_claim_share_username
before insert or update on public.projects
for each row execute function public.claim_invitation_username();

drop trigger if exists guest_claim_share_username on public.guest_invitations;
create trigger guest_claim_share_username
before insert or update on public.guest_invitations
for each row execute function public.claim_invitation_username();

create or replace function public.username_available(p_username text, p_except_id uuid default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (
    select 1 from public.share_username_claims c
    where c.username = lower(trim(p_username))
      and (p_except_id is null or c.source <> 'project' or c.record_id <> p_except_id)
  );
$$;
revoke all on function public.username_available(text,uuid) from public;
grant execute on function public.username_available(text,uuid) to authenticated;
