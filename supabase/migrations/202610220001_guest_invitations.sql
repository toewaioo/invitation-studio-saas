-- Anonymous invitations are deliberately isolated from the owner/customer tables.
create table if not exists public.guest_invitations (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  public_key text not null unique,
  status text not null default 'published',
  title text not null, customer_name text not null, customer_email text not null default '',
  customer_phone text not null default '', private_notes text not null default '',
  person_a text not null, person_b text not null, parent_a text not null default '', parent_b text not null default '',
  event_date text not null, event_time text not null, venue text not null, message text not null,
  map_url text not null default '', template text not null default 'thazin', theme text not null default 'sage',
  project_type text not null default 'wedding', photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.guest_invitations enable row level security;
revoke all on table public.guest_invitations from anon, authenticated, public;
grant all on table public.guest_invitations to service_role;

create table if not exists public.guest_invitation_ip_hour (
  ip_hash text not null, window_start timestamptz not null, attempts integer not null default 0,
  primary key (ip_hash, window_start)
);
create table if not exists public.guest_invitation_day (
  day date primary key, attempts integer not null default 0
);
alter table public.guest_invitation_ip_hour enable row level security;
alter table public.guest_invitation_day enable row level security;
revoke all on table public.guest_invitation_ip_hour, public.guest_invitation_day from anon, authenticated, public;
grant all on table public.guest_invitation_ip_hour, public.guest_invitation_day to service_role;
create policy guest_service_only on public.guest_invitations for all to service_role using (true) with check (true);
create policy guest_ip_service_only on public.guest_invitation_ip_hour for all to service_role using (true) with check (true);
create policy guest_day_service_only on public.guest_invitation_day for all to service_role using (true) with check (true);

alter table public.guest_invitations drop constraint if exists guest_invitation_shape;
alter table public.guest_invitations add constraint guest_invitation_shape check (
 status = 'published' and username like 'guest-%' and char_length(title) between 1 and 120 and
 char_length(customer_name) <= 100 and char_length(customer_email) <= 160 and char_length(customer_phone) <= 50 and
 char_length(private_notes) <= 1500 and char_length(person_a) between 1 and 60 and char_length(person_b) between 1 and 60 and
 char_length(parent_a) <= 180 and char_length(parent_b) <= 180 and char_length(venue) between 1 and 220 and char_length(message) between 1 and 350 and
 char_length(map_url) <= 1200 and template in ('thazin','noir','rose') and theme in ('sage','midnight','rose','blue') and project_type = 'wedding' and
 event_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and
 (customer_email = '' or customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') and
 (map_url = '' or map_url ~* '^https://(www[.]google[.]com|maps[.]google[.]com|maps[.]app[.]goo[.]gl|goo[.]gl)(/[^[:space:]]*)?$') and
 jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) between 0 and 3
);

create or replace function public.guest_invitations_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'Guest invitations are immutable'; end; $$;
drop trigger if exists guest_invitations_immutable on public.guest_invitations;
create trigger guest_invitations_immutable before update or delete on public.guest_invitations for each row execute function public.guest_invitations_immutable();

create or replace function public.create_guest_invitation(p_ip_hash text, p_input jsonb, p_photos jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare now_hour timestamptz := date_trunc('hour', now()); today date := current_date; n integer; d integer; p public.guest_invitations;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
 if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'IP identity required'; end if;
 if p_input is null or jsonb_typeof(p_input) <> 'object' or p_photos is null or jsonb_typeof(p_photos) <> 'array' then raise exception 'Invalid payload'; end if;
 insert into public.guest_invitation_ip_hour(ip_hash,window_start,attempts) values(p_ip_hash,now_hour,0) on conflict do nothing;
 select attempts into n from public.guest_invitation_ip_hour where ip_hash=p_ip_hash and window_start=now_hour for update;
 if n >= 5 then raise exception 'Rate limit exceeded'; end if;
 insert into public.guest_invitation_day(day,attempts) values(today,0) on conflict do nothing;
 select attempts into d from public.guest_invitation_day where day=today for update;
 if d >= 200 then raise exception 'Daily limit exceeded'; end if;
 update public.guest_invitation_ip_hour set attempts=attempts+1 where ip_hash=p_ip_hash and window_start=now_hour;
 update public.guest_invitation_day set attempts=attempts+1 where day=today;
 insert into public.guest_invitations(username,public_key,title,customer_name,customer_email,customer_phone,private_notes,person_a,person_b,parent_a,parent_b,event_date,event_time,venue,message,map_url,template,theme,project_type,photos)
 values ('guest-'||replace(gen_random_uuid()::text,'-',''), replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
  coalesce(nullif(trim(p_input->>'title'),''),''), '', '', '', '', coalesce(p_input->>'person_a',''), coalesce(p_input->>'person_b',''), coalesce(p_input->>'parent_a',''), coalesce(p_input->>'parent_b',''), coalesce(p_input->>'event_date',''), coalesce(p_input->>'event_time',''), coalesce(p_input->>'venue',''), coalesce(p_input->>'message',''), coalesce(p_input->>'map_url',''), coalesce(p_input->>'template','thazin'), coalesce(p_input->>'theme','sage'), coalesce(p_input->>'project_type','wedding'), p_photos) returning * into p;
 return public.guest_public_project(p.username,p.public_key);
end; $$;

create or replace function public.guest_public_project(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
 select jsonb_build_object('id',g.id,'title',g.title,'customer_name','','customer_email','','customer_phone','','private_notes','', 'person_a',g.person_a,'person_b',g.person_b,'parent_a',g.parent_a,'parent_b',g.parent_b,'event_date',g.event_date,'event_time',g.event_time,'venue',g.venue,'message',g.message,'map_url',g.map_url,'username',g.username,'template',g.template,'theme',g.theme,'project_type',g.project_type,'status',g.status,'photos',g.photos,'created_at',g.created_at,'updated_at',g.updated_at,'public_key',g.public_key)
 from public.guest_invitations g where g.username=trim(p_username) and g.public_key=p_public_key and g.status='published';
$$;
revoke all on function public.create_guest_invitation(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_invitation(text,jsonb,jsonb) to service_role;
revoke all on function public.guest_public_project(text,text) from public;
grant execute on function public.guest_public_project(text,text) to anon, authenticated;
