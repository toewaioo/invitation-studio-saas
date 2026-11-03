import { test, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';

test('SQL migration: owner isolation, private storage, publication and edit revocation', async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 CREATE FUNCTION storage.filename(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)] $$;
 GRANT USAGE ON SCHEMA auth,storage,public TO authenticated,anon;
 INSERT INTO auth.users VALUES ('11111111-1111-4111-a111-111111111111'),('22222222-2222-4222-a222-222222222222');
 `);
 await db.exec(await Bun.file(new URL('../supabase/migrations/202610210001_invitation_studio.sql',import.meta.url)).text());
 await db.exec(await Bun.file(new URL('../supabase/migrations/202610210002_rpc_privileges.sql',import.meta.url)).text());
 const privileges=await db.query<{owner_rpc:boolean;public_rpc:boolean}>(`SELECT has_function_privilege('anon','public.publish_project(uuid)','EXECUTE') AS owner_rpc,has_function_privilege('anon','public.public_project(text,text)','EXECUTE') AS public_rpc`);
 expect(privileges.rows[0].owner_rpc).toBe(false);expect(privileges.rows[0].public_rpc).toBe(true);
 await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',false);`);
 const pid='33333333-3333-4333-a333-333333333333', photo='44444444-4444-4444-a444-444444444444';
 await db.query(`INSERT INTO public.projects(id,title,username,customer_name,person_a,person_b,event_date,event_time,venue,message) VALUES ($1,'Story','sql-story','Private customer','A','B','2027-02-14','09:00','Hall','Welcome')`,[pid]);
 await expect(db.query(`SELECT public.publish_project($1)`,[pid])).rejects.toThrow();
 const path=`11111111-1111-4111-a111-111111111111/${pid}/${photo}.jpeg`;
 await db.query(`INSERT INTO storage.objects(bucket_id,name) VALUES ('project-photos',$1)`,[path]);
 await db.query(`INSERT INTO public.project_photos(id,project_id,storage_path) VALUES ($1,$2,$3)`,[photo,pid,path]);
 const published=await db.query<{p:any}>(`SELECT public.publish_project($1) AS p`,[pid]);
 const key=published.rows[0].p.public_key;
 expect(key).toHaveLength(64);
 await db.exec(`SET ROLE anon;`);
 await expect(db.query(`SELECT * FROM public.projects`)).rejects.toThrow();
 const pub=await db.query<{p:any}>(`SELECT public.public_project('sql-story',$1) AS p`,[key]);
 expect(pub.rows[0].p.customer_name).toBe('');expect(pub.rows[0].p.photos).toHaveLength(1);
 await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-a222-222222222222',false);`);
 expect((await db.query(`SELECT * FROM public.projects`)).rows).toHaveLength(0);
 expect((await db.query(`SELECT * FROM storage.objects`)).rows).toHaveLength(0);
 await db.exec(`SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',false);`);
 await db.query(`UPDATE public.projects SET title='Changed',status='draft',public_key=null WHERE id=$1`,[pid]);
 const stale=await db.query<{p:any}>(`SELECT public.public_project('sql-story',$1) AS p`,[key]);expect(stale.rows[0].p).toBeNull();
 const published2=await db.query<{p:any}>(`SELECT public.publish_project($1) AS p`,[pid]);
 expect(published2.rows[0].p.public_key).not.toBe(key);
 await db.query(`SELECT public.revoke_project($1)`,[pid]);
 await db.query(`DELETE FROM public.project_photos WHERE id=$1`,[photo]);
 expect((await db.query(`SELECT * FROM public.project_photos`)).rows).toHaveLength(0);
 }finally{await db.close();}
},20000);
