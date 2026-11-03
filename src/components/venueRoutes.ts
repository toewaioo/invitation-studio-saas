import { calendarFor, invitationDate, invitationTime, isClockTime, venueMap } from './invitationData';

export interface RouteArrivalTarget { date: string; time: string; timeZone: 'Asia/Yangon'; label: string }
export interface VenueRoute { id: string; label: string; detail: string; href: string; arrivalTarget: RouteArrivalTarget | null }

/** The event clock is consumed only by the opt-in route-guidance dialog.
 * Maps URLs do not document arrival/departure-time parameters. Never send
 * an unsupported timestamp or silently default an absent/ambiguous clock.
 * https://developers.google.com/maps/documentation/urls/guide#directions-action
 */
export function routeArrivalTarget(eventDate: string, eventTime: string): RouteArrivalTarget | null {
  const date = eventDate.trim(), time = eventTime.trim();
  if (!calendarFor(date) || !isClockTime(time)) return null;
  return { date, time, timeZone: 'Asia/Yangon', label: `${invitationDate(date)} · ${invitationTime(time)} (မြန်မာစံတော်ချိန် UTC+06:30)` };
}

/** These are suggested starting points, not surveyed roads or promised ETAs.
 * Google Maps chooses the actual route and estimates. Never infer a destination
 * from the camera's @ coordinates, the venue's name, or an unresolved short link.
 */
export function venueRoutes(venue: string, supplied: string, eventDate = '', eventTime = ''): VenueRoute[] {
  const arrivalTarget = routeArrivalTarget(eventDate, eventTime);
  const map = venueMap(venue, supplied);
  if (!map.href) return [];
  const source = new URL(map.href);
  if (['maps.app.goo.gl', 'goo.gl'].includes(source.hostname)) return [];
  const destination = source.searchParams.get('destination') || source.searchParams.get('query') || source.searchParams.get('q');
  if (!destination?.trim()) return [];
  const placeId = source.searchParams.get('destination_place_id') || source.searchParams.get('query_place_id');
  const yangon = /ရန်ကုန်|yangon/i.test(venue);
  const choices = yangon ? [
    { id: 'current', label: 'မိမိရှိရာမှ', detail: 'စတင်မည့်နေရာကို Maps တွင် ရွေးပါ', origin: '', mode: 'driving' },
    { id: 'hledan', label: 'လှည်းတန်းမှ', detail: 'လှည်းတန်းစင်တာကို စတင်ရာအဖြစ် ရွေးထားသည်', origin: 'Hledan Centre, Yangon, Myanmar', mode: 'driving' },
    { id: 'insein', label: 'အင်းစိန်မှ', detail: 'အင်းစိန်ဈေးကို စတင်ရာအဖြစ် ရွေးထားသည်', origin: 'Insein Market, Yangon, Myanmar', mode: 'driving' },
    { id: 'aungmingalar', label: 'အောင်မင်္ဂလာအဝေးပြေးမှ', detail: 'အဝေးပြေးဝင်းကို စတင်ရာအဖြစ် ရွေးထားသည်', origin: 'Aung Mingalar Highway Bus Station, Yangon, Myanmar', mode: 'driving' },
  ] : [
    { id: 'driving', label: 'ကားဖြင့်', detail: 'မိမိစတင်မည့်နေရာကို ရွေးပါ', origin: '', mode: 'driving' },
    { id: 'transit', label: 'အများပြည်သူသုံးယာဉ်ဖြင့်', detail: 'Maps တွင် ရရှိနိုင်သည့်ခရီးစဉ်ကို စစ်ပါ', origin: '', mode: 'transit' },
    { id: 'walking', label: 'လမ်းလျှောက်၍', detail: 'အနီးအနားမှ လာရောက်သူများအတွက်', origin: '', mode: 'walking' },
    { id: 'bicycling', label: 'စက်ဘီးဖြင့်', detail: 'Maps တွင် ရရှိနိုင်သည့်လမ်းကို စစ်ပါ', origin: '', mode: 'bicycling' },
  ];
  return choices.map(({ id, label, detail, origin, mode }) => {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('destination', destination);
    if (placeId) url.searchParams.set('destination_place_id', placeId);
    if (origin) url.searchParams.set('origin', origin);
    url.searchParams.set('travelmode', mode);
    return { id, label, detail, href: url.href, arrivalTarget };
  });
}
