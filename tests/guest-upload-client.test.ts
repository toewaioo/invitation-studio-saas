import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { normalizeGuestPhotoMime } from '../src/lib/photoMime';

const source = readFileSync(new URL('../src/lib/guestInvitation.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '');
const compiled = await new Bun.Transpiler({ loader: 'ts' }).transform(source);
const executable = compiled.replace(/export const /g, 'const ').replace(/export function /g, 'function ').replace(/export async function /g, 'async function ');
const input = {
  title: 'Wedding day', customer_name: 'PRIVATE NAME', customer_email: 'private@example.test', customer_phone: 'private-phone', private_notes: 'PRIVATE NOTES',
  person_a: 'A', person_b: 'B', parent_a: '', parent_b: '', event_date: '2027-02-14', event_time: '18:30', venue: 'Hall', message: 'Welcome',
  map_url: '', username: 'private-user', template: 'thazin', theme: 'sage', project_type: 'wedding', schedule: [{ time: '18:30', label: 'Reception' }],
};
const pngHeader = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const photo = new File([pngHeader], 'portrait.jpg', { type: 'image/jpeg' });

function makeClient(uploadOk = true) {
  const actions: Array<{ action: string; options: any }> = [];
  const apiRequest = async (action: string, options: any = {}) => {
    actions.push({ action, options });
    if (action === 'guestUploadStart') return { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionToken: 'f'.repeat(64), expiresAt: '2030-01-01T00:00:00.000Z', uploads: options.body.photos.map((item: any) => ({ photoId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', contentType: item.type, size: item.size })) };
    if (action === 'guestUploadFile') {
      if (!uploadOk) throw new Error('Upload failed');
      return { uploaded: true };
    }
    if (action === 'guestUploadFinalize') return { id: 'published-id', username: 'guest-demo', status: 'published', public_key: 'share-key', photos: [{ id: 'photo-id', caption: '', position: 0, url: '/api/studio?action=publicPhoto' }] };
    if (action === 'guestUploadCancel') return { canceled: true };
    throw new Error(`Unexpected API action ${action}`);
  };
  const factory = new Function('apiRequest','normalizeProjectInput','isSupabaseConfigured','validateUploadResolution','MAX_PHOTO_BYTES','normalizeGuestPhotoMime', `${executable}\nreturn createGuestInvitation;`);
  const createGuestInvitation = factory(apiRequest, (value: any) => value, true, async () => {}, 4_490_000, normalizeGuestPhotoMime) as (value: any, files: File[]) => Promise<any>;
  return { createGuestInvitation, actions };
}

describe('guest proxied-upload browser client', () => {
  test('sends public metadata only and forwards raw bytes to the same-origin Vercel API, then finalizes', async () => {
    const client = makeClient();
    const project = await client.createGuestInvitation(input as any, [photo]);
    expect(project.public_key).toBe('share-key');
    expect(client.actions.map(call => call.action)).toEqual(['guestUploadStart','guestUploadFile','guestUploadFinalize']);
    const startBody = client.actions[0].options.body;
    expect(startBody.input.customer_name).toBeUndefined();
    expect(startBody.input.customer_email).toBeUndefined();
    expect(startBody.input.customer_phone).toBeUndefined();
    expect(startBody.input.private_notes).toBeUndefined();
    expect(startBody.input.username).toBeUndefined();
    expect(startBody.photos).toEqual([{ size: photo.size, type: 'image/png' }]);
    expect(JSON.stringify(startBody)).not.toContain('PRIVATE');
    const upload = client.actions[1].options;
    expect(upload.raw).not.toBe(photo);
    expect(upload.raw.type).toBe('image/png');
    expect(new Uint8Array(await upload.raw.arrayBuffer())).toEqual(pngHeader);
    expect(upload.headers).toEqual({
      'x-guest-session-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'x-guest-session-token': 'f'.repeat(64),
      'x-guest-photo-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(upload).not.toHaveProperty('url');
    expect(client.actions[2].options.body).toEqual({ sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionToken: 'f'.repeat(64) });
  });

  test('cancels the server session if the proxied upload fails and does not finalize', async () => {
    const client = makeClient(false);
    await expect(client.createGuestInvitation(input as any, [photo])).rejects.toThrow('Upload failed');
    expect(client.actions.map(call => call.action)).toEqual(['guestUploadStart','guestUploadFile','guestUploadCancel']);
  });
});
