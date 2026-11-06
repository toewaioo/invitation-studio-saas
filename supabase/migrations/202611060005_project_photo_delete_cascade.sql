-- A project deletion cascades to project_photos after the parent row has been
-- removed from the transaction's visible row set. Permit that FK-driven cleanup;
-- standalone photo changes still require a live, owner-authorized draft project.
create or replace function public.enforce_photo_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare p public.projects;
declare n integer;
begin
  select * into p from public.projects where id = coalesce(new.project_id, old.project_id) for update;
  if p.id is null then
    if tg_op = 'DELETE' then return old; end if;
    raise exception 'Project not found';
  end if;
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
