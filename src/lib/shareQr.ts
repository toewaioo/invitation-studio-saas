import QRCode from 'qrcode';
import type { Project } from '../types';

export const HEART_QR = {
  width: 1000, height: 1000, svgViewBoxX: 0, svgWidth: 1000, centerX: 500, centerY: 560, diamondRadius: 375,
  rotation: 225, quietZone: 4, errorCorrectionLevel: 'H' as const,
  color: '#C8102E', downloadScale: 3,
};
const MIN_QR_CONTRAST = 4.5;

/** Contrast of a six-digit foreground color against the QR's white background. */
export function qrColorContrastRatio(color: string): number | null {
  if (!/^#[\da-f]{6}$/i.test(color)) return null;
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
  return 1.05 / (luminance + 0.05);
}

export function hasHighContrastQrColor(color: string): boolean {
  return (qrColorContrastRatio(color) ?? 0) >= MIN_QR_CONTRAST;
}

type ShareableProject = Pick<Project, 'status' | 'username' | 'public_key'>;

/** Only a successfully published project with a valid username can be shared. */
export function publishedShareUrl(project: ShareableProject, origin: string): string | null {
  if (project.status !== 'published' || !/^[a-z][a-z0-9-]{2,39}$/.test(project.username)) return null;
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('A valid website origin is required');
  const url = new URL(`/i/${project.username}`, base.origin);
  return url.href;
}

/** An intact standard QR is rotated into the heart's lower diamond, with the
 * three real finder eyes at left, right and bottom, like the supplied reference.
 * Decorative modules continue on the same rotated lattice through both upper
 * lobes. No encoded module is removed; only the upper, internal quiet-zone edges
 * are selectively textured, with the opposite edges and exterior white margin intact.
 */
export function heartQrSvg(url: string, color = HEART_QR.color): string {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.href !== url) throw new Error('Encode the exact final HTTP(S) share URL');
  if (!hasHighContrastQrColor(color)) throw new Error('Choose a six-digit QR color with at least 4.5:1 contrast against white');
  const code = QRCode.create(url, { errorCorrectionLevel: HEART_QR.errorCorrectionLevel });
  const n = code.modules.size;
  // Keep the complete rotated quiet zone on canvas, even for unusually short URLs.
  // Preserve the tested safe canvas margin around the full four-module quiet zone.
  const available = Math.min(HEART_QR.centerX, HEART_QR.width - HEART_QR.centerX, HEART_QR.centerY, HEART_QR.height - HEART_QR.centerY) - 20;
  const radius = Math.min(HEART_QR.diamondRadius, available * n / (n + HEART_QR.quietZone * 2));
  const cell = radius * Math.SQRT2 / n;
  const transform = `translate(${HEART_QR.centerX} ${HEART_QR.centerY}) rotate(${HEART_QR.rotation}) scale(${cell}) translate(${-n / 2} ${-n / 2})`;
  const data: string[] = [];
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    if (code.modules.get(row, col)) data.push(`M${col} ${row}h1v1h-1z`);
  }
  // Extend the visual texture into both lobes on the exact same rotated grid as
  // the QR. Keeping the lattice aligned removes the large diagonal wedges that
  // result when canvas-aligned squares meet the rotated QR diamond. These are
  // decoration only: the complete canonical matrix and its four-module quiet
  // zone are excluded here and again by the SVG mask below. A separate localized
  // path below fills only the two heart-facing quiet-zone strips.
  const continuation: string[] = [];
  const margin = Math.ceil(Math.SQRT2 * Math.max(HEART_QR.width, HEART_QR.height) / (2 * cell)) + 2;
  const first = -margin;
  const last = n + margin;
  const mod = (value: number) => (value % n + n) % n;
  for (let row = first; row <= last; row++) for (let col = first; col <= last; col++) {
    const inProtectedSquare = row >= -HEART_QR.quietZone && row < n + HEART_QR.quietZone
      && col >= -HEART_QR.quietZone && col < n + HEART_QR.quietZone;
    if (inProtectedSquare) continue;
    if (code.modules.get(mod(row * 13 + col * 7), mod(row * 5 + col * 17))) {
      continuation.push(`M${col} ${row}h1v1h-1z`);
    }
  }
  // Fill only the two upper, heart-facing edges of the rotated matrix's quiet zone.
  // Those strips sit inside the symbol between its upper lobes and central QR; the
  // opposite two quiet-zone edges and exterior white margin stay clear. The clip
  // prevents any fill outside the whole heart silhouette. Canonical QR modules remain unchanged.
  const upperGap: string[] = [];
  const upperGapDepth = Math.min(n, 36);
  const isUpperGapModule = (row: number, col: number) => code.modules.get(mod(row * 13 + col * 7), mod(row * 5 + col * 17))
    || (row * 17 + col * 31 + row * col * 3) % 4 < 2;
  for (let row = n; row < n + HEART_QR.quietZone; row++) for (let col = n - upperGapDepth; col < n; col++) {
    if (isUpperGapModule(row, col)) {
      upperGap.push(`M${col} ${row}h1v1h-1z`);
    }
  }
  for (let row = n - upperGapDepth; row < n; row++) for (let col = n; col < n + HEART_QR.quietZone; col++) {
    if (isUpperGapModule(row, col)) {
      upperGap.push(`M${col} ${row}h1v1h-1z`);
    }
  }
  const heart = 'M500 175C355 15 200 5 105 105C-10 225 42 430 147 596L500 970L853 596C958 430 1010 225 895 105C800 5 645 15 500 175Z';
  const quiet = `<rect x="-4" y="-4" width="${n + 8}" height="${n + 8}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HEART_QR.svgWidth}" height="${HEART_QR.height}" viewBox="${HEART_QR.svgViewBoxX} 0 ${HEART_QR.svgWidth} ${HEART_QR.height}"><defs><clipPath id="heart-silhouette"><path d="${heart}"/></clipPath><mask id="outside-quiet-zone" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="#fff"/><g transform="${transform}" fill="#000">${quiet}</g></mask></defs><rect width="1000" height="1000" fill="#fff"/><g clip-path="url(#heart-silhouette)" mask="url(#outside-quiet-zone)"><path id="heart-qr-continuation" d="${continuation.join('')}" transform="${transform}" fill="${color}"/></g><g transform="${transform}"><g fill="#fff">${quiet}</g><path d="${data.join('')}" fill="${color}"/></g><g clip-path="url(#heart-silhouette)"><path id="heart-qr-upper-gap-fill" d="${upperGap.join('')}" transform="${transform}" fill="${color}"/></g></svg>`;
}

export interface VerifiedHeartQr { png: Blob; preview: string; width: number; height: number; }

async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not render the QR image'));
    image.src = source;
  });
  return image;
}

/** Re-open and decode the actual exported PNG, including all silhouette modules.
 * Download is enabled only when an independent decoder reads the exact URL.
 */
export async function verifiedHeartQr(url: string, color = HEART_QR.color): Promise<VerifiedHeartQr> {
  const source = URL.createObjectURL(new Blob([heartQrSvg(url, color)], { type: 'image/svg+xml' }));
  let pngSource: string | undefined;
  try {
    const image = await loadImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = HEART_QR.svgWidth * HEART_QR.downloadScale;
    canvas.height = HEART_QR.height * HEART_QR.downloadScale;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('QR image rendering is unavailable in this browser');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export QR PNG')), 'image/png'));
    pngSource = URL.createObjectURL(png);
    const exportedPng = await loadImage(pngSource);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(exportedPng, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { default: decode } = await import('jsqr');
    const scanned = decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
    if (scanned?.data !== url) throw new Error('Heart QR scan verification failed. Retry; an unverified image cannot be downloaded.');
    const preview = pngSource;
    pngSource = undefined;
    return { png, preview, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(source);
    if (pngSource) URL.revokeObjectURL(pngSource);
  }
}
