import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import { MAX_PHOTO_BYTES } from '../src/lib/validation.js'

export const config = { api: { bodyParser: false } }
const MUSIC_MAX = 4_000_000
const CONTROL_MAX = 64 * 1024
const PHOTO_TYPES = new Set(['image/jpeg','image/png','image/webp'])
const MUSIC_TYPES = new Set(['audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav'])
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', Vary: 'Origin' }
const env = (name: string) => process.env[name] || (name === 'SUPABASE_URL' ? process.env.VITE_SUPABASE_URL : name === 'SUPABASE_ANON_KEY' ? process.env.VITE_SUPABASE_ANON_KEY : '') || ''
const send = (res: ServerResponse, status: number, body: unknown, extra: Record<string,string> = {}) => { if (!res.headersSent) { res.writeHead(status, { ...JSON_HEADERS, ...extra }); res.end(JSON.stringify(body)) } }

function originAllowed(req: IncomingMessage) {
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false
  const origin = req.headers.origin
  if (!origin) return true
  const host = req.headers.host
  if (!host) return false
  const proto = String(req.headers['x-forwarded-proto'] || (env('NODE_ENV') === 'production' ? 'https' : 'http')).split(',')[0].trim()
  try { return new URL(origin).origin === `${proto}://${host}` } catch { return false }
}
async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const request = req as IncomingMessage & { body?: unknown }
  if (request.body !== undefined) {
    const value = Buffer.isBuffer(request.body) ? request.body : typeof request.body === 'string' ? Buffer.from(request.body) : Buffer.from(JSON.stringify(request.body))
    if (value.length > limit) throw Object.assign(new Error('Request too large'), { status: 413 })
    return value
  }
  const declared = Number(req.headers['content-length'] || 0)
  if (declared > limit) throw Object.assign(new Error('Request too large'), { status: 413 })
  const chunks: Buffer[] = []; let total = 0
  for await (const chunk of req) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); total += bytes.length; if (total > limit) throw Object.assign(new Error('Request too large'), { status: 413 }); chunks.push(bytes) }
  return Buffer.concat(chunks)
}
async function readJson(req: IncomingMessage) {
  const raw = await readBody(req, CONTROL_MAX)
  try { const value = JSON.parse(raw.toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string, any> }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }) }
}
function jsonUrl(_origin: string, action: string, values: Record<string,string>) {
  const params = new URLSearchParams({ action, ...values })
  return `/api/love-galaxy?${params}`
}
function validUuid(value: unknown) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) }
function publicGalaxy(row: any, key: string | null, origin: string, linkKey: string | null = key) {
  if (!row || row.status !== 'published' || typeof row.username !== 'string' || !/^galaxy-[a-z0-9-]{8,39}$/.test(row.username) || !Array.isArray(row.photos) || row.photos.length !== 4) throw new Error('Unable to confirm Love Galaxy')
  const photos = row.photos.map((photo: any, position: number) => {
    if (!photo || !validUuid(photo.id) || !Number.isInteger(photo.position) || photo.position !== position) throw new Error('Unable to confirm Love Galaxy')
    return { id: photo.id, position, url: jsonUrl(origin,'photo',{ username: row.username, ...(linkKey ? { key: linkKey } : {}), fileId: photo.id }) }
  })
  const musicTrack = row.music_track === 'custom' ? 'custom' : row.music_track === 'cosmic-orbit' ? 'cosmic-orbit' : null
  if (!musicTrack) throw new Error('Unable to confirm Love Galaxy')
  return {
    id: String(row.id || ''), username: row.username, public_key: key, status: 'published',
    title: String(row.title || ''), ring_text_one: String(row.ring_text_one || ''), ring_text_two: String(row.ring_text_two || ''),
    music_track: musicTrack,
    music_url: musicTrack === 'custom' ? jsonUrl(origin,'music',{ username: row.username, ...(linkKey ? { key: linkKey } : {}) }) : null,
    photos, created_at: String(row.created_at || ''),
  }
}
function publicJourneyWorlds(rows: unknown) {
  if (!Array.isArray(rows)) throw new Error('Unable to load journey worlds')
  return rows.slice(0, 20).flatMap((row: any) => {
    if (!row || typeof row.username !== 'string' || !/^galaxy-[a-z0-9-]{8,39}$/.test(row.username) || typeof row.title !== 'string' || !row.title.trim() || row.title.trim().length > 120) return []
    return [{ username: row.username, title: row.title.trim() }]
  })
}
function statusError(status: number, text: string) {
  if (status === 429) return 'Rate limit exceeded'
  try {
    const value = JSON.parse(text)
    const message = typeof value.error === 'string' ? value.error : ''
    const safe = new Set([
      'Invalid Love Galaxy input','Unexpected Love Galaxy fields','Invalid title','Invalid ring_text_one','Invalid ring_text_two','Invalid music choice',
      'Choose exactly four photos','Choose exactly four photos','Photo exceeds 4.49 MB','Music exceeds 4 MB','File MIME type not allowed',
      'Select one music file for custom music, or choose the included soundtrack.','Photo or music selection is incomplete','Choose four different photos',
      'Photo contents do not match type or authorization','File size or MIME type does not match authorization','A file upload is missing',
      'Upload session expired','Upload session not found','File already uploaded','Invalid upload authorization','Invalid file metadata',
      'Love Galaxy not found or unavailable','Love Galaxy media not found','Request too large','Client identity unavailable',
    ])
    return status < 500 && safe.has(message) ? message : 'Unable to complete Love Galaxy request'
  } catch { return 'Unable to complete Love Galaxy request' }
}

export async function runLoveGalaxyCleanup(fetcher: typeof fetch = fetch) {
  const url = env('SUPABASE_URL'); const key = env('SUPABASE_ANON_KEY'); const bridge = env('GUEST_UPLOAD_BRIDGE_SECRET')
  if (!url || !key || bridge.length < 32) throw new Error('Love Galaxy cleanup is not configured')
  const origin = env('APP_ORIGIN') || 'https://love-birds-mm.vercel.app'
  const upstream = await fetcher(`${url.replace(/\/$/, '')}/functions/v1/love-galaxy`, {
    method:'POST', cache:'no-store', headers:{ 'content-type':'application/json', apikey:key, authorization:`Bearer ${key}`, origin, 'x-invitation-upload-bridge':bridge },
    body:JSON.stringify({action:'cleanup'}),
  })
  if (!upstream.ok) throw new Error('Love Galaxy cleanup failed')
  const value:any = await upstream.json()
  const count = Number(value?.cleanedSessions)
  if (!Number.isInteger(count) || count < 0 || count > 10) throw new Error('Unexpected Love Galaxy cleanup result')
  return count
}
function requestIp(req: IncomingMessage) {
  const identity = env('VERCEL') === '1' ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress
  return typeof identity === 'string' && isIP(identity.trim()) ? identity.trim() : ''
}
async function edgeRequest(fetcher: typeof fetch, req: IncomingMessage, action: string, body: Record<string,unknown>, raw?: Buffer, mime?: string) {
  const url = env('SUPABASE_URL'); const key = env('SUPABASE_ANON_KEY'); const bridge = env('GUEST_UPLOAD_BRIDGE_SECRET')
  if (!url || !key || bridge.length < 32) throw Object.assign(new Error('Service unavailable'), { status: 503 })
  const origin = env('APP_ORIGIN') || 'https://love-birds-mm.vercel.app'
  const headers: Record<string,string> = {
    'content-type': raw ? (mime || 'application/octet-stream') : 'application/json',
    apikey: key, authorization: `Bearer ${key}`, origin, 'x-invitation-upload-bridge': bridge,
  }
  if (action === 'start' || action === 'upload') {
    const ip = requestIp(req)
    if (!ip) throw Object.assign(new Error('Client identity unavailable'), { status: 400 })
    headers['x-forwarded-for'] = ip; headers['x-real-ip'] = ip
  }
  if (action === 'upload') headers['x-love-galaxy-action'] = 'upload'
  for (const [name, value] of Object.entries(body)) if (typeof value === 'string' && name.startsWith('x-')) headers[name] = value
  const response = await fetcher(`${url.replace(/\/$/, '')}/functions/v1/love-galaxy`, {
    method: 'POST', headers,
    body: raw ? raw as unknown as BodyInit : JSON.stringify({ action, ...body }),
    cache: 'no-store',
  })
  return response
}

export function createLoveGalaxyHandler(deps: { fetch?: typeof fetch } = {}) {
  const fetcher = deps.fetch || fetch
  return async function loveGalaxyApi(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const action = url.searchParams.get('action') || ''
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, JSON_HEADERS); res.end(); return }
    const methods: Record<string,string> = { start:'POST', upload:'POST', finalize:'POST', cancel:'POST', public:'GET', discoverable:'GET', photo:'GET', music:'GET' }
    if (!methods[action]) { send(res,404,{error:'Not found'}); return }
    if (req.method !== methods[action]) { res.setHeader('Allow',methods[action]); send(res,405,{error:'Method not allowed'}); return }
    if (req.method !== 'GET' && !originAllowed(req)) { send(res,403,{error:'Origin not allowed'}); return }
    if (action === 'upload') {
      const sessionId = String(req.headers['x-love-galaxy-session-id'] || '')
      const sessionToken = String(req.headers['x-love-galaxy-session-token'] || '')
      const fileId = String(req.headers['x-love-galaxy-file-id'] || '')
      if (!validUuid(sessionId) || !/^[0-9a-f]{64}$/.test(sessionToken) || !validUuid(fileId)) throw Object.assign(new Error('Invalid upload authorization'),{status:400})
      const mime = String(req.headers['content-type'] || '').split(';')[0].toLowerCase()
      const isPhoto = PHOTO_TYPES.has(mime); const isMusic = MUSIC_TYPES.has(mime)
      if (!isPhoto && !isMusic) throw Object.assign(new Error('File MIME type not allowed'),{status:415})
      const max = isPhoto ? MAX_PHOTO_BYTES : MUSIC_MAX
      const bytes = await readBody(req,max)
      if (!bytes.length) throw Object.assign(new Error('File is required'),{status:400})
      const upstream = await edgeRequest(fetcher,req,'upload',{
        'x-love-galaxy-session-id':sessionId,'x-love-galaxy-session-token':sessionToken,'x-love-galaxy-file-id':fileId,
      },bytes,mime)
      const text = await upstream.text()
      if (!upstream.ok) { send(res,upstream.status,{error:statusError(upstream.status,text)}); return }
      let parsed:any; try { parsed=JSON.parse(text) } catch { throw new Error('Unable to upload file') }
      if (parsed?.uploaded !== true) throw new Error('Unable to upload file')
      send(res,upstream.status,{data:{uploaded:true}}); return
    }
    if (action === 'photo' || action === 'music') {
      const username = url.searchParams.get('username') || ''; const key = url.searchParams.get('key') || ''
      const fileId = url.searchParams.get('fileId') || ''
      if (!/^galaxy-[a-z0-9-]{8,39}$/.test(username) || (key && !/^[0-9a-f]{64}$/.test(key)) || (action === 'photo' && !validUuid(fileId))) { send(res,404,{error:'Love Galaxy media not found'}); return }
      const upstream = await edgeRequest(fetcher,req,'media',{username,key,kind:action === 'photo' ? 'photo' : 'music',fileId})
      if (!upstream.ok) { const text=await upstream.text(); send(res,upstream.status,{error:statusError(upstream.status,text)}); return }
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      const bytes = Buffer.from(await upstream.arrayBuffer())
      res.writeHead(200,{ 'Cache-Control':'no-store', 'Content-Type':contentType, 'Content-Length':String(bytes.length), 'X-Content-Type-Options':'nosniff' })
      res.end(bytes); return
    }
    if (action === 'public') {
      const username = url.searchParams.get('username') || ''; const key = url.searchParams.get('key') || ''
      if (!/^galaxy-[a-z0-9-]{8,39}$/.test(username) || (key && !/^[0-9a-f]{64}$/.test(key))) { send(res,404,{error:'Love Galaxy not found or unavailable'}); return }
      const upstream = await edgeRequest(fetcher,req,'public',{username,key})
      const text = await upstream.text()
      if (!upstream.ok) { send(res,upstream.status,{error:statusError(upstream.status,text)}); return }
      const value:any = JSON.parse(text); const payload = publicGalaxy(value?.galaxy,null,`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`,key || null)
      send(res,200,{data:payload}); return
    }
    if (action === 'discoverable') {
      const upstream = await edgeRequest(fetcher,req,'discoverable',{})
      const text = await upstream.text()
      if (!upstream.ok) { send(res,upstream.status,{error:statusError(upstream.status,text)}); return }
      const value:any = JSON.parse(text)
      send(res,200,{data:{worlds:publicJourneyWorlds(value?.worlds)}}); return
    }
    const body = await readJson(req)
    if (action === 'start') {
      const input = body.input
      const files = body.files
      if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(files) || ![4,5].includes(files.length)) throw Object.assign(new Error('Choose exactly four photos'),{status:400})
      const cleanedFiles = files.map((file:any,index:number) => {
        if (!file || typeof file !== 'object' || Array.isArray(file) || !['photo','music'].includes(file.kind) || typeof file.type !== 'string' || !Number.isSafeInteger(file.size)) throw Object.assign(new Error('Invalid file metadata'),{status:400})
        const photo = file.kind === 'photo'; const mime = file.type.toLowerCase()
        if (!(photo ? PHOTO_TYPES : MUSIC_TYPES).has(mime) || file.size < 1 || file.size > (photo ? MAX_PHOTO_BYTES : MUSIC_MAX)) throw Object.assign(new Error(photo ? 'Photo exceeds 4.49 MB' : 'Music exceeds 4 MB'),{status:400})
        if (index < 4 && !photo || index === 4 && !file.kind.includes('music')) throw Object.assign(new Error('Choose exactly four photos'),{status:400})
        return {kind:file.kind,size:file.size,type:mime}
      })
      const cleanedInput = {
        title: String((input as any).title || '').trim(),
        ring_text_one: String((input as any).ring_text_one || '').trim(),
        ring_text_two: String((input as any).ring_text_two || '').trim(),
        music_track: (input as any).music_track,
        journey_discovery_enabled: (input as any).journey_discovery_enabled === true,
      }
      if ((input as any).journey_discovery_enabled !== undefined && typeof (input as any).journey_discovery_enabled !== 'boolean') throw Object.assign(new Error('Invalid Love Galaxy input'),{status:400})
      if (!cleanedInput.title || cleanedInput.title.length>120 || !cleanedInput.ring_text_one || cleanedInput.ring_text_one.length>64 || !cleanedInput.ring_text_two || cleanedInput.ring_text_two.length>64 || !['cosmic-orbit','custom'].includes(String(cleanedInput.music_track))) throw Object.assign(new Error('Invalid Love Galaxy input'),{status:400})
      if ((cleanedInput.music_track==='custom') !== (cleanedFiles.length===5)) throw Object.assign(new Error('Photo or music selection is incomplete'),{status:400})
      const upstream = await edgeRequest(fetcher,req,'start',{input:cleanedInput,files:cleanedFiles})
      const text=await upstream.text()
      if (!upstream.ok) { send(res,upstream.status,{error:statusError(upstream.status,text)}); return }
      const value:any=JSON.parse(text); const upload=value?.upload
      if (!validUuid(upload?.sessionId) || !/^[0-9a-f]{64}$/.test(upload?.sessionToken || '') || !Array.isArray(upload.uploads) || upload.uploads.length!==cleanedFiles.length) throw new Error('Unable to start Love Galaxy upload')
      const uploads=upload.uploads.map((item:any,index:number) => {
        if (!validUuid(item?.fileId) || item.kind!==cleanedFiles[index].kind || item.contentType!==cleanedFiles[index].type || item.size!==cleanedFiles[index].size) throw new Error('Unable to start Love Galaxy upload')
        return {fileId:item.fileId,kind:item.kind,contentType:item.contentType,size:item.size}
      })
      send(res,201,{data:{sessionId:upload.sessionId,sessionToken:upload.sessionToken,expiresAt:String(upload.expiresAt||''),uploads}}); return
    }
    if (action === 'finalize') {
      if (!validUuid(body.sessionId) || typeof body.sessionToken!=='string' || !/^[0-9a-f]{64}$/.test(body.sessionToken)) throw Object.assign(new Error('Invalid upload authorization'),{status:400})
      const upstream=await edgeRequest(fetcher,req,'finalize',{sessionId:body.sessionId,sessionToken:body.sessionToken})
      const text=await upstream.text()
      if (!upstream.ok) { send(res,upstream.status,{error:statusError(upstream.status,text)}); return }
      const value:any=JSON.parse(text)
      const origin=`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
      send(res,201,{data:publicGalaxy(value?.galaxy,value?.galaxy?.public_key || null,origin,null)}); return
    }
    if (action === 'cancel') {
      if (!validUuid(body.sessionId) || typeof body.sessionToken!=='string' || !/^[0-9a-f]{64}$/.test(body.sessionToken)) throw Object.assign(new Error('Invalid upload authorization'),{status:400})
      const upstream=await edgeRequest(fetcher,req,'cancel',{sessionId:body.sessionId,sessionToken:body.sessionToken})
      const text=await upstream.text()
      if (!upstream.ok) { send(res,upstream.status,{error:statusError(upstream.status,text)}); return }
      const value:any=JSON.parse(text); send(res,200,{data:{canceled:!!value?.result?.canceled}}); return
    }
  } catch (error:any) {
    const status=Number.isInteger(error?.status)?error.status:400
    const message=error instanceof Error ? error.message : ''
    const safe=new Set(['Invalid Love Galaxy input','Choose exactly four photos','Photo exceeds 4.49 MB','Music exceeds 4 MB','File MIME type not allowed','Photo or music selection is incomplete','Invalid upload authorization','Request too large','Client identity unavailable','Service unavailable'])
    send(res,status,safe.has(message)?{error:message}:{error:status>=500?'Service unavailable':'Unable to complete Love Galaxy request'})
  }
  }
}
export default createLoveGalaxyHandler()
