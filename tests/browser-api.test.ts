import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { apiRequest, ownerAuth } from '../src/lib/api';
import { ServerRepository } from '../src/lib/repository';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const ok = (data: unknown) => new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });

describe('same-origin browser API boundary', () => {
  test('all browser source excludes Supabase clients, keys, RPC, storage and direct URLs', () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(join(dir, x.name)) : /\.(tsx?|js)$/.test(x.name) ? [join(dir, x.name)] : []);
    for (const file of walk(join(import.meta.dir, '../src'))) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/@supabase\/supabase-js|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE|VITE_STUDIO_ADMIN|\.supabase\.co|\.rpc\(|\.storage\.from\(|signedUrl|upload\/resumable/);
    }
  });
  test('sends only same-origin cookies and relative URLs, with JSON action payloads', async () => {
    let captured: { url: string; init?: RequestInit } | undefined;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => { captured = { url: String(url), init }; return ok(true); }) as unknown as typeof fetch;
    expect(await apiRequest<boolean>('usernameAvailable', { query: { username: 'a b', exceptId: undefined } })).toBe(true);
    expect(captured?.url).toBe('/api/studio?action=usernameAvailable&username=a+b');
    expect(captured?.init?.credentials).toBe('same-origin');
    expect(captured?.init?.cache).toBe('no-store');
    await apiRequest('revoke', { body: { projectId: 'id' } });
    expect(captured?.init?.method).toBe('POST');
    expect(captured?.init?.body).toBe('{"projectId":"id"}');
    expect(captured?.init?.headers).not.toHaveProperty('Authorization');
  });
  test('rejects server errors and accidental SPA HTML without local-data fallback', async () => {
    globalThis.fetch = (async () => new Response('{"error":"Please sign in first"}', { status: 401 })) as unknown as typeof fetch;
    await expect(new ServerRepository().list()).rejects.toThrow('Please sign in first');
    globalThis.fetch = (async () => new Response('<html>SPA fallback</html>')) as unknown as typeof fetch;
    await expect(apiRequest('list')).rejects.toThrow('The server could not complete');
  });
  test('owner login/logout notification contains identity only and clears state', async () => {
    const sessions: unknown[] = [], off = ownerAuth.subscribe(x => sessions.push(x));
    globalThis.fetch = (async (url: RequestInfo | URL) => String(url).includes('login') ? ok({ user: { id: 'owner' }, isOwner: true }) : ok({ user: null, isOwner: false })) as unknown as typeof fetch;
    try {
      await ownerAuth.signIn('owner@example.test', 'password');
      await ownerAuth.signOut();
      expect(sessions).toEqual([{ user: { id: 'owner' }, isOwner: true }, { user: null, isOwner: false }]);
    } finally { off(); }
  });
  test('uploads raw binary files individually through the same-origin API at the 4.49 MB cap', async () => {
    const p = { id: 'project', status: 'draft', photos: [] as { id: string }[] }, requests: RequestInit[] = [];
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init || {});
      return ok(init?.method === 'POST' ? { ...p, photos: [{ id: 'photo' }] } : p);
    }) as unknown as typeof fetch;
    const file = new File([new Uint8Array(4_490_000)], 'photo.png', { type: 'image/png' });
    await new ServerRepository().upload('project', [file]);
    expect(requests[1].body).toBe(file);
    expect(requests[1].headers).toEqual({ 'Content-Type': 'image/png' });
  });
  test('the SPA rewrite excludes the server API namespace', () => {
    const config = JSON.parse(readFileSync(join(import.meta.dir, '../vercel.json'), 'utf8'));
    const pattern = new RegExp(`^${config.rewrites[0].source}$`);
    expect(pattern.test('/api/studio')).toBe(false);
    expect(pattern.test('/api')).toBe(false);
    expect(pattern.test('/manage')).toBe(true);
    expect(pattern.test('/i/guest-one')).toBe(true);
  });
});
