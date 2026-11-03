-- Optional wedding schedule: at most four {time,label} milestones.
-- The three-argument guest RPC remains available for old callers; the four-argument
-- overload is used only when a caller supplies a schedule.

alter table public.projects add column if not exists schedule jsonb not null default '[]'::jsonb;
alter table public.guest_invitations add column if not exists schedule jsonb not null default '[]'::jsonb;

create or replace function public.schedule_valid(value jsonb)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select coalesce(jsonb_typeof(value) = 'array', false)
    and case when jsonb_typeof(value) = 'array' then jsonb_array_length(value) <= 4 else false end
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end) as item
      where jsonb_typeof(item) <> 'object'
         or coalesce(jsonb_typeof(item->'time'),'') <> 'string'
         or (item->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(jsonb_typeof(item->'label'),'') <> 'string'
         or char_length(btrim(item->>'label')) = 0
         or char_length(item->>'label') > 100
    );
$$;
revoke all on function public.schedule_valid(jsonb) from public, anon, authenticated;
grant execute on function public.schedule_valid(jsonb) to authenticated, service_role;

alter table public.projects drop constraint if exists projects_schedule_valid;
alter table public.projects add constraint projects_schedule_valid check (public.schedule_valid(schedule));
alter table public.guest_invitations drop constraint if exists guest_invitation_schedule_valid;
alter table public.guest_invitations add constraint guest_invitation_schedule_valid check (public.schedule_valid(schedule));

create or replace function public.public_project(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
 select jsonb_build_object('id',p.id,'title',p.title,'customer_name','','customer_email','','customer_phone','','private_notes','', 'person_a',p.person_a,'person_b',p.person_b,'parent_a',p.parent_a,'parent_b',p.parent_b,'event_date',p.event_date,'event_time',p.event_time,'venue',p.venue,'message',p.message,'map_url',p.map_url,'schedule',p.schedule,'username',p.username,'template',p.template,'theme',p.theme,'project_type',p.project_type,'status',p.status,'photos',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'url',x.storage_path,'path',x.storage_path,'caption',x.caption,'position',x.position) order by x.position) from public.project_photos x where x.project_id=p.id),'[]'::jsonb),'created_at',p.created_at,'updated_at',p.updated_at,'public_key',null)
 from public.projects p where p.username=trim(p_username) and p.public_key=p_public_key and p.status='published';
$$;
revoke all on function public.public_project(text,text) from public;
grant execute on function public.public_project(text,text) to anon, authenticated;

create or replace function public.guest_public_project(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
 select jsonb_build_object('id',g.id,'title',g.title,'customer_name','','customer_email','','customer_phone','','private_notes','', 'person_a',g.person_a,'person_b',g.person_b,'parent_a',g.parent_a,'parent_b',g.parent_b,'event_date',g.event_date,'event_time',g.event_time,'venue',g.venue,'message',g.message,'map_url',g.map_url,'schedule',g.schedule,'username',g.username,'template',g.template,'theme',g.theme,'project_type',g.project_type,'status',g.status,'photos',g.photos,'created_at',g.created_at,'updated_at',g.updated_at,'public_key',g.public_key)
 from public.guest_invitations g where g.username=trim(p_username) and g.public_key=p_public_key and g.status='published';
$$;
revoke all on function public.guest_public_project(text,text) from public;
grant execute on function public.guest_public_project(text,text) to anon, authenticated;

-- New implementation. It preserves the original service-role-only authorization,
-- rate limits, and immutable published guest row semantics.
create or replace function public.create_guest_invitation(p_ip_hash text, p_input jsonb, p_schedule jsonb, p_photos jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare now_hour timestamptz := date_trunc('hour', now()); today date := current_date; n integer; d integer; p public.guest_invitations;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
 if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'IP identity required'; end if;
 if p_input is null or jsonb_typeof(p_input) <> 'object' or p_photos is null or jsonb_typeof(p_photos) <> 'array' then raise exception 'Invalid payload'; end if;
 if p_schedule is null or not public.schedule_valid(p_schedule) then raise exception 'Invalid schedule'; end if;
 insert into public.guest_invitation_ip_hour(ip_hash,window_start,attempts) values(p_ip_hash,now_hour,0) on conflict do nothing;
 select attempts into n from public.guest_invitation_ip_hour where ip_hash=p_ip_hash and window_start=now_hour for update;
 if n >= 5 then raise exception 'Rate limit exceeded'; end if;
 insert into public.guest_invitation_day(day,attempts) values(today,0) on conflict do nothing;
 select attempts into d from public.guest_invitation_day where day=today for update;
 if d >= 200 then raise exception 'Daily limit exceeded'; end if;
 update public.guest_invitation_ip_hour set attempts=attempts+1 where ip_hash=p_ip_hash and window_start=now_hour;
 update public.guest_invitation_day set attempts=attempts+1 where day=today;
 insert into public.guest_invitations(username,public_key,title,customer_name,customer_email,customer_phone,private_notes,person_a,person_b,parent_a,parent_b,event_date,event_time,venue,message,map_url,schedule,template,theme,project_type,photos)
 values ('guest-'||replace(gen_random_uuid()::text,'-',''), replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
  coalesce(nullif(trim(p_input->>'title'),''),''), '', '', '', '', coalesce(p_input->>'person_a',''), coalesce(p_input->>'person_b',''), coalesce(p_input->>'parent_a',''), coalesce(p_input->>'parent_b',''), coalesce(p_input->>'event_date',''), coalesce(p_input->>'event_time',''), coalesce(p_input->>'venue',''), coalesce(p_input->>'message',''), coalesce(p_input->>'map_url',''), p_schedule, coalesce(p_input->>'template','thazin'), coalesce(p_input->>'theme','sage'), coalesce(p_input->>'project_type','wedding'), p_photos) returning * into p;
 return public.guest_public_project(p.username,p.public_key);
end; $$;
revoke all on function public.create_guest_invitation(text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_invitation(text,jsonb,jsonb,jsonb) to service_role;

-- Keep the original call shape working for clients that do not use schedules.
create or replace function public.create_guest_invitation(p_ip_hash text, p_input jsonb, p_photos jsonb)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select public.create_guest_invitation(p_ip_hash, p_input, '[]'::jsonb, p_photos);
$$;
revoke all on function public.create_guest_invitation(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_invitation(text,jsonb,jsonb) to service_role;
