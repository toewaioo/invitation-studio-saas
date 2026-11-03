import { describe, expect, test } from 'bun:test';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { renderToStaticMarkup } from 'react-dom/server';
import ShareDialog from '../src/components/ShareDialog';
import { HEART_QR, hasHighContrastQrColor, heartQrSvg, publishedShareUrl, qrColorContrastRatio } from '../src/lib/shareQr';
import { emptyProject, type Project } from '../src/types';

const origin = 'https://8767-iphoc9ukmik2wj0j3ipu2-a5df5fb1.us2.manus.computer';
const project: Project = { ...emptyProject, id: 'qr-test-only', status: 'published', username: 'qr-verification-sample', public_key: 'demo-only-' + 'a'.repeat(64), person_a: 'နမူနာအမည်တစ်', person_b: 'နမူနာအမည်နှစ်', photos: [], created_at: '', updated_at: '' };
async function raster(svg: string, width: number) {
  const png = await sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { png, data, info, decoded: jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, { inversionAttempts: 'dontInvert' }) };
}

describe('published heart QR', () => {
  test('one URL builder encodes the exact returned key, without changing usernames or inventing links', () => {
    expect(publishedShareUrl(project, origin)).toBe(`${origin}/i/${project.username}?key=${project.public_key}`);
    const withReserved = publishedShareUrl({ ...project, public_key: 'a+b/&?=' }, origin)!;
    expect(new URL(withReserved).searchParams.get('key')).toBe('a+b/&?=');
    expect(publishedShareUrl({ ...project, status: 'draft' }, origin)).toBeNull();
    expect(publishedShareUrl({ ...project, public_key: null }, origin)).toBeNull();
    expect(publishedShareUrl({ ...project, public_key: '' }, origin)).toBeNull();
    expect(publishedShareUrl({ ...project, username: '../bad' }, origin)).toBeNull();
    expect(() => publishedShareUrl(project, 'javascript:alert(1)')).toThrow();
  });
  test('draft and revoked projects have no share/QR markup, even with stale keys', () => {
    const oldLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', { value: { origin }, configurable: true });
    try {
      expect(renderToStaticMarkup(<ShareDialog project={{ ...project, status: 'draft' }} lang="en" onClose={() => {}} />)).toBe('');
      expect(renderToStaticMarkup(<ShareDialog project={{ ...project, public_key: null }} lang="my" onClose={() => {}} />)).toBe('');
    } finally { Object.defineProperty(globalThis, 'location', { value: oldLocation, configurable: true }); }
  });
  test('full generated red heart-silhouette PNG independently decodes at print, desktop and compact sizes', async () => {
    const url = publishedShareUrl(project, origin)!;
    const svg = heartQrSvg(url);
    expect(HEART_QR.errorCorrectionLevel).toBe('H');
    expect(HEART_QR.quietZone).toBe(4);
    expect(QRCode.create(url, { errorCorrectionLevel: 'H' }).errorCorrectionLevel.bit).toBe(2);
    for (const width of [3000, 1000, 800, 600, 480, 400]) {
      const result = await raster(svg, width);
      expect(result.decoded?.data, `PNG width ${width}px`).toBe(url);
    }
  }, 30000);
  test('custom foreground colors must remain high-contrast and scan to the unchanged exact URL', async () => {
    const url = publishedShareUrl(project, origin)!;
    const navy = '#174A7E';
    expect(HEART_QR.color).toBe('#C8102E');
    expect(qrColorContrastRatio(HEART_QR.color)).toBeGreaterThan(4.5);
    expect(qrColorContrastRatio(navy)).toBeGreaterThan(4.5);
    expect(hasHighContrastQrColor(navy)).toBe(true);
    expect(hasHighContrastQrColor('#FFFFFF')).toBe(false);
    expect(hasHighContrastQrColor('red')).toBe(false);
    expect(() => heartQrSvg(url, '#FFFFFF')).toThrow(/4.5:1 contrast/);
    const svg = heartQrSvg(url, navy);
    expect(svg).toContain(`fill="${navy}"`);
    expect(svg.replaceAll(navy, HEART_QR.color)).toBe(heartQrSvg(url));
    expect(svg).toContain('<g fill="#fff">');
    const result = await raster(svg, 1000);
    expect(result.decoded?.data).toBe(url);
  }, 30000);
  test('long supported usernames, keys and different hosting origins retain exact URL bytes', async () => {
    for (const host of ['https://invitations.example.com', origin, 'http://localhost:8768']) {
      const url = publishedShareUrl({ ...project, username: 'a' + 'b'.repeat(39), public_key: '1234567890abcdef'.repeat(4) }, host)!;
      const result = await raster(heartQrSvg(url), 1600);
      expect(result.decoded?.data).toBe(url);
    }
  }, 30000);
  test('SVG preserves full side canvas and leaves extra white room beyond the four-module quiet zone', () => {
    const url = publishedShareUrl(project, origin)!;
    const svg = heartQrSvg(url);
    expect(svg).toContain(`width="${HEART_QR.svgWidth}" height="${HEART_QR.height}" viewBox="${HEART_QR.svgViewBoxX} 0 ${HEART_QR.svgWidth} ${HEART_QR.height}"`);
    expect(svg).toContain('d="M500 175C355 15 200 5 105 105C-10 225 42 430 147 596L500 970L853 596C958 430 1010 225 895 105C800 5 645 15 500 175Z"');
    const n = QRCode.create(url, { errorCorrectionLevel: 'H' }).modules.size;
    const available = Math.min(HEART_QR.centerX, HEART_QR.width - HEART_QR.centerX, HEART_QR.centerY, HEART_QR.height - HEART_QR.centerY) - 20;
    const radius = Math.min(HEART_QR.diamondRadius, available * n / (n + HEART_QR.quietZone * 2));
    const outerQuietHalfExtent = radius * (n + HEART_QR.quietZone * 2) / n;
    expect(HEART_QR.svgViewBoxX).toBe(0);
    expect(HEART_QR.svgWidth).toBe(HEART_QR.width);
    expect(HEART_QR.svgWidth).toBe(HEART_QR.height);
    expect(HEART_QR.centerX - outerQuietHalfExtent - HEART_QR.svgViewBoxX).toBeGreaterThan(40);
    expect(HEART_QR.svgViewBoxX + HEART_QR.svgWidth - HEART_QR.centerX - outerQuietHalfExtent).toBeGreaterThan(40);
  });
  test('the canonical dark matrix and external quiet zone remain pixel-perfect around the filled upper wedge', async () => {
    const url = publishedShareUrl(project, origin)!;
    const code = QRCode.create(url, { errorCorrectionLevel: 'H' });
    const n = code.modules.size;
    const svg = heartQrSvg(url);
    const gapPath = svg.match(/id="heart-qr-upper-gap-fill" d="([^"]*)"/)?.[1] ?? '';
    const gapTiles = new Set([...gapPath.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(([, col, row]) => `${row},${col}`));
    const { data, info } = await raster(svg, 1000);
    const available = Math.min(HEART_QR.centerX, HEART_QR.width - HEART_QR.centerX, HEART_QR.centerY, HEART_QR.height - HEART_QR.centerY) - 20;
    const radius = Math.min(HEART_QR.diamondRadius, available * n / (n + HEART_QR.quietZone * 2));
    const cell = radius * Math.SQRT2 / n;
    const angle = HEART_QR.rotation * Math.PI / 180;
    let canonicalCount = 0, quietCount = 0, visibleGapModules = 0;
    for (let row = -4; row < n + 4; row++) for (let col = -4; col < n + 4; col++) {
      const dx = (col + 0.5 - n / 2) * cell;
      const dy = (row + 0.5 - n / 2) * cell;
      const scale = info.width / HEART_QR.svgWidth;
      const x = Math.floor((HEART_QR.centerX + dx * Math.cos(angle) - dy * Math.sin(angle) - HEART_QR.svgViewBoxX) * scale);
      const y = Math.floor((HEART_QR.centerY + dx * Math.sin(angle) + dy * Math.cos(angle)) * scale);
      const index = (y * info.width + x) * 4;
      const inside = row >= 0 && row < n && col >= 0 && col < n;
      const dark = inside && code.modules.get(row, col);
      if (inside) canonicalCount++; else quietCount++;
      if (gapTiles.has(`${row},${col}`)) {
        if (data[index] < 255 || data[index + 1] < 255 || data[index + 2] < 255) visibleGapModules++;
        continue;
      }
      const expected = dark ? [200, 16, 46] : [255, 255, 255];
      if (expected.some((value, channel) => data[index + channel] !== value)) throw new Error(`Canonical matrix/quiet zone changed at ${row},${col}`);
    }
    expect(gapTiles.size).toBeGreaterThan(0);
    expect(visibleGapModules).toBeGreaterThan(0);
    expect(canonicalCount).toBe(n * n);
    expect(quietCount).toBe((n + 8) ** 2 - n ** 2);
  });
  test('heart is filled with aligned continuation modules and a localized upper-wedge fill', async () => {
    const svg = heartQrSvg(publishedShareUrl(project, origin)!);
    expect(svg).toContain('id="heart-silhouette"');
    expect(svg).toContain('id="outside-quiet-zone"');
    expect(svg).toContain('id="heart-qr-continuation"');
    const code = QRCode.create(publishedShareUrl(project, origin)!, { errorCorrectionLevel: 'H' });
    const codeSize = code.modules.size;
    const available = Math.min(HEART_QR.centerX, HEART_QR.width - HEART_QR.centerX, HEART_QR.centerY, HEART_QR.height - HEART_QR.centerY) - 20;
    const radius = Math.min(HEART_QR.diamondRadius, available * codeSize / (codeSize + HEART_QR.quietZone * 2));
    const cell = radius * Math.SQRT2 / codeSize;
    const continuationPath = svg.match(/<path id="heart-qr-continuation" d="([^"]*)" transform="([^"]*)"/)?.[1] ?? '';
    const continuationTransform = `translate(${HEART_QR.centerX} ${HEART_QR.centerY}) rotate(${HEART_QR.rotation}) scale(${cell}) translate(${-codeSize / 2} ${-codeSize / 2})`;
    expect(svg).toContain(`d="${continuationPath}" transform="${continuationTransform}"`);
    const continuationTiles = [...continuationPath.matchAll(/M(-?\d+) (-?\d+)h1v1h-1z/g)].map(([, col, row]) => [Number(col), Number(row)] as const);
    expect(continuationTiles.length).toBeGreaterThan(0);
    expect(continuationTiles.every(([col, row]) => row < -HEART_QR.quietZone || row >= codeSize + HEART_QR.quietZone
      || col < -HEART_QR.quietZone || col >= codeSize + HEART_QR.quietZone)).toBe(true);
    expect(continuationTiles.some(([col]) => col < -HEART_QR.quietZone)).toBe(true);
    expect(continuationTiles.some(([col]) => col >= codeSize + HEART_QR.quietZone)).toBe(true);
    expect(continuationTiles.some(([, row]) => row < -HEART_QR.quietZone)).toBe(true);
    expect(continuationTiles.some(([, row]) => row >= codeSize + HEART_QR.quietZone)).toBe(true);
    const gapPath = svg.match(/<path id="heart-qr-upper-gap-fill" d="([^"]*)" transform="([^"]*)" fill="([^"]*)"\/>/)?.[1] ?? '';
    const gapTiles = [...gapPath.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(([, col, row]) => [Number(col), Number(row)] as const);
    const upperGapDepth = Math.min(codeSize, 36);
    expect(gapTiles.length).toBeGreaterThan(0);
    expect(gapTiles.every(([col, row]) => (
      row >= codeSize && row < codeSize + HEART_QR.quietZone && col >= codeSize - upperGapDepth && col < codeSize
    ) || (
      col >= codeSize && col < codeSize + HEART_QR.quietZone && row >= codeSize - upperGapDepth && row < codeSize
    ))).toBe(true);
    expect(svg).toContain('rotate(225)');
    expect(svg).toContain('#C8102E');
    expect(svg).not.toContain('stroke=');
    expect(svg).not.toContain('#fff9fa');
    expect(HEART_QR.width).toBe(HEART_QR.height);
    expect(HEART_QR.svgWidth).toBe(HEART_QR.width);
    const rendered = await raster(svg, 1000);
    const scale = rendered.info.width / HEART_QR.svgWidth;
    const mapX = (coordinate: number) => Math.floor((coordinate - HEART_QR.svgViewBoxX) * scale);
    const mapY = (coordinate: number) => Math.floor(coordinate * scale);
    const darkPixelsIn = (x1: number, x2: number, y1: number, y2: number) => {
      let count = 0;
      for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
        const index = (y * rendered.info.width + x) * 4;
        if (rendered.data[index] === 200 && rendered.data[index + 1] === 16 && rendered.data[index + 2] === 46) count++;
      }
      return count;
    };
    expect(darkPixelsIn(mapX(80), mapX(300), mapY(120), mapY(320))).toBeGreaterThan(5000);
    expect(darkPixelsIn(mapX(700), mapX(920), mapY(120), mapY(320))).toBeGreaterThan(5000);
  }, 30000);
  test('varied published keys and usernames still decode the full silhouette exactly', async () => {
    for (let i = 0; i < 8; i++) {
      const key = Array.from({ length: 64 }, (_, j) => ((i * 13 + j * 7 + j * j) % 16).toString(16)).join('');
      const url = publishedShareUrl({ ...project, username: `heart-demo-${i}`, public_key: key }, origin)!;
      expect((await raster(heartQrSvg(url), 800)).decoded?.data).toBe(url);
    }
  }, 30000);
  test('republishing produces a new QR/link, not the revoked link', async () => {
    const old = publishedShareUrl(project, origin)!;
    const current = publishedShareUrl({ ...project, public_key: 'new-demo-only-' + 'b'.repeat(64) }, origin)!;
    expect(current).not.toBe(old);
    expect((await raster(heartQrSvg(current), 1200)).decoded?.data).toBe(current);
    expect(() => heartQrSvg('javascript:alert(1)')).toThrow();
  });
});


describe('heart QR share dialog layout', () => {
  test('reduces surrounding spacing while preserving the color picker and four-module quiet zone', async () => {
    const css = await Bun.file(new URL('../src/components/share-dialog.css', import.meta.url)).text();
    expect(css).toContain('.share-dialog { padding: 18px; }');
    expect(css).toContain('.share-full-names { margin-top: 10px; }');
    expect(css).toContain('.share-qr-color-control { margin-top: 4px; }');
    expect(css).toContain('.share-link-field { margin-top: 9px; }');
    expect(css).toContain('.share-expiry-note { margin: 12px 0 0; padding-top: 9px; }');
    expect(css).toContain('.share-qr-color-control');
    expect(css).toContain('aspect-ratio:1000 / 1000');
    expect(css).toContain('.share-dialog { padding: 14px 12px; }');
    expect(HEART_QR.quietZone).toBe(4);
  });
});
