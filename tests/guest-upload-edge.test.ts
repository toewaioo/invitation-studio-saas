import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { normalizeGuestPhotoMime } from '../src/lib/photoMime';

const source = readFileSync(new URL('../supabase/functions/guest-upload/index.ts', import.meta.url), 'utf8');
const compiled = await new Bun.Transpiler({ loader: 'ts' }).transform(source.replace("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'", ''));
const origin = 'https://app.example';
const baseInput = {
  title: 'မင်္ဂလာဆောင်', person_a: 'သီဟ', person_b: 'မေမြတ်', parent_a: '', parent_b: '',
  event_date: '2027-02-14', event_time: '18:30', venue: 'Yangon Hall', message: 'Welcome',
  map_url: '', template: 'thazin', theme: 'sage', project_type: 'wedding',
};
const png = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const makeJpeg = (size: number) => { const bytes = new Uint8Array(size); bytes.set([0xff,0xd8,0xff]); return bytes; };

type FileObject = { bytes: Uint8Array; type: string };
function makeHarness() {
  const env: Record<string, string | undefined> = {
    ALLOWED_ORIGINS: origin, IP_HASH_SALT: 'unit-test-salt', SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'server-only-key', GUEST_UPLOAD_BRIDGE_SECRET: 'gateway-only-secret-for-unit-tests-32',
  };
  const sessions = new Map<string, any>();
  const objects = new Map<string, FileObject>();
  const uploadedPaths: string[] = [];
  const removed: string[][] = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const DenoStub = { env: { get: (key: string) => env[key] }, serve: (captured: (request: Request) => Promise<Response>) => { handler = captured; } };
  const createClient = () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      const id = String(args.p_session_id ?? '');
      if (name === 'list_expired_guest_upload_sessions') return { data: [], error: null };
      if (name === 'create_guest_upload_session') {
        const sessionId = String(args.p_session_id);
        const session = { id: sessionId, secret_hash: args.p_secret_hash, ip_hash: args.p_ip_hash, input: args.p_input, schedule: args.p_schedule, files: args.p_files, status: 'pending', expires_at: args.p_expires_at };
        sessions.set(sessionId, session);
        return { data: { id: sessionId }, error: null };
      }
      const session = sessions.get(id);
      if (name === 'get_guest_upload_session') {
        if (!session || session.secret_hash !== args.p_secret_hash) return { data: null, error: null };
        return { data: { id: session.id, input: session.input, schedule: session.schedule, files: session.files, status: session.status, expires_at: session.expires_at, guest_invitation_id: session.guest_invitation_id }, error: null };
      }
      if (name === 'finalize_guest_upload_session') {
        if (!session || session.secret_hash !== args.p_secret_hash) return { data: null, error: { message: 'Upload session not found' } };
        if (session.status === 'pending') {
          session.status = 'published'; session.guest_invitation_id = 'published-id';
          session.project = { id: 'published-id', username: 'guest-test', public_key: 'share-key', status: 'published', title: session.input.title, customer_name: '', photos: session.files.map((file: any) => ({ id: file.id, storage_path: file.path, caption: '', position: file.position })) };
        }
        return { data: session.status === 'published' ? session.project : null, error: null };
      }
      if (name === 'cancel_guest_upload_session') {
        if (!session || session.secret_hash !== args.p_secret_hash) return { data: { status: 'missing', files: [] }, error: null };
        if (session.status === 'pending') session.status = 'canceled';
        return { data: { status: session.status, files: session.status === 'published' ? [] : session.files }, error: null };
      }
      if (name === 'expire_guest_upload_session') return { data: true, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
    storage: { from: (_bucket: string) => ({
      upload: async (path: string, body: Blob, options: any) => {
        if (objects.has(path)) return { data: null, error: { statusCode: 409, message: 'already exists' } };
        const bytes = new Uint8Array(await body.arrayBuffer());
        objects.set(path, { bytes, type: options.contentType });
        uploadedPaths.push(path);
        return { data: { path }, error: null };
      },
      download: async (path: string) => {
        const object = objects.get(path);
        return object ? { data: new Blob([object.bytes.slice().buffer as ArrayBuffer], { type: object.type }), error: null } : { data: null, error: { message: 'missing' } };
      },
      remove: async (paths: string[]) => { removed.push(paths); for (const name of paths) objects.delete(name); return { data: paths.map(name => ({ name })), error: null }; },
    }) },
  });
  new Function('Deno', 'createClient', compiled)(DenoStub, createClient);
  if (!handler) throw new Error('Edge Function did not register a handler');
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://edge.example/guest-upload', {
    method: 'POST', headers: { origin, 'x-forwarded-for': '203.0.113.5', 'content-type': 'application/json', 'x-invitation-upload-bridge': 'gateway-only-secret-for-unit-tests-32', ...headers }, body: JSON.stringify(body),
  });
  const binaryRequest = (body: Uint8Array, sessionId: string, sessionToken: string, photoId: string, type = 'image/jpeg', extra: Record<string, string> = {}) => new Request('https://edge.example/guest-upload', {
    method: 'POST', headers: { origin, 'x-forwarded-for': '203.0.113.5', 'content-type': type, 'x-invitation-upload-bridge': 'gateway-only-secret-for-unit-tests-32', 'x-invitation-upload-action': 'upload', 'x-invitation-upload-session-id': sessionId, 'x-invitation-upload-session-token': sessionToken, 'x-invitation-upload-photo-id': photoId, ...extra }, body: body as unknown as BodyInit,
  });
  return { handler, request, binaryRequest, env, sessions, objects, uploadedPaths, removed, rpcCalls };
}
async function json(response: Response) { return await response.json() as Record<string, any>; }
async function start(harness: ReturnType<typeof makeHarness>, size = png.length, type = 'image/png') {
  const response = await harness.handler(harness.request({ action: 'start', input: baseInput, photos: [{ size, type }] }));
  return { response, body: await json(response) };
}

describe('guest server-proxied upload Edge Function', () => {
  test('rejects direct public calls with forged forwarding headers unless the Vercel bridge secret is present', async () => {
    const h = makeHarness();
    const denied = await h.handler(h.request({ action: 'start', input: baseInput, photos: [{ size: png.length, type: 'image/png' }] }, { 'x-invitation-upload-bridge': '', 'x-forwarded-for': '198.51.100.99' }));
    expect(denied.status).toBe(403);
    expect(h.rpcCalls).toHaveLength(0);
    expect(h.uploadedPaths).toHaveLength(0);
    const unconfigured = makeHarness();
    delete unconfigured.env.GUEST_UPLOAD_BRIDGE_SECRET;
    const deniedUnconfigured = await unconfigured.handler(unconfigured.request({ action: 'start', input: baseInput, photos: [{ size: png.length, type: 'image/png' }] }));
    expect(deniedUnconfigured.status).toBe(403);
    expect(unconfigured.rpcCalls).toHaveLength(0);
  });

  test('allows only the bridge-authenticated cleanup action to run without a client IP', async () => {
    const h = makeHarness();
    const response = await h.handler(h.request({ action: 'cleanup' }, { 'x-forwarded-for': '' }));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ cleanedSessions: 0 });
    expect(h.rpcCalls.some(call => call.name === 'list_expired_guest_upload_sessions')).toBe(true);
    const denied = await h.handler(h.request({ action: 'cleanup' }, { 'x-invitation-upload-bridge': '' }));
    expect(denied.status).toBe(403);
  });

  test('creates path-bound upload sessions but returns no Storage URL or capability', async () => {
    const h = makeHarness();
    const { response, body } = await start(h, 4_490_000, 'image/jpeg');
    expect(response.status).toBe(201);
    expect(body.upload.uploads[0]).toEqual({ photoId: expect.any(String), contentType: 'image/jpeg', size: 4_490_000 });
    expect(JSON.stringify(body)).not.toMatch(/supabase|signedUrl|server-only-key/);
    expect(h.uploadedPaths).toHaveLength(0);
    const session = [...h.sessions.values()][0];
    expect(session.input.customer_name).toBeUndefined();
    expect(session.files[0].path).toMatch(new RegExp(`^guest-staging/${body.upload.sessionId}/[0-9a-f-]{36}\\.jpg$`));
    expect(session.secret_hash).not.toBe(body.upload.sessionToken);
  });

  test('accepts exactly 4,490,000 raw bytes through the bridge and finalizes after server verification', async () => {
    const h = makeHarness();
    const { body } = await start(h, 4_490_000, 'image/jpeg');
    const photoId = body.upload.uploads[0].photoId;
    const bytes = makeJpeg(4_490_000);
    const uploaded = await h.handler(h.binaryRequest(bytes, body.upload.sessionId, body.upload.sessionToken, photoId));
    expect(uploaded.status).toBe(201);
    expect(await json(uploaded)).toEqual({ uploaded: true });
    expect([...h.objects.values()][0].bytes.length).toBe(4_490_000);
    expect(h.uploadedPaths).toHaveLength(1);
    const response = await h.handler(h.request({ action: 'finalize', sessionId: body.upload.sessionId, sessionToken: body.upload.sessionToken }));
    const result = await json(response);
    expect(response.status).toBe(201);
    expect(result.project.status).toBe('published');
    expect(result.project.photos).toHaveLength(1);
    expect(result.project.customer_name).toBe('');
    expect(h.sessions.get(body.upload.sessionId).status).toBe('published');
  });

  test('rejects one byte over the limit before Storage and rejects over-limit start metadata', async () => {
    const h = makeHarness();
    expect((await start(h, 4_490_001, 'image/jpeg')).response.status).toBe(400);
    const { body } = await start(h, 4_490_000, 'image/jpeg');
    const tooLarge = await h.handler(h.binaryRequest(makeJpeg(4_490_001), body.upload.sessionId, body.upload.sessionToken, body.upload.uploads[0].photoId));
    expect(tooLarge.status).toBe(413);
    expect(h.uploadedPaths).toHaveLength(0);
  });

  test('rejects wrong session token, MIME, image magic, and duplicate uploads', async () => {
    const h = makeHarness();
    const { body } = await start(h, png.length, 'image/png');
    const photoId = body.upload.uploads[0].photoId;
    const badToken = await h.handler(h.binaryRequest(png, body.upload.sessionId, '0'.repeat(64), photoId, 'image/png'));
    expect(badToken.status).toBe(404);
    const badType = await h.handler(h.binaryRequest(png, body.upload.sessionId, body.upload.sessionToken, photoId, 'image/jpeg'));
    expect(badType.status).toBe(400);
    const badMagic = await h.handler(h.binaryRequest(new Uint8Array([0xff,0xd8,0xff]), body.upload.sessionId, body.upload.sessionToken, photoId, 'image/png'));
    expect(badMagic.status).toBe(400);
    const first = await h.handler(h.binaryRequest(png, body.upload.sessionId, body.upload.sessionToken, photoId, 'image/png'));
    expect(first.status).toBe(201);
    const repeated = await h.handler(h.binaryRequest(png, body.upload.sessionId, body.upload.sessionToken, photoId, 'image/png'));
    expect(repeated.status).toBe(409);
    expect(h.uploadedPaths).toHaveLength(1);
  });

  test('normalizes a mislabeled real PNG, verifies its bytes, then removes the pending object on cancel', async () => {
    const imageBytes = new Uint8Array(readFileSync(new URL('../artifacts/local-preview-heart-qr.png', import.meta.url)));
    const selected = new File([imageBytes], 'camera.jpg', { type: 'image/jpeg' });
    const normalized = await normalizeGuestPhotoMime(selected);
    expect(normalized.type).toBe('image/png');

    const h = makeHarness();
    const { body } = await start(h, normalized.size, normalized.type);
    const photoId = body.upload.uploads[0].photoId;
    const uploaded = await h.handler(h.binaryRequest(new Uint8Array(await normalized.arrayBuffer()), body.upload.sessionId, body.upload.sessionToken, photoId, normalized.type));
    expect(uploaded.status).toBe(201);
    expect(h.uploadedPaths).toHaveLength(1);
    const file = h.sessions.get(body.upload.sessionId).files[0];
    expect(h.objects.get(file.path)?.bytes).toEqual(imageBytes);

    const canceled = await h.handler(h.request({ action: 'cancel', sessionId: body.upload.sessionId, sessionToken: body.upload.sessionToken }));
    expect(canceled.status).toBe(200);
    expect(await json(canceled)).toEqual({ result: { canceled: true } });
    expect(h.objects.has(file.path)).toBe(false);
    expect(h.removed).toEqual([[file.path]]);
    expect(h.rpcCalls.some(call => call.name === 'finalize_guest_upload_session')).toBe(false);
  });

  test('does not publish mismatched stored MIME or invalid image bytes and removes only its own staging object', async () => {
    const h = makeHarness();
    const { body } = await start(h, png.length, 'image/png');
    h.objects.set(h.sessions.get(body.upload.sessionId).files[0].path, { bytes: new Uint8Array([0xff,0xd8,0xff]), type: 'image/png' });
    const response = await h.handler(h.request({ action: 'finalize', sessionId: body.upload.sessionId, sessionToken: body.upload.sessionToken }));
    expect(response.status).toBe(400);
    expect(h.sessions.get(body.upload.sessionId).status).toBe('canceled');
    expect(h.removed).toEqual([[h.sessions.get(body.upload.sessionId).files[0].path]]);
    expect(h.rpcCalls.some(call => call.name === 'finalize_guest_upload_session')).toBe(false);
  });

  test('cancel after an ambiguous response cannot delete a successfully published guest photo', async () => {
    const h = makeHarness();
    const { body } = await start(h);
    const file = h.sessions.get(body.upload.sessionId).files[0];
    h.objects.set(file.path, { bytes: png, type: 'image/png' });
    await h.handler(h.request({ action: 'finalize', sessionId: body.upload.sessionId, sessionToken: body.upload.sessionToken }));
    const response = await h.handler(h.request({ action: 'cancel', sessionId: body.upload.sessionId, sessionToken: body.upload.sessionToken }));
    expect(response.status).toBe(200);
    expect((await json(response)).result.canceled).toBe(false);
    expect(h.removed).toHaveLength(0);
    expect(h.objects.has(file.path)).toBe(true);
  });
});
