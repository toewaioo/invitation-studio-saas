import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_PHOTOS = 3, MAX_PHOTO_BYTES = 9 * 1024 * 1024, MAX_TOTAL_BYTES = 27 * 1024 * 1024
const inputKeys = ['title','person_a','person_b','parent_a','parent_b','event_date','event_time','venue','message','map_url','template','theme','project_type']
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', Vary: 'Origin' }
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
  // Deno.serve authenticates the server-only Vercel bridge before this header is used.
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip')?.trim() || request.headers.get('x-real-ip')?.trim() || null
}
// Supabase provides the service credential only inside the Edge runtime. It never leaves this function.
// A dedicated salt can override it; domain separation keeps the fallback specific to IP hashing.
const ipSalt = () => Deno.env.get('IP_HASH_SALT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
async function sha256(value: string) { const salt = ipSalt(); if (!salt) throw new Error('IP hash salt is not configured'); const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('guest-invitation-ip:v1:' + value + ':' + salt)); return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('') }
function stringField(input: Record<string, unknown>, key: string, max: number, required = false) { const value = input[key] ?? ''; if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Invalid ${key}`); return value }
function decodePhoto(dataUrl: unknown): { dataUrl: string, caption: string, position: number, bytes: number } {
  if (!dataUrl || typeof dataUrl !== 'string') throw new Error('Invalid photo data URL')
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i); if (!match) throw new Error('Invalid photo data URL')
  let bytes: Uint8Array; try { const raw = atob(match[2]); bytes = Uint8Array.from(raw, c => c.charCodeAt(0)) } catch { throw new Error('Invalid photo encoding') }
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('Photo exceeds 9 MiB')
  const mime = match[1].toLowerCase(), ok = mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : mime === 'image/png' ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  if (!ok) throw new Error('Photo magic bytes do not match type')
  return { dataUrl, caption: '', position: 0, bytes: bytes.length }
}

Deno.serve(async request => {
  const origin = allowedOrigin(request)
  if (!validBridgeSecret(request)) return fail('Guest gateway authorization required', 403, origin || undefined)
  if (!ipSalt() || !Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return fail('Guest endpoint is not configured', 503)
  if (request.method === 'OPTIONS') return origin ? response({}, 204, origin) : fail('Origin not allowed', 403)
  if (!origin || request.method !== 'POST') return fail('Origin or method not allowed', 403)
  const ip = ipAddress(request); if (!ip) return fail('Client identity unavailable', 400, origin)
  try {
    const contentLength = Number(request.headers.get('content-length') || 0); if (contentLength > 4.5 * 1024 * 1024) throw new Error('Request too large'); const reader = request.body?.getReader(); if (!reader) throw new Error('Request body required'); const decoder = new TextDecoder(); let raw = '', requestBytes = 0; for (;;) { const chunk = await reader.read(); if (chunk.done) break; requestBytes += chunk.value.byteLength; if (requestBytes > 4.5 * 1024 * 1024) throw new Error('Request too large'); raw += decoder.decode(chunk.value, { stream: true }) } raw += decoder.decode(); const body = JSON.parse(raw); if (!body || typeof body !== 'object') throw new Error('Invalid JSON')
    const input = (body as Record<string, unknown>).input; const rawPhotos = (body as Record<string, unknown>).photos
    if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(rawPhotos) || rawPhotos.length < 1 || rawPhotos.length > MAX_PHOTOS) throw new Error('Invalid payload')
    const source = input as Record<string, unknown>; const clean: Record<string, any> = {}
    for (const key of inputKeys) clean[key] = stringField(source, key, key === 'message' ? 350 : key === 'map_url' ? 1200 : key === 'title' ? 120 : key.startsWith('parent_') ? 180 : key.startsWith('person_') ? 60 : 220, ['title','person_a','person_b','venue','message','event_date','event_time'].includes(key))
    const hasSchedule = source.schedule !== undefined
    if (hasSchedule) {
      if (!Array.isArray(source.schedule) || source.schedule.length > 4) throw new Error('Invalid schedule')
      clean.schedule = source.schedule.map((item: unknown) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid schedule')
        const value = item as Record<string, unknown>
        if (typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || typeof value.label !== 'string' || value.label.length > 100 || !value.label.trim()) throw new Error('Invalid schedule')
        return { time: value.time, label: value.label }
      })
    }
    const dateMatch = clean.event_date.match(/^(\d{4})-(\d{2})-(\d{2})$/); const date = dateMatch ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))) : null; if (!date || date.getUTCFullYear() !== Number(dateMatch![1]) || date.getUTCMonth() !== Number(dateMatch![2]) - 1 || date.getUTCDate() !== Number(dateMatch![3]) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean.event_time)) throw new Error('Invalid date or time')
    if (clean.map_url && !/^https:\/\/(www\.google\.com|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl)(\/[^\s]*)?$/i.test(clean.map_url)) throw new Error('Invalid map URL')
    if (!['thazin','noir','rose'].includes(clean.template) || !['sage','midnight','rose','blue'].includes(clean.theme) || clean.project_type !== 'wedding') throw new Error('Invalid design')
    let total = 0; const photos = rawPhotos.map((photo: unknown, i) => { if (!photo || typeof photo !== 'object') throw new Error('Invalid photo'); const x = photo as Record<string, unknown>; const decoded = decodePhoto(x.dataUrl); const caption = typeof x.caption === 'string' && x.caption.length <= 350 ? x.caption : ''; total += decoded.bytes; if (total > MAX_TOTAL_BYTES) throw new Error('Photos exceed 27 MiB combined'); return { id: crypto.randomUUID(), url: decoded.dataUrl, caption, position: i } })
    const service = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false } })
    const args: Record<string, unknown> = { p_ip_hash: await sha256(ip), p_input: clean, p_photos: photos }
    if (hasSchedule) args.p_schedule = clean.schedule
    const { data: project, error } = await service.rpc('create_guest_invitation', args)
    if (error || !project) {
      if (hasSchedule && error && /function .*create_guest_invitation.*does not exist|could not find the function/i.test(error.message)) return fail('Schedule persistence is unavailable; apply the schedule migration', 503, origin)
      return fail(error?.message?.includes('Rate limit') || error?.message?.includes('Daily limit') ? 'Rate limit exceeded' : 'Unable to create invitation', error?.message?.includes('Rate limit') || error?.message?.includes('Daily limit') ? 429 : 400, origin)
    }
    return response({ project }, 201, origin)
  } catch (error) { return fail(error instanceof Error ? error.message : 'Invalid request', 400, origin) }
})
