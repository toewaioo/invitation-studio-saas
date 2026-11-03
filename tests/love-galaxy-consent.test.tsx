import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import LoveGalaxyCreator from '../src/components/LoveGalaxyCreator';

test('creator presents a separate, optional journey-discovery consent that defaults off', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'en', setItem: () => undefined },
  });
  try {
    const html = renderToStaticMarkup(<LoveGalaxyCreator />);
    expect(html).toContain('class="lg-journey-consent"');
    expect(html).toContain('Allow my Love Galaxy to appear as a planet in other people’s journeys');
    expect(html).toContain('optional; off by default');
    expect(html).toContain('id="lg-journey-consent-details"');
    expect(html).toContain('aria-describedby="lg-journey-consent-details"');
    expect(html).toContain('journey listings use only your galaxy title and share link');
    expect(html).toContain('not your photos, ring messages, or music');
    expect(html).toMatch(/class="lg-journey-consent"><input type="checkbox"(?![^>]*checked)/);
    expect(html).toContain('I have permission to share these photos and music.');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});
