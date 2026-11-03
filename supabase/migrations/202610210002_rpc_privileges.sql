-- Supabase default privileges can explicitly grant anon/authenticated EXECUTE.
-- Revoking only PUBLIC does not remove those explicit role grants.
revoke all on function public.username_available(text,uuid) from public, anon;
revoke all on function public.publish_project(uuid) from public, anon;
revoke all on function public.revoke_project(uuid) from public, anon;
grant execute on function public.username_available(text,uuid) to authenticated;
grant execute on function public.publish_project(uuid) to authenticated;
grant execute on function public.revoke_project(uuid) to authenticated;
-- This is deliberately public: its body requires the matching random share key
-- and published status, and returns invitation fields only, never customer PII.
revoke all on function public.public_project(text,text) from public;
grant execute on function public.public_project(text,text) to anon, authenticated;
