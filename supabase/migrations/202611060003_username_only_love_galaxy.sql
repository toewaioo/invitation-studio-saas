-- Love Galaxy public data/media remain service-role proxied; callers need a username, not a secret key.
-- Existing links may still supply the matching legacy key.
create or replace function public.public_love_galaxy(p_username text, p_public_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', g.id,
    'username', g.username,
    'title', g.title,
    'ring_text_one', g.ring_text_one,
    'ring_text_two', g.ring_text_two,
    'music_track', g.music_track,
    'music_path', g.music_path,
    'photos', g.photos,
    'status', g.status,
    'created_at', g.created_at
  )
  from public.love_galaxies g
  where g.username = trim(p_username)
    and (nullif(p_public_key, '') is null or g.public_key = p_public_key)
    and g.status = 'published';
$$;
revoke all on function public.public_love_galaxy(text, text) from public, anon, authenticated;
grant execute on function public.public_love_galaxy(text, text) to service_role;
