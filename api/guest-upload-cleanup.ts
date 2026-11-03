import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

export const config = { api: { bodyParser: false } }
const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
}
const reply = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, jsonHeaders)
  res.end(JSON.stringify(body))
}

function matchesBearer(value: string, secret: string) {
  if (secret.length < 32 || value.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(value), Buffer.from(secret))
}

export default async function guestUploadCleanup(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    reply(res, 405, { error: 'Method not allowed' })
    return
  }

  const cronSecret = process.env.CRON_SECRET || ''
  const rawAuthorization = req.headers.authorization
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] || '' : rawAuthorization || ''
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!matchesBearer(supplied, cronSecret)) {
    reply(res, 401, { error: 'Unauthorized' })
    return
  }

  const bridgeSecret = process.env.GUEST_UPLOAD_BRIDGE_SECRET || ''
  const supabaseUrl = process.env.SUPABASE_URL || ''
  if (bridgeSecret.length < 32 || !supabaseUrl) {
    reply(res, 503, { error: 'Cleanup service is not configured' })
    return
  }

  let endpoint: URL
  try {
    const base = new URL(supabaseUrl)
    if (base.protocol !== 'https:' || base.hostname !== 'ryqnovjcrimzzwvzmzqp.supabase.co') {
      reply(res, 503, { error: 'Cleanup service is not configured' })
      return
    }
    endpoint = new URL('/functions/v1/guest-upload', base)
  } catch {
    reply(res, 503, { error: 'Cleanup service is not configured' })
    return
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://love-birds-mm.vercel.app',
        'x-invitation-upload-bridge': bridgeSecret,
      },
      body: JSON.stringify({ action: 'cleanup' }),
      cache: 'no-store',
    })
    if (!upstream.ok) {
      reply(res, 502, { error: upstream.status === 403 ? 'Cleanup service authorization failed' : 'Cleanup service failed' })
      return
    }
    const result = await upstream.json() as { cleanedSessions?: unknown }
    const cleanedSessions = Number(result?.cleanedSessions)
    if (!Number.isInteger(cleanedSessions) || cleanedSessions < 0 || cleanedSessions > 10) {
      reply(res, 502, { error: 'Unexpected cleanup result' })
      return
    }
    reply(res, 200, { ok: true, cleanedSessions })
  } catch {
    reply(res, 502, { error: 'Cleanup service unavailable' })
  }
}
