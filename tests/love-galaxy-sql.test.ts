import { expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';

const uuid = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

 test('Love Galaxy consent is default-off, creation-session controlled, and discovery returns minimal opted-in metadata only', async () => {
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

    // Simulate an already-published legacy world before applying the additive migration.
    await db.query(`INSERT INTO public.love_galaxies(username,public_key,title,ring_text_one,ring_text_two,music_track,photos) VALUES ($1,$2,'Legacy world','private ring one','private ring two','cosmic-orbit','[]'::jsonb || jsonb_build_array('{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb))`, ['galaxy-legacy0001','e'.repeat(64)]);
    await db.exec(await Bun.file(new URL('../supabase/migrations/202611030001_love_galaxy_journey_discovery_consent.sql', import.meta.url)).text());
    await db.exec(await Bun.file(new URL('../supabase/migrations/202611060003_username_only_love_galaxy.sql', import.meta.url)).text());

    const legacy = await db.query<{ journey_discovery_enabled: boolean }>(`SELECT journey_discovery_enabled FROM public.love_galaxies WHERE username='galaxy-legacy0001' LIMIT 1`);
    expect(legacy.rows[0].journey_discovery_enabled).toBe(false);
    const access = await db.query<{ read_direct: boolean; start_anon: boolean; finalize_anon: boolean; public_lookup_anon: boolean; discovery_anon: boolean; discovery_service_role: boolean }>(`
      SELECT has_table_privilege('anon','public.love_galaxies','SELECT') read_direct,
        has_function_privilege('anon','public.create_love_galaxy_upload_session(uuid,text,text,jsonb,jsonb,timestamptz)','EXECUTE') start_anon,
        has_function_privilege('anon','public.finalize_love_galaxy_upload_session(uuid,text)','EXECUTE') finalize_anon,
        has_function_privilege('anon','public.public_love_galaxy(text,text)','EXECUTE') public_lookup_anon,
        has_function_privilege('anon','public.list_discoverable_love_galaxies()','EXECUTE') discovery_anon,
        has_function_privilege('service_role','public.list_discoverable_love_galaxies()','EXECUTE') discovery_service_role
    `);
    expect(access.rows[0]).toEqual({ read_direct:false, start_anon:false, finalize_anon:false, public_lookup_anon:false, discovery_anon:false, discovery_service_role:true });
    const bucket = await db.query<{ public:boolean; file_size_limit:number }>(`SELECT public,file_size_limit FROM storage.buckets WHERE id='love-galaxy-media' LIMIT 1`);
    expect(bucket.rows[0]).toEqual({ public:false, file_size_limit:4_490_000 });

    await db.exec(`SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)`);
    const input={title:'Our memories',ring_text_one:'Words for the first ring',ring_text_two:'Words for the second ring',music_track:'cosmic-orbit'};
    const startSession = async (digit: string, photoDigits: string[], consent?: boolean) => {
      const session = uuid(digit); const ids = photoDigits.map(uuid);
      const photos = ids.map((id,index)=>({id,kind:'photo',path:`love-galaxy-staging/${session}/${id}.jpg`,mime_type:'image/jpeg',size:index===0?4_490_000:1200,position:index}));
      const sessionInput = consent === undefined ? input : { ...input, journey_discovery_enabled: consent };
      const created=await db.query<{ value:any }>(`SELECT public.create_love_galaxy_upload_session($1::uuid,$2,$3,$4::jsonb,$5::jsonb,now()+interval '2 hours') value`,[session,digit.repeat(64),'b'.repeat(64),JSON.stringify(sessionInput),JSON.stringify(photos)]);
      expect(created.rows[0].value.files).toHaveLength(4);
      return { session, tokenHash:digit.repeat(64), files:photos };
    };

    const optedOutSession = await startSession('f',['1','2','3','4']);
    const optedOutPublished=await db.query<{ value:any }>(`SELECT public.finalize_love_galaxy_upload_session($1::uuid,$2) value`,[optedOutSession.session,optedOutSession.tokenHash]);
    expect(optedOutPublished.rows[0].value.status).toBe('published');
    expect(optedOutPublished.rows[0].value.username).toMatch(/^galaxy-[a-z0-9-]+$/);
    expect(optedOutPublished.rows[0].value.photos).toHaveLength(4);
    expect(optedOutPublished.rows[0].value.photos.map((photo:any)=>photo.position)).toEqual([0,1,2,3]);
    expect(optedOutPublished.rows[0].value.ring_text_one).toBe(input.ring_text_one);
    await db.exec(`RESET ROLE`);
    const optedOutRow=await db.query<{ journey_discovery_enabled:boolean }>(`SELECT journey_discovery_enabled FROM public.love_galaxies WHERE username=$1 LIMIT 1`,[optedOutPublished.rows[0].value.username]);
    expect(optedOutRow.rows[0].journey_discovery_enabled).toBe(false);
    await db.exec(`SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)`);
    const repeated=await db.query<{ value:any }>(`SELECT public.finalize_love_galaxy_upload_session($1::uuid,$2) value`,[optedOutSession.session,optedOutSession.tokenHash]);
    expect(repeated.rows[0].value.id).toBe(optedOutPublished.rows[0].value.id);
    const publicRow=await db.query<{ value:any }>(`SELECT public.public_love_galaxy($1,$2) value`,[optedOutPublished.rows[0].value.username,optedOutPublished.rows[0].value.public_key]);
    expect(publicRow.rows[0].value.title).toBe(input.title);
    expect(publicRow.rows[0].value.photos).toHaveLength(4);
    expect(publicRow.rows[0].value).not.toHaveProperty('public_key');
    expect(publicRow.rows[0].value).not.toHaveProperty('journey_discovery_enabled');
    expect(publicRow.rows[0].value).not.toHaveProperty('ip_hash');
    const shortLookup=await db.query<{ value:any }>(`SELECT public.public_love_galaxy($1,null) value`,[optedOutPublished.rows[0].value.username]);
    expect(shortLookup.rows[0].value.title).toBe(input.title);
    expect((await db.query<{ value:any }>(`SELECT public.public_love_galaxy($1,$2) value`,[optedOutPublished.rows[0].value.username,'0'.repeat(64)])).rows[0].value).toBeNull();
    const legacyLookup=await db.query<{ value:any }>(`SELECT public.public_love_galaxy($1,$2) value`,['galaxy-legacy0001','e'.repeat(64)]);
    expect(legacyLookup.rows[0].value.title).toBe('Legacy world');

    const optedInSession = await startSession('a',['5','6','7','8'],true);
    const optedInPublished=await db.query<{ value:any }>(`SELECT public.finalize_love_galaxy_upload_session($1::uuid,$2) value`,[optedInSession.session,optedInSession.tokenHash]);
    await db.exec(`RESET ROLE`);
    const optedInRow=await db.query<{ journey_discovery_enabled:boolean }>(`SELECT journey_discovery_enabled FROM public.love_galaxies WHERE username=$1 LIMIT 1`,[optedInPublished.rows[0].value.username]);
    expect(optedInRow.rows[0].journey_discovery_enabled).toBe(true);
    await db.exec(`SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)`);
    const discovered=await db.query<{ value:any }>(`SELECT public.list_discoverable_love_galaxies() value`);
    expect(discovered.rows[0].value).toEqual([{ username:optedInPublished.rows[0].value.username, title:input.title, public_key:optedInPublished.rows[0].value.public_key }]);
    expect(JSON.stringify(discovered.rows[0].value)).not.toContain('ring_text');
    expect(JSON.stringify(discovered.rows[0].value)).not.toContain('photos');
    expect(JSON.stringify(discovered.rows[0].value)).not.toContain('music');
    expect(JSON.stringify(discovered.rows[0].value)).not.toContain('id');

    const invalidSession=uuid('d');
    const invalidInput={...input,journey_discovery_enabled:'yes'};
    const invalidPhotos=optedOutSession.files.map((file:any)=>({...file,path:file.path.replace(optedOutSession.session,invalidSession)}));
    await expect(db.query(`SELECT public.create_love_galaxy_upload_session($1::uuid,$2,$3,$4::jsonb,$5::jsonb,now()+interval '2 hours')`,[invalidSession,'c'.repeat(64),'d'.repeat(64),JSON.stringify(invalidInput),JSON.stringify(invalidPhotos)])).rejects.toThrow();
    await expect(db.query(`UPDATE public.love_galaxies SET journey_discovery_enabled=true WHERE username=$1`,[optedOutPublished.rows[0].value.username])).rejects.toThrow();

    await db.exec(`RESET ROLE; SET ROLE anon`);
    await expect(db.query(`SELECT * FROM public.love_galaxies LIMIT 1`)).rejects.toThrow();
    await expect(db.query(`UPDATE public.love_galaxies SET journey_discovery_enabled=true`)).rejects.toThrow();
    await expect(db.query(`SELECT public.list_discoverable_love_galaxies()`)).rejects.toThrow();
  } finally { await db.close(); }
}, 20000);
