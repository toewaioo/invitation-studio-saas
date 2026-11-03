import type { IncomingMessage, ServerResponse } from 'node:http'
import { venueMap } from '../src/components/invitationData.js'

const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 4_000
const CACHE_MAX = 128
const CACHE_TTL_MS = 5 * 60 * 1_000

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type Deps = { fetch?: Fetcher; now?: () => number }
type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>
type CacheEntry = { embed: string; expires: number }

const EMPTY = { embed: '' }

/** Google Maps hosts and the only paths accepted by this resolver. */
function isApprovedMapsUrl(value: string): URL | null {
  if (value.length > 4096) return null
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  const path = url.pathname
  if (host === 'maps.app.goo.gl') {
    return /^\/[A-Za-z0-9_-]+\/?$/.test(path) ? url : null
  }
  if (host === 'goo.gl') return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(path) ? url : null
  if (host === 'maps.google.com') return /^\/maps(?:\/|$)/.test(path) ? url : null
  if (host === 'www.google.com' || host === 'google.com') {
    return /^\/maps(?:\/|$)/.test(path) ? url : null
  }
  return null
}

function requestUrl(req: IncomingMessage): URL | null {
  try {
    return new URL(req.url || '/', 'http://venue-map.local')
  } catch {
    return null
  }
}

function send(res: ServerResponse, status: number, body: typeof EMPTY) {
  if (res.headersSent) return
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  })
  res.end(JSON.stringify(body))
}

async function fetchRedirect(fetcher: Fetcher, url: URL): Promise<URL | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetcher(url.href, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })
    if (response.status < 300 || response.status >= 400) return null
    const location = response.headers.get('location')
    await response.body?.cancel()
    return location ? isApprovedMapsUrl(new URL(location, url).href) : null
  } finally {
    clearTimeout(timer)
  }
}

async function resolve(input: string, fetcher: Fetcher): Promise<string> {
  let current = isApprovedMapsUrl(input)
  if (!current) return ''
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const parsed = venueMap('', current.href)
    if (parsed.embed) return parsed.embed
    if (redirects === MAX_REDIRECTS) return ''
    const next = await fetchRedirect(fetcher, current)
    if (!next) return ''
    current = next
  }
  return ''
}

export function createVenueMapHandler(deps: Deps = {}): Handler {
  const fetcher = deps.fetch || fetch
  const now = deps.now || Date.now
  const cache = new Map<string, CacheEntry>()

  return async (req, res) => {
    if (req.method === 'OPTIONS') {
      send(res, 204, EMPTY)
      return
    }
    if (req.method !== 'GET') {
      send(res, 405, EMPTY)
      return
    }
    const request = requestUrl(req)
    const raw = request?.searchParams.get('url')?.trim() || ''
    const supplied = isApprovedMapsUrl(raw)
    if (!supplied) {
      send(res, raw ? 200 : 400, EMPTY)
      return
    }
    const key = supplied.href
    const currentTime = now()
    const hit = cache.get(key)
    if (hit && hit.expires > currentTime) {
      send(res, 200, { embed: hit.embed })
      return
    }
    if (hit) cache.delete(key)
    try {
      const embed = await resolve(key, fetcher)
      if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value
        if (oldest) cache.delete(oldest)
      }
      cache.set(key, { embed, expires: currentTime + CACHE_TTL_MS })
      send(res, 200, { embed })
    } catch {
      send(res, 200, EMPTY)
    }
  }
}

export { isApprovedMapsUrl, resolve }
export default createVenueMapHandler()
