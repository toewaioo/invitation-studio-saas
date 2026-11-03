import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import Invitation from "../src/components/Invitation";
import { emptyProject, type Design, type Project } from "../src/types";
import { renderedParentTexts } from "./helpers/markup-text";

const fixture: Project = {
  ...emptyProject,
  id: "ornate-design-test",
  status: "draft",
  public_key: null,
  created_at: "",
  updated_at: "",
  person_a: "မောင်ပြည့်ဖြိုးအောင်မင်းခန့် နမူနာအမည်အပြည့်အစုံ",
  person_b: "မနှင်းသဇင်ဝင်းထက်အောင် နမူနာအမည်အပြည့်အစုံ",
  parent_a: "ဦးအောင်မင်း နမူနာ နှင့်\nဒေါ်ခင်မြ နမူနာ",
  parent_b: "ဦးဝင်းထက် နမူနာ နှင့်\nဒေါ်နှင်းအေး နမူနာ",
  event_date: "2027-02-14",
  event_time: "09:30",
  venue: "နမူနာဧည့်ခန်းမ\nနမူနာနေရာ ဒုတိယစာကြောင်း",
  message: "နမူနာဖိတ်ကြားစာ ပထမစာကြောင်း",
  photos: [],
};

const designs: Design[] = ["thazin", "noir", "rose"];
const formalCard = (project: Project) => {
  const html = renderToStaticMarkup(<Invitation project={project} />);
  return html.match(/<article class="paper invitation-paper"[\s\S]*?<\/article>/)?.[0] ?? html;
};

const ornateCss = readFileSync(
  new URL("../src/components/invitation-ornate.css", import.meta.url),
  "utf8",
);

function cssRules(css: string): Array<{ selector: string; declarations: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    declarations: match[2],
  }));
}

describe("ornate printed invitation designs", () => {
  test("all three designs retain each supplied full name, family, venue, and date without time", () => {
    for (const design of designs) {
      const html = formalCard({ ...fixture, template: design });
      for (const literal of [fixture.person_a, fixture.person_b, fixture.venue]) {
        expect(html).toContain(literal);
      }
      expect(renderedParentTexts(html)).toEqual([fixture.parent_a, fixture.parent_b]);
      expect(html).toContain('dateTime="2027-02-14"');
      expect(html).not.toContain('dateTime="09:30"');
      expect(html).toContain(`data-design="${design}"`);
      expect(html.split(fixture.person_a).length - 1).toBe(1);
      expect(html.split(fixture.person_b).length - 1).toBe(1);
    }
  });

  test("renders decorative filigree as hidden decoration, not additional content", () => {
    for (const design of designs) {
      const html = formalCard({ ...fixture, template: design });
      expect(html).toMatch(
        /<svg(?=[^>]*class="[^"]*paper-filigree[^"]*")(?=[^>]*aria-hidden="true")[^>]*>/,
      );
    }
  });

  test("does not fabricate missing parents or event details", () => {
    const html = formalCard({
      ...fixture,
      template: "rose",
      parent_a: "",
      parent_b: "   ",
      event_date: "",
      event_time: "",
      venue: "",
    });
    expect(html).not.toContain("traditional-parents");
    expect(html).not.toContain("traditional-event");
    expect(html).not.toContain("တို့၏ မိသားစု");
    expect(html).not.toContain("မိဘအမည် မထည့်ရသေးပါ");
    expect(html).not.toContain("မသတ်မှတ်ရသေးပါ");
  });

  test("ornate CSS scopes the three designs to invite and does not style dashboard/App", () => {
    for (const design of designs) {
      expect(ornateCss).toMatch(new RegExp(`\\.invite[^{}]*invite-design-${design}`));
    }
    for (const { selector } of cssRules(ornateCss)) {
      expect(selector).not.toMatch(/(?:^|[\\s>+~,(])(?:dashboard|app)(?:[.#[:\\s,{)>+~]|$)/i);
    }
  });

  test("Myanmar name rules never apply nonzero tracking", () => {
    const nameRules = cssRules(ornateCss).filter(({ selector }) =>
      /(?:traditional-person|traditional-parents|paper-filigree.*name|name-pair)/i.test(selector),
    );
    for (const { declarations } of nameRules) {
      const tracking = declarations.match(/letter-spacing\s*:\s*([^;]+);?/i);
      if (tracking) expect(tracking[1].trim()).toMatch(/^(?:0|0(?:px|em|rem|ch|ex|%))$/);
    }
  });
});
