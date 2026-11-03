import { expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';

const uuid = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

 test('Love Galaxy SQL remains a separate private-by-link type with four ordered photos and service-role-only writes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage,public TO authenticated,anon,service_role;
    `);
    await db.exec(await Bun.file(new URL('../supabase/migrations/202610300001_love_galaxy.sql', import.meta.url)).text());
    const access = await db.query<{ read_direct: boolean; start_anon: boolean; finalize_anon: boolean; public_lookup_anon: boolean }>(`
      SELECT has_table_privilege('anon','public.love_galaxies','SELECT') read_direct,
        has_function_privilege('anon','public.create_love_galaxy_upload_session(uuid,text,text,jsonb,jsonb,timestamptz)','EXECUTE') start_anon,
        has_function_privilege('anon','public.finalize_love_galaxy_upload_session(uuid,text)','EXECUTE') finalize_anon,
        has_function_privilege('anon','public.public_love_galaxy(text,text)','EXECUTE') public_lookup_anon
    `);
    expect(access.rows[0]).toEqual({ read_direct:false, start_anon:false, finalize_anon:false, public_lookup_anon:false });
    const bucket = await db.query<{ public:boolean; file_size_limit:number }>(`SELECT public,file_size_limit FROM storage.buckets WHERE id='love-galaxy-media' LIMIT 1`);
    expect(bucket.rows[0]).toEqual({ public:false, file_size_limit:4_490_000 });

    await db.exec(`SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)`);
    const session = uuid('f'); const tokenHash='a'.repeat(64); const ipHash='b'.repeat(64);
    const ids=[uuid('1'),uuid('2'),uuid('3'),uuid('4')];
    const photos=ids.map((id,index)=>({id,kind:'photo',path:`love-galaxy-staging/${session}/${id}.jpg`,mime_type:'image/jpeg',size:index===0?4_490_000:1200,position:index}));
    const input={title:'Our memories',ring_text_one:'Words for the first ring',ring_text_two:'Words for the second ring',music_track:'cosmic-orbit'};
    const created=await db.query<{ value:any }>(`SELECT public.create_love_galaxy_upload_session($1::uuid,$2,$3,$4::jsonb,$5::jsonb,now()+interval '2 hours') value`,[session,tokenHash,ipHash,JSON.stringify(input),JSON.stringify(photos)]);
    expect(created.rows[0].value.files).toHaveLength(4);
    const published=await db.query<{ value:any }>(`SELECT public.finalize_love_galaxy_upload_session($1::uuid,$2) value`,[session,tokenHash]);
    expect(published.rows[0].value.status).toBe('published');
    expect(published.rows[0].value.username).toMatch(/^galaxy-[a-z0-9-]+$/);
    expect(published.rows[0].value.photos).toHaveLength(4);
    expect(published.rows[0].value.photos.map((photo:any)=>photo.position)).toEqual([0,1,2,3]);
    expect(published.rows[0].value.ring_text_one).toBe(input.ring_text_one);
    const repeated=await db.query<{ value:any }>(`SELECT public.finalize_love_galaxy_upload_session($1::uuid,$2) value`,[session,tokenHash]);
    expect(repeated.rows[0].value.id).toBe(published.rows[0].value.id);
    const publicRow=await db.query<{ value:any }>(`SELECT public.public_love_galaxy($1,$2) value`,[published.rows[0].value.username,published.rows[0].value.public_key]);
    expect(publicRow.rows[0].value.title).toBe(input.title);
    expect(publicRow.rows[0].value.photos).toHaveLength(4);
    expect(publicRow.rows[0].value).not.toHaveProperty('public_key');
    expect(publicRow.rows[0].value).not.toHaveProperty('ip_hash');
    await expect(db.query(`UPDATE public.love_galaxies SET title='changed' WHERE username=$1`,[published.rows[0].value.username])).rejects.toThrow();
    await expect(db.query(`SELECT public.create_love_galaxy_upload_session($1::uuid,$2,$3,$4::jsonb,$5::jsonb,now()+interval '2 hours')`,[uuid('d'),'c'.repeat(64),'e'.repeat(64),JSON.stringify(input),JSON.stringify(photos.slice(0,3))])).rejects.toThrow();
    const oversized=photos.map((photo:any,index:number)=>index===0?{...photo,size:4_490_001}:photo);
    await expect(db.query(`SELECT public.create_love_galaxy_upload_session($1::uuid,$2,$3,$4::jsonb,$5::jsonb,now()+interval '2 hours')`,[uuid('c'),'d'.repeat(64),'f'.repeat(64),JSON.stringify(input),JSON.stringify(oversized)])).rejects.toThrow();
    await db.exec(`RESET ROLE; SET ROLE anon`);
    await expect(db.query(`SELECT * FROM public.love_galaxies LIMIT 1`)).rejects.toThrow();
    await expect(db.query(`UPDATE public.love_galaxies SET title='changed'`)).rejects.toThrow();
  } finally { await db.close(); }
}, 20000);
