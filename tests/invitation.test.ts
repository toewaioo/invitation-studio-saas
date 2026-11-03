import { describe, expect, test } from "bun:test";
import {
  calendarFor,
  invitationCalendar,
  invitationDate,
  myDigits,
  venueMap,
} from "../src/components/invitationData";

describe("immersive invitation data", () => {
  test("date-only calendar handles leap years without guest timezone conversion", () => {
    expect(calendarFor("2027-02-14")).toMatchObject({
      day: 14,
      month: 2,
      year: 2027,
      count: 28,
      start: 1,
    });
    expect(calendarFor("2028-02-29")?.count).toBe(29);
    expect(calendarFor("2027-02-29")).toBeNull();
    expect(calendarFor("")).toBeNull();
    expect(calendarFor("2027-13-01")).toBeNull();
  });
  test("Myanmar month names and numerals do not depend on browser ICU support", () => {
    expect(myDigits("14:30 / 2027")).toBe("၁၄:၃၀ / ၂၀၂၇");
    expect(invitationDate("2027-02-14")).toContain("၁၄ ဖေဖော်ဝါရီ ၂၀၂၇");
    expect(invitationDate("2027-02-14")).toContain("တနင်္ဂနွေနေ့");
    expect(invitationDate("")).toBe("နေ့ရက် မသတ်မှတ်ရသေးပါ");
  });
  test("calendar export is explicit Myanmar time and escapes event text", () => {
    const content = invitationCalendar(
      {
        id: "project-1",
        person_a: "Min",
        person_b: "Thazin",
        event_date: "2027-02-14",
        event_time: "09:00",
        venue: "Hall, Yangon; Room A",
        message: "Together\nAlways",
      },
      new Date("2026-10-21T00:00:00Z"),
    );
    expect(content).toContain("DTSTART:20270214T023000Z");
    expect(content).toContain("DTSTAMP:20261021T000000Z");
    expect(content).toContain("LOCATION:Hall\\, Yangon\\; Room A");
    expect(content).toContain("DESCRIPTION:Together\\nAlways");
    expect(content?.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(
      invitationCalendar({
        id: "",
        person_a: "",
        person_b: "",
        event_date: "",
        event_time: "",
        venue: "",
        message: "",
      }),
    ).toBeNull();
  });
  test("map iframe stays Google-only and untrusted URLs are not embedded or linked", () => {
    const map = venueMap(
      "Yangon Hall",
      "https://www.google.com/maps/place/Hall/@17.0002815,96.0650261,17z",
    );
    expect(map.embed).toBe(
      "https://maps.google.com/maps?q=17.0002815%2C96.0650261&z=16&output=embed",
    );
    expect(map.directions).toBe("https://www.google.com/maps/place/Hall/@17.0002815,96.0650261,17z");
    expect(venueMap("Hall", "javascript:alert(1)").href).toBe("");
    expect(venueMap("Hall", "https://evil.example/fake").href).not.toContain(
      "evil.example",
    );
    expect(venueMap("", "https://evil.example/fake").embed).toBe("");
    expect(venueMap("", "https://maps.app.goo.gl/example").href).toBe(
      "https://maps.app.goo.gl/example",
    );
    expect(venueMap("", "").href).toBe("");
  });
});
