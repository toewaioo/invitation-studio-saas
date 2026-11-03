import { afterEach, describe, expect, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import guestUploadCleanup from '../api/guest-upload-cleanup'

const savedEnv = {
  CRON_SECRET: process.env.CRON_SECRET,
  GUEST_UPLOAD_BRIDGE_SECRET: process.env.GUEST_UPLOAD_BRIDGE_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
}
const originalFetch = globalThis.fetch
const secret = 'cron-unit-test-secret-with-at-least-32-chars'
const bridge = 'bridge-unit-test-secret-with-at-least-32-chars'

function fixture(method = 'GET', authorization?: string) {
  let status = 0
  let body = ''
  const headers: Record<string, unknown> = {}
  const req = { method, headers: authorization ? { authorization } : {} } as IncomingMessage
  const res = {
    writeHead(code: number, values: Record<string, unknown>) { status = code; Object.assign(headers, values); return this },
    setHeader(name: string, value: unknown) { headers[name] = value; return this },
    end(value?: string) { body = value || ''; return this },
  } as unknown as ServerResponse
  return { req, res, result: () => ({ status, body: body ? JSON.parse(body) : null, headers }) }
}

function configure() {
  process.env.CRON_SECRET = secret
  process.env.GUEST_UPLOAD_BRIDGE_SECRET = bridge
  process.env.SUPABASE_URL = 'https://ryqnovjcrimzzwvzmzqp.supabase.co'
}

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  globalThis.fetch = originalFetch
})

describe('guest upload cleanup Cron route', () => {
  test('rejects unauthenticated requests without contacting Supabase', async () => {
    configure()
    let called = false
    globalThis.fetch = (async () => { called = true; return new Response('{}') }) as unknown as typeof fetch
    const { req, res, result } = fixture()
    await guestUploadCleanup(req, res)
    expect(result().status).toBe(401)
    expect(called).toBe(false)
  })

  test('forwards only the cleanup action to the exact production Edge Function with server-held bridge auth', async () => {
    configure()
    let observedUrl = ''
    let observedInit: RequestInit | undefined
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      observedUrl = String(input)
      observedInit = init
      return new Response(JSON.stringify({ cleanedSessions: 1 }), { status: 200 })
    }) as typeof fetch
    const { req, res, result } = fixture('GET', `Bearer ${secret}`)
    await guestUploadCleanup(req, res)
    expect(result().status).toBe(200)
    expect(result().body).toEqual({ ok: true, cleanedSessions: 1 })
    expect(observedUrl).toBe('https://ryqnovjcrimzzwvzmzqp.supabase.co/functions/v1/guest-upload')
    const headers = new Headers(observedInit?.headers)
    expect(headers.get('x-invitation-upload-bridge')).toBe(bridge)
    expect(headers.get('origin')).toBe('https://love-birds-mm.vercel.app')
    expect(observedInit?.body).toBe('{"action":"cleanup"}')
  })

  test('fails closed when the configured Supabase target is not the production project', async () => {
    configure()
    process.env.SUPABASE_URL = 'https://wrong-project.supabase.co'
    let called = false
    globalThis.fetch = (async () => { called = true; return new Response('{}') }) as unknown as typeof fetch
    const { req, res, result } = fixture('GET', `Bearer ${secret}`)
    await guestUploadCleanup(req, res)
    expect(result().status).toBe(503)
    expect(called).toBe(false)
  })
})
