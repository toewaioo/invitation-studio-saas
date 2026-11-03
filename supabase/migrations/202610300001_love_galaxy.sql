-- Prepared for the Love Galaxy preview only. Do not apply to production without an explicit approval.
-- Love Galaxy is a separate public-by-link creation type, never a wedding project/template.

create table if not exists public.love_galaxies (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^galaxy-[a-z0-9-]{8,39}$'),
  public_key text not null unique check (public_key ~ '^[0-9a-f]{64}$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  ring_text_one text not null check (char_length(btrim(ring_text_one)) between 1 and 64),
  ring_text_two text not null check (char_length(btrim(ring_text_two)) between 1 and 64),
  music_track text not null check (music_track in ('cosmic-orbit','custom')),
  music_path text,
  photos jsonb not null check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) = 4),
  status text not null default 'published' check (status = 'published'),
  created_at timestamptz not null default now(),
  check ((music_track = 'custom') = (music_path is not null)),
  check (music_path is null or music_path ~ '^love-galaxy-staging/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|aac|ogg|wav)$')
);
alter table public.love_galaxies enable row level security;
revoke all on table public.love_galaxies from public, anon, authenticated;
revoke all on table public.love_galaxies from service_role;
grant select, insert on table public.love_galaxies to service_role;

create table if not exists public.love_galaxy_upload_sessions (
  id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  files jsonb not null check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 4 and 5),
  status text not null default 'pending' check (status in ('pending','published','canceled','expired')),
  expires_at timestamptz not null,
  love_galaxy_id uuid unique references public.love_galaxies(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((status = 'published') = (love_galaxy_id is not null))
);
alter table public.love_galaxy_upload_sessions enable row level security;
revoke all on table public.love_galaxy_upload_sessions from public, anon, authenticated;
grant all on table public.love_galaxy_upload_sessions to service_role;

create table if not exists public.love_galaxy_upload_ip_hour (
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (ip_hash, window_start)
);
create table if not exists public.love_galaxy_upload_day (
  day date primary key,
  attempts integer not null default 0 check (attempts >= 0)
);
alter table public.love_galaxy_upload_ip_hour enable row level security;
alter table public.love_galaxy_upload_day enable row level security;
revoke all on table public.love_galaxy_upload_ip_hour, public.love_galaxy_upload_day from public, anon, authenticated;
grant all on table public.love_galaxy_upload_ip_hour, public.love_galaxy_upload_day to service_role;

create or replace function public.create_love_galaxy_upload_session(
  p_session_id uuid, p_secret_hash text, p_ip_hash text,
  p_input jsonb, p_files jsonb, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  now_hour timestamptz := date_trunc('hour', now()); today date := current_date;
  hour_count integer; day_count integer; f jsonb; i integer := 0;
  v_id text; v_kind text; v_mime text; v_path text; v_size bigint; v_music_count integer := 0;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_session_id is null or p_secret_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid upload session'; end if;
  if p_input is null or jsonb_typeof(p_input) is distinct from 'object' or pg_column_size(p_input) > 12000 then raise exception 'Invalid Love Galaxy input'; end if;
  if (p_input->>'title') is null or char_length(btrim(p_input->>'title')) not between 1 and 120 then raise exception 'Invalid Love Galaxy title'; end if;
  if (p_input->>'ring_text_one') is null or char_length(btrim(p_input->>'ring_text_one')) not between 1 and 64 then raise exception 'Invalid first ring phrase'; end if;
  if (p_input->>'ring_text_two') is null or char_length(btrim(p_input->>'ring_text_two')) not between 1 and 64 then raise exception 'Invalid second ring phrase'; end if;
  if coalesce(p_input->>'music_track','') not in ('cosmic-orbit','custom') then raise exception 'Invalid music choice'; end if;
  if exists (select 1 from jsonb_object_keys(p_input) as keys(key) where key not in ('title','ring_text_one','ring_text_two','music_track')) then raise exception 'Unexpected Love Galaxy fields'; end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) not in (4,5) then raise exception 'Choose exactly four photos'; end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '2 hours 1 minute' then raise exception 'Invalid upload expiry'; end if;
  for f in select value from jsonb_array_elements(p_files) loop
    if jsonb_typeof(f) <> 'object' then raise exception 'Invalid file metadata'; end if;
    v_id := f->>'id'; v_kind := f->>'kind'; v_mime := f->>'mime_type'; v_path := f->>'path';
    if v_id is null or v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid file id'; end if;
    if coalesce(f->>'size','') !~ '^[0-9]+$' or coalesce(f->>'position','') !~ '^[0-9]+$' then raise exception 'Invalid file size'; end if;
    v_size := (f->>'size')::bigint;
    if v_kind = 'photo' then
      if i > 3 or v_mime is null or v_mime not in ('image/jpeg','image/png','image/webp') or v_size < 1 or v_size > 4490000 or (f->>'position')::integer <> i then raise exception 'Invalid photo metadata'; end if;
      if v_path is distinct from ('love-galaxy-staging/' || p_session_id::text || '/' || v_id || (case v_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' else '' end)) then raise exception 'Invalid photo path'; end if;
      i := i + 1;
    elsif v_kind = 'music' then
      v_music_count := v_music_count + 1;
      if v_music_count > 1 or v_mime is null or v_mime not in ('audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav') or v_size < 1 or v_size > 4000000 or (f->>'position')::integer <> 4 then raise exception 'Invalid music metadata'; end if;
      if v_path is distinct from ('love-galaxy-staging/' || p_session_id::text || '/' || v_id || (case v_mime when 'audio/mpeg' then '.mp3' when 'audio/mp4' then '.m4a' when 'audio/aac' then '.aac' when 'audio/ogg' then '.ogg' else '.wav' end)) then raise exception 'Invalid music path'; end if;
    else raise exception 'Invalid file kind'; end if;
  end loop;
  if i <> 4 or (p_input->>'music_track' = 'custom' and v_music_count <> 1) or (p_input->>'music_track' = 'cosmic-orbit' and v_music_count <> 0) then raise exception 'Photo or music selection is incomplete'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_files)) <> jsonb_array_length(p_files) then raise exception 'Duplicate file ids'; end if;

  insert into public.love_galaxy_upload_ip_hour(ip_hash, window_start, attempts) values(p_ip_hash, now_hour, 0) on conflict do nothing;
  select attempts into hour_count from public.love_galaxy_upload_ip_hour where ip_hash=p_ip_hash and window_start=now_hour for update;
  if hour_count >= 5 then raise exception 'Rate limit exceeded'; end if;
  insert into public.love_galaxy_upload_day(day, attempts) values(today, 0) on conflict do nothing;
  select attempts into day_count from public.love_galaxy_upload_day where day=today for update;
  if day_count >= 200 then raise exception 'Daily limit exceeded'; end if;
  update public.love_galaxy_upload_ip_hour set attempts=attempts+1 where ip_hash=p_ip_hash and window_start=now_hour;
  update public.love_galaxy_upload_day set attempts=attempts+1 where day=today;
  insert into public.love_galaxy_upload_sessions(id, secret_hash, ip_hash, input, files, expires_at) values(p_session_id,p_secret_hash,p_ip_hash,p_input,p_files,p_expires_at);
  return jsonb_build_object('id',p_session_id,'expires_at',p_expires_at,'files',p_files);
end; $$;

create or replace function public.get_love_galaxy_upload_session(p_session_id uuid, p_secret_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.love_galaxy_upload_sessions;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into s from public.love_galaxy_upload_sessions where id=p_session_id and secret_hash=p_secret_hash;
  if s.id is null then return null; end if;
  return jsonb_build_object('id',s.id,'input',s.input,'files',s.files,'status',s.status,'expires_at',s.expires_at,'love_galaxy_id',s.love_galaxy_id);
end; $$;

create or replace function public.public_love_galaxy(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id',g.id,'username',g.username,'title',g.title,'ring_text_one',g.ring_text_one,'ring_text_two',g.ring_text_two,'music_track',g.music_track,'music_path',g.music_path,'photos',g.photos,'status',g.status,'created_at',g.created_at)
  from public.love_galaxies g where g.username=trim(p_username) and g.public_key=p_public_key and g.status='published';
$$;

create or replace function public.finalize_love_galaxy_upload_session(p_session_id uuid, p_secret_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.love_galaxy_upload_sessions; g public.love_galaxies; photo_list jsonb; audio_path text; v_username text; v_public_key text;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into s from public.love_galaxy_upload_sessions where id=p_session_id and secret_hash=p_secret_hash for update;
  if s.id is null then raise exception 'Upload session not found'; end if;
  if s.status='published' and s.love_galaxy_id is not null then
    select * into g from public.love_galaxies where id=s.love_galaxy_id;
    if g.id is null then raise exception 'Published Love Galaxy not found'; end if;
    return jsonb_build_object('id',g.id,'username',g.username,'public_key',g.public_key,'title',g.title,'ring_text_one',g.ring_text_one,'ring_text_two',g.ring_text_two,'music_track',g.music_track,'music_path',g.music_path,'photos',g.photos,'status',g.status,'created_at',g.created_at);
  end if;
  if s.status<>'pending' or s.expires_at<=now() then raise exception 'Upload session expired'; end if;
  if jsonb_array_length(s.files) not in (4,5) then raise exception 'Photo or music selection is incomplete'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','storage_path',f->>'path','content_type',f->>'mime_type','size',(f->>'size')::bigint,'position',(f->>'position')::integer) order by (f->>'position')::integer),'[]'::jsonb)
    into photo_list from jsonb_array_elements(s.files) f where f->>'kind'='photo';
  select f->>'path' into audio_path from jsonb_array_elements(s.files) f where f->>'kind'='music';
  if jsonb_array_length(photo_list)<>4 or (s.input->>'music_track'='custom' and audio_path is null) or (s.input->>'music_track'='cosmic-orbit' and audio_path is not null) then raise exception 'Photo or music selection is incomplete'; end if;
  v_username := 'galaxy-' || substr(replace(gen_random_uuid()::text,'-',''),1,16);
  v_public_key := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
  insert into public.love_galaxies(username,public_key,title,ring_text_one,ring_text_two,music_track,music_path,photos)
    values(v_username,v_public_key,btrim(s.input->>'title'),btrim(s.input->>'ring_text_one'),btrim(s.input->>'ring_text_two'),s.input->>'music_track',audio_path,photo_list) returning * into g;
  update public.love_galaxy_upload_sessions set status='published',love_galaxy_id=g.id where id=s.id;
  return jsonb_build_object('id',g.id,'username',g.username,'public_key',g.public_key,'title',g.title,'ring_text_one',g.ring_text_one,'ring_text_two',g.ring_text_two,'music_track',g.music_track,'music_path',g.music_path,'photos',g.photos,'status',g.status,'created_at',g.created_at);
end; $$;

create or replace function public.cancel_love_galaxy_upload_session(p_session_id uuid, p_secret_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.love_galaxy_upload_sessions;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select * into s from public.love_galaxy_upload_sessions where id=p_session_id and secret_hash=p_secret_hash for update;
  if s.id is null then return jsonb_build_object('status','missing','files','[]'::jsonb); end if;
  if s.status='pending' then update public.love_galaxy_upload_sessions set status='canceled',expires_at=now() where id=s.id; end if;
  return jsonb_build_object('status',case when s.status='pending' then 'canceled' else s.status end,'files',case when s.status='published' then '[]'::jsonb else s.files end);
end; $$;

create or replace function public.list_expired_love_galaxy_upload_sessions(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'files',x.files)),'[]'::jsonb) into result
  from (select id,files from public.love_galaxy_upload_sessions where status in ('pending','canceled') and expires_at<=now()-interval '5 minutes' order by expires_at limit greatest(1,least(coalesce(p_limit,20),100))) x;
  return result;
end; $$;

create or replace function public.expire_love_galaxy_upload_session(p_session_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  update public.love_galaxy_upload_sessions set status='expired' where id=p_session_id and status in ('pending','canceled') and expires_at<=now();
  return found;
end; $$;

revoke all on function public.create_love_galaxy_upload_session(uuid,text,text,jsonb,jsonb,timestamptz) from public, anon, authenticated;
revoke all on function public.get_love_galaxy_upload_session(uuid,text) from public, anon, authenticated;
revoke all on function public.public_love_galaxy(text,text) from public, anon, authenticated;
revoke all on function public.finalize_love_galaxy_upload_session(uuid,text) from public, anon, authenticated;
revoke all on function public.cancel_love_galaxy_upload_session(uuid,text) from public, anon, authenticated;
revoke all on function public.list_expired_love_galaxy_upload_sessions(integer) from public, anon, authenticated;
revoke all on function public.expire_love_galaxy_upload_session(uuid) from public, anon, authenticated;
grant execute on function public.create_love_galaxy_upload_session(uuid,text,text,jsonb,jsonb,timestamptz) to service_role;
grant execute on function public.get_love_galaxy_upload_session(uuid,text) to service_role;
grant execute on function public.public_love_galaxy(text,text) to service_role;
grant execute on function public.finalize_love_galaxy_upload_session(uuid,text) to service_role;
grant execute on function public.cancel_love_galaxy_upload_session(uuid,text) to service_role;
grant execute on function public.list_expired_love_galaxy_upload_sessions(integer) to service_role;
grant execute on function public.expire_love_galaxy_upload_session(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('love-galaxy-media','love-galaxy-media',false,4490000,array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav']::text[])
on conflict(id) do update set public=false,file_size_limit=4490000,allowed_mime_types=array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav']::text[];
-- No anon/authenticated storage policies are added. Only the Edge service-role path can access this private bucket.
