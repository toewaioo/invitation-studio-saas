import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createVenueMapHandler } from '../api/venue-map'

const short = 'https://maps.app.goo.gl/CS6Q7snZngXwxkm87'
const place = 'https://www.google.com/maps/place/2328%2B426+Lotaya+Hinthada+Monastery,+Yangon/data=!4m2!3m1!1s0x30c1bd5776a6b0ed:0xe4f27be8675ffe2e!18m1!1e1'

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } })
}
function response(embed = '') {
  return new Response(JSON.stringify({ embed }), { headers: { 'content-type': 'application/json' } })
}

async function request(handler: ReturnType<typeof createVenueMapHandler>, path: string, method = 'GET') {
  const server = createServer((req, res) => { void handler(req, res) })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  try { return await fetch(`http://127.0.0.1:${port}${path}`, { method }) }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

describe('venue map API', () => {
  test('follows an approved short-link redirect and returns the shared parser embed', async () => {
    const calls: string[] = []
    const handler = createVenueMapHandler({ fetch: async (input, init) => {
      calls.push(String(input))
      expect(init?.redirect).toBe('manual')
      expect(init?.credentials).toBeUndefined()
      return redirect(place)
    } })
    const result = await (await request(handler, `/api/venue-map?url=${encodeURIComponent(short)}`)).json() as { embed: string }
    expect(result.embed).toContain('Lotaya%20Hinthada%20Monastery')
    expect(calls).toEqual([short])
  })

  test('does not fetch a disallowed redirect', async () => {
    let calls = 0
    const handler = createVenueMapHandler({ fetch: async () => { calls += 1; return redirect('https://evil.example/steal') } })
    const result = await (await request(handler, `/api/venue-map?url=${encodeURIComponent(short)}`)).json() as { embed: string }
    expect(result).toEqual({ embed: '' })
    expect(calls).toBe(1)
  })

  test('bounds redirect chains and returns empty when a fetch fails or times out', async () => {
    let calls = 0
    const handler = createVenueMapHandler({ fetch: async (_input, init) => {
      calls += 1
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return redirect(short)
    } })
    const result = await (await request(handler, `/api/venue-map?url=${encodeURIComponent(short)}`)).json() as { embed: string }
    expect(result).toEqual({ embed: '' })
    expect(calls).toBe(5)

    const failing = createVenueMapHandler({ fetch: async () => { throw new Error('timeout') } })
    expect(await (await request(failing, `/api/venue-map?url=${encodeURIComponent(short)}`)).json()).toEqual({ embed: '' })
  })

  test('rejects invalid inputs without an upstream request', async () => {
    let calls = 0
    const handler = createVenueMapHandler({ fetch: async () => { calls += 1; return response() } })
    const result = await request(handler, '/api/venue-map?url=https%3A%2F%2Fevil.example%2Fmaps')
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ embed: '' })
    expect((await request(handler, '/api/venue-map')).status).toBe(400)
    expect(calls).toBe(0)
  })

  test('cache is isolated per handler instance', async () => {
    let firstCalls = 0
    let secondCalls = 0
    const first = createVenueMapHandler({ fetch: async () => { firstCalls += 1; return redirect(place) } })
    const second = createVenueMapHandler({ fetch: async () => { secondCalls += 1; return redirect('https://evil.example/') } })
    const path = `/api/venue-map?url=${encodeURIComponent(short)}`
    expect((await (await request(first, path)).json() as { embed: string }).embed).toContain('Lotaya')
    expect((await (await request(first, path)).json() as { embed: string }).embed).toContain('Lotaya')
    expect((await (await request(second, path)).json() as { embed: string }).embed).toBe('')
    expect(firstCalls).toBe(1)
    expect(secondCalls).toBe(1)
  })
})
