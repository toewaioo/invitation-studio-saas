import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createStudioHandler } from '../api/studio'

const BASE = 'https://database.example'
const OWNER = 'owner-uuid'
const OTHER = 'other-uuid'
const access = 'owner-access'
const refresh = 'owner-refresh'
const project = {
  id: 'project-1', owner_id: OWNER, title: 'Our day', customer_name: 'Secret Name', customer_email: 'secret@example.com',
  customer_phone: '555', private_notes: 'private', person_a: 'A', person_b: 'B', parent_a: '', parent_b: '',
  event_date: '2030-01-01', event_time: '12:00', venue: 'Venue', message: 'Welcome', map_url: '', username: 'our-day',
  template: 'thazin', theme: 'sage', project_type: 'wedding', status: 'draft', public_key: 'share-key',
  storage_path: 'private/project.json', project_photos: [{ id: 'photo-1', caption: 'one', position: 0, storage_path: `${OWNER}/project-1/photo-1.jpg` }],
}

let currentProject = structuredClone(project)
let usernameFree = true
let failPhotoInsert = false
let failStorageDelete = false
let projectDeleted = false
let calls: Array<{ url: string; init?: RequestInit }> = []
let publicMode: 'valid' | 'missing' | 'guest-fallback' = 'valid'
let server: ReturnType<typeof createServer>
let origin = ''
let handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>
let savedEnv: Record<string, string | undefined>

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
}
function bearer(init?: RequestInit, input?: RequestInfo | URL) {
  const headers = input instanceof Request ? input.headers : init?.headers
  return String(new Headers(headers).get('authorization') || '').replace(/^Bearer\s+/i, '')
}
function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input); calls.push({ url, init })
  const u = new URL(url); const token = bearer(init, input)
  if (u.pathname === '/auth/v1/user') return Promise.resolve(token === access ? json({ id: OWNER, email: 'owner@example.com' }) : token === 'other-token' ? json({ id: OTHER }) : json({ message: 'invalid token' }, 401))
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') return Promise.resolve(json({ access_token: access, refresh_token: refresh, user: { id: OWNER }, expires_in: 3600 }))
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') return Promise.resolve(json({ access_token: 'refreshed-access', refresh_token: 'refreshed-refresh', user: { id: OWNER }, expires_in: 3600 }))
  if (u.pathname === '/auth/v1/logout') return Promise.resolve(new Response(null, { status: 204 }))
  if (u.pathname === '/rest/v1/projects') {
    if (token !== access && token !== 'refreshed-access') return Promise.resolve(json({ message: 'RLS' }, 401))
    if (init?.method === 'DELETE') { projectDeleted = true; return Promise.resolve(json([{ id: currentProject.id }])) }
    if (init?.method === 'POST' || init?.method === 'PATCH') { currentProject = { ...currentProject, ...JSON.parse(String(init.body)) }; return Promise.resolve(json(currentProject)) }
    if (u.searchParams.has('id')) return Promise.resolve(projectDeleted ? json([]) : json(currentProject))
    return Promise.resolve(json([currentProject]))
  }
  if (u.pathname === '/rest/v1/project_photos') {
    if (init?.method === 'POST') {
      if (failPhotoInsert) return Promise.resolve(json({ message: 'internal customer canary' }, 400))
      const row = JSON.parse(String(init.body)); currentProject.project_photos.push(row)
    }
    if (init?.method === 'DELETE') currentProject.project_photos = currentProject.project_photos.filter(x => `eq.${x.id}` !== u.searchParams.get('id'))
    return Promise.resolve(json([]))
  }
  if (u.pathname.startsWith('/rest/v1/rpc/')) {
    const rpc = u.pathname.split('/').pop()
    if (rpc === 'public_project') return Promise.resolve(publicMode === 'missing' || publicMode === 'guest-fallback' ? json(null, 404) : json(project))
    if (rpc === 'guest_public_project') return Promise.resolve(publicMode === 'guest-fallback' ? json({ ...project, username: 'guest-abc', public_key: 'guest-key', status: 'published' }) : json(null, 404))
    if (rpc === 'username_available') return Promise.resolve(json(usernameFree))
    if (rpc === 'publish_project') { currentProject.status = 'published'; currentProject.public_key = 'new-share-key'; return Promise.resolve(json(currentProject)) }
    if (rpc === 'revoke_project') { currentProject.status = 'draft'; currentProject.public_key = ''; return Promise.resolve(json(true)) }
  }
  if (u.pathname.startsWith('/storage/v1/object/')) {
    if (init?.method === 'POST') return Promise.resolve(json({ Key: u.pathname.split('/object/')[1] }))
    if (init?.method === 'DELETE') return Promise.resolve(failStorageDelete ? json({ message: 'storage cleanup failed' }, 500) : json([]))
    return Promise.resolve(new Response(new Uint8Array([255, 216, 255]), { headers: { 'content-type': 'image/jpeg' } }))
  }
  if (u.pathname.startsWith('/functions/v1/guest-invitation')) return Promise.resolve(json({ project: { username: 'guest-abc', public_key: 'guest-key', title: 'Guest', status: 'published' } }, 201))
  if (u.pathname.startsWith('/functions/v1/guest-upload')) {
    if (new Headers(init?.headers).get('x-invitation-upload-action') === 'upload') return Promise.resolve(json({ uploaded: true }, 201))
    const body = JSON.parse(String(init?.body || '{}'))
    if (body.action === 'start') {
      const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      const uploads = (body.photos || []).map((photo: any, index: number) => {
        const photoId = `${String(index + 1).padStart(8, '0')}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
        return { photoId, contentType: photo.type, size: photo.size }
      })
      return Promise.resolve(json({ upload: { sessionId: id, sessionToken: 'a'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z', uploads } }, 201))
    }
    if (body.action === 'finalize') return Promise.resolve(json({ project: { username: 'guest-abc', public_key: 'guest-key', title: 'Guest', status: 'published', photos: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', storage_path: 'private/hidden.jpg', caption: '', position: 0 }] } }, 201))
    if (body.action === 'cancel') return Promise.resolve(json({ result: { canceled: true } }))
  }
  if (u.pathname.startsWith('/functions/v1/invitation-photo')) return Promise.resolve(new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/jpeg' } }))
  throw new Error(`unmocked upstream ${url}`)
}
async function start() {
  handler = createStudioHandler({ fetch: mockFetch as typeof fetch, now: () => 1700000000000 })
  server = createServer((req, res) => { void handler(req, res) })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  origin = `http://127.0.0.1:${address.port}`
}
async function stop() { await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())) }
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type') && typeof init.body === 'string') headers.set('content-type', 'application/json')
  return fetch(origin + path, { ...init, headers })
}
const ownerHeaders = (extra: Record<string, string> = {}) => ({ cookie: `studio_access=${access}`, ...extra })
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => request(path, { method: 'POST', headers: { ...ownerHeaders(), 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

beforeAll(async () => {
  savedEnv = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY, STUDIO_ADMIN_USER_ID: process.env.STUDIO_ADMIN_USER_ID, NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL, APP_ORIGIN: process.env.APP_ORIGIN, GUEST_UPLOAD_BRIDGE_SECRET: process.env.GUEST_UPLOAD_BRIDGE_SECRET }
  Object.assign(process.env, { SUPABASE_URL: BASE, SUPABASE_ANON_KEY: 'anon-test', STUDIO_ADMIN_USER_ID: OWNER, NODE_ENV: 'production', GUEST_UPLOAD_BRIDGE_SECRET: 'test-bridge-secret-test-bridge-secret' })
  await start()
})
afterAll(async () => { await stop(); for (const [k, v] of Object.entries(savedEnv)) v === undefined ? delete process.env[k] : process.env[k] = v })
beforeEach(() => { calls = []; publicMode = 'valid'; currentProject = structuredClone(project); usernameFree = true; failPhotoInsert = false; failStorageDelete = false; projectDeleted = false; process.env.GUEST_UPLOAD_BRIDGE_SECRET = 'test-bridge-secret-test-bridge-secret'; delete process.env.VERCEL; delete process.env.APP_ORIGIN })

describe('studio server API', () => {
  test('anonymous requests cannot access owner list/get or mutate actions', async () => {
    for (const [path, init] of [
      ['/api/studio?action=list', {}], ['/api/studio?action=get&projectId=project-1', {}],
      ['/api/studio?action=save', { method: 'POST', body: '{}' }], ['/api/studio?action=publish', { method: 'POST', body: '{}' }],
      ['/api/studio?action=revoke', { method: 'POST', body: '{}' }], ['/api/studio?action=deleteProject', { method: 'POST', body: JSON.stringify({ projectId: 'project-1', confirmUsername: 'our-day' }) }], ['/api/studio?action=upload&projectId=project-1', { method: 'POST', body: Buffer.from([255,216,255]), headers: { 'content-type': 'image/jpeg' } }],
      ['/api/studio?action=ownerPhoto&projectId=project-1&photoId=photo-1', {}],
    ] as Array<[string, RequestInit]>) { const r = await request(path, init); expect(r.status).toBe(401) }
    expect(calls).toHaveLength(0)
  })

  test('cross-origin and cross-site mutation is denied before any upstream fetch', async () => {
    const r = await request('/api/studio?action=login', { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'pw' }) })
    expect(r.status).toBe(403); expect(calls).toHaveLength(0)
  })

  test('valid owner auth forwards JWT to RLS and strips private storage metadata', async () => {
    const r = await request('/api/studio?action=get&projectId=project-1', { headers: ownerHeaders() }); const body = await r.json() as any
    expect(r.status).toBe(200); expect(body.data.owner_id).toBeUndefined(); expect(body.data.storage_path).toBeUndefined(); expect(body.data.photos[0].url).toContain('ownerPhoto')
    const api = calls.find((x) => x.url.includes('/rest/v1/projects')); expect(bearer(api?.init)).toBe(access); expect(bearer(api?.init)).not.toBe('service-role')
  })

  test('non-owner JWT is denied for private delete before any database request', async () => {
    const r = await request('/api/studio?action=deleteProject', { method: 'POST', headers: { cookie: 'studio_access=other-token', 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', confirmUsername: 'our-day' }) }); expect(r.status).toBe(403); expect(calls.some((x) => x.url.endsWith('/auth/v1/user'))).toBe(true); expect(calls.some(x => x.url.includes('/rest/') || x.url.includes('/storage/'))).toBe(false)
  })

  test('login sets secure HttpOnly cookies and never returns tokens', async () => {
    const r = await request('/api/studio?action=login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'pw' }) }); const b = await r.json() as any
    expect(r.status).toBe(200); expect(b.data.user.id).toBe(OWNER); expect(JSON.stringify(b)).not.toContain(access); expect(r.headers.get('set-cookie')).toContain('HttpOnly'); expect(r.headers.get('set-cookie')).toContain('Secure'); expect(r.headers.get('set-cookie')).toContain('SameSite=Lax')
  })

  test('refresh replaces access and refresh cookies, then uses refreshed JWT for RLS', async () => {
    const r = await request('/api/studio?action=list', { headers: { cookie: 'studio_access=expired; studio_refresh=old-refresh' } }); const b = await r.json() as any
    expect(r.status).toBe(200); expect(b.data.length).toBeGreaterThan(0); expect(r.headers.get('set-cookie')).toContain('refreshed-access'); expect(r.headers.get('set-cookie')).toContain('refreshed-refresh'); expect(bearer(calls.find((x) => x.url.includes('/rest/v1/projects'))?.init)).toBe('refreshed-access')
  })

  test('logout calls fixed upstream endpoint and clears both cookies', async () => {
    const r = await post('/api/studio?action=logout', {}); expect(r.status).toBe(200); expect(calls.some((x) => x.url.includes('/auth/v1/logout'))).toBe(true); expect(r.headers.get('set-cookie')).toContain('studio_access=;'); expect(r.headers.get('set-cookie')).toContain('studio_refresh=;')
  })

  test('username-only public projects stay redacted, and old key-bearing links remain compatible', async () => {
    const r = await request('/api/studio?action=publicProject&username=our-day'); const b = await r.json() as any; const p = b.data
    expect(r.status).toBe(200); for (const key of ['customer_name','customer_email','customer_phone','private_notes']) expect(p[key]).toBe(''); for (const key of ['owner_id','storage_path','path','project_photos']) expect(p[key]).toBeUndefined(); expect(p.public_key).toBeNull(); expect(p.photos[0]).toEqual({ id: 'photo-1', caption: 'one', position: 0, url: expect.stringContaining('publicPhoto') }); expect(p.photos[0].url).not.toContain('key=')
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({ p_username: 'our-day', p_public_key: null })
    const legacy = await request('/api/studio?action=publicProject&username=our-day&key=share-key'); const oldProject = (await legacy.json() as any).data
    expect(legacy.status).toBe(200); expect(oldProject.photos[0].url).toContain('key=share-key'); expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({ p_username: 'our-day', p_public_key: 'share-key' })
  })

  test('guest endpoint forwards only server identity and preserves upstream share key', async () => {
    process.env.VERCEL = '1'; const r = await request('/api/studio?action=guest', { method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.5', origin: `https://${new URL(origin).host}`, 'content-type': 'application/json' }, body: JSON.stringify({ input: { title: 'Guest', username: 'guest-abc', customer_name: 'C', customer_email: 'c@example.com', customer_phone: '', person_a: 'A', person_b: 'B', parent_a: '', parent_b: '', event_date: '2030-01-01', event_time: '12:00', venue: 'Venue', message: 'Welcome', map_url: '', template: 'thazin', theme: 'sage', project_type: 'wedding', owner_id: 'attacker', private_notes: 'secret' }, photos: [{ dataUrl: 'data:image/jpeg;base64,/9j/AA==' }] }) }); const b = await r.json() as any
    expect(r.status).toBe(201); expect(b.data.public_key).toBe('guest-key'); const upstream = calls.find((x) => x.url.includes('guest-invitation')); expect(upstream?.init?.headers && new Headers(upstream.init.headers).get('x-forwarded-for')).toBe('203.0.113.5'); expect(new Headers(upstream?.init?.headers).get('x-invitation-upload-bridge')).toBe('test-bridge-secret-test-bridge-secret'); expect(JSON.stringify(upstream?.init?.body)).not.toContain('owner_id'); expect(JSON.stringify(upstream?.init?.body)).not.toContain('private_notes')
  })

  test('proxied upload start strips private fields and returns metadata, not a Storage capability', async () => {
    process.env.VERCEL = '1'
    const r = await request('/api/studio?action=guestUploadStart', { method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.5', origin: `https://${new URL(origin).host}`, 'content-type': 'application/json' }, body: JSON.stringify({ input: { title: 'Guest', person_a: 'A', person_b: 'B', event_date: '2030-01-01', event_time: '12:00', venue: 'Hall', message: 'Welcome', template: 'thazin', theme: 'sage', project_type: 'wedding', customer_name: 'PRIVATE', private_notes: 'CANARY', owner_id: 'attacker' }, photos: [{ size: 4_490_000, type: 'image/png', dataUrl: 'MUST_NOT_FORWARD', path: 'attacker/path' }] }) })
    const b = await r.json() as any
    const upstream = calls.find(x => x.url.includes('/functions/v1/guest-upload'))
    const sent = JSON.parse(String(upstream?.init?.body))
    expect(r.status).toBe(201)
    expect(b.data.sessionId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(b.data.uploads[0]).toEqual({ photoId: '00000001-bbbb-4bbb-8bbb-bbbbbbbbbbbb', contentType: 'image/png', size: 4_490_000 })
    expect(JSON.stringify(b)).not.toMatch(/signedUrl|supabase\.example|storage\/v1/)
    expect(sent.action).toBe('start')
    expect(new Headers(upstream?.init?.headers).get('x-invitation-upload-bridge')).toBe('test-bridge-secret-test-bridge-secret')
    expect(JSON.stringify(b)).not.toContain('test-bridge-secret')
    expect(sent.input.customer_name).toBeUndefined(); expect(sent.input.private_notes).toBeUndefined(); expect(sent.input.owner_id).toBeUndefined()
    expect(sent.photos).toEqual([{ size: 4_490_000, type: 'image/png' }])
    expect(JSON.stringify(sent)).not.toContain('MUST_NOT_FORWARD')
    expect(new Headers(upstream?.init?.headers).get('authorization')).toBe('Bearer anon-test')
  })

  test('guest file bytes go raw through Vercel to the protected Edge bridge at 4,490,000 bytes', async () => {
    process.env.VERCEL = '1'
    const bytes = Buffer.alloc(4_490_000)
    bytes.set([0xff, 0xd8, 0xff])
    const r = await request('/api/studio?action=guestUploadFile', { method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.5', origin: `https://${new URL(origin).host}`, 'content-type': 'image/jpeg', 'x-guest-session-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x-guest-session-token': 'a'.repeat(64), 'x-guest-photo-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, body: bytes as unknown as BodyInit })
    const body = await r.json() as any
    const upstream = calls.find(x => x.url.includes('/functions/v1/guest-upload') && new Headers(x.init?.headers).get('x-invitation-upload-action') === 'upload')
    expect(r.status).toBe(200)
    expect(body.data).toEqual({ uploaded: true })
    expect(upstream).toBeTruthy()
    expect(Buffer.from(upstream?.init?.body as any).length).toBe(4_490_000)
    expect(new Headers(upstream?.init?.headers).get('x-invitation-upload-session-id')).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(new Headers(upstream?.init?.headers).get('x-invitation-upload-session-token')).toBe('a'.repeat(64))
    expect(new Headers(upstream?.init?.headers).get('x-invitation-upload-bridge')).toBe('test-bridge-secret-test-bridge-secret')
    expect(JSON.stringify(body)).not.toMatch(/supabase|signedUrl|storage\/v1/)
  })

  test('guest Vercel proxy rejects a 4,490,001-byte body before calling Supabase', async () => {
    process.env.VERCEL = '1'
    const before = calls.filter(x => x.url.includes('/functions/v1/guest-upload')).length
    const bytes = Buffer.alloc(4_490_001, 1)
    const r = await request('/api/studio?action=guestUploadFile', { method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.5', origin: `https://${new URL(origin).host}`, 'content-type': 'image/jpeg', 'x-guest-session-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x-guest-session-token': 'a'.repeat(64), 'x-guest-photo-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, body: bytes as unknown as BodyInit })
    expect(r.status).toBe(413)
    expect(calls.filter(x => x.url.includes('/functions/v1/guest-upload'))).toHaveLength(before)
  })

  test('proxied upload finalization sanitizes storage paths and keeps the published share key', async () => {
    process.env.VERCEL = '1'
    const r = await request('/api/studio?action=guestUploadFinalize', { method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.5', origin: `https://${new URL(origin).host}`, 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionToken: 'a'.repeat(64), path: 'attacker/path' }) })
    const b = await r.json() as any
    expect(r.status).toBe(201); expect(b.data.public_key).toBe('guest-key'); expect(b.data.photos[0].url).toContain('publicPhoto')
    expect(b.data.photos[0].storage_path).toBeUndefined(); expect(JSON.stringify(b)).not.toContain('private/hidden.jpg')
    const upstream = JSON.parse(String(calls.find(x => x.url.includes('/functions/v1/guest-upload'))?.init?.body))
    expect(upstream).toEqual({ action: 'finalize', sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionToken: 'a'.repeat(64) })
  })

  test('guest APIs fail closed when their server-only Edge bridge secret is not configured', async () => {
    delete process.env.GUEST_UPLOAD_BRIDGE_SECRET
    const start = await request('/api/studio?action=guestUploadStart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: {}, photos: [] }) })
    const legacy = await request('/api/studio?action=guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(start.status).toBe(503); expect(legacy.status).toBe(503)
    expect(calls.some(x => x.url.includes('/functions/v1/guest-upload'))).toBe(false)
    expect(calls.some(x => x.url.includes('/functions/v1/guest-invitation'))).toBe(false)
  })

  test('legacy base64 guest endpoint retains the 4.5 MiB request guard', async () => {
    const payload = Buffer.alloc(4_500_001, 65)
    const r = await request('/api/studio?action=guest', { method: 'POST', headers: { origin: `https://${new URL(origin).host}`, 'content-type': 'application/json' }, body: payload as unknown as BodyInit })
    expect(r.status).toBe(413)
    expect(calls.some(x => x.url.includes('/functions/v1/guest-invitation'))).toBe(false)
  })

  test('invalid or revoked public shares return 404', async () => {
    const original = mockFetch
    publicMode = 'missing'; const r = await request('/api/studio?action=publicProject&username=missing&key=bad'); expect(r.status).toBe(404)
    expect(original).toBe(mockFetch)
  })

  test('upload rejects invalid MIME/magic and rejects payloads above 4,490,000 bytes', async () => {
    const cases: Array<[string, Buffer, number]> = [['text/plain', Buffer.from('x'), 400], ['image/png', Buffer.from([255,216,255]), 400], ['image/jpeg', Buffer.alloc(4_490_001, 1), 413]]
    for (const [type, bytes, expected] of cases) {
      const r = await request('/api/studio?action=upload&projectId=project-1', { method: 'POST', headers: { ...ownerHeaders(), 'content-type': type }, body: bytes as unknown as BodyInit }); expect(r.status).toBe(expected)
    }
  })

  test('server accepts a 4,490,000-byte image payload through the authenticated upload path', async () => {
    const bytes = Buffer.alloc(4_490_000)
    bytes.set([0xff, 0xd8, 0xff])
    const r = await request('/api/studio?action=upload&projectId=project-1', { method: 'POST', headers: { ...ownerHeaders(), 'content-type': 'image/jpeg' }, body: bytes as unknown as BodyInit })
    expect(r.status).toBe(200)
    expect(calls.some(x => x.url.includes('/storage/v1/object/project-photos/'))).toBe(true)
  })

  test('unsupported action and method are rejected and responses are no-store JSON', async () => {
    const r = await request('/api/studio?action=nope'); expect(r.status).toBe(404); expect(r.headers.get('cache-control')).toContain('no-store'); expect(r.headers.get('content-type')).toContain('application/json')
    const m = await request('/api/studio?action=list', { method: 'POST', headers: ownerHeaders() }); expect(m.status).toBe(405)
  })

  test('OPTIONS is a no-store JSON preflight response', async () => { const r = await request('/api/studio?action=list', { method: 'OPTIONS' }); expect(r.status).toBe(204); expect(r.headers.get('cache-control')).toContain('no-store') })
})

describe('server gateway behavior preservation', () => {
  test('save assigns the verified owner, strips injected ownership and keeps drafts private', async () => {
    const r = await post('/api/studio?action=save', { input: { ...project, owner_id: 'attacker', status: 'published', public_key: 'injected' } });
    const b = await r.json() as any;
    expect(r.status).toBe(200);
    expect(b.data.status).toBe('draft');
    expect(b.data.public_key).toBeNull();
    const write = calls.find(x => x.url.includes('/rest/v1/projects') && x.init?.method === 'POST');
    const row = JSON.parse(String(write?.init?.body));
    expect(row.owner_id).toBe(OWNER);
    expect(row.project_photos).toBeUndefined();
    expect(bearer(write?.init)).toBe(access);
  });

  test('duplicate usernames remain a useful validation error without attempting a write', async () => {
    usernameFree = false;
    const r = await post('/api/studio?action=save', { input: project });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'Username is already in use' });
    expect(calls.some(x => x.url.includes('/rest/v1/projects') && x.init?.method === 'POST')).toBe(false);
  });

  test('permanent deletion requires the exact current username confirmation before any destructive action', async () => {
    for (const confirmation of ['', 'another-name']) {
      const r = await post('/api/studio?action=deleteProject', { projectId: project.id, confirmUsername: confirmation })
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ error: 'Username confirmation does not match' })
      expect(calls.some(x => x.url.endsWith('/rpc/revoke_project'))).toBe(false)
      expect(calls.some(x => x.url.includes('/storage/v1/object/') && x.init?.method === 'DELETE')).toBe(false)
      expect(calls.some(x => x.url.includes('/rest/v1/projects') && x.init?.method === 'DELETE')).toBe(false)
      calls = []
    }
  })

  test('owner can hard-delete a published invitation after revoking and cleaning only its own photos', async () => {
    currentProject = { ...structuredClone(project), status: 'published', public_key: 'share-key' }
    const r = await post('/api/studio?action=deleteProject', { projectId: project.id, confirmUsername: 'our-day' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ data: { deleted: true } })
    const revokeIndex = calls.findIndex(x => x.url.endsWith('/rpc/revoke_project'))
    const assetIndex = calls.findIndex(x => x.url.includes('/storage/v1/object/project-photos') && x.init?.method === 'DELETE')
    const deleteIndex = calls.findIndex(x => x.url.includes('/rest/v1/projects') && x.init?.method === 'DELETE')
    expect(revokeIndex).toBeGreaterThanOrEqual(0)
    expect(assetIndex).toBeGreaterThan(revokeIndex)
    expect(deleteIndex).toBeGreaterThan(assetIndex)
    const assetCall = calls[assetIndex]
    expect(JSON.parse(String(assetCall.init?.body)).prefixes).toEqual([`${OWNER}/project-1/photo-1.jpg`])
    expect(bearer(assetCall.init)).toBe(access)
    const dbDelete = calls[deleteIndex]
    expect(new URL(dbDelete.url).searchParams.get('owner_id')).toBe(`eq.${OWNER}`)
    expect(bearer(dbDelete.init)).toBe(access)
  })

  test('failed photo storage cleanup leaves the invitation row intact and reports the completed revoke', async () => {
    currentProject = { ...structuredClone(project), status: 'published', public_key: 'share-key' }
    failStorageDelete = true
    const r = await post('/api/studio?action=deleteProject', { projectId: project.id, confirmUsername: 'our-day' })
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ error: 'Sharing was stopped, but deletion did not complete. Please retry.' })
    expect(calls.some(x => x.url.endsWith('/rpc/revoke_project'))).toBe(true)
    expect(calls.some(x => x.url.includes('/rest/v1/projects') && x.init?.method === 'DELETE')).toBe(false)
    expect(projectDeleted).toBe(false)
  })

  test('owner publish and revoke still use existing RLS-scoped RPCs and return updated state', async () => {
    const published = await post('/api/studio?action=publish', { projectId: project.id });
    const p = await published.json() as any;
    expect(published.status).toBe(200);
    expect(p.data.status).toBe('published');
    expect(p.data.public_key).toBe('new-share-key');
    const revoked = await post('/api/studio?action=revoke', { projectId: project.id });
    expect(revoked.status).toBe(200);
    expect((await revoked.json() as any).data.status).toBe('draft');
    for (const action of ['publish_project', 'revoke_project']) {
      const call = calls.find(x => x.url.endsWith(`/rpc/${action}`));
      expect(bearer(call?.init)).toBe(access);
      expect(JSON.parse(String(call?.init?.body))).toEqual({ p_project_id: project.id });
    }
  });

  test('binary upload, photo metadata and deletion remain bound to owner and project', async () => {
    const r = await request(`/api/studio?action=upload&projectId=${project.id}`, { method: 'POST', headers: ownerHeaders({ 'content-type': 'image/jpeg' }), body: new Uint8Array([255,216,255,0]) });
    const p = (await r.json() as any).data;
    expect(r.status).toBe(200);
    expect(p.photos.length).toBe(2);
    const rowCall = calls.find(x => x.url.endsWith('/rest/v1/project_photos') && x.init?.method === 'POST');
    const row = JSON.parse(String(rowCall?.init?.body));
    expect(row.project_id).toBe(project.id);
    expect(row.storage_path).toStartWith(`${OWNER}/${project.id}/`);
    expect(row.position).toBe(1);
    expect(p.photos[1].url).toContain('ownerPhoto');
    const removed = await post('/api/studio?action=removePhoto', { projectId: project.id, photoId: row.id });
    expect(removed.status).toBe(200);
    expect((await removed.json() as any).data.photos).toHaveLength(1);
  });

  test('failed photo metadata insert removes only the just-uploaded object and hides DB errors', async () => {
    failPhotoInsert = true;
    const r = await request(`/api/studio?action=upload&projectId=${project.id}`, { method: 'POST', headers: ownerHeaders({ 'content-type': 'image/jpeg' }), body: new Uint8Array([255,216,255,0]) });
    expect(r.status).toBe(400);
    expect(JSON.stringify(await r.json())).not.toContain('canary');
    const cleanup = calls.find(x => x.url.includes('/storage/v1/object/') && x.init?.method === 'DELETE');
    expect(cleanup).toBeDefined();
    expect(bearer(cleanup?.init)).toBe(access);
    expect(JSON.parse(String(cleanup?.init?.body)).prefixes).toHaveLength(1);
  });

  test('guest share lookup falls back by username and retains legacy key validation', async () => {
    publicMode = 'guest-fallback';
    const r = await request('/api/studio?action=publicProject&username=guest-abc');
    expect(r.status).toBe(200);
    const p = (await r.json() as any).data;
    expect(p.username).toBe('guest-abc');
    expect(p.public_key).toBeNull();
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({ p_username: 'guest-abc', p_public_key: null });
    expect(calls.some(x => x.url.endsWith('/rpc/guest_public_project'))).toBe(true);
    expect(calls.some(x => x.url.includes('/auth/'))).toBe(false);
    const legacy = await request('/api/studio?action=publicProject&username=guest-abc&key=guest-key');
    expect(legacy.status).toBe(200); expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({ p_username: 'guest-abc', p_public_key: 'guest-key' });
  });

  test('both public and owner photos use binary same-origin no-store delivery', async () => {
    const publicPhoto = await request('/api/studio?action=publicPhoto&username=our-day&photo=photo-1');
    expect(publicPhoto.status).toBe(200);
    expect(publicPhoto.headers.get('cache-control')).toContain('no-store');
    expect(new Uint8Array(await publicPhoto.arrayBuffer())).toEqual(new Uint8Array([1,2]));
    expect(new URL(calls.at(-1)!.url).searchParams.has('key')).toBe(false);
    const oldPhoto = await request('/api/studio?action=publicPhoto&username=our-day&key=share-key&photo=photo-1');
    expect(oldPhoto.status).toBe(200); expect(new URL(calls.at(-1)!.url).searchParams.get('key')).toBe('share-key');
    const ownerPhoto = await request(`/api/studio?action=ownerPhoto&projectId=${project.id}&photoId=photo-1`, { headers: ownerHeaders() });
    expect(ownerPhoto.status).toBe(200);
    expect(ownerPhoto.headers.get('content-type')).toContain('image/jpeg');
    expect(new Uint8Array(await ownerPhoto.arrayBuffer())).toEqual(new Uint8Array([255,216,255]));
  });

  test('Vercel guest creation rejects missing platform identity rather than a shared proxy address', async () => {
    process.env.VERCEL = '1';
    const r = await request('/api/studio?action=guest', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5', 'x-real-ip': '203.0.113.5' }, body: JSON.stringify({ input: { title: 'Guest' }, photos: [{ dataUrl: 'data:image/jpeg;base64,/9j/' }] }) });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'Client identity unavailable' });
    expect(calls).toHaveLength(0);
  });

  test('missing server configuration fails closed instead of using browser/local data', async () => {
    delete process.env.STUDIO_ADMIN_USER_ID;
    try {
      const r = await request('/api/studio?action=session');
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: 'Service unavailable' });
      expect(calls).toHaveLength(0);
    } finally { process.env.STUDIO_ADMIN_USER_ID = OWNER; }
  });
});
