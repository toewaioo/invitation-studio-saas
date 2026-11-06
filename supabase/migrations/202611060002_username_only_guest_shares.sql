-- Guest invitations are immutable and private at table level; only this redacted published projection is public.
-- A supplied legacy key remains valid only when it matches the original row.
create or replace function public.guest_public_project(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'customer_name', '',
    'customer_email', '',
    'customer_phone', '',
    'private_notes', '',
    'person_a', g.person_a,
    'person_b', g.person_b,
    'parent_a', g.parent_a,
    'parent_b', g.parent_b,
    'event_date', g.event_date,
    'event_time', g.event_time,
    'venue', g.venue,
    'message', g.message,
    'map_url', g.map_url,
    'schedule', g.schedule,
    'username', g.username,
    'template', g.template,
    'theme', g.theme,
    'project_type', g.project_type,
    'status', g.status,
    'photos', g.photos,
    'created_at', g.created_at,
    'updated_at', g.updated_at,
    'public_key', g.public_key
  )
  from public.guest_invitations g
  where g.username = trim(p_username)
    and (nullif(p_public_key, '') is null or g.public_key = p_public_key)
    and g.status = 'published';
$$;
revoke all on function public.guest_public_project(text, text) from public;
grant execute on function public.guest_public_project(text, text) to anon, authenticated;
