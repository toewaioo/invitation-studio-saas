import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import Invitation from "../src/components/Invitation";
import {
  emptyProject,
  type Design,
  type Project,
  type Theme,
} from "../src/types";

const fixture: Project = {
  ...emptyProject,
  id: "render-test",
  status: "draft",
  created_at: "",
  updated_at: "",
  public_key: null,
  person_a: "Min",
  person_b: "Thazin",
  event_date: "2027-02-14",
  event_time: "09:00",
  venue: "Yangon Hall",
  map_url: "https://www.google.com/maps?q=16.8,96.15",
  customer_email: "private-contact@example.test",
  customer_phone: "private-phone",
  private_notes: "PRIVATE_INTERNAL_NOTES",
  photos: [
    {
      id: "photo-1",
      url: "/test/customer-photo.jpg",
      caption: "Our memory",
      position: 0,
    },
  ],
};

describe("original immersive invitation renderer", () => {
  test("every design and palette retains the full envelope, book, calendar and persistent gallery", () => {
    for (const template of ["thazin", "noir", "rose"] as Design[])
      for (const theme of ["sage", "midnight", "rose", "blue"] as Theme[]) {
        const html = renderToStaticMarkup(
          <Invitation project={{ ...fixture, template, theme }} />,
        );
        expect(html).toContain(
          `invite-design-${template} invite-theme-${theme}`,
        );
        expect(html).toContain('id="open-envelope"');
        expect(html).toContain('class="letter-peek"');
        expect(html).toContain('class="book-spine"');
        expect(html).toContain('id="photo-dialog"');
        expect(html).not.toContain('id="countdown-days"');
        expect(html).not.toContain('id="calendar"');
        expect(html).not.toContain('class="route-information"');
        expect(html).toContain('data-map-src="https://maps.google.com/');
        expect((html.match(/data-page="\d"/g) || []).length).toBe(6);
        expect(html).not.toContain("PRIVATE_INTERNAL_NOTES");
        expect(html).not.toContain("private-contact@example.test");
        expect(html).not.toContain("private-phone");
      }
  });
  test("original design-specific 3D theatres are distinct, not flat palette swaps", () => {
    const thazin = renderToStaticMarkup(
      <Invitation project={{ ...fixture, template: "thazin" }} />,
    );
    const noir = renderToStaticMarkup(
      <Invitation project={{ ...fixture, template: "noir" }} />,
    );
    const rose = renderToStaticMarkup(
      <Invitation project={{ ...fixture, template: "rose" }} />,
    );
    expect(thazin).toContain("/assets/paper-floral-arch.svg");
    expect(noir).toContain('class="noir-scene"');
    expect(noir).toContain('class="deco-wing wing-left"');
    expect(rose).toContain('class="rose-scene"');
    expect(rose).toContain('class="rose-petal petal-three"');
  });
  test("bundled sample photos appear only in explicitly labelled sample previews", () => {
    const empty = { ...fixture, photos: [] };
    const real = renderToStaticMarkup(<Invitation project={empty} />);
    const ownerPreview = renderToStaticMarkup(
      <Invitation project={empty} preview />,
    );
    const sample = renderToStaticMarkup(
      <Invitation project={{ ...empty, id: "design-preview" }} preview />,
    );
    expect(real).not.toContain("/assets/wedding-");
    expect(ownerPreview).not.toContain("/assets/wedding-");
    expect(sample).toContain("/assets/wedding-3.jpg");
    expect(sample).toContain("ဒီဇိုင်းသရုပ်ပြ နမူနာဓာတ်ပုံ");
  });
  test("every template keeps both supplied full names visible and has no initials", () => {
    const personA = "မင်းခန့်အောင် Alexander Longname";
    const personB = "သဇင်ဝင်း Elizabeth Longname";
    for (const template of ["thazin", "noir", "rose"] as Design[]) {
      const html = renderToStaticMarkup(
        <Invitation project={{ ...fixture, template, person_a: personA, person_b: personB }} />,
      );
      expect(html).toContain(personA);
      expect(html).toContain(personB);
      expect(html).not.toContain("M&T");
      expect(html).not.toContain("A&T");
      expect(html).not.toContain("scene-monogram");
      expect(html).not.toContain("paper-monogram");
      expect(html).toContain("class=\"seal-heart\"");
      const formal = html.match(/<article class="paper invitation-paper"[\s\S]*?<\/article>/)?.[0] || "";
      expect(formal.split(personA).length - 1).toBe(1);
      expect(formal.split(personB).length - 1).toBe(1);
    }
  });
  test("missing names use an explicit neutral placeholder, never invented names", () => {
    const html = renderToStaticMarkup(
      <Invitation project={{ ...fixture, person_a: "", person_b: "   ", photos: [] }} />,
    );
    expect(html).toContain("အမည် မထည့်ရသေးပါ");
    expect(html).not.toContain("မောင်");
    expect(html).not.toContain("M&T");
    expect(html).not.toContain("T&");
  });
  test("customer names and messages stay escaped React text", () => {
    const html = renderToStaticMarkup(
      <Invitation
        project={{
          ...fixture,
          person_a: "<script>alert(1)</script>",
          message: "<img src=x onerror=alert(1)>",
        }}
      />,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("no-referrer-when-downgrade");
  });
});
