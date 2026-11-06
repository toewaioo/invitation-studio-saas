import { validateUploadResolution, MAX_PHOTO_BYTES } from './validation';
import { normalizeGuestPhotoMime } from './photoMime';

export const LOVE_GALAXY_PHOTO_COUNT = 4;
export const LOVE_GALAXY_MUSIC_BYTES = 4_000_000;
export const LOVE_GALAXY_MUSIC_TRACKS = ['cosmic-orbit', 'custom'] as const;
export type LoveGalaxyMusicTrack = typeof LOVE_GALAXY_MUSIC_TRACKS[number];

export interface LoveGalaxyInput {
  title: string;
  ring_text_one: string;
  ring_text_two: string;
  music_track: LoveGalaxyMusicTrack;
  journey_discovery_enabled?: boolean;
}
export interface LoveGalaxyPhoto {
  id: string;
  url: string;
  position: number;
}
export interface LoveGalaxy {
  id: string;
  username: string;
  public_key: string | null;
  status: 'published';
  title: string;
  ring_text_one: string;
  ring_text_two: string;
  music_track: LoveGalaxyMusicTrack;
  music_url: string | null;
  photos: LoveGalaxyPhoto[];
  created_at: string;
}
export interface DiscoverableLoveGalaxy {
  username: string;
  title: string;
}

type UploadFile = { kind: 'photo' | 'music'; file: File };
type UploadStart = {
  sessionId: string;
  sessionToken: string;
  expiresAt: string;
  uploads: Array<{ fileId: string; kind: 'photo' | 'music'; contentType: string; size: number }>;
};

async function galaxyRequest<T>(action: string, options: { query?: Record<string, string | undefined>; body?: unknown; raw?: Blob; headers?: Record<string, string> } = {}): Promise<T> {
  const query = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(options.query || {})) if (value !== undefined) query.set(key, value);
  const mutating = options.body !== undefined || options.raw !== undefined;
  const response = await fetch(`/api/love-galaxy?${query}`, {
    method: mutating ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: mutating ? { 'Content-Type': options.raw?.type || 'application/json', ...(options.headers || {}) } : undefined,
    body: options.raw || (mutating ? JSON.stringify(options.body) : undefined),
  });
  const payload = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok || !payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) throw new Error(payload?.error || 'The Love Galaxy service could not complete this request.');
  return payload.data as T;
}

const MUSIC_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav']);

export function normalizeLoveGalaxyInput(input: LoveGalaxyInput): LoveGalaxyInput {
  const title = String(input.title || '').trim();
  const ring_text_one = String(input.ring_text_one || '').trim();
  const ring_text_two = String(input.ring_text_two || '').trim();
  const music_track = input.music_track;
  if (!title || title.length > 120) throw new Error('Give your Love Galaxy a title up to 120 characters.');
  if (!ring_text_one || ring_text_one.length > 64) throw new Error('Ring phrase 1 is required and must be 64 characters or fewer.');
  if (!ring_text_two || ring_text_two.length > 64) throw new Error('Ring phrase 2 is required and must be 64 characters or fewer.');
  if (!LOVE_GALAXY_MUSIC_TRACKS.includes(music_track)) throw new Error('Choose a supported music option.');
  return { title, ring_text_one, ring_text_two, music_track, journey_discovery_enabled: input.journey_discovery_enabled === true };
}

function safeFile(file: File, kind: 'photo' | 'music') {
  if (kind === 'photo') {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) throw new Error('Use JPG, PNG or WEBP photos.');
    if (file.size < 1 || file.size > MAX_PHOTO_BYTES) throw new Error('Each photo must be 4.49 MB or smaller.');
  } else {
    if (!MUSIC_TYPES.has(file.type.toLowerCase())) throw new Error('Use an MP3, M4A, AAC, OGG or WAV music file.');
    if (file.size < 1 || file.size > LOVE_GALAXY_MUSIC_BYTES) throw new Error('Music must be 4 MB or smaller for this preview.');
  }
}

async function fingerprint(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createLoveGalaxy(input: LoveGalaxyInput, photos: File[], musicFile?: File): Promise<LoveGalaxy> {
  if (photos.length !== LOVE_GALAXY_PHOTO_COUNT) throw new Error('Choose exactly four memory photos.');
  const payload = normalizeLoveGalaxyInput(input);
  if ((payload.music_track === 'custom') !== !!musicFile) throw new Error('Select a music file for custom music, or choose the included soundtrack.');

  const normalizedPhotos = await Promise.all(photos.map(normalizeGuestPhotoMime));
  for (const photo of normalizedPhotos) await validateUploadResolution(photo);
  for (const photo of normalizedPhotos) safeFile(photo, 'photo');
  const photoFingerprints = await Promise.all(normalizedPhotos.map(fingerprint));
  if (new Set(photoFingerprints).size !== LOVE_GALAXY_PHOTO_COUNT) throw new Error('Choose four different photos.');
  if (musicFile) safeFile(musicFile, 'music');

  const selectedFiles: UploadFile[] = normalizedPhotos.map(file => ({ kind: 'photo', file }));
  if (musicFile) selectedFiles.push({ kind: 'music', file: musicFile });
  const session = await galaxyRequest<UploadStart>('start', {
    body: {
      input: payload,
      files: selectedFiles.map(({ kind, file }) => ({ kind, size: file.size, type: file.type.toLowerCase() })),
    },
  });
  if (!session?.sessionId || !session.sessionToken || session.uploads?.length !== selectedFiles.length) {
    throw new Error('Love Galaxy upload authorization could not be confirmed.');
  }

  try {
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const { file, kind } = selectedFiles[index];
      const upload = session.uploads[index];
      if (!upload?.fileId || upload.kind !== kind || upload.contentType !== file.type.toLowerCase() || upload.size !== file.size) {
        throw new Error('Upload authorization did not match the selected file.');
      }
      await galaxyRequest<{ uploaded: boolean }>('upload', {
        raw: file,
        headers: {
          'x-love-galaxy-session-id': session.sessionId,
          'x-love-galaxy-session-token': session.sessionToken,
          'x-love-galaxy-file-id': upload.fileId,
        },
      });
    }
    const galaxy = await galaxyRequest<LoveGalaxy>('finalize', {
      body: { sessionId: session.sessionId, sessionToken: session.sessionToken },
    });
    if (galaxy?.status !== 'published' || galaxy.photos?.length !== LOVE_GALAXY_PHOTO_COUNT) {
      throw new Error('Publishing could not be confirmed. Keep this page open and retry only after checking your connection.');
    }
    return galaxy;
  } catch (error) {
    await galaxyRequest<{ canceled: boolean }>('cancel', {
      body: { sessionId: session.sessionId, sessionToken: session.sessionToken },
    }).catch(() => undefined);
    throw error;
  }
}

export function publishedLoveGalaxyUrl(galaxy: Pick<LoveGalaxy, 'status' | 'username' | 'public_key'>, origin: string): string | null {
  if (galaxy.status !== 'published' || !/^galaxy-[a-z0-9-]{8,39}$/.test(galaxy.username)) return null;
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('A valid website origin is required');
  return new URL(`/love/${galaxy.username}`, base.origin).href;
}

export async function fetchPublicLoveGalaxy(username: string, key?: string): Promise<LoveGalaxy> {
  return galaxyRequest<LoveGalaxy>('public', { query: { username, ...(key ? { key } : {}) } });
}

export async function fetchDiscoverableLoveGalaxies(): Promise<DiscoverableLoveGalaxy[]> {
  const result = await galaxyRequest<{ worlds: DiscoverableLoveGalaxy[] }>('discoverable');
  return Array.isArray(result?.worlds) ? result.worlds : [];
}
