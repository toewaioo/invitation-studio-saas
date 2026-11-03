import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Invitation from '../src/components/Invitation';
import { createDesignPreview } from '../src/lib/designPreview';
import { routeArrivalTarget, venueRoutes } from '../src/components/venueRoutes';

const sample = createDesignPreview('thazin', 'my');

const allRouteUrls = (eventDate = '', eventTime = '') =>
  venueRoutes(sample.venue, sample.map_url, eventDate, eventTime).map((route) => new URL(route.href));

describe('route guidance arrival metadata', () => {
  test('event time changes metadata without changing route URLs', () => {
    const early = venueRoutes(sample.venue, sample.map_url, '2027-02-14', '09:37');
    const late = venueRoutes(sample.venue, sample.map_url, '2027-02-14', '10:38');

    expect(early).toHaveLength(4);
    expect(late).toHaveLength(4);
    expect(early.map((route) => route.href)).toEqual(late.map((route) => route.href));
    expect(early.map((route) => route.arrivalTarget?.time)).toEqual(['09:37', '09:37', '09:37', '09:37']);
    expect(late.map((route) => route.arrivalTarget?.time)).toEqual(['10:38', '10:38', '10:38', '10:38']);
  });

  test('event date changes metadata while keeping URL destinations and route choices stable', () => {
    const first = venueRoutes(sample.venue, sample.map_url, '2027-02-14', '09:37');
    const second = venueRoutes(sample.venue, sample.map_url, '2027-02-15', '09:37');

    expect(first.map((route) => route.href)).toEqual(second.map((route) => route.href));
    expect(first.map((route) => route.arrivalTarget?.date)).toEqual(['2027-02-14', '2027-02-14', '2027-02-14', '2027-02-14']);
    expect(second.map((route) => route.arrivalTarget?.date)).toEqual(['2027-02-15', '2027-02-15', '2027-02-15', '2027-02-15']);
  });

  test('strictly validates trimmed ISO dates and 24-hour times, including midnight', () => {
    expect(routeArrivalTarget(' 2027-02-14 ', ' 00:00 ')).toMatchObject({
      date: '2027-02-14',
      time: '00:00',
      timeZone: 'Asia/Yangon',
    });
    for (const [date, time] of [
      ['2027-02-29', '09:37'],
      ['2027-02-14', '24:00'],
      ['2027-02-14', '9:37'],
      ['2027/02/14', '09:37'],
      ['14-02-2027', '09:37'],
      ['', '09:37'],
      ['2027-02-14', ''],
      ['2027-02-14', 'နံနက် ၉ နာရီ'],
    ]) {
      expect(routeArrivalTarget(date, time)).toBeNull();
    }
  });

  test('does not emit unsupported future arrival/departure parameters or event time in URLs', () => {
    for (const url of allRouteUrls('2027-02-14', '09:37')) {
      expect(url.searchParams.has('arrival_time')).toBe(false);
      expect(url.searchParams.has('departure_time')).toBe(false);
      expect(url.href).not.toContain('09%3A37');
      expect(url.href).not.toContain('09:37');
    }
  });

  test('SSR keeps event time, countdown, and calendar export absent while showing supplied milestones only', () => {
    const html = renderToStaticMarkup(
      <Invitation project={{ ...sample, event_time: '09:37' }} />,
    );

    expect(html).not.toContain('09:37');
    expect(html).not.toContain('၀၉:၃၇');
    expect(html).not.toContain('countdown-hours');
    expect(html).not.toContain('id="calendar"');
    expect(html).not.toContain('BEGIN:VCALENDAR');
    expect(html).not.toContain('class="route-label"');
    expect(html).toContain('class="schedule-milestones"');
  });
});
