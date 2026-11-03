export type SupportedPhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

export function detectSupportedPhotoMime(bytes: Uint8Array): SupportedPhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export async function normalizeGuestPhotoMime(file: File): Promise<File> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const actualMime = detectSupportedPhotoMime(header);
  if (!actualMime) throw new Error('Photo contents do not match MIME type');
  if (file.type.toLowerCase() === actualMime) return file;
  return new File([file], file.name, { type: actualMime, lastModified: file.lastModified });
}
