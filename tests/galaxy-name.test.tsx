import { afterEach, describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import LoveGalaxyCreator from '../src/components/LoveGalaxyCreator';
import { createGalaxyPlanetName } from '../src/lib/galaxyName';

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('generated Galaxy names', () => {
  test('uses a five-character base-36 planet identifier', () => {
    expect(createGalaxyPlanetName(0)).toBe('Planet #00000');
    expect(createGalaxyPlanetName(71)).toBe('Planet #0001z');
    expect(createGalaxyPlanetName(0x7fffffff)).toMatch(/^Planet #[0-9a-z]{5}$/);
  });

  test('prefills the new-creation Galaxy name while leaving it editable', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => 'en', setItem: () => undefined },
    });

    const html = renderToStaticMarkup(<LoveGalaxyCreator />);
    const titleInput = html.match(/<input[^>]*aria-label="Galaxy name"[^>]*>/)?.[0];

    expect(titleInput).toBeDefined();
    expect(titleInput).toMatch(/value="Planet #[0-9a-z]{5}"/);
    expect(titleInput).not.toMatch(/readonly/i);
    expect(html).toContain('A random planet-style name, ready to edit.');
  });
});
