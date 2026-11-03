import type { Project } from "../types";

export const MYANMAR_MONTHS = [
  "ဇန်နဝါရီ",
  "ဖေဖော်ဝါရီ",
  "မတ်",
  "ဧပြီ",
  "မေ",
  "ဇွန်",
  "ဇူလိုင်",
  "ဩဂုတ်",
  "စက်တင်ဘာ",
  "အောက်တိုဘာ",
  "နိုဝင်ဘာ",
  "ဒီဇင်ဘာ",
];
const WEEKDAYS = [
  "တနင်္ဂနွေနေ့",
  "တနင်္လာနေ့",
  "အင်္ဂါနေ့",
  "ဗုဒ္ဓဟူးနေ့",
  "ကြာသပတေးနေ့",
  "သောကြာနေ့",
  "စနေနေ့",
];
export const myDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (n) => "၀၁၂၃၄၅၆၇၈၉"[Number(n)]);
export const text = (value: string | null | undefined, fallback = "—") =>
  value?.trim() || fallback;

export const isClockTime = (value: string | null | undefined) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value?.trim() || "");
/** Standard form times get a unit; already-written time wording stays intact. */
export const invitationTime = (value: string) =>
  isClockTime(value) ? `${myDigits(value.trim())} နာရီ` : myDigits(value.trim());

/** Date-only arithmetic stays independent of the guest's operating-system timezone. */
export function calendarFor(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1000 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return {
    year,
    month,
    day,
    weekday: WEEKDAYS[date.getUTCDay()],
    monthName: MYANMAR_MONTHS[month - 1],
    start: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
    count: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  };
}
export function invitationDate(value: string) {
  const date = calendarFor(value);
  return date
    ? `${date.weekday}၊ ${myDigits(date.day)} ${date.monthName} ${myDigits(date.year)}`
    : "နေ့ရက် မသတ်မှတ်ရသေးပါ";
}
export const eventInstant = (date: string, time: string) =>
  new Date(`${date}T${time || "09:00"}:00+06:30`);
const escapeICS = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/[;,]/g, (c) => `\\${c}`);
const utcICS = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function invitationCalendar(
  project: Pick<
    Project,
    | "id"
    | "person_a"
    | "person_b"
    | "event_date"
    | "event_time"
    | "venue"
    | "message"
  >,
  now = new Date(),
) {
  if (
    !calendarFor(project.event_date) ||
    (project.event_time &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(project.event_time))
  )
    return null;
  const start = eventInstant(project.event_date, project.event_time);
  if (Number.isNaN(start.getTime())) return null;
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Metta Invitation Studio//Wedding//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${escapeICS(project.id)}@invitation-studio`,
      `DTSTAMP:${utcICS(now)}`,
      `DTSTART:${utcICS(start)}`,
      `SUMMARY:${escapeICS(`${text(project.person_a)} & ${text(project.person_b)} — မင်္ဂလာဧည့်ခံပွဲ`)}`,
      `LOCATION:${escapeICS(project.venue || "")}`,
      `DESCRIPTION:${escapeICS(project.message || "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}

/** A venue name is text, not permission to guess its coordinates or map.
 * Only supplied HTTPS Google Maps URLs enable map actions. Short links are
 * resolved by the server; the original invitation URL stays the external link. */
export function venueMap(_venue: string, supplied: string) {
  const empty = { embed: "", href: "", directions: "" };
  try {
    const url = new URL(supplied.trim());
    const allowed = ["maps.app.goo.gl", "goo.gl", "maps.google.com", "www.google.com", "google.com"].includes(url.hostname);
    if (supplied.length > 4096 || url.protocol !== "https:" || !allowed || url.username || url.password || url.port) return empty;
    if (url.hostname === "maps.app.goo.gl" && !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return empty;
    if (url.hostname === "goo.gl" && !/^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return empty;
    if (["www.google.com", "google.com"].includes(url.hostname) && !/^\/maps(?:\/|$)/.test(url.pathname)) return empty;
    if (["maps.app.goo.gl", "goo.gl"].includes(url.hostname)) return { embed: "", href: url.href, directions: url.href };
    if (/^\/maps\/embed(?:\/|$)/.test(url.pathname) && url.searchParams.get("pb")) return { embed: url.href, href: url.href, directions: url.href };
    // !3d/!4d identify the place pin; @ coordinates can describe only its viewport.
    const pin = url.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const coordinates = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const place = url.pathname.match(/\/maps\/place\/([^/]+)/);
    const placeId = url.searchParams.get("query_place_id") || url.searchParams.get("destination_place_id");
    const cid = url.searchParams.get("cid");
    const query = placeId ? `place_id:${placeId}` : pin ? `${pin[1]},${pin[2]}` : url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("destination") || (cid && /^\d+$/.test(cid) ? `cid:${cid}` : "") || (coordinates ? `${coordinates[1]},${coordinates[2]}` : "") || (place ? decodeURIComponent(place[1].replace(/\+/g, " ")) : "");
    return { embed: query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed` : "", href: url.href, directions: url.href };
  } catch { return empty; }
}
