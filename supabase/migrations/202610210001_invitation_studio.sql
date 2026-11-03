-- Uses built-in gen_random_uuid(); no extension-specific search_path needed.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default '', customer_name text not null default '', customer_email text not null default '',
  customer_phone text not null default '', private_notes text not null default '', person_a text not null default '', person_b text not null default '',
  parent_a text not null default '', parent_b text not null default '', event_date text not null default '', event_time text not null default '', venue text not null default '',
  message text not null default '', map_url text not null default '', username text not null,
  template text not null default 'thazin', theme text not null default 'sage', project_type text not null default 'wedding',
  status text not null default 'draft', public_key text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (username), unique (owner_id, id)
);
create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique, caption text not null default '', position integer not null default 0, created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_photos enable row level security;
revoke all on table public.projects, public.project_photos from anon;
grant select, insert, update, delete on table public.projects, public.project_photos to authenticated;

-- The UI permits blank optional fields, but never permits over-limit values or malformed date/time/map values.
alter table public.projects drop constraint if exists projects_required_and_lengths;
alter table public.projects add constraint projects_required_and_lengths check (
  char_length(btrim(title)) between 1 and 120 and btrim(customer_name) <> '' and btrim(person_a) <> '' and btrim(person_b) <> '' and btrim(venue) <> '' and btrim(message) <> '' and char_length(customer_name) <= 100 and char_length(customer_email) <= 160 and
  char_length(customer_phone) <= 50 and char_length(private_notes) <= 1500 and char_length(person_a) <= 60 and char_length(person_b) <= 60 and
  char_length(parent_a) <= 180 and char_length(parent_b) <= 180 and char_length(venue) <= 220 and char_length(message) <= 350 and char_length(map_url) <= 1200 and
  char_length(username) between 3 and 40 and char_length(template) between 1 and 40 and char_length(theme) between 1 and 40 and
  (customer_email = '' or customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') and
  ((event_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char(to_date(event_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') = event_date)) and
  (event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and
  (map_url = '' or map_url ~* '^https://(www[.]google[.]com|maps[.]google[.]com|maps[.]app[.]goo[.]gl|goo[.]gl)(/[^[:space:]]*)?$')
);
alter table public.projects drop constraint if exists projects_username_format;
alter table public.projects add constraint projects_username_format check (username ~ '^[a-z][a-z0-9-]{2,39}$');
alter table public.projects drop constraint if exists projects_template_enum;
alter table public.projects add constraint projects_template_enum check (template in ('thazin','noir','rose'));
alter table public.projects drop constraint if exists projects_theme_enum;
alter table public.projects add constraint projects_theme_enum check (theme in ('sage','midnight','rose','blue'));
alter table public.projects drop constraint if exists projects_type_enum;
alter table public.projects add constraint projects_type_enum check (project_type = 'wedding');
alter table public.projects drop constraint if exists projects_status_key_consistency;
alter table public.projects add constraint projects_status_key_consistency check ((status = 'draft' and public_key is null) or (status = 'published' and public_key is not null));

alter table public.project_photos drop constraint if exists project_photos_max;
alter table public.project_photos add constraint project_photos_max check (position >= 0 and position < 8);
alter table public.project_photos drop constraint if exists project_photos_caption_length;
alter table public.project_photos add constraint project_photos_caption_length check (char_length(caption) <= 350);
alter table public.project_photos drop constraint if exists project_photos_path_owner;
alter table public.project_photos add constraint project_photos_path_owner check (storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$');

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_public_idx on public.projects(status, username, public_key) where status = 'published' and public_key is not null;

-- No client may alter publication state/key. Content edits are allowed only while draft.
create or replace function public.projects_before_write()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare publishing boolean := coalesce(current_setting('app.publishing', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.public_key is not null then raise exception 'Projects must be inserted as draft with no public key'; end if;
    new.updated_at := now(); return new;
  end if;
  if new.owner_id <> old.owner_id then raise exception 'Project owner cannot change'; end if;
  if (to_jsonb(new) - 'updated_at' - 'status' - 'public_key') is distinct from (to_jsonb(old) - 'updated_at' - 'status' - 'public_key') then
    new.status := 'draft'; new.public_key := null;
  end if;
  if not publishing and new.status = 'published' and (new.status is distinct from old.status or new.public_key is distinct from old.public_key) then
    raise exception 'Publish through the RPC';
  end if;
  if publishing and (new.status, new.public_key) is distinct from (old.status, old.public_key)
     and not ((old.status = 'draft' and old.public_key is null and new.status = 'published' and new.public_key is not null)
           or (old.status = 'published' and old.public_key is not null and new.status = 'draft' and new.public_key is null)) then
    raise exception 'Invalid publication transition';
  end if;
  new.updated_at := now(); return new;
end; $$;
drop trigger if exists projects_before_write on public.projects;
create trigger projects_before_write before insert or update on public.projects for each row execute function public.projects_before_write();

drop policy if exists projects_owner_select on public.projects;
drop policy if exists projects_owner_insert on public.projects;
drop policy if exists projects_owner_update on public.projects;
drop policy if exists projects_owner_delete on public.projects;
drop policy if exists photos_owner_select on public.project_photos;
drop policy if exists photos_owner_insert on public.project_photos;
drop policy if exists photos_owner_update on public.project_photos;
drop policy if exists photos_owner_delete on public.project_photos;
create policy projects_owner_select on public.projects for select to authenticated using (owner_id = auth.uid());
create policy projects_owner_insert on public.projects for insert to authenticated with check (owner_id = auth.uid() and status = 'draft' and public_key is null);
create policy projects_owner_update on public.projects for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_owner_delete on public.projects for delete to authenticated using (owner_id = auth.uid() and status = 'draft');
create policy photos_owner_select on public.project_photos for select to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy photos_owner_insert on public.project_photos for insert to authenticated with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid() and p.status = 'draft'));
create policy photos_owner_update on public.project_photos for update to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid() and p.status = 'draft')) with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid() and p.status = 'draft'));
create policy photos_owner_delete on public.project_photos for delete to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid() and p.status = 'draft'));

create or replace function public.enforce_photo_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare p public.projects;
declare n integer;
begin
  select * into p from public.projects where id = coalesce(new.project_id, old.project_id) for update;
  if p.id is null then raise exception 'Project not found'; end if;
  if p.status = 'published' then raise exception 'Photos cannot change while project is published'; end if;
  if tg_op = 'INSERT' then
    select count(*) into n from public.project_photos where project_id = new.project_id;
    if n >= 8 then raise exception 'A project may contain at most 8 photos'; end if;
  end if;
  if tg_op <> 'DELETE' and (split_part(new.storage_path,'/',1) <> p.owner_id::text or split_part(new.storage_path,'/',2) <> new.project_id::text or split_part(split_part(new.storage_path,'/',3),'.',1) <> new.id::text) then
    raise exception 'Photo path must be owner/project/photo id';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists project_photos_guard on public.project_photos;
create trigger project_photos_guard before insert or update or delete on public.project_photos for each row execute function public.enforce_photo_guard();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('project-photos','project-photos',false,4194304,array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public=false, file_size_limit=4194304, allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];
-- Storage table-wide privileges are managed by Supabase; bucket policies below are scoped to this application.
grant select, insert, update, delete on table storage.objects to authenticated;
drop policy if exists photo_objects_owner_read on storage.objects;
drop policy if exists photo_objects_owner_write on storage.objects;
drop policy if exists photo_objects_owner_delete on storage.objects;
create policy photo_objects_owner_read on storage.objects for select to authenticated using (bucket_id='project-photos' and (storage.foldername(name))[1] = auth.uid()::text and exists (select 1 from public.projects p where p.owner_id=auth.uid() and p.id::text=(storage.foldername(name))[2]));
create policy photo_objects_owner_write on storage.objects for insert to authenticated with check (bucket_id='project-photos' and (storage.foldername(name))[1] = auth.uid()::text and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$' and storage.filename(name) ~* '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' and exists (select 1 from public.projects p where p.owner_id=auth.uid() and p.id::text=(storage.foldername(name))[2] and p.status='draft'));
create policy photo_objects_owner_delete on storage.objects for delete to authenticated using (bucket_id='project-photos' and (storage.foldername(name))[1] = auth.uid()::text and exists (select 1 from public.projects p where p.owner_id=auth.uid() and p.id::text=(storage.foldername(name))[2] and p.status='draft'));

create or replace function public.username_available(p_username text, p_except_id uuid default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (select 1 from public.projects where lower(username)=lower(trim(p_username)) and (p_except_id is null or id <> p_except_id));
$$;
revoke all on function public.username_available(text,uuid) from public;
grant execute on function public.username_available(text,uuid) to authenticated;

create or replace function public.publish_project(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.projects; result jsonb;
begin
  perform set_config('app.publishing','on',true);
  select * into p from public.projects where id=p_project_id and owner_id=auth.uid() for update;
  if p.id is null then raise exception 'Project not found'; end if;
  if p.status <> 'draft' then raise exception 'Project is already published'; end if;
  if not exists(select 1 from public.project_photos where project_id=p.id) then raise exception 'Add at least one photo before publishing'; end if;
  update public.projects set status='published', public_key=replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','') where id=p.id returning * into p;
  select to_jsonb(p) || jsonb_build_object('project_photos',coalesce((select jsonb_agg(to_jsonb(x) order by position) from public.project_photos x where x.project_id=p.id),'[]'::jsonb)) into result;
  return result;
end; $$;
revoke all on function public.publish_project(uuid) from public;
grant execute on function public.publish_project(uuid) to authenticated;

create or replace function public.revoke_project(p_project_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform set_config('app.publishing','on',true);
  update public.projects set status='draft', public_key=null where id=p_project_id and owner_id=auth.uid();
  return found;
end; $$;
revoke all on function public.revoke_project(uuid) from public;
grant execute on function public.revoke_project(uuid) to authenticated;

create or replace function public.public_project(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
 select jsonb_build_object('id',p.id,'title',p.title,'customer_name','','customer_email','','customer_phone','','private_notes','', 'person_a',p.person_a,'person_b',p.person_b,'parent_a',p.parent_a,'parent_b',p.parent_b,'event_date',p.event_date,'event_time',p.event_time,'venue',p.venue,'message',p.message,'map_url',p.map_url,'username',p.username,'template',p.template,'theme',p.theme,'project_type',p.project_type,'status',p.status,'photos',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'url',x.storage_path,'path',x.storage_path,'caption',x.caption,'position',x.position) order by x.position) from public.project_photos x where x.project_id=p.id),'[]'::jsonb),'created_at',p.created_at,'updated_at',p.updated_at,'public_key',null)
 from public.projects p where p.username=trim(p_username) and p.public_key=p_public_key and p.status='published';
$$;
revoke all on function public.public_project(text,text) from public;
grant execute on function public.public_project(text,text) to anon, authenticated;
