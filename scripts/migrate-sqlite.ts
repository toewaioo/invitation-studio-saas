/** Server-side migration only. Never import this file into the browser bundle. */
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const option = (name:string) => args.find(a=>a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const dataDir = resolve(option('data') || '/workspace/invitation-studio-data');
const workspace = option('workspace');
const apply = args.includes('--apply');
if (!workspace) {
 console.error('Usage: bun scripts/migrate-sqlite.ts --workspace=LEGACY_WORKSPACE_ID [--data=/path] [--apply]\nDefault: dry run. Select a workspace explicitly; never merge all customer workspaces.');
 process.exit(1);
}
const db = new Database(resolve(dataDir,'studio.sqlite3'),{readonly:true});
const rows = db.query('SELECT p.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.notes AS private_notes FROM projects p JOIN customers c ON c.id=p.customer_id WHERE p.workspace_id=? ORDER BY p.created_at').all(workspace) as Record<string,any>[];
const photosFor = (pid:string) => db.query('SELECT * FROM photos WHERE project_id=? ORDER BY position').all(pid) as Record<string,any>[];
console.log(`Selected workspace: ${rows.length} projects, ${rows.reduce((n,p)=>n+photosFor(p.id).length,0)} photos. All imported invitations become PRIVATE DRAFTS. Old share links are not imported.`);
if (!apply) { console.log('Dry run only. No changes made. For import set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and IMPORT_OWNER_ID (an existing Auth user UUID), then add --apply.'); db.close(); process.exit(0); }
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,owner=process.env.IMPORT_OWNER_ID;
if(!url||!key||!owner) throw new Error('Missing server-only SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or IMPORT_OWNER_ID.');
if(!/^[0-9a-f-]{36}$/i.test(owner))throw new Error('IMPORT_OWNER_ID must be an existing Supabase Auth user UUID.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const ownerResult=await client.auth.admin.getUserById(owner);if(ownerResult.error)throw ownerResult.error;
const uuid=(value:string)=>{const hash=createHash('sha256').update(`metta-legacy:${workspace}:${value}`).digest('hex').slice(0,32);return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`;};
for(const row of rows){
 const id=uuid(row.id);
 // Refuse to overwrite: reruns skip completed projects and resume only missing photos.
 const existing=await client.from('projects').select('id,owner_id,status').eq('id',id).maybeSingle();if(existing.error)throw existing.error;
 if(existing.data&&(existing.data.owner_id!==owner||existing.data.status!=='draft'))throw new Error('Existing target project has another owner or is published. Import stopped without overwriting it.');
 if(!existing.data){const content=JSON.parse(row.content_json);const {error}=await client.from('projects').insert({id,owner_id:owner,title:row.title,username:row.username,status:'draft',public_key:null,template:row.template,theme:row.theme,project_type:row.project_type,customer_name:row.customer_name,customer_email:row.customer_email,customer_phone:row.customer_phone,private_notes:row.private_notes,...content,created_at:row.created_at,updated_at:row.updated_at});if(error)throw error;}
 for(const photo of photosFor(row.id)){
  const photoId=uuid(photo.id),path=`${owner}/${id}/${photoId}.jpg`;
  const found=await client.from('project_photos').select('id').eq('id',photoId).maybeSingle();if(found.error)throw found.error;if(found.data)continue;
  if(basename(photo.filename)!==photo.filename)throw new Error('Unsafe legacy photo filename.');
  const file=Bun.file(resolve(dataDir,'uploads',photo.filename));if(!await file.exists())throw new Error('A legacy photo is missing. Import stopped; existing source is unchanged.');
  const uploaded=await client.storage.from('project-photos').upload(path,await file.arrayBuffer(),{contentType:'image/jpeg',upsert:false});if(uploaded.error && !['409','Duplicate','ResourceAlreadyExists'].includes(String((uploaded.error as any).statusCode || uploaded.error.name)))throw uploaded.error;
  const inserted=await client.from('project_photos').insert({id:photoId,project_id:id,storage_path:path,caption:photo.caption,position:photo.position});if(inserted.error)throw inserted.error;
 }
 console.log(`Imported private draft ${id}`);
}
db.close();console.log('Import complete. Review each draft and publish new share links manually. Source SQLite/files were not modified.');
