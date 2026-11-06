import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeProjectInput, fields, MAX_PHOTO_BYTES } from '../src/lib/validation.js'
import type { ProjectInput } from '../src/types.js'

const MAX_JSON = 4_500_000
const MAX_UPLOAD = MAX_PHOTO_BYTES
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const config = { api: { bodyParser: false } }

type Deps = { fetch?: typeof fetch; now?: () => number }

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>

export function createStudioHandler(deps: Deps = {}): Handler {
  const fetcher = deps.fetch || fetch
  const now = deps.now || Date.now
  return async (req, res) => handle(req, res, fetcher, now)
}

export default createStudioHandler()

const env = (name: string) => process.env[name] || ''
const getConfig = () => ({
  url: env('SUPABASE_URL'),
  key: env('SUPABASE_ANON_KEY'),
  owner: env('STUDIO_ADMIN_USER_ID'),
})
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Vary: 'Origin',
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string | string[]> = {},
) {
  if (res.headersSent) return
  res.writeHead(status, { ...jsonHeaders, ...extra })
  res.end(JSON.stringify(body))
}

function fail(res: ServerResponse, status: number, message: string) {
  send(res, status, { error: message })
}

function genericError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/schedule[\s\S]*(?:column|schema cache)|(?:column|schema cache)[\s\S]*schedule/i.test(message)) {
    return 'Schedule persistence is unavailable; apply the schedule migration'
  }
  const safe = [
    'Project details are required',
    'A project title is required',
    'Username must start with a letter and contain 3–40 lowercase letters, numbers, or hyphens',
    'Customer name is required',
    'First person is required',
    'Second person is required',
    'Event date is required',
    'Event time is required',
    'Venue is required',
    'Message is required',
    'Project title is too long',
    'Username is too long',
    'Username is already in use',
    'Invalid guest payload',
    'Enter a valid event date and time',
    'Enter a valid customer email',
    'Map link must be a valid HTTPS Google Maps URL',
    'Invalid design',
    'Invalid theme',
    'This project type is not available yet',
    'Published invitations must be revoked before changing photos',
    'A project may contain at most 8 photos',
    'Photo must be JPG, PNG, or WEBP',
    'Photo is required',
    'Photo is larger than 4.49 MB',
    'Photo contents do not match type',
    'Photo not found',
    'Not found',
    'Project not found',
    'Username confirmation does not match',
    'Unable to delete invitation',
    'Sharing was stopped, but deletion did not complete. Please retry.',
    'Invalid JSON',
    'Invalid credentials',
    'Please sign in first',
    'Not authorized',
    'Client identity unavailable',
    'Unable to create invitation',
    'Unable to start upload',
    'Unable to verify upload session',
    'Unable to confirm invitation',
    'Unable to publish invitation',
    'Unable to cancel upload',
    'Upload session not found',
    'Upload session expired',
    'Choose 1–3 photos',
    'Photo exceeds 4.49 MB',
    'Photo already uploaded',
    'Unable to upload photo',
    'Photo MIME type not allowed',
    'A photo upload is missing',
    'Photo size or MIME type does not match authorization',
    'Photo contents do not match MIME type',
    'Invalid upload authorization',
    'Invalid photo metadata',
    'Photos exceed 27 MiB combined',
    'Rate limit exceeded',
    'Invitation not found or revoked',
    'Schedule persistence is unavailable; apply the schedule migration',
    'Service unavailable',
    'Request too large',
  ]
  if (safe.includes(message)) return message
  if (/^\w+ is too long$/.test(message)) return message
  return 'Unable to complete request'
}

function cookieMap(req: IncomingMessage) {
  const out: Record<string, string> = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const name = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    try {
      out[name] = decodeURIComponent(value)
    } catch {
      // Ignore malformed cookies rather than failing the request.
    }
  }
  return out
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Lax; ${
    env('NODE_ENV') === 'production' ? 'Secure; ' : ''
  }Max-Age=${Math.max(0, Math.floor(maxAge))}`
}

function clearCookies() {
  return [cookie('studio_access', '', 0), cookie('studio_refresh', '', 0)]
}

function originAllowed(req: IncomingMessage) {
  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase()
  if (fetchSite === 'cross-site') return false
  const origin = req.headers.origin
  if (!origin) return true
  const host = req.headers.host
  if (!host) return false
  const proto = String(
    req.headers['x-forwarded-proto'] || (env('NODE_ENV') === 'production' ? 'https' : 'http'),
  ).split(',')[0].trim()
  try {
    return new URL(origin).origin === `${proto}://${host}`
  } catch {
    return false
  }
}

async function readBody(req: IncomingMessage, limit = MAX_JSON): Promise<Buffer> {
  const request = req as IncomingMessage & { body?: unknown }
  if (request.body !== undefined) {
    const body = Buffer.isBuffer(request.body)
      ? request.body
      : typeof request.body === 'string'
        ? Buffer.from(request.body)
        : Buffer.from(JSON.stringify(request.body))
    if (body.length > limit) throw Object.assign(new Error('Request too large'), { status: 413 })
    return body
  }
  const declared = Number(req.headers['content-length'] || 0)
  if (declared > limit) throw Object.assign(new Error('Request too large'), { status: 413 })
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += bytes.length
    if (total > limit) throw Object.assign(new Error('Request too large'), { status: 413 })
    chunks.push(bytes)
  }
  return Buffer.concat(chunks)
}

async function readJson(req: IncomingMessage) {
  const body = await readBody(req)
  try {
    const value = JSON.parse(body.toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, any>
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 })
  }
}

function client(fetcher: typeof fetch, access?: string): SupabaseClient {
  const c = getConfig()
  if (!c.url || !c.key) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  return createClient(c.url, c.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: fetcher,
      headers: access ? { Authorization: `Bearer ${access}` } : {},
    },
  })
}

type StudioAuthUser = { id: string }
type StudioAuthSession = { access_token: string; refresh_token: string; expires_at?: number }
type StudioAuthApi = {
  getUser(jwt?: string): Promise<{ data: { user: StudioAuthUser | null }; error: unknown }>
  refreshSession(session?: { refresh_token?: string }): Promise<{
    data: { user: StudioAuthUser | null; session: StudioAuthSession | null }
    error: unknown
  }>
  signInWithPassword(credentials: { email: string; password: string }): Promise<{
    data: { user: StudioAuthUser | null; session: StudioAuthSession | null }
    error: unknown
  }>
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: unknown }>
}

function studioAuth(sb: SupabaseClient): StudioAuthApi {
  return sb.auth as unknown as StudioAuthApi
}

async function auth(
  req: IncomingMessage,
  fetcher: typeof fetch,
  allowAnonymous = false,
): Promise<{
  sb: SupabaseClient
  user: any
  refreshed?: { access_token: string; refresh_token: string; expires_at?: number }
  access?: string
}> {
  const c = getConfig()
  if (!c.owner) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const cookies = cookieMap(req)
  let access = cookies.studio_access
  let sb = client(fetcher, access)
  let user: any = null
  if (access) {
    const result = await studioAuth(sb).getUser(access)
    user = result.data.user || null
  }
  let refreshed: any
  if (!user && cookies.studio_refresh) {
    const result = await studioAuth(client(fetcher)).refreshSession({ refresh_token: cookies.studio_refresh })
    user = result.data.user || null
    if (result.data.session) {
      refreshed = result.data.session
      access = refreshed.access_token
      sb = client(fetcher, access)
    }
  }
  if (!user) {
    if (allowAnonymous) return { sb, user: null, access }
    throw Object.assign(new Error('Please sign in first'), { status: 401 })
  }
  if (user.id !== c.owner) throw Object.assign(new Error('Not authorized'), { status: 403 })
  return { sb, user, refreshed, access }
}

function projectRow(row: any, publicView = false, username = '', key = '') {
  const result: any = {}
  for (const field of fields) {
    result[field] = publicView && ['customer_name', 'customer_email', 'customer_phone', 'private_notes'].includes(field)
      ? ''
      : row[field] ?? ''
  }
  result.id = row.id
  result.status = row.status
  result.created_at = row.created_at
  result.updated_at = row.updated_at
  result.public_key = publicView ? null : (row.public_key ?? null)
  if (Array.isArray(row.schedule)) result.schedule = row.schedule

  const photos = Array.isArray(row.photos) ? row.photos : (row.project_photos || [])
  result.photos = photos
    .slice()
    .sort((a: any, b: any) => Number(a.position || 0) - Number(b.position || 0))
    .map((photo: any) => {
      const value: any = {
        id: photo.id,
        caption: photo.caption || '',
        position: photo.position,
      }
      value.url = publicView && typeof photo.url === 'string' && photo.url.startsWith('data:image/')
        ? photo.url
        : publicView
          ? `/api/studio?action=publicPhoto&username=${encodeURIComponent(username)}${key ? `&key=${encodeURIComponent(key)}` : ''}&photo=${encodeURIComponent(photo.id)}`
          : `/api/studio?action=ownerPhoto&projectId=${encodeURIComponent(row.id)}&photoId=${encodeURIComponent(photo.id)}`
      return value
    })
  return result
}

async function getProject(sb: SupabaseClient, id: string) {
  const result = await sb.from('projects').select('*, project_photos(*)').eq('id', id).single()
  if (result.error || !result.data) throw new Error('Project not found')
  return result.data
}

async function ownerResult(sb: SupabaseClient, id: string) {
  return projectRow(await getProject(sb, id))
}

function headerSession(res: ServerResponse, refreshed: any, now: () => number) {
  if (!refreshed) return
  const expiresAt = refreshed.expires_at ? refreshed.expires_at * 1000 : now() + 3_600_000
  const maxAge = Math.max(0, Math.floor((expiresAt - now()) / 1000))
  res.setHeader('Set-Cookie', [
    cookie('studio_access', refreshed.access_token, maxAge),
    cookie('studio_refresh', refreshed.refresh_token, 60 * 60 * 24 * 30),
  ])
}

const methods: Record<string, string> = {
  session: 'GET', login: 'POST', logout: 'POST', publicPhoto: 'GET', guest: 'POST',
  guestUploadStart: 'POST', guestUploadFile: 'POST', guestUploadFinalize: 'POST', guestUploadCancel: 'POST',
  publicProject: 'GET', usernameAvailable: 'GET', list: 'GET', get: 'GET', save: 'POST',
  upload: 'POST', removePhoto: 'POST', publish: 'POST', revoke: 'POST', deleteProject: 'POST', ownerPhoto: 'GET',
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  fetcher: typeof fetch,
  now: () => number,
) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const action = url.searchParams.get('action') || ''
    if (req.method === 'OPTIONS') {
      res.writeHead(204, jsonHeaders)
      res.end()
      return
    }
    if (!Object.hasOwn(methods, action)) {
      fail(res, 404, 'Not found')
      return
    }
    if (req.method !== methods[action]) {
      res.setHeader('Allow', methods[action])
      fail(res, 405, 'Method not allowed')
      return
    }
    if (action === 'session' || action === 'ownerPhoto') {
      if (!originAllowed(req)) {
        fail(res, 403, 'Origin not allowed')
        return
      }
    } else if (req.method !== 'GET' && !originAllowed(req)) {
      fail(res, 403, 'Origin not allowed')
      return
    }

    if (action === 'session') {
      const c = getConfig()
      try {
        const result = await auth(req, fetcher, true)
        headerSession(res, result.refreshed, now)
        send(res, 200, { data: { user: result.user ? { id: result.user.id } : null, isOwner: !!result.user && result.user.id === c.owner } })
      } catch (error: any) {
        if (error?.status === 503) throw error
        send(res, 200, { data: { user: null, isOwner: false } })
      }
      return
    }

    if (action === 'login') {
      const body = await readJson(req)
      if (typeof body.email !== 'string' || typeof body.password !== 'string') {
        throw Object.assign(new Error('Invalid credentials'), { status: 400 })
      }
      const authClient = client(fetcher)
      const auth = studioAuth(authClient)
      const result = await auth.signInWithPassword({ email: body.email, password: body.password })
      if (result.error || !result.data.user || result.data.user.id !== getConfig().owner) {
        if (result.data.session) await auth.signOut({ scope: 'local' })
        throw Object.assign(new Error('Invalid credentials'), { status: 403 })
      }
      res.setHeader('Set-Cookie', [
        cookie('studio_access', result.data.session!.access_token, 3600),
        cookie('studio_refresh', result.data.session!.refresh_token, 60 * 60 * 24 * 30),
      ])
      send(res, 200, { data: { user: { id: result.data.user.id }, isOwner: true } })
      return
    }

    if (action === 'logout') {
      const cookies = cookieMap(req)
      const c = getConfig()
      if (!c.url || !c.key) throw Object.assign(new Error('Service unavailable'), { status: 503 })
      if (c.url && c.key && cookies.studio_access) {
        await fetcher(`${c.url}/auth/v1/logout?scope=local`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cookies.studio_access}`, apikey: c.key },
        }).catch(() => undefined)
      }
      res.setHeader('Set-Cookie', clearCookies())
      send(res, 200, { data: { user: null, isOwner: false } })
      return
    }

    if (action === 'publicPhoto') {
      await proxyPhoto(fetcher, url, res)
      return
    }
    if (action === 'guest') {
      await guest(fetcher, req, res)
      return
    }
    if (action === 'guestUploadFile') {
      await guestUploadFile(fetcher, req, res)
      return
    }
    if (action === 'guestUploadStart' || action === 'guestUploadFinalize' || action === 'guestUploadCancel') {
      const task = action === 'guestUploadStart' ? 'start' : action === 'guestUploadFinalize' ? 'finalize' : 'cancel'
      await guestUpload(fetcher, req, res, task)
      return
    }
    if (action === 'publicProject') {
      const sb = client(fetcher)
      const username = url.searchParams.get('username') || ''
      const key = url.searchParams.get('key') || ''
      if (!username || username.length > 40 || key.length > 128) { fail(res, 404, 'Invitation not found or revoked'); return }
      let result = await sb.rpc('public_project', { p_username: username, p_public_key: key || null })
      if ((result.error || !result.data) && username.startsWith('guest-')) {
        result = await sb.rpc('guest_public_project', { p_username: username, p_public_key: key || null })
      }
      if (result.error || !result.data) {
        fail(res, 404, 'Invitation not found or revoked')
        return
      }
      send(res, 200, { data: projectRow(result.data, true, username, key) })
      return
    }

    const owner = await auth(req, fetcher)
    headerSession(res, owner.refreshed, now)

    if (action === 'usernameAvailable') {
      const result = await owner.sb.rpc('username_available', {
        p_username: url.searchParams.get('username') || '',
        p_except_id: url.searchParams.get('exceptId') || null,
      })
      if (result.error) throw result.error
      send(res, 200, { data: !!result.data })
      return
    }
    if (action === 'list') {
      const result = await owner.sb.from('projects').select('*, project_photos(*)').order('updated_at', { ascending: false })
      if (result.error) throw result.error
      send(res, 200, { data: (result.data || []).map((row: any) => projectRow(row)) })
      return
    }
    if (action === 'get') {
      send(res, 200, { data: await ownerResult(owner.sb, url.searchParams.get('projectId') || '') })
      return
    }
    if (action === 'save') {
      const body = await readJson(req)
      const input = normalizeProjectInput(body.input as ProjectInput)
      const id = typeof body.projectId === 'string' ? body.projectId : undefined
      const available = await owner.sb.rpc('username_available', { p_username: input.username, p_except_id: id || null })
      if (available.error) throw available.error
      if (!available.data) throw new Error('Username is already in use')
      const row: Record<string, any> = Object.fromEntries(fields.map((field) => [field, (input as any)[field]]))
      if ((input as any).schedule !== undefined) row.schedule = (input as any).schedule
      row.status = 'draft'
      row.public_key = null
      const query = id
        ? owner.sb.from('projects').update(row).eq('id', id).select('*, project_photos(*)').single()
        : owner.sb.from('projects').insert({ ...row, owner_id: owner.user.id }).select('*, project_photos(*)').single()
      const result = await query
      if (result.error || !result.data) throw result.error || new Error('Unable to save project')
      send(res, 200, { data: projectRow(result.data) })
      return
    }
    if (action === 'upload') {
      const id = url.searchParams.get('projectId') || ''
      const project = await getProject(owner.sb, id)
      if (project.status === 'published') throw new Error('Published invitations must be revoked before changing photos')
      if ((project.project_photos || []).length >= 8) throw new Error('A project may contain at most 8 photos')
      const type = String(req.headers['content-type'] || '').split(';')[0].toLowerCase()
      if (!PHOTO_TYPES.has(type)) throw new Error('Photo must be JPG, PNG, or WEBP')
      const bytes = await readBody(req, MAX_UPLOAD)
      if (!bytes.length) throw new Error('Photo is required')
      const validMagic = type === 'image/jpeg'
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : type === 'image/png'
          ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
      if (!validMagic) throw new Error('Photo contents do not match type')
      const photoId = globalThis.crypto.randomUUID()
      const path = `${owner.user.id}/${id}/${photoId}.${type.split('/')[1]}`
      const upload = await owner.sb.storage.from('project-photos').upload(path, bytes, { upsert: false, contentType: type })
      if (upload.error) throw upload.error
      const used = new Set((project.project_photos || []).map((photo: any) => photo.position))
      let position = 0
      while (used.has(position)) position++
      const inserted = await owner.sb.from('project_photos').insert({ id: photoId, project_id: id, storage_path: path, caption: '', position })
      if (inserted.error) {
        await owner.sb.storage.from('project-photos').remove([path])
        throw inserted.error
      }
      send(res, 200, { data: await ownerResult(owner.sb, id) })
      return
    }
    if (action === 'removePhoto') {
      const body = await readJson(req)
      const id = String(body.projectId || '')
      const photoId = String(body.photoId || '')
      const project = await getProject(owner.sb, id)
      if (project.status === 'published') throw new Error('Published invitations must be revoked before changing photos')
      const photo = (project.project_photos || []).find((item: any) => item.id === photoId)
      if (!photo) throw new Error('Photo not found')
      const deleted = await owner.sb.from('project_photos').delete().eq('id', photoId).eq('project_id', id)
      if (deleted.error) throw deleted.error
      if (photo.storage_path) await owner.sb.storage.from('project-photos').remove([photo.storage_path])
      send(res, 200, { data: await ownerResult(owner.sb, id) })
      return
    }
    if (action === 'publish' || action === 'revoke') {
      const body = await readJson(req)
      const result = await owner.sb.rpc(action === 'publish' ? 'publish_project' : 'revoke_project', { p_project_id: String(body.projectId || '') })
      if (result.error) throw result.error
      send(res, 200, { data: await ownerResult(owner.sb, String(body.projectId || '')) })
      return
    }
    if (action === 'deleteProject') {
      const body = await readJson(req)
      const id = typeof body.projectId === 'string' ? body.projectId.trim() : ''
      const project = await getProject(owner.sb, id)
      const confirmation = typeof body.confirmUsername === 'string' ? body.confirmUsername.trim().toLowerCase() : ''
      if (confirmation !== String(project.username || '').toLowerCase()) throw new Error('Username confirmation does not match')

      const wasPublished = project.status === 'published'
      const deletionError = () => new Error(wasPublished
        ? 'Sharing was stopped, but deletion did not complete. Please retry.'
        : 'Unable to delete invitation')
      if (wasPublished) {
        const revoked = await owner.sb.rpc('revoke_project', { p_project_id: id })
        if (revoked.error || !revoked.data) throw revoked.error || new Error('Unable to delete invitation')
      }

      const photoRows = Array.isArray(project.project_photos) ? project.project_photos : []
      const prefix = `${owner.user.id}/${id}/`
      const paths = photoRows.map((photo: any) => photo.storage_path)
      if (paths.some((path: unknown) => typeof path !== 'string' || !path.startsWith(prefix))) {
        throw deletionError()
      }
      if (paths.length) {
        const removed = await owner.sb.storage.from('project-photos').remove(paths as string[])
        if (removed.error) throw deletionError()
      }

      const deleted = await owner.sb.from('projects').delete().eq('id', id).eq('owner_id', owner.user.id).select('id').maybeSingle()
      if (deleted.error || !deleted.data) throw deletionError()
      send(res, 200, { data: { deleted: true } })
      return
    }
    if (action === 'ownerPhoto') {
      const id = url.searchParams.get('projectId') || ''
      const photoId = url.searchParams.get('photoId') || ''
      const project = await getProject(owner.sb, id)
      const photo = (project.project_photos || []).find((item: any) => item.id === photoId)
      if (!photo) throw Object.assign(new Error('Not found'), { status: 404 })
      const download = await owner.sb.storage.from('project-photos').download(photo.storage_path)
      if (download.error || !download.data) throw Object.assign(new Error('Not found'), { status: 404 })
      res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': download.data.type || 'application/octet-stream' })
      res.end(Buffer.from(await download.data.arrayBuffer()))
      return
    }
    fail(res, 404, 'Not found')
  } catch (error: any) {
    const status = Number.isInteger(error?.status) ? error.status : 400
    fail(res, status, genericError(error))
  }
}

async function proxyPhoto(fetcher: typeof fetch, url: URL, res: ServerResponse) {
  const c = getConfig()
  if (!c.url || !c.key) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const username = url.searchParams.get('username') || ''
  const key = url.searchParams.get('key') || ''
  const photo = url.searchParams.get('photo') || ''
  const params = new URLSearchParams({ username, photo })
  if (key) params.set('key', key)
  if (!username || username.length > 40 || !photo || photo.length > 128 || key.length > 128) { fail(res, 404, 'Not found'); return }
  const result = await fetcher(`${c.url}/functions/v1/invitation-photo?${params}`, { headers: { apikey: c.key } })
  if (!result.ok) {
    fail(res, 404, 'Not found')
    return
  }
  res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': result.headers.get('content-type') || 'application/octet-stream' })
  res.end(Buffer.from(await result.arrayBuffer()))
}

async function guestUpload(fetcher: typeof fetch, req: IncomingMessage, res: ServerResponse, task: 'start' | 'finalize' | 'cancel') {
  const c = getConfig()
  if (!c.url || !c.key) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const bridgeSecret = env('GUEST_UPLOAD_BRIDGE_SECRET')
  if (bridgeSecret.length < 32) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const incoming = await readJson(req)
  const origin = env('APP_ORIGIN') || 'https://love-birds-mm.vercel.app'
  const vercelIdentity = env('VERCEL') === '1' ? req.headers['x-vercel-forwarded-for'] : undefined
  const ip = env('VERCEL') === '1' ? vercelIdentity : req.socket?.remoteAddress
  if (typeof ip !== 'string' || !isIP(ip.trim())) throw Object.assign(new Error('Client identity unavailable'), { status: 400 })
  let body: Record<string, unknown>
  if (task === 'start') {
    const publicFields = ['title','person_a','person_b','parent_a','parent_b','event_date','event_time','venue','message','map_url','template','theme','project_type']
    const rawInput = incoming.input && typeof incoming.input === 'object' && !Array.isArray(incoming.input) ? incoming.input as Record<string, unknown> : {}
    const input = Object.fromEntries(publicFields.map(field => [field, rawInput[field]]))
    if (rawInput.schedule !== undefined) input.schedule = rawInput.schedule
    const photos = Array.isArray(incoming.photos) ? incoming.photos.map((photo: any) => ({ size: photo?.size, type: photo?.type })) : incoming.photos
    body = { action: task, input, photos }
  } else {
    body = { action: task, sessionId: incoming.sessionId, sessionToken: incoming.sessionToken }
  }
  const result = await fetcher(`${c.url}/functions/v1/guest-upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: c.key,
      authorization: `Bearer ${c.key}`,
      origin,
      'x-forwarded-for': ip.trim(),
      'x-real-ip': ip.trim(),
      'x-invitation-upload-bridge': bridgeSecret,
    },
    body: JSON.stringify(body),
  })
  const text = await result.text()
  if (!result.ok) {
    let message = 'Unable to complete request'
    try {
      const value = JSON.parse(text)
      if (result.status === 429) message = 'Rate limit exceeded'
      else if (typeof value.error === 'string' && result.status < 500) message = genericError(new Error(value.error))
    } catch { /* Keep a safe generic message. */ }
    throw Object.assign(new Error(message), { status: result.status >= 500 ? 502 : result.status })
  }
  let value: any
  try { value = JSON.parse(text) } catch { throw new Error('Unable to complete request') }
  if (task === 'start') {
    const upload = value.upload
    const idOk = typeof upload?.sessionId === 'string' && /^[0-9a-f-]{36}$/.test(upload.sessionId)
    const tokenOk = typeof upload?.sessionToken === 'string' && /^[0-9a-f]{64}$/.test(upload.sessionToken)
    const uploads = Array.isArray(upload?.uploads) ? upload.uploads : []
    if (!idOk || !tokenOk || uploads.length < 1 || uploads.length > 3) throw new Error('Unable to start upload')
    const safeUploads = uploads.map((item: any) => {
      if (typeof item?.photoId !== 'string' || !/^[0-9a-f-]{36}$/.test(item.photoId) || typeof item.contentType !== 'string' || !Number.isSafeInteger(item.size)) throw new Error('Unable to start upload')
      if (!['image/jpeg','image/png','image/webp'].includes(item.contentType) || item.size < 1 || item.size > MAX_UPLOAD) throw new Error('Unable to start upload')
      return { photoId: item.photoId, contentType: item.contentType, size: item.size }
    })
    send(res, result.status, { data: { sessionId: upload.sessionId, sessionToken: upload.sessionToken, expiresAt: upload.expiresAt, uploads: safeUploads } })
    return
  }
  if (task === 'cancel') {
    send(res, result.status, { data: { canceled: !!value.result?.canceled } })
    return
  }
  const project = value.project
  if (!project || project.status !== 'published' || typeof project.public_key !== 'string' || !project.public_key) throw new Error('Unable to publish invitation')
  const data = projectRow(project, true, project.username || '', project.public_key)
  data.public_key = project.public_key
  send(res, result.status, { data })
}

async function guestUploadFile(fetcher: typeof fetch, req: IncomingMessage, res: ServerResponse) {
  const c = getConfig()
  if (!c.url || !c.key) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const bridgeSecret = env('GUEST_UPLOAD_BRIDGE_SECRET')
  if (bridgeSecret.length < 32) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const sessionId = String(req.headers['x-guest-session-id'] || '')
  const sessionToken = String(req.headers['x-guest-session-token'] || '')
  const photoId = String(req.headers['x-guest-photo-id'] || '')
  const type = String(req.headers['content-type'] || '').split(';')[0].toLowerCase()
  if (!/^[0-9a-f-]{36}$/.test(sessionId) || !/^[0-9a-f]{64}$/.test(sessionToken) || !/^[0-9a-f-]{36}$/.test(photoId)) {
    throw Object.assign(new Error('Invalid upload authorization'), { status: 400 })
  }
  if (!PHOTO_TYPES.has(type)) throw Object.assign(new Error('Photo must be JPG, PNG, or WEBP'), { status: 415 })
  const bytes = await readBody(req, MAX_UPLOAD)
  if (!bytes.length) throw Object.assign(new Error('Photo is required'), { status: 400 })
  const origin = env('APP_ORIGIN') || 'https://love-birds-mm.vercel.app'
  const vercelIdentity = env('VERCEL') === '1' ? req.headers['x-vercel-forwarded-for'] : undefined
  const ip = env('VERCEL') === '1' ? vercelIdentity : req.socket?.remoteAddress
  if (typeof ip !== 'string' || !isIP(ip.trim())) throw Object.assign(new Error('Client identity unavailable'), { status: 400 })
  const result = await fetcher(`${c.url}/functions/v1/guest-upload`, {
    method: 'POST',
    headers: {
      'content-type': type,
      apikey: c.key,
      authorization: `Bearer ${c.key}`,
      origin,
      'x-forwarded-for': ip.trim(),
      'x-real-ip': ip.trim(),
      'x-invitation-upload-bridge': bridgeSecret,
      'x-invitation-upload-action': 'upload',
      'x-invitation-upload-session-id': sessionId,
      'x-invitation-upload-session-token': sessionToken,
      'x-invitation-upload-photo-id': photoId,
    },
    body: bytes as unknown as BodyInit,
  })
  let value: any
  try { value = await result.json() } catch { throw Object.assign(new Error('Unable to upload photo'), { status: 502 }) }
  if (!result.ok) {
    let message = 'Unable to upload photo'
    if (result.status === 429) message = 'Rate limit exceeded'
    else if (typeof value?.error === 'string' && result.status < 500) message = genericError(new Error(value.error))
    throw Object.assign(new Error(message), { status: result.status >= 500 ? 502 : result.status })
  }
  if (value?.uploaded !== true) throw new Error('Unable to upload photo')
  send(res, 200, { data: { uploaded: true } })
}

async function guest(fetcher: typeof fetch, req: IncomingMessage, res: ServerResponse) {
  const c = getConfig()
  if (!c.url || !c.key) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const bridgeSecret = env('GUEST_UPLOAD_BRIDGE_SECRET')
  if (bridgeSecret.length < 32) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const incoming = await readJson(req)
  if (!incoming.input || typeof incoming.input !== 'object' || Array.isArray(incoming.input) || !Array.isArray(incoming.photos) || incoming.photos.length < 1 || incoming.photos.length > 3) throw new Error('Invalid guest payload')
  const publicFields = ['title','person_a','person_b','parent_a','parent_b','event_date','event_time','venue','message','map_url','template','theme','project_type']
  const input = Object.fromEntries(publicFields.map(field => [field, incoming.input[field]]))
  if (incoming.input.schedule !== undefined) input.schedule = incoming.input.schedule
  const photos = incoming.photos.map((photo: any) => {
    if (!photo || typeof photo !== 'object' || typeof photo.dataUrl !== 'string') throw new Error('Invalid guest payload')
    return { dataUrl: photo.dataUrl, caption: typeof photo.caption === 'string' ? photo.caption : '' }
  })
  const body = JSON.stringify({ input, photos })
  const origin = env('APP_ORIGIN') || 'https://love-birds-mm.vercel.app'
  const vercelIdentity = env('VERCEL') === '1'
    ? req.headers['x-vercel-forwarded-for']
    : undefined
  const ip = env('VERCEL') === '1' ? vercelIdentity : req.socket?.remoteAddress
  if (typeof ip !== 'string' || !isIP(ip.trim())) throw Object.assign(new Error('Client identity unavailable'), { status: 400 })
  const result = await fetcher(`${c.url}/functions/v1/guest-invitation`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: c.key,
      authorization: `Bearer ${c.key}`,
      origin,
      'x-forwarded-for': ip.trim(),
      'x-real-ip': ip.trim(),
      'x-invitation-upload-bridge': bridgeSecret,
    },
    body: body as unknown as BodyInit,
  })
  const text = await result.text()
  if (!result.ok) {
    let message = 'Unable to create invitation'
    try {
      const value = JSON.parse(text)
      if (result.status === 429) message = 'Rate limit exceeded'
      else if (typeof value.error === 'string' && result.status < 500) {
        message = genericError(new Error(value.error))
      }
    } catch {
      // Keep the safe generic message.
    }
    throw Object.assign(new Error(message), { status: result.status >= 500 ? 502 : result.status })
  }
  let value: any
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Unable to create invitation')
  }
  const project = value.project || value
  if (!project || project.status !== 'published' || typeof project.public_key !== 'string' || !project.public_key) {
    throw new Error('Unable to create invitation')
  }
  const data = projectRow(project, true, project.username || '', project.public_key)
  data.public_key = project.public_key
  send(res, result.status, { data })
}
