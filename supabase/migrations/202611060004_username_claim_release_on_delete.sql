-- Renaming a live invitation retains its previous usernames, but hard deletion
-- releases every name claimed by that invitation so another project can use it.
create or replace function public.release_invitation_usernames()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  claim_source text := case when tg_table_name = 'projects' then 'project' else 'guest' end;
begin
  delete from public.share_username_claims
  where source = claim_source and record_id = old.id;
  return old;
end;
$$;
revoke all on function public.release_invitation_usernames() from public, anon, authenticated;

drop trigger if exists projects_release_share_usernames on public.projects;
create trigger projects_release_share_usernames
after delete on public.projects
for each row execute function public.release_invitation_usernames();

drop trigger if exists guest_release_share_usernames on public.guest_invitations;
create trigger guest_release_share_usernames
after delete on public.guest_invitations
for each row execute function public.release_invitation_usernames();
