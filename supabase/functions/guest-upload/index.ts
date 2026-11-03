import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_PHOTOS = 3
const MAX_PHOTO_BYTES = 4_490_000
const MAX_STORED_PHOTO_BYTES = MAX_PHOTO_BYTES
const MAX_TOTAL_BYTES = 27 * 1024 * 1024
const MAX_CONTROL_BYTES = 64 * 1024
const BUCKET = 'project-photos'
const inputKeys = ['title','person_a','person_b','parent_a','parent_b','event_date','event_time','venue','message','map_url','template','theme','project_type'] as const
const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', 'Content-Type': 'application/json', Vary: 'Origin' }
const response = (body: unknown, status = 200, origin?: string) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { ...headers, ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type' } : {}) } })
const fail = (message: string, status = 400, origin?: string) => response({ error: message }, status, origin)

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || 'https://love-birds-mm.vercel.app').split(',').map(x => x.trim()).filter(Boolean)
  return origin && configured.includes(origin) ? origin : (origin ? null : (configured.length === 1 ? configured[0] : null))
}
function validBridgeSecret(request: Request) {
  const expected = Deno.env.get('GUEST_UPLOAD_BRIDGE_SECRET') || ''
  const supplied = request.headers.get('x-invitation-upload-bridge') || ''
  if (expected.length < 32 || supplied.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i)
  return mismatch === 0
}
function ipAddress(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip')?.trim() || request.headers.get('x-real-ip')?.trim() || null
}
const ipSalt = () => Deno.env.get('IP_HASH_SALT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
async function hash(value: string, purpose: string) {
  const salt = ipSalt()
  if (!salt) throw new Error('Upload service is not configured')
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}:v1:${value}:${salt}`))
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('')
}
function randomHex(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map(x => x.toString(16).padStart(2, '0')).join('')
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_CONTROL_BYTES) throw new Error('Request too large')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Request body required')
  const decoder = new TextDecoder()
  let raw = '', total = 0
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    total += chunk.value.byteLength
    if (total > MAX_CONTROL_BYTES) throw new Error('Request too large')
    raw += decoder.decode(chunk.value, { stream: true })
  }
  raw += decoder.decode()
  const value = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid payload')
  return value as Record<string, unknown>
}
async function readBinary(request: Request, limit = MAX_PHOTO_BYTES): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > limit) throw Object.assign(new Error('Request too large'), { status: 413 })
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Request body required')
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    total += chunk.value.byteLength
    if (total > limit) throw Object.assign(new Error('Request too large'), { status: 413 })
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}
function field(input: Record<string, unknown>, key: string, max: number, required = false) {
  const value = input[key] ?? ''
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Invalid ${key}`)
  return value
}
function cleanInput(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid invitation input')
  const source = raw as Record<string, unknown>
  const clean: Record<string, string> = {}
  for (const key of inputKeys) clean[key] = field(source, key, key === 'message' ? 350 : key === 'map_url' ? 1200 : key === 'title' ? 120 : key.startsWith('parent_') ? 180 : key.startsWith('person_') ? 60 : 220, ['title','person_a','person_b','venue','message','event_date','event_time'].includes(key))
  if (Object.keys(source).some(key => !(inputKeys as readonly string[]).includes(key) && key !== 'schedule')) throw new Error('Unexpected invitation fields')
  const dateMatch = clean.event_date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = dateMatch ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))) : null
  if (!date || date.getUTCFullYear() !== Number(dateMatch![1]) || date.getUTCMonth() !== Number(dateMatch![2]) - 1 || date.getUTCDate() !== Number(dateMatch![3]) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean.event_time)) throw new Error('Invalid date or time')
  if (clean.map_url && !/^https:\/\/(www\.google\.com|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl)(\/[^\s]*)?$/i.test(clean.map_url)) throw new Error('Invalid map URL')
  if (!['thazin','noir','rose'].includes(clean.template) || !['sage','midnight','rose','blue'].includes(clean.theme) || clean.project_type !== 'wedding') throw new Error('Invalid design')
  const rawSchedule = source.schedule ?? []
  if (!Array.isArray(rawSchedule) || rawSchedule.length > 4) throw new Error('Invalid schedule')
  const schedule = rawSchedule.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid schedule')
    const value = item as Record<string, unknown>
    if (typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || typeof value.label !== 'string' || value.label.length > 100 || !value.label.trim()) throw new Error('Invalid schedule')
    return { time: value.time, label: value.label }
  })
  return { input: clean, schedule }
}
function extensionFor(mime: string) { return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : '' }
function validObjectPath(sessionId: string, file: Record<string, unknown>) {
  const extension = extensionFor(String(file.mime_type || ''))
  return !!extension && typeof file.id === 'string' && typeof file.path === 'string' && file.path === `guest-staging/${sessionId}/${file.id}.${extension}`
}
function hasMagic(mime: string, bytes: Uint8Array) {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i) => bytes[i] === v)
  if (mime === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP'
  return false
}
function trustedPaths(sessionId: string, files: unknown): string[] {
  if (!Array.isArray(files)) return []
  return files.filter((file): file is Record<string, unknown> => !!file && typeof file === 'object' && !Array.isArray(file) && validObjectPath(sessionId, file)).map(file => file.path as string)
}
async function removePaths(service: any, sessionId: string, files: unknown) {
  const paths = trustedPaths(sessionId, files)
  if (paths.length) await service.storage.from(BUCKET).remove(paths)
}
async function cleanupExpired(service: any) {
  const listed = await service.rpc('list_expired_guest_upload_sessions', { p_limit: 10 })
  if (listed.error || !Array.isArray(listed.data)) return 0
  let cleaned = 0
  for (const session of listed.data) {
    if (!session || typeof session.id !== 'string' || !/^[0-9a-f-]{36}$/.test(session.id)) continue
    const paths = trustedPaths(session.id, session.files)
    if (paths.length) {
      const removed = await service.storage.from(BUCKET).remove(paths)
      if (removed.error) continue
    }
    const expired = await service.rpc('expire_guest_upload_session', { p_session_id: session.id })
    if (!expired.error && expired.data === true) cleaned++
  }
  return cleaned
}
function client() {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !key) throw new Error('Upload service is not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}
function sessionSecret(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error('Upload session not found')
  return value
}
function sessionId(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) throw new Error('Upload session not found')
  return value
}

async function startUpload(service: any, body: Record<string, unknown>, ip: string) {
  const { input, schedule } = cleanInput(body.input)
  if (!Array.isArray(body.photos) || body.photos.length < 1 || body.photos.length > MAX_PHOTOS) throw new Error('Choose 1–3 photos')
  const id = crypto.randomUUID()
  const token = randomHex(32)
  const secretHash = await hash(token, 'guest-upload-session')
  // Keep pending sessions short-lived; the token authorizes only server-proxied uploads for this session.
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const files = body.photos.map((photo, position) => {
    if (!photo || typeof photo !== 'object' || Array.isArray(photo)) throw new Error('Invalid photo metadata')
    const value = photo as Record<string, unknown>
    const size = value.size
    const mime = value.type
    if (!Number.isSafeInteger(size) || Number(size) < 1 || Number(size) > MAX_PHOTO_BYTES) throw new Error('Photo exceeds 4.49 MB')
    if (typeof mime !== 'string' || !['image/jpeg','image/png','image/webp'].includes(mime)) throw new Error('Photo MIME type not allowed')
    const photoId = crypto.randomUUID()
    const path = `guest-staging/${id}/${photoId}.${extensionFor(mime)}`
    return { id: photoId, path, mime_type: mime, size: Number(size), position }
  })
  const ipHash = await hash(ip, 'guest-invitation-ip')
  const created = await service.rpc('create_guest_upload_session', {
    p_session_id: id, p_secret_hash: secretHash, p_ip_hash: ipHash,
    p_input: input, p_schedule: schedule, p_files: files, p_expires_at: expiresAt,
  })
  if (created.error || !created.data) {
    const message = created.error?.message || 'Unable to start upload'
    if (/rate limit|daily limit/i.test(message)) throw Object.assign(new Error('Rate limit exceeded'), { status: 429 })
    throw new Error('Unable to start upload')
  }
  const uploads = files.map(file => ({ photoId: file.id, contentType: file.mime_type, size: file.size }))
  return { sessionId: id, sessionToken: token, expiresAt, uploads }
}

async function uploadPhoto(service: any, request: Request) {
  const id = sessionId(request.headers.get('x-invitation-upload-session-id'))
  const token = sessionSecret(request.headers.get('x-invitation-upload-session-token'))
  const photoId = sessionId(request.headers.get('x-invitation-upload-photo-id'))
  const mime = String(request.headers.get('content-type') || '').split(';')[0].toLowerCase()
  if (!['image/jpeg','image/png','image/webp'].includes(mime)) throw new Error('Photo MIME type not allowed')
  const secretHash = await hash(token, 'guest-upload-session')
  const found = await service.rpc('get_guest_upload_session', { p_session_id: id, p_secret_hash: secretHash })
  if (found.error) throw new Error('Unable to verify upload session')
  const session = found.data as Record<string, unknown> | null
  if (!session) throw new Error('Upload session not found')
  if (session.status !== 'pending' || typeof session.expires_at !== 'string' || Date.parse(session.expires_at) <= Date.now()) throw new Error('Upload session expired')
  if (!Array.isArray(session.files)) throw new Error('Invalid upload session')
  const file = session.files.find((value: any) => value && typeof value === 'object' && value.id === photoId)
  if (!file || !validObjectPath(id, file)) throw new Error('Invalid upload authorization')
  const expected = file as Record<string, unknown>
  const expectedType = String(expected.mime_type || '')
  const expectedSize = Number(expected.size)
  if (mime !== expectedType || !Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > MAX_PHOTO_BYTES) throw new Error('Photo size or MIME type does not match authorization')
  const bytes = await readBinary(request)
  if (bytes.length !== expectedSize) throw new Error('Photo size or MIME type does not match authorization')
  if (!hasMagic(mime, bytes)) throw new Error('Photo contents do not match MIME type')
  const upload = await service.storage.from(BUCKET).upload(String(expected.path), new Blob([bytes], { type: mime }), { upsert: false, contentType: mime, cacheControl: '0' })
  if (upload.error) {
    const message = String(upload.error.message || '')
    if (Number(upload.error.statusCode) === 409 || /already exists|duplicate/i.test(message)) throw Object.assign(new Error('Photo already uploaded'), { status: 409 })
    throw new Error('Unable to upload photo')
  }
  return { uploaded: true }
}

async function finalizeUpload(service: any, body: Record<string, unknown>) {
  const id = sessionId(body.sessionId)
  const token = sessionSecret(body.sessionToken)
  const secretHash = await hash(token, 'guest-upload-session')
  const found = await service.rpc('get_guest_upload_session', { p_session_id: id, p_secret_hash: secretHash })
  if (found.error) throw new Error('Unable to verify upload session')
  const session = found.data as Record<string, unknown> | null
  if (!session) throw new Error('Upload session not found')
  if (session.status === 'published') {
    const prior = await service.rpc('finalize_guest_upload_session', { p_session_id: id, p_secret_hash: secretHash })
    if (prior.error || !prior.data) throw new Error('Unable to confirm invitation')
    return prior.data
  }
  if (session.status !== 'pending' || typeof session.expires_at !== 'string' || Date.parse(session.expires_at) <= Date.now()) throw new Error('Upload session expired')
  try {
    if (!Array.isArray(session.files) || session.files.length < 1 || session.files.length > MAX_PHOTOS) throw new Error('Invalid upload session')
    let total = 0
    for (const file of session.files) {
      if (!file || typeof file !== 'object' || Array.isArray(file) || !validObjectPath(id, file as Record<string, unknown>)) throw new Error('Invalid upload authorization')
      const expected = file as Record<string, unknown>
      const mime = String(expected.mime_type || '')
      const size = Number(expected.size)
      if (!['image/jpeg','image/png','image/webp'].includes(mime) || !Number.isSafeInteger(size) || size < 1 || size > MAX_STORED_PHOTO_BYTES) throw new Error('Invalid photo metadata')
      const result = await service.storage.from(BUCKET).download(String(expected.path))
      if (result.error || !result.data) throw new Error('A photo upload is missing')
      const blob = result.data as Blob
      if (blob.size !== size || blob.size > MAX_STORED_PHOTO_BYTES || blob.type.toLowerCase() !== mime) throw new Error('Photo size or MIME type does not match authorization')
      total += blob.size
      if (total > MAX_TOTAL_BYTES) throw new Error('Photos exceed 27 MiB combined')
      if (!hasMagic(mime, new Uint8Array(await blob.arrayBuffer()))) throw new Error('Photo contents do not match MIME type')
    }
  } catch (error) {
    const canceled = await service.rpc('cancel_guest_upload_session', { p_session_id: id, p_secret_hash: secretHash })
    if (canceled.data?.status === 'canceled') await removePaths(service, id, canceled.data.files)
    throw error
  }
  const published = await service.rpc('finalize_guest_upload_session', { p_session_id: id, p_secret_hash: secretHash })
  if (published.error || !published.data) throw new Error('Unable to publish invitation')
  return published.data
}

async function cancelUpload(service: any, body: Record<string, unknown>) {
  const id = sessionId(body.sessionId)
  const secretHash = await hash(sessionSecret(body.sessionToken), 'guest-upload-session')
  const result = await service.rpc('cancel_guest_upload_session', { p_session_id: id, p_secret_hash: secretHash })
  if (result.error) throw new Error('Unable to cancel upload')
  if (result.data?.status === 'canceled') await removePaths(service, id, result.data.files)
  return { canceled: result.data?.status === 'canceled' || result.data?.status === 'missing' }
}

Deno.serve(async request => {
  const origin = allowedOrigin(request)
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!validBridgeSecret(request)) return fail('Upload gateway authorization required', 403, origin || undefined)
  if (!ipSalt() || !Deno.env.get('SUPABASE_URL') || !secret) return fail('Upload service is not configured', 503)
  if (request.method === 'OPTIONS') return origin ? response({}, 204, origin) : fail('Origin not allowed', 403)
  if (!origin || request.method !== 'POST') return fail('Origin or method not allowed', 403)
  try {
    if (request.headers.get('x-invitation-upload-action') === 'upload') {
      const ip = ipAddress(request)
      if (!ip) return fail('Client identity unavailable', 400, origin)
      const result = await uploadPhoto(client(), request)
      return response(result, 201, origin)
    }
    const body = await readBody(request)
    const action = body.action
    if (!['start','finalize','cancel','cleanup'].includes(String(action))) throw new Error('Invalid upload action')
    const service = client()
    if (action === 'cleanup') return response({ cleanedSessions: await cleanupExpired(service) }, 200, origin)
    await cleanupExpired(service)
    const ip = ipAddress(request)
    if (!ip) return fail('Client identity unavailable', 400, origin)
    if (action === 'start') return response({ upload: await startUpload(service, body, ip) }, 201, origin)
    if (action === 'finalize') return response({ project: await finalizeUpload(service, body) }, 201, origin)
    return response({ result: await cancelUpload(service, body) }, 200, origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process upload'
    const status = Number((error as { status?: number })?.status) || (/not found/i.test(message) ? 404 : /rate limit/i.test(message) ? 429 : /too large/i.test(message) ? 413 : 400)
    return fail(message, status, origin)
  }
})
