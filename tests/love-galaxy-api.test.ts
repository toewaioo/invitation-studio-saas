import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLoveGalaxyHandler } from '../api/love-galaxy';

let server: ReturnType<typeof createServer>;
let origin = '';
let handler: (req:IncomingMessage,res:ServerResponse)=>Promise<void>;
let savedEnv: Record<string,string|undefined>;
const calls: Array<{ url:string; init:RequestInit }> = [];
const sessionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fileIds=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const pubKey='a'.repeat(64);
function mockFetch(input:RequestInfo|URL,init:RequestInit={}) {
  const url=String(input); calls.push({url,init});
  const headers=new Headers(init.headers);
  const body=init.body instanceof Buffer ? null : JSON.parse(String(init.body||'{}'));
  if (headers.get('x-love-galaxy-action')==='upload') return Promise.resolve(new Response(JSON.stringify({uploaded:true}),{status:201,headers:{'content-type':'application/json'}}));
  if (body.action==='start') return Promise.resolve(new Response(JSON.stringify({upload:{sessionId,sessionToken:'b'.repeat(64),expiresAt:'2030-01-01T00:00:00Z',uploads:body.files.map((file:any,index:number)=>({fileId:fileIds[index],kind:file.kind,contentType:file.type,size:file.size}))}}),{status:201,headers:{'content-type':'application/json'}}));
  if (body.action==='discoverable') return Promise.resolve(new Response(JSON.stringify({worlds:[{username:'galaxy-0123456789abcdef',title:'Our Day',public_key:pubKey,photos:['private-photo'],ring_text_one:'private ring',ring_text_two:'private ring two',music_path:'private-music',journey_discovery_enabled:false},{username:'invalid',title:'Bad row',public_key:pubKey}]}),{headers:{'content-type':'application/json'}}));
  if (body.action==='public') return Promise.resolve(new Response(JSON.stringify({galaxy:{id:'galaxy-row',username:'galaxy-0123456789abcdef',title:'Our Day',ring_text_one:'first orbit',ring_text_two:'second orbit',music_track:'cosmic-orbit',photos:fileIds.map((id,position)=>({id,storage_path:`love-galaxy-staging/private/${id}.jpg`,position})),status:'published',created_at:'2030-01-01T00:00:00Z'}}),{headers:{'content-type':'application/json'}}));
  if (body.action==='media') return Promise.resolve(new Response(new Uint8Array([0xff,0xd8,0xff,0x00]),{headers:{'content-type':'image/jpeg'}}));
  if (body.action==='finalize') return Promise.resolve(new Response(JSON.stringify({galaxy:{id:'galaxy-row',username:'galaxy-0123456789abcdef',public_key:pubKey,title:'Our Day',ring_text_one:'first orbit',ring_text_two:'second orbit',music_track:'cosmic-orbit',photos:fileIds.map((id,position)=>({id,storage_path:`love-galaxy-staging/private/${id}.jpg`,position})),status:'published',created_at:'2030-01-01T00:00:00Z'}}),{headers:{'content-type':'application/json'}}));
  if (body.action==='cancel') return Promise.resolve(new Response(JSON.stringify({result:{canceled:true}}),{headers:{'content-type':'application/json'}}));
  throw new Error(`Unexpected edge request: ${body.action}`);
}
function json(data:unknown,status=200) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}}); }

beforeAll(async () => {
  savedEnv={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_ANON_KEY:process.env.SUPABASE_ANON_KEY,GUEST_UPLOAD_BRIDGE_SECRET:process.env.GUEST_UPLOAD_BRIDGE_SECRET,APP_ORIGIN:process.env.APP_ORIGIN,VERCEL:process.env.VERCEL,NODE_ENV:process.env.NODE_ENV};
  process.env.SUPABASE_URL='https://supabase.example'; process.env.SUPABASE_ANON_KEY='public-anon-key'; process.env.GUEST_UPLOAD_BRIDGE_SECRET='server-bridge-secret-which-is-at-least-32-chars'; process.env.APP_ORIGIN='https://love-birds-mm.vercel.app'; process.env.VERCEL='0'; process.env.NODE_ENV='test';
  handler=createLoveGalaxyHandler({fetch:mockFetch as typeof fetch});
  server=createServer((req,res)=>{ void handler(req,res); });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address(); if (!address || typeof address==='string') throw new Error('No API test listener');
  origin=`http://127.0.0.1:${address.port}`;
});
afterAll(async()=>{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  for (const [key,value] of Object.entries(savedEnv)) { if (value===undefined) delete process.env[key]; else process.env[key]=value; }
});

async function call(action:string,body:unknown,headers:Record<string,string>={}) {
  const response=await fetch(`${origin}/api/love-galaxy?action=${action}`,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)});
  return {response,body:await response.json() as any};
}

describe('dedicated Vercel Love Galaxy gateway',()=>{
  test('starts only four ordered photos and returns no bridge or service credentials to the browser',async()=>{
    const files=fileIds.map(()=>({kind:'photo',size:1200,type:'image/jpeg'}));
    const {response,body}=await call('start',{input:{title:'Our Day',ring_text_one:'first orbit',ring_text_two:'second orbit',music_track:'cosmic-orbit'},files});
    expect(response.status).toBe(201);
    expect(body.data.sessionId).toBe(sessionId);
    expect(body.data.uploads).toHaveLength(4);
    expect(JSON.stringify(body)).not.toContain('server-bridge-secret');
    expect(JSON.stringify(body)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    const upstream=calls.at(-1)!;
    expect(upstream.url).toBe('https://supabase.example/functions/v1/love-galaxy');
    expect(new Headers(upstream.init.headers).get('x-invitation-upload-bridge')).toBe(process.env.GUEST_UPLOAD_BRIDGE_SECRET!);
    expect(new Headers(upstream.init.headers).get('apikey')).toBe('public-anon-key');
    const upstreamBody=JSON.parse(String(upstream.init.body));
    expect(upstreamBody.action).toBe('start');
    expect(upstreamBody.input.journey_discovery_enabled).toBe(false);
    const optedIn=await call('start',{input:{title:'Our Day',ring_text_one:'first orbit',ring_text_two:'second orbit',music_track:'cosmic-orbit',journey_discovery_enabled:true},files});
    expect(optedIn.response.status).toBe(201);
    expect(JSON.parse(String(calls.at(-1)!.init.body)).input.journey_discovery_enabled).toBe(true);
    const callsBeforeInvalid=calls.length;
    const invalid=await call('start',{input:{title:'Our Day',ring_text_one:'first orbit',ring_text_two:'second orbit',music_track:'cosmic-orbit',journey_discovery_enabled:'true'},files});
    expect(invalid.response.status).toBe(400);
    expect(calls).toHaveLength(callsBeforeInvalid);
  });

  test('proxies raw photo bytes through the Vercel endpoint and does not return private path data',async()=>{
    const bytes=Buffer.from([0xff,0xd8,0xff,0x01]);
    const response=await fetch(`${origin}/api/love-galaxy?action=upload`,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'image/jpeg','x-love-galaxy-session-id':sessionId,'x-love-galaxy-session-token':'b'.repeat(64),'x-love-galaxy-file-id':fileIds[0]},body:bytes});
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({data:{uploaded:true}});
    const upstream=calls.at(-1)!;
    expect(upstream.url).toBe('https://supabase.example/functions/v1/love-galaxy');
    expect(new Headers(upstream.init.headers).get('x-love-galaxy-action')).toBe('upload');
    expect(Buffer.from(upstream.init.body as Buffer)).toEqual(bytes);
  });

  test('public link lookup returns only redacted fields and proxies private photo delivery',async()=>{
    const key=new URLSearchParams({action:'public',username:'galaxy-0123456789abcdef',key:pubKey});
    const lookup=await fetch(`${origin}/api/love-galaxy?${key}`);
    expect(lookup.status).toBe(200);
    const result=await lookup.json() as any;
    expect(result.data.photos).toHaveLength(4);
    expect(result.data.photos[0].url).toContain('/api/love-galaxy?action=photo');
    expect(result.data.photos[0].url).toContain(`key=${pubKey}`);
    expect(result.data.photos[0].url).not.toContain('127.0.0.1');
    expect(JSON.stringify(result)).not.toContain('storage_path');
    expect(JSON.stringify(result)).not.toContain('love-galaxy-staging');
    const photoUrl=new URL(result.data.photos[0].url,origin);
    const photo=await fetch(`${origin}${photoUrl.pathname}${photoUrl.search}`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(new Uint8Array([0xff,0xd8,0xff,0x00]));
  });

  test('username-only Love Galaxy links fetch published metadata and private photos without a key',async()=>{
    const lookup=await fetch(`${origin}/api/love-galaxy?action=public&username=galaxy-0123456789abcdef`);
    expect(lookup.status).toBe(200);
    const result=await lookup.json() as any;
    expect(result.data.public_key).toBeNull();
    expect(new URL(result.data.photos[0].url,origin).searchParams.has('key')).toBe(false);
    const photoUrl=new URL(result.data.photos[0].url,origin);
    const photo=await fetch(`${origin}${photoUrl.pathname}${photoUrl.search}`);
    expect(photo.status).toBe(200);
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(new Uint8Array([0xff,0xd8,0xff,0x00]));
    const edge=JSON.parse(String(calls.at(-1)?.init.body));
    expect(edge.action).toBe('media'); expect(edge.username).toBe('galaxy-0123456789abcdef'); expect(edge.key).toBe('');
  });
  test('isolated discovery route exposes only validated title and share identifiers',async()=>{
    const response=await fetch(`${origin}/api/love-galaxy?action=discoverable`);
    expect(response.status).toBe(200);
    const result=await response.json() as any;
    expect(result.data.worlds).toEqual([{username:'galaxy-0123456789abcdef',title:'Our Day'}]);
    expect(JSON.stringify(result)).not.toContain('public_key');
    expect(JSON.stringify(result)).not.toContain('private-photo');
    expect(JSON.stringify(result)).not.toContain('private ring');
    expect(JSON.stringify(result)).not.toContain('private-music');
    expect(JSON.stringify(result)).not.toContain('journey_discovery_enabled');
    expect(calls.at(-1)?.url).toBe('https://supabase.example/functions/v1/love-galaxy');
    expect(JSON.parse(String(calls.at(-1)?.init.body)).action).toBe('discoverable');
  });

  test('blocks cross-origin mutation and rejects a wrong photo count before contacting Supabase',async()=>{
    const upstreamCalls=calls.length;
    const denied=await fetch(`${origin}/api/love-galaxy?action=start`,{method:'POST',headers:{origin:'https://attacker.example','sec-fetch-site':'cross-site','content-type':'application/json'},body:'{}'});
    expect(denied.status).toBe(403);
    const {response}=await call('start',{input:{title:'Our Day',ring_text_one:'a',ring_text_two:'b',music_track:'cosmic-orbit'},files:[{kind:'photo',size:10,type:'image/jpeg'}]});
    expect(response.status).toBe(400);
    const publicKeyConsent=await call('consent',{username:'galaxy-0123456789abcdef',key:pubKey,journey_discovery_enabled:true});
    expect(publicKeyConsent.response.status).toBe(404);
    expect(calls).toHaveLength(upstreamCalls);
  });
});
