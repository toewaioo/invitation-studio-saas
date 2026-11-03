import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../supabase/functions/invitation-photo/index.ts', import.meta.url), 'utf8');
const compiled = await new Bun.Transpiler({ loader: 'ts' }).transform(source.replace("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'", ''));
const username = 'guest-test';
const shareKey = 'safe-share-key';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const photoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const storagePath = `guest-staging/${sessionId}/${photoId}.jpg`;

function makeHarness(photoPath = storagePath, validShare = true) {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const downloads: string[] = [];
  const DenoStub = { env: { get: (name: string) => name === 'SUPABASE_URL' ? 'https://supabase.example' : name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-only-key' : undefined }, serve: (fn: (request: Request) => Promise<Response>) => { handler = fn; } };
  const createClient = () => ({
    from: (table: string) => {
      const filters: Record<string, string> = {};
      const builder = {
        select: (_columns: string) => builder,
        eq: (key: string, value: string) => { filters[key] = value; return builder; },
        maybeSingle: async () => {
          if (table === 'projects') return { data: null, error: null };
          if (table === 'guest_invitations' && validShare && filters.username === username && filters.public_key === shareKey && filters.status === 'published') {
            return { data: { photos: [{ id: photoId, storage_path: photoPath }] }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
    storage: { from: (_bucket: string) => ({ download: async (path: string) => {
      downloads.push(path);
      return { data: new Blob([new Uint8Array([0xff,0xd8,0xff])], { type: 'image/jpeg' }), error: null };
    } }) },
  });
  new Function('Deno', 'createClient', compiled)(DenoStub, createClient);
  if (!handler) throw new Error('Photo proxy did not register a handler');
  const request = (user = username, key = shareKey, photo = photoId) => new Request(`https://edge.example/invitation-photo?username=${user}&key=${key}&photo=${photo}`);
  return { handler, request, downloads };
}

describe('private guest photo proxy', () => {
  test('serves only the exact photo object linked to a published share and never exposes a Storage URL', async () => {
    const h = makeHarness();
    const response = await h.handler(h.request());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff,0xd8,0xff]));
    expect(h.downloads).toEqual([storagePath]);
  });

  test('rejects arbitrary storage paths and invalid or revoked share keys without downloading', async () => {
    const badPath = makeHarness('private/other-project/photo.jpg');
    expect((await badPath.handler(badPath.request())).status).toBe(404);
    expect(badPath.downloads).toHaveLength(0);
    const revoked = makeHarness(storagePath, false);
    expect((await revoked.handler(revoked.request())).status).toBe(404);
    expect(revoked.downloads).toHaveLength(0);
  });
});
