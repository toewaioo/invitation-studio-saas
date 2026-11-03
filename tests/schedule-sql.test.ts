import { test, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';

const owner = '11111111-1111-4111-a111-111111111111';
const otherOwner = '22222222-2222-4222-a222-222222222222';
const projectId = '33333333-3333-4333-a333-333333333333';
const photoId = '44444444-4444-4444-a444-444444444444';

const readMigration = (name: string) => Bun.file(new URL(`../supabase/migrations/${name}`, import.meta.url)).text();

const input = {
  title: 'Schedule guest', person_a: 'A', person_b: 'B', parent_a: '', parent_b: '',
  event_date: '2027-02-14', event_time: '09:00', venue: 'Hall', message: 'Welcome', map_url: '',
  template: 'thazin', theme: 'sage', project_type: 'wedding',
};

test('schedule SQL migration compiles and preserves persistence, RPC compatibility, validation, and RLS', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
      CREATE FUNCTION storage.filename(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)] $$;
      GRANT USAGE ON SCHEMA auth,storage,public TO authenticated,anon,service_role;
      INSERT INTO auth.users VALUES ('${owner}'), ('${otherOwner}');
    `);
    await db.exec(await readMigration('202610210001_invitation_studio.sql'));
    await db.exec(await readMigration('202610210002_rpc_privileges.sql'));
    await db.exec(await readMigration('202610220001_guest_invitations.sql'));
    await db.exec(await readMigration('202610220002_schedule.sql'));

    const defaults = await db.query<{ project_schedule: unknown; guest_schedule: unknown }>(
      `SELECT (SELECT schedule FROM public.projects LIMIT 1) project_schedule, (SELECT schedule FROM public.guest_invitations LIMIT 1) guest_schedule`,
    );
    expect(defaults.rows[0]).toEqual({ project_schedule: null, guest_schedule: null });
    const projectColumns = await db.query<{ column_default: string; is_nullable: string }>(
      `SELECT column_default,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='schedule'`,
    );
    expect(projectColumns.rows[0]).toEqual({ column_default: "'[]'::jsonb", is_nullable: 'NO' });

    const privileges = await db.query<{ guest3_anon: boolean; guest4_anon: boolean; guest3_service: boolean; guest4_service: boolean; table_read: boolean }>(
      `SELECT has_function_privilege('anon','public.create_guest_invitation(text,jsonb,jsonb)','EXECUTE') guest3_anon,
              has_function_privilege('anon','public.create_guest_invitation(text,jsonb,jsonb,jsonb)','EXECUTE') guest4_anon,
              has_function_privilege('service_role','public.create_guest_invitation(text,jsonb,jsonb)','EXECUTE') guest3_service,
              has_function_privilege('service_role','public.create_guest_invitation(text,jsonb,jsonb,jsonb)','EXECUTE') guest4_service,
              has_table_privilege('anon','public.guest_invitations','SELECT') table_read`,
    );
    expect(privileges.rows[0]).toEqual({ guest3_anon: false, guest4_anon: false, guest3_service: true, guest4_service: true, table_read: false });

    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',false)`);
    await db.query(`INSERT INTO public.projects(id,owner_id,title,username,customer_name,person_a,person_b,event_date,event_time,venue,message) VALUES ($1,$2,'Owner schedule','owner-schedule','Private','A','B','2027-02-14','09:00','Hall','Welcome')`, [projectId, owner]);
    const projectDefault = await db.query<{ schedule: unknown }>(`SELECT schedule FROM public.projects WHERE id=$1`, [projectId]);
    expect(projectDefault.rows[0].schedule).toEqual([]);
    const schedule = [{ time: '07:00', label: 'Morning ceremony' }, { time: '18:30', label: 'Dinner' }];
    await db.query(`UPDATE public.projects SET schedule=$1::jsonb WHERE id=$2`, [JSON.stringify(schedule), projectId]);
    const ownerRoundtrip = await db.query<{ schedule: unknown }>(`SELECT schedule FROM public.projects WHERE id=$1`, [projectId]);
    expect(ownerRoundtrip.rows[0].schedule).toEqual(schedule);

    await db.query(`INSERT INTO public.project_photos(id,project_id,storage_path) VALUES ($1,$2,$3)`, [photoId, projectId, `${owner}/${projectId}/${photoId}.jpeg`]);
    const published = await db.query<{ project: any }>(`SELECT public.publish_project($1) project`, [projectId]);
    const publicKey = published.rows[0].project.public_key;
    await db.exec(`SET ROLE anon`);
    const publicRoundtrip = await db.query<{ project: any }>(`SELECT public.public_project('owner-schedule',$1) project`, [publicKey]);
    expect(publicRoundtrip.rows[0].project.schedule).toEqual(schedule);
    await expect(db.query(`SELECT * FROM public.projects`)).rejects.toThrow();

    await db.exec(`RESET ROLE; SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)`);
    const guest3 = await db.query<{ project: any }>(`SELECT public.create_guest_invitation($1,$2::jsonb,$3::jsonb) project`, ['1'.repeat(64), JSON.stringify(input), '[]']);
    expect(guest3.rows[0].project.schedule).toEqual([]);
    const guestSchedule = [{ time: '10:15', label: 'Reception' }];
    const guest4 = await db.query<{ project: any }>(`SELECT public.create_guest_invitation($1,$2::jsonb,$3::jsonb,$4::jsonb) project`, ['2'.repeat(64), JSON.stringify(input), JSON.stringify(guestSchedule), '[]']);
    expect(guest4.rows[0].project.schedule).toEqual(guestSchedule);

    for (const invalid of [null, '{}', JSON.stringify([{ time: '25:00', label: 'Bad' }]), JSON.stringify([{ time: '07:00' }]), JSON.stringify([{ label: 'Bad' }]), JSON.stringify([{ time: '07:00', label: '   ' }]), JSON.stringify([{ time: '07:00', label: 'x'.repeat(101) }]), JSON.stringify(Array(5).fill({ time: '07:00', label: 'Too many' }))]) {
      await expect(db.query(`SELECT public.create_guest_invitation($1,$2::jsonb,$3::jsonb,$4::jsonb)`, ['3'.repeat(64), JSON.stringify(input), invalid, '[]'])).rejects.toThrow();
    }
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${otherOwner}',false)`);
    expect((await db.query(`SELECT * FROM public.projects`)).rows).toHaveLength(0);
    expect((await db.query(`UPDATE public.projects SET schedule='[]'::jsonb WHERE id=$1`, [projectId])).rows).toHaveLength(0);
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${owner}',false)`);
    expect((await db.query<{ schedule: unknown }>(`SELECT schedule FROM public.projects WHERE id=$1`, [projectId])).rows[0].schedule).toEqual(schedule);
  } finally {
    await db.close();
  }
}, 20000);
