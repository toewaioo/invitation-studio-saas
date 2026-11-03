-- Server-only protocol for direct guest photo uploads to the existing private bucket.
-- This migration is prepared for local testing only; do not apply without approval.
create table if not exists public.guest_upload_sessions (
  id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  input jsonb not null,
  schedule jsonb not null default '[]'::jsonb,
  files jsonb not null,
  status text not null default 'pending' check (status in ('pending','published','canceled','expired')),
  expires_at timestamptz not null,
  guest_invitation_id uuid unique references public.guest_invitations(id) on delete set null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(input) = 'object'),
  check (public.schedule_valid(schedule)),
  check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 1 and 3),
  check ((status = 'published') = (guest_invitation_id is not null))
);
alter table public.guest_upload_sessions enable row level security;
revoke all on table public.guest_upload_sessions from public, anon, authenticated;
grant all on table public.guest_upload_sessions to service_role;

create or replace function public.create_guest_upload_session(
  p_session_id uuid, p_secret_hash text, p_ip_hash text,
  p_input jsonb, p_schedule jsonb, p_files jsonb, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare now_hour timestamptz := date_trunc('hour', now()); today date := current_date;
  n integer; d integer; f jsonb; i integer := 0; v_size bigint; v_position integer;
  v_id text; v_mime text; v_extension text; v_path text;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_session_id is null or p_secret_hash is null or p_secret_hash !~ '^[0-9a-f]{64}$' or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid upload session'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or pg_column_size(p_input) > 16000 then raise exception 'Invalid invitation input'; end if;
  if exists (select 1 from jsonb_object_keys(p_input) as keys(key) where key not in ('title','person_a','person_b','parent_a','parent_b','event_date','event_time','venue','message','map_url','template','theme','project_type')) then raise exception 'Unexpected invitation fields'; end if;
  if p_schedule is null or not public.schedule_valid(p_schedule) then raise exception 'Invalid schedule'; end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) not between 1 and 3 then raise exception 'Invalid photo list'; end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '2 hours 1 minute' then raise exception 'Invalid upload expiry'; end if;
  for f in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(f) <> 'object' then raise exception 'Invalid photo metadata'; end if;
    v_id := f->>'id'; v_mime := f->>'mime_type'; v_path := f->>'path';
    if v_id is null or v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid photo id'; end if;
    if (f->>'size') is null or (f->>'size') !~ '^[0-9]+$' then raise exception 'Invalid photo size'; end if;
    v_size := (f->>'size')::bigint;
    if v_size < 1 or v_size > 9437184 then raise exception 'Photo exceeds 9 MiB'; end if;
    if (f->>'position') is null or (f->>'position') !~ '^[0-2]$' then raise exception 'Invalid photo position'; end if;
    v_position := (f->>'position')::integer;
    if v_position <> i then raise exception 'Invalid photo order'; end if;
    v_extension := case v_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else null end;
    if v_extension is null or v_path <> 'guest-staging/' || p_session_id::text || '/' || v_id || '.' || v_extension then raise exception 'Invalid photo path or MIME type'; end if;
    i := i + 1;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_files)) <> jsonb_array_length(p_files) then raise exception 'Duplicate photo ids'; end if;

  insert into public.guest_invitation_ip_hour(ip_hash, window_start, attempts) values(p_ip_hash, now_hour, 0) on conflict do nothing;
  select attempts into n from public.guest_invitation_ip_hour where ip_hash=p_ip_hash and window_start=now_hour for update;
  if n >= 5 then raise exception 'Rate limit exceeded'; end if;
  insert into public.guest_invitation_day(day, attempts) values(today, 0) on conflict do nothing;
  select attempts into d from public.guest_invitation_day where day=today for update;
  if d >= 200 then raise exception 'Daily limit exceeded'; end if;
  update public.guest_invitation_ip_hour set attempts=attempts+1 where ip_hash=p_ip_hash and window_start=now_hour;
  update public.guest_invitation_day set attempts=attempts+1 where day=today;

  insert into public.guest_upload_sessions(id, secret_hash, ip_hash, input, schedule, files, expires_at)
    values(p_session_id, p_secret_hash, p_ip_hash, p_input, p_schedule, p_files, p_expires_at);
  return jsonb_build_object('id', p_session_id, 'expires_at', p_expires_at, 'files', p_files);
end; $$;

create or replace function public.get_guest_upload_session(p_session_id uuid, p_secret_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.guest_upload_sessions;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into s from public.guest_upload_sessions where id=p_session_id and secret_hash=p_secret_hash;
  if s.id is null then return null; end if;
  return jsonb_build_object('id',s.id,'input',s.input,'schedule',s.schedule,'files',s.files,'status',s.status,'expires_at',s.expires_at,'guest_invitation_id',s.guest_invitation_id);
end; $$;

create or replace function public.finalize_guest_upload_session(p_session_id uuid, p_secret_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.guest_upload_sessions; p public.guest_invitations; photo_list jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into s from public.guest_upload_sessions where id=p_session_id and secret_hash=p_secret_hash for update;
  if s.id is null then raise exception 'Upload session not found'; end if;
  if s.status = 'published' and s.guest_invitation_id is not null then
    select * into p from public.guest_invitations where id=s.guest_invitation_id;
    if p.id is null then raise exception 'Published invitation not found'; end if;
    return public.guest_public_project(p.username,p.public_key);
  end if;
  if s.status <> 'pending' or s.expires_at <= now() then raise exception 'Upload session expired'; end if;
  select jsonb_agg(jsonb_build_object('id', f->>'id', 'storage_path', f->>'path', 'caption', '', 'position', (f->>'position')::integer) order by (f->>'position')::integer)
    into photo_list from jsonb_array_elements(s.files) f;
  insert into public.guest_invitations(username,public_key,title,customer_name,customer_email,customer_phone,private_notes,person_a,person_b,parent_a,parent_b,event_date,event_time,venue,message,map_url,schedule,template,theme,project_type,photos)
  values ('guest-'||replace(gen_random_uuid()::text,'-',''), replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
    coalesce(nullif(trim(s.input->>'title'),''),''), '', '', '', '', coalesce(s.input->>'person_a',''), coalesce(s.input->>'person_b',''), coalesce(s.input->>'parent_a',''), coalesce(s.input->>'parent_b',''), coalesce(s.input->>'event_date',''), coalesce(s.input->>'event_time',''), coalesce(s.input->>'venue',''), coalesce(s.input->>'message',''), coalesce(s.input->>'map_url',''), s.schedule, coalesce(s.input->>'template','thazin'), coalesce(s.input->>'theme','sage'), coalesce(s.input->>'project_type','wedding'), photo_list)
  returning * into p;
  update public.guest_upload_sessions set status='published', guest_invitation_id=p.id where id=s.id;
  return public.guest_public_project(p.username,p.public_key);
end; $$;

create or replace function public.cancel_guest_upload_session(p_session_id uuid, p_secret_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.guest_upload_sessions;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into s from public.guest_upload_sessions where id=p_session_id and secret_hash=p_secret_hash for update;
  if s.id is null then return jsonb_build_object('status','missing'); end if;
  if s.status = 'pending' then update public.guest_upload_sessions set status='canceled' where id=s.id; end if;
  return jsonb_build_object('status',case when s.status='pending' then 'canceled' else s.status end,'files',case when s.status='published' then '[]'::jsonb else s.files end);
end; $$;

create or replace function public.list_expired_guest_upload_sessions(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'files',x.files)), '[]'::jsonb) into result
  from (select id,files from public.guest_upload_sessions where status in ('pending','canceled') and expires_at <= now() - interval '5 minutes' order by expires_at limit greatest(1,least(coalesce(p_limit,20),100))) x;
  return result;
end; $$;

create or replace function public.expire_guest_upload_session(p_session_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  update public.guest_upload_sessions set status='expired' where id=p_session_id and status in ('pending','canceled') and expires_at <= now();
  return found;
end; $$;

revoke all on function public.create_guest_upload_session(uuid,text,text,jsonb,jsonb,jsonb,timestamptz) from public, anon, authenticated;
revoke all on function public.get_guest_upload_session(uuid,text) from public, anon, authenticated;
revoke all on function public.finalize_guest_upload_session(uuid,text) from public, anon, authenticated;
revoke all on function public.cancel_guest_upload_session(uuid,text) from public, anon, authenticated;
revoke all on function public.list_expired_guest_upload_sessions(integer) from public, anon, authenticated;
revoke all on function public.expire_guest_upload_session(uuid) from public, anon, authenticated;
grant execute on function public.create_guest_upload_session(uuid,text,text,jsonb,jsonb,jsonb,timestamptz) to service_role;
grant execute on function public.get_guest_upload_session(uuid,text) to service_role;
grant execute on function public.finalize_guest_upload_session(uuid,text) to service_role;
grant execute on function public.cancel_guest_upload_session(uuid,text) to service_role;
grant execute on function public.list_expired_guest_upload_sessions(integer) to service_role;
grant execute on function public.expire_guest_upload_session(uuid) to service_role;
