import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Invitation from '../src/components/Invitation';
import { venueRoutes } from '../src/components/venueRoutes';
import { createDesignPreview } from '../src/lib/designPreview';

const sample = createDesignPreview('thazin', 'my');
const destination = '17.0002815,96.0650261';

describe('page four venue route choices', () => {
  test('four distinct Yangon starting choices preserve the supplied destination', () => {
    const routes = venueRoutes(sample.venue, sample.map_url);
    expect(routes).toHaveLength(4);
    expect(new Set(routes.map(r => r.href)).size).toBe(4);
    expect(routes.map(r => r.id)).toEqual(['current', 'hledan', 'insein', 'aungmingalar']);
    for (const route of routes) {
      const url = new URL(route.href);
      expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
      expect(url.searchParams.get('api')).toBe('1');
      expect(url.searchParams.get('destination')).toBe(destination);
      expect(url.searchParams.get('travelmode')).toBe('driving');
      expect(url.searchParams.has('arrival_time')).toBe(false);
      expect(url.searchParams.has('departure_time')).toBe(false);
    }
    expect(new URL(routes[0].href).searchParams.has('origin')).toBe(false);
  });

  test('place IDs and encoded destinations are preserved without carrying stale waypoints', () => {
    const routes = venueRoutes(sample.venue, 'https://www.google.com/maps/dir/?api=1&destination=A%26B+Hall&destination_place_id=ChIJ-example&waypoints=Wrong+Stop&origin=Wrong+Origin');
    const url = new URL(routes[0].href);
    expect(url.searchParams.get('destination')).toBe('A&B Hall');
    expect(url.searchParams.get('destination_place_id')).toBe('ChIJ-example');
    expect(url.searchParams.has('waypoints')).toBe(false);
    expect(url.searchParams.has('origin')).toBe(false);
  });

  test('query map formats support routes while preserving place ID', () => {
    const routes = venueRoutes(sample.venue, 'https://www.google.com/maps/search/?api=1&query=Venue&query_place_id=ChIJ-test');
    expect(routes).toHaveLength(4);
    expect(new URL(routes[0].href).searchParams.get('destination_place_id')).toBe('ChIJ-test');
  });

  test('unresolved short maps, camera-only views and invalid URLs do not invent a destination', () => {
    for (const url of ['', 'javascript:alert(1)', 'https://evil.example/maps?q=Venue', 'https://www.google.com.evil.example/maps?q=Venue', 'https://maps.app.goo.gl/example', 'https://goo.gl/maps/example', 'https://www.google.com/maps/@17,96,15z', 'https://www.google.com/maps/?q=']) {
      expect(venueRoutes(sample.venue, url)).toEqual([]);
    }
  });

  test('other venues do not inherit unrelated Yangon origins', () => {
    const routes = venueRoutes('Mandalay Hall', 'https://www.google.com/maps/?q=21.98,96.08');
    expect(routes).toHaveLength(4);
    expect(routes.map(r => new URL(r.href).searchParams.get('travelmode'))).toEqual(['driving', 'transit', 'walking', 'bicycling']);
    expect(routes.every(r => !new URL(r.href).searchParams.has('origin'))).toBe(true);
  });

  test('page four replaces road routes with the supplied wedding schedule in every design', () => {
    for (const template of ['thazin', 'noir', 'rose'] as const) {
      const html = renderToStaticMarkup(<Invitation project={{ ...sample, template, event_time: '09:37' }} preview />);
      const page = html.match(/<article class="paper details-paper"[\s\S]*?<\/article>/)?.[0] || '';
      expect(page).toContain('class="wedding-schedule"');
      expect(page).toContain('7:00 AM');
      expect(page).toContain('9:00 AM');
      expect(page).not.toContain('route-information');
      expect(html).not.toContain('route-guidance-dialog');
      expect(html).not.toContain('09:37');
      expect(html).not.toContain('၀၉:၃၇');
      expect(html).not.toContain('id="calendar"');
      expect(html).not.toContain('countdown-hours');
    }
  });
  test('free-text event time remains hidden too', () => {
    const time = 'နံနက် ၉ နာရီမှ ၁၂ နာရီအထိ';
    const html = renderToStaticMarkup(<Invitation project={{ ...sample, event_time: time }} />);
    expect(html).not.toContain(time);
  });

  test('short links retain the exact safe map fallback instead of four fake routes', () => {
    const map_url = 'https://maps.app.goo.gl/ExactOwnerLink';
    const html = renderToStaticMarkup(<Invitation project={{ ...sample, map_url }} />);
    expect(html).toContain('href="' + map_url + '"');
    expect(html).not.toContain('class="route-label"');
  });
});
