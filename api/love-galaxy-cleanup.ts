import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { runLoveGalaxyCleanup } from './love-galaxy.js'

const reply = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store, no-cache, must-revalidate', Pragma:'no-cache' })
  res.end(JSON.stringify(body))
}
function authorized(value: string, expected: string) {
  if (expected.length < 32 || value.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected))
}
export default async function loveGalaxyCleanup(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); reply(res,405,{error:'Method not allowed'}); return }
  const raw = req.headers.authorization
  const authorization = Array.isArray(raw) ? raw[0] || '' : raw || ''
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!authorized(supplied,process.env.CRON_SECRET || '')) { reply(res,401,{error:'Unauthorized'}); return }
  try { reply(res,200,{ok:true,cleanedSessions:await runLoveGalaxyCleanup()}) }
  catch { reply(res,503,{error:'Love Galaxy cleanup is unavailable'}) }
}
