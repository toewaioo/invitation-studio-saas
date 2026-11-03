import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PHOTO_MAX = 4_490_000
const MUSIC_MAX = 4_000_000
const TOTAL_MAX = 27 * 1024 * 1024
const CONTROL_MAX = 64 * 1024
const BUCKET = 'love-galaxy-media'
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MUSIC_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav'])
const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', 'Content-Type': 'application/json', Vary: 'Origin' }
const response = (body: unknown, status = 200, origin?: string) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { ...headers, ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type' } : {}) } })
const fail = (message: string, status = 400, origin?: string) => response({ error: message }, status, origin)

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  const configured = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('APP_ORIGIN') || 'https://love-birds-mm.vercel.app').split(',').map(value => value.trim()).filter(Boolean)
  return origin && configured.includes(origin) ? origin : (origin ? null : (configured.length === 1 ? configured[0] : null))
}
function validBridgeSecret(request: Request) {
  const expected = Deno.env.get('GUEST_UPLOAD_BRIDGE_SECRET') || ''
  const supplied = request.headers.get('x-invitation-upload-bridge') || ''
  if (expected.length < 32 || supplied.length !== expected.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index)
  return mismatch === 0
}
function client() {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !key) throw new Error('Love Galaxy service is not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}
const secretSalt = () => Deno.env.get('IP_HASH_SALT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
async function hash(value: string, purpose: string) {
  const salt = secretSalt()
  if (!salt) throw new Error('Love Galaxy service is not configured')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}:v1:${value}:${salt}`))
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}
function randomHex(length: number) {
  return [...crypto.getRandomValues(new Uint8Array(length))].map(value => value.toString(16).padStart(2, '0')).join('')
}
function validUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) }
function sessionId(value: unknown) { if (!validUuid(value)) throw new Error('Upload session not found'); return value }
function sessionToken(value: unknown) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error('Upload session not found'); return value }
async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > CONTROL_MAX) throw Object.assign(new Error('Request too large'), { status: 413 })
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Request body required')
  const chunks: Uint8Array[] = []; let total = 0
  for (;;) { const item = await reader.read(); if (item.done) break; total += item.value.byteLength; if (total > CONTROL_MAX) throw Object.assign(new Error('Request too large'), { status: 413 }); chunks.push(item.value) }
  const bytes = new Uint8Array(total); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const value = JSON.parse(new TextDecoder().decode(bytes))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid payload')
  return value as Record<string, unknown>
}
async function readBinary(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maxBytes) throw Object.assign(new Error('Request too large'), { status: 413 })
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Request body required')
  const chunks: Uint8Array[] = []; let total = 0
  for (;;) { const item = await reader.read(); if (item.done) break; total += item.value.byteLength; if (total > maxBytes) throw Object.assign(new Error('Request too large'), { status: 413 }); chunks.push(item.value) }
  const bytes = new Uint8Array(total); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}
function extension(mime: string, kind: 'photo' | 'music') {
  if (kind === 'photo') return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : ''
  return mime === 'audio/mpeg' ? 'mp3' : mime === 'audio/mp4' ? 'm4a' : mime === 'audio/aac' ? 'aac' : mime === 'audio/ogg' ? 'ogg' : ['audio/wav', 'audio/x-wav'].includes(mime) ? 'wav' : ''
}
function hasMagic(mime: string, bytes: Uint8Array) {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index) => bytes[index] === value)
  if (mime === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP'
  if (mime === 'audio/ogg') return bytes.length >= 4 && String.fromCharCode(...bytes.slice(0,4)) === 'OggS'
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WAVE'
  if (mime === 'audio/mp4') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4,8)) === 'ftyp'
  if (mime === 'audio/aac') return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0
  if (mime === 'audio/mpeg') return bytes.length >= 3 && ((String.fromCharCode(...bytes.slice(0,3)) === 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
  return false
}
function safeInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Love Galaxy input')
  const source = value as Record<string, unknown>
  if (Object.keys(source).some(key => !['title','ring_text_one','ring_text_two','music_track'].includes(key))) throw new Error('Unexpected Love Galaxy fields')
  const field = (key: string, max: number) => {
    const text = source[key]
    if (typeof text !== 'string' || !text.trim() || text.trim().length > max) throw new Error(`Invalid ${key}`)
    return text.trim()
  }
  const musicTrack = source.music_track
  if (musicTrack !== 'cosmic-orbit' && musicTrack !== 'custom') throw new Error('Invalid music choice')
  return { title: field('title', 120), ring_text_one: field('ring_text_one', 64), ring_text_two: field('ring_text_two', 64), music_track: musicTrack }
}
function validFileList(files: unknown) {
  if (!Array.isArray(files) || ![4,5].includes(files.length)) throw new Error('Choose exactly four photos')
  const selected = files.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid file metadata')
    const file = value as Record<string, unknown>
    const kind = file.kind
    const mime = file.type
    const size = file.size
    if (kind !== 'photo' && kind !== 'music') throw new Error('Invalid file kind')
    if (typeof mime !== 'string' || !((kind === 'photo' ? PHOTO_TYPES : MUSIC_TYPES).has(mime.toLowerCase()))) throw new Error('File MIME type not allowed')
    if (!Number.isSafeInteger(size) || Number(size) < 1 || Number(size) > (kind === 'photo' ? PHOTO_MAX : MUSIC_MAX)) throw new Error(kind === 'photo' ? 'Photo exceeds 4.49 MB' : 'Music exceeds 4 MB')
    if (index < 4 && kind !== 'photo') throw new Error('Choose exactly four photos')
    if (index === 4 && kind !== 'music') throw new Error('Invalid music selection')
    return { kind, mime_type: mime.toLowerCase(), size: Number(size), position: kind === 'photo' ? index : 4 }
  })
  if (selected.slice(0,4).some(file => file.kind !== 'photo') || new Set(selected.filter(file => file.kind === 'photo').map(file => file.position)).size !== 4) throw new Error('Choose exactly four photos')
  if (selected.filter(file => file.kind === 'music').length > 1) throw new Error('Choose one music file at most')
  return selected
}
function ipAddress(request: Request) { return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || null }
function validStagingPath(id: string, file: Record<string, unknown>) {
  const kind = file.kind === 'photo' ? 'photo' : file.kind === 'music' ? 'music' : null
  const ext = kind ? extension(String(file.mime_type || ''), kind) : ''
  return !!kind && !!ext && validUuid(file.id) && file.path === `love-galaxy-staging/${id}/${file.id}.${ext}`
}
function trustedPaths(id: string, files: unknown) {
  if (!Array.isArray(files)) return []
  return files.filter((value): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && validStagingPath(id, value as Record<string, unknown>)).map(value => value.path as string)
}
async function cleanupExpired(service: any) {
  const listed = await service.rpc('list_expired_love_galaxy_upload_sessions', { p_limit: 10 })
  if (listed.error || !Array.isArray(listed.data)) return 0
  let cleaned = 0
  for (const session of listed.data) {
    if (!session || !validUuid(session.id)) continue
    const paths = trustedPaths(session.id, session.files)
    if (paths.length) { const removed = await service.storage.from(BUCKET).remove(paths); if (removed.error) continue }
    const expired = await service.rpc('expire_love_galaxy_upload_session', { p_session_id: session.id })
    if (!expired.error && expired.data === true) cleaned++
  }
  return cleaned
}
async function startUpload(service: any, body: Record<string, unknown>, ip: string) {
  const input = safeInput(body.input)
  const files = validFileList(body.files)
  const musicCount = files.filter(file => file.kind === 'music').length
  if ((input.music_track === 'custom') !== (musicCount === 1)) throw new Error('Select one music file for custom music, or choose the included soundtrack.')
  const id = crypto.randomUUID(); const token = randomHex(32); const secretHash = await hash(token, 'love-galaxy-upload-session')
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const storedFiles = files.map(file => {
    const fileId = crypto.randomUUID(); const ext = extension(file.mime_type, file.kind)
    return { id: fileId, kind: file.kind, path: `love-galaxy-staging/${id}/${fileId}.${ext}`, mime_type: file.mime_type, size: file.size, position: file.position }
  })
  const ipHash = await hash(ip, 'love-galaxy-upload-ip')
  const created = await service.rpc('create_love_galaxy_upload_session', { p_session_id: id, p_secret_hash: secretHash, p_ip_hash: ipHash, p_input: input, p_files: storedFiles, p_expires_at: expiresAt })
  if (created.error || !created.data) {
    const message = String(created.error?.message || '')
    if (/rate limit|daily limit/i.test(message)) throw Object.assign(new Error('Rate limit exceeded'), { status: 429 })
    throw new Error('Unable to start Love Galaxy upload')
  }
  return { sessionId: id, sessionToken: token, expiresAt, uploads: storedFiles.map(file => ({ fileId: file.id, kind: file.kind, contentType: file.mime_type, size: file.size })) }
}
async function findSession(service: any, id: string, token: string) {
  const secretHash = await hash(token, 'love-galaxy-upload-session')
  const found = await service.rpc('get_love_galaxy_upload_session', { p_session_id: id, p_secret_hash: secretHash })
  if (found.error || !found.data) throw new Error('Upload session not found')
  return { session: found.data as Record<string, unknown>, secretHash }
}
async function uploadFile(service: any, request: Request) {
  const id = sessionId(request.headers.get('x-love-galaxy-session-id'))
  const token = sessionToken(request.headers.get('x-love-galaxy-session-token'))
  const fileId = sessionId(request.headers.get('x-love-galaxy-file-id'))
  const { session } = await findSession(service, id, token)
  if (session.status !== 'pending' || typeof session.expires_at !== 'string' || Date.parse(session.expires_at) <= Date.now() || !Array.isArray(session.files)) throw new Error('Upload session expired')
  const file = session.files.find((value: any) => value && typeof value === 'object' && value.id === fileId) as Record<string, unknown> | undefined
  if (!file || !validStagingPath(id, file)) throw new Error('Invalid upload authorization')
  const kind = file.kind as 'photo' | 'music'; const mime = String(request.headers.get('content-type') || '').split(';')[0].toLowerCase()
  const maxBytes = kind === 'photo' ? PHOTO_MAX : MUSIC_MAX
  if (mime !== file.mime_type || !(kind === 'photo' ? PHOTO_TYPES : MUSIC_TYPES).has(mime) || Number(file.size) < 1 || Number(file.size) > maxBytes) throw new Error('File size or MIME type does not match authorization')
  const bytes = await readBinary(request, maxBytes)
  if (bytes.length !== Number(file.size) || !hasMagic(mime, bytes)) throw new Error('File contents do not match type or authorization')
  const result = await service.storage.from(BUCKET).upload(String(file.path), new Blob([bytes], { type: mime }), { upsert: false, contentType: mime, cacheControl: '0' })
  if (result.error) {
    const message = String(result.error.message || '')
    if (Number(result.error.statusCode) === 409 || /already exists|duplicate/i.test(message)) throw Object.assign(new Error('File already uploaded'), { status: 409 })
    throw new Error('Unable to upload file')
  }
  return { uploaded: true }
}
async function finalizeUpload(service: any, body: Record<string, unknown>) {
  const id = sessionId(body.sessionId); const token = sessionToken(body.sessionToken)
  const { session, secretHash } = await findSession(service, id, token)
  if (session.status === 'published') {
    const prior = await service.rpc('finalize_love_galaxy_upload_session', { p_session_id: id, p_secret_hash: secretHash })
    if (prior.error || !prior.data) throw new Error('Unable to confirm Love Galaxy')
    return prior.data
  }
  if (session.status !== 'pending' || typeof session.expires_at !== 'string' || Date.parse(session.expires_at) <= Date.now() || !Array.isArray(session.files)) throw new Error('Upload session expired')
  const files = session.files as Array<Record<string, unknown>>
  const photos = files.filter(file => file.kind === 'photo')
  const audio = files.filter(file => file.kind === 'music')
  if (photos.length !== 4 || audio.length > 1 || ((session.input as any)?.music_track === 'custom') !== (audio.length === 1)) throw new Error('Photo or music selection is incomplete')
  let total = 0; const photoHashes = new Set<string>()
  try {
    for (const file of files) {
      if (!validStagingPath(id, file)) throw new Error('Invalid upload authorization')
      const kind = file.kind as 'photo' | 'music'; const mime = String(file.mime_type || ''); const size = Number(file.size)
      if (!Number.isSafeInteger(size) || size < 1 || size > (kind === 'photo' ? PHOTO_MAX : MUSIC_MAX)) throw new Error('Invalid file metadata')
      const result = await service.storage.from(BUCKET).download(String(file.path))
      if (result.error || !result.data) throw new Error('A file upload is missing')
      const blob = result.data as Blob; const bytes = new Uint8Array(await blob.arrayBuffer())
      if (blob.size !== size || blob.type.toLowerCase() !== mime || !hasMagic(mime, bytes)) throw new Error('File size, MIME type, or contents do not match authorization')
      total += blob.size
      if (total > TOTAL_MAX) throw new Error('Love Galaxy media exceeds 27 MiB combined')
      if (kind === 'photo') {
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
        if (photoHashes.has(hash)) throw new Error('Choose four different photos')
        photoHashes.add(hash)
      }
    }
  } catch (error) {
    const canceled = await service.rpc('cancel_love_galaxy_upload_session', { p_session_id: id, p_secret_hash: secretHash })
    if (canceled.data?.status === 'canceled') {
      const paths = trustedPaths(id, canceled.data.files)
      if (paths.length) await service.storage.from(BUCKET).remove(paths)
    }
    throw error
  }
  const published = await service.rpc('finalize_love_galaxy_upload_session', { p_session_id: id, p_secret_hash: secretHash })
  if (published.error || !published.data) throw new Error('Unable to publish Love Galaxy')
  return published.data
}
async function cancelUpload(service: any, body: Record<string, unknown>) {
  const id = sessionId(body.sessionId); const token = sessionToken(body.sessionToken)
  const secretHash = await hash(token, 'love-galaxy-upload-session')
  const result = await service.rpc('cancel_love_galaxy_upload_session', { p_session_id: id, p_secret_hash: secretHash })
  if (result.error) throw new Error('Unable to cancel upload')
  if (result.data?.status === 'canceled') { const paths = trustedPaths(id, result.data.files); if (paths.length) await service.storage.from(BUCKET).remove(paths) }
  return { canceled: ['canceled','missing'].includes(result.data?.status) }
}
async function publishedByLink(service: any, username: unknown, key: unknown) {
  if (typeof username !== 'string' || !/^galaxy-[a-z0-9-]{8,39}$/.test(username) || typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)) return null
  const result = await service.rpc('public_love_galaxy', { p_username: username, p_public_key: key })
  if (result.error || !result.data) return null
  return result.data as Record<string, unknown>
}
function fileById(galaxy: Record<string, unknown>, kind: 'photo' | 'music', id: string) {
  if (kind === 'music') return typeof galaxy.music_path === 'string' ? galaxy.music_path : null
  if (!Array.isArray(galaxy.photos)) return null
  const photo = galaxy.photos.find((item: any) => item && item.id === id)
  return photo && typeof photo.storage_path === 'string' ? photo.storage_path : null
}
async function publicMedia(service: any, body: Record<string, unknown>) {
  const kind = body.kind === 'music' ? 'music' : body.kind === 'photo' ? 'photo' : null
  const galaxy = await publishedByLink(service, body.username, body.key)
  if (!kind || !galaxy) throw Object.assign(new Error('Love Galaxy not found or unavailable'), { status: 404 })
  const mediaPath = fileById(galaxy, kind, kind === 'photo' ? String(body.fileId || '') : '')
  if (!mediaPath || !/^love-galaxy-staging\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|mp3|m4a|aac|ogg|wav)$/.test(mediaPath)) throw Object.assign(new Error('Love Galaxy media not found'), { status: 404 })
  const file = await service.storage.from(BUCKET).download(mediaPath)
  if (file.error || !file.data) throw Object.assign(new Error('Love Galaxy media not found'), { status: 404 })
  return file.data as Blob
}
async function callAction(service: any, action: string, body: Record<string, unknown>, request: Request) {
  if (action === 'start') {
    const ip = ipAddress(request)
    if (!ip) throw Object.assign(new Error('Client identity unavailable'), { status: 400 })
    await cleanupExpired(service)
    return { upload: await startUpload(service, body, ip) }
  }
  if (action === 'finalize') return { galaxy: await finalizeUpload(service, body) }
  if (action === 'cancel') return { result: await cancelUpload(service, body) }
  if (action === 'cleanup') return { cleanedSessions: await cleanupExpired(service) }
  if (action === 'public') {
    const galaxy = await publishedByLink(service, body.username, body.key)
    if (!galaxy) throw Object.assign(new Error('Love Galaxy not found or unavailable'), { status: 404 })
    return { galaxy }
  }
  if (action === 'media') return { media: await publicMedia(service, body) }
  throw new Error('Invalid Love Galaxy action')
}

Deno.serve(async request => {
  const origin = allowedOrigin(request)
  if (!validBridgeSecret(request)) return fail('Love Galaxy gateway authorization required', 403, origin || undefined)
  if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !secretSalt()) return fail('Love Galaxy service is not configured', 503)
  if (request.method === 'OPTIONS') return origin ? response({}, 204, origin) : fail('Origin not allowed', 403)
  if (!origin || request.method !== 'POST') return fail('Origin or method not allowed', 403)
  try {
    const service = client()
    if (request.headers.get('x-love-galaxy-action') === 'upload') {
      const result = await uploadFile(service, request)
      return response(result, 201, origin)
    }
    const body = await readJson(request)
    const result = await callAction(service, String(body.action || ''), body, request)
    if (result.media instanceof Blob) return new Response(result.media, { status: 200, headers: { 'Cache-Control': 'no-store', 'Content-Type': result.media.type || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' } })
    return response(result, ['start','finalize'].includes(String(body.action)) ? 201 : 200, origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process Love Galaxy request'
    const status = Number((error as { status?: number })?.status) || (/not found|unavailable/i.test(message) ? 404 : /rate limit/i.test(message) ? 429 : /too large/i.test(message) ? 413 : 400)
    return fail(message, status, origin)
  }
})
