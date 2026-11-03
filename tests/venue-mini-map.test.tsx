import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import VenueMiniMap from '../src/components/VenueMiniMap';
import { venueMap } from '../src/components/invitationData';

describe('invitation-specific mini maps', () => {
  test('no supplied valid map means no map, even with a venue name', () => {
    for (const supplied of ['', 'javascript:alert(1)', 'https://evil.example/maps', 'https://www.google.com/maps-fake', 'https://maps.app.goo.gl/', 'https://www.google.com:8443/maps?q=Hall', 'https://user@www.google.com/maps?q=Hall']) {
      expect(renderToStaticMarkup(<VenueMiniMap venue="Lotaya Hinthada Monastery" supplied={supplied} />)).toBe('');
    }
  });
  test('supplied long URL creates a lazy Google-only iframe and exact original link', () => {
    const supplied = 'https://www.google.com/maps/?q=21.98,96.08';
    const html = renderToStaticMarkup(<VenueMiniMap venue="Mandalay Hall" supplied={supplied} />);
    expect(html).toContain('class="mini-map"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('src="https://maps.google.com/maps?q=21.98%2C96.08');
    expect(html).toContain(`href="${supplied}"`);
    expect(html).not.toContain('CS6Q7snZngXwxkm87');
  });
  test('short URL is preserved until resolved, never used as an iframe or guessed from venue', () => {
    const supplied = 'https://maps.app.goo.gl/CS6Q7snZngXwxkm87';
    const map = venueMap('Some unrelated venue', supplied);
    expect(map.href).toBe(supplied);
    expect(map.embed).toBe('');
    expect(renderToStaticMarkup(<VenueMiniMap venue="Some unrelated venue" supplied={supplied} />)).not.toContain('iframe');
  });
  test('pin coordinates override viewport, plus-code place URLs and place IDs are supported', () => {
    expect(venueMap('', 'https://www.google.com/maps/place/Hall/@17,96,15z/data=!3d18.123!4d97.456').embed).toContain('18.123%2C97.456');
    expect(venueMap('', 'https://www.google.com/maps/place/2328%2B426+Lotaya+Hinthada+Monastery,+Yangon/data=!4m2').embed).toContain('2328%2B426%20Lotaya');
    expect(venueMap('', 'https://www.google.com/maps/search/?api=1&query=Hall&query_place_id=ChIJtest').embed).toContain('place_id%3AChIJtest');
  });
});

test('calendar is identical for different separate event times, while schedule stays intact', async () => {
  const { default: Invitation } = await import('../src/components/Invitation');
  const { createDesignPreview } = await import('../src/lib/designPreview');
  for (const design of ['thazin', 'noir', 'rose'] as const) {
    const project = createDesignPreview(design, 'my');
    const markup = (time: string) => renderToStaticMarkup(<Invitation project={{...project, event_time:time}} />);
    const calendar = (html: string) => html.match(/<article class="paper calendar-paper"[\s\S]*?<\/article>/)?.[0];
    expect(calendar(markup('01:12'))).toBe(calendar(markup('23:59')));
    expect(markup('01:12')).toContain('data-countdown-status=');
    expect(markup('01:12')).not.toContain('countdown-hours');
    expect(markup('01:12')).toContain('class="wedding-schedule"');
    expect(markup('01:12')).toContain('7:00 AM');
  }
});
