import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import Invitation from "../src/components/Invitation";
import { emptyProject, type Design, type Project } from "../src/types";
import { invitationTime, isClockTime } from "../src/components/invitationData";
import { renderedParentTexts } from "./helpers/markup-text";

const designs: Design[] = ["thazin", "noir", "rose"];
const longVenue =
  "ရန်ကုန်မြို့ မင်္ဂလာဧည့်ခံခန်းမ အမှတ် ၁၂၃ မဟာဗန္ဓုလလမ်း မြို့နယ်အလယ်ပိုင်း အဆောက်အအုံအတွင်းရှိ အခမ်းအနားခန်းမကြီး ဒုတိယထပ် ဧည့်သည်များအတွက် သီးသန့်ဝင်ပေါက်နှင့် ကားရပ်နားရန်နေရာပါဝင်သော မင်္ဂလာခန်းမ";
const longMessage =
  "မိသားစုနှစ်ဖက်မှ ချစ်ခင်ရသူများအားလုံးကို အထူးလေးစားစွာဖြင့် ဖိတ်ကြားအပ်ပါသည်။ " +
  "အတူတကွဆုံစည်းပြီး မင်္ဂလာနေ့ရက်ကို နွေးထွေးပျော်ရွှင်စွာ ဖြတ်သန်းပေးကြပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။";
const eventTime = "နံနက် ၀၉:၀၀ နာရီမှ မွန်းတည့် ၁၂:၀၀ နာရီအထိ";

const fixture: Project = {
  ...emptyProject,
  id: "responsive-event-test",
  status: "draft",
  public_key: null,
  created_at: "",
  updated_at: "",
  template: "thazin",
  customer_name: "PRIVATE_CUSTOMER_SENTINEL",
  customer_email: "PRIVATE_EMAIL_SENTINEL",
  customer_phone: "PRIVATE_PHONE_SENTINEL",
  private_notes: "PRIVATE_NOTES_SENTINEL",
  parent_a: "ဦးအောင်မင်း နှင့် ဒေါ်ခင်မြ\nမိသားစုဝင်များအားလုံး",
  parent_b: "ဦးဝင်းထက် နှင့် ဒေါ်နှင်းအေး\nမိသားစုဝင်များအားလုံး",
  person_a: "မောင်ပြည့်ဖြိုးအောင်မင်းခန့် နမူနာအမည်အပြည့်အစုံ",
  person_b: "မနှင်းသဇင်ဝင်းထက်အောင် နမူနာအမည်အပြည့်အစုံ",
  event_date: "2027-02-14",
  event_time: eventTime,
  venue: longVenue,
  message: longMessage,
  photos: [],
};

function formalCard(project: Project) {
  return (
    renderToStaticMarkup(<Invitation project={project} />).match(
      /<article class="paper invitation-paper"[\s\S]*?<\/article>/,
    )?.[0] ?? ""
  );
}

describe("responsive traditional event content", () => {
  test("SSR keeps long supplied content exact across all three designs", () => {
    for (const template of designs) {
      const html = formalCard({ ...fixture, template });
      expect(renderedParentTexts(html)).toEqual([fixture.parent_a, fixture.parent_b]);
      expect(html).toContain(fixture.person_a);
      expect(html).toContain(fixture.person_b);
      expect(html).toContain(fixture.message);
      expect(html).toContain(fixture.venue);
      expect(html).not.toContain(eventTime);
      expect(html).not.toContain(`datetime="${eventTime}"`);

      // The long venue is allowed to wrap, but must not be abbreviated or replaced.
      expect(html).not.toMatch(/…|\.\.\.|&hellip;|\b(?:etc|more)\b/i);
      expect(html).not.toContain("PRIVATE_CUSTOMER_SENTINEL");
      expect(html).not.toContain("PRIVATE_EMAIL_SENTINEL");
      expect(html).not.toContain("PRIVATE_PHONE_SENTINEL");
      expect(html).not.toContain("PRIVATE_NOTES_SENTINEL");
      expect(html).not.toContain("customer_name");
      expect(html).not.toContain("private_notes");
    }
  });

  test("renders date and venue once as two semantic dl rows, without guest-facing time", () => {
    const html = formalCard(fixture);
    const event = html.match(/<dl class="traditional-event">[\s\S]*?<\/dl>/)?.[0] ?? "";

    expect(event).not.toBe("");
    expect((event.match(/<dt>/g) ?? []).length).toBe(2);
    expect((event.match(/<dd(?:\s|>)/g) ?? []).length).toBe(2);
    expect((event.match(/<dt>နေ့ရက်<\/dt>/g) ?? []).length).toBe(1);
    expect((event.match(/<dt>အချိန်<\/dt>/g) ?? []).length).toBe(0);
    expect((event.match(/<dt>နေရာ<\/dt>/g) ?? []).length).toBe(1);
    expect((event.match(/<time[\s>]/g) ?? []).length).toBe(1);
    expect(event).toContain(longVenue);
    expect(event).not.toContain(eventTime);
  });

  test("omits each optional event row when its supplied value is empty", () => {
    const html = formalCard({ ...fixture, event_date: "", event_time: "", venue: "" });
    expect(html).not.toContain('class="traditional-event"');
    expect(html).not.toContain('class="traditional-date"');
    expect(html).not.toContain('class="traditional-time"');
    expect(html).not.toContain('class="traditional-location"');
  });

  test("traditional event CSS is one-column, shrink-safe, and does not clip text", () => {
    const css = readFileSync(new URL("../src/components/traditional-card.css", import.meta.url), "utf8");
    const eventBlock = css.match(/(?:^|\n)[^{}]*\.traditional-event[^{}]*\{[^}]*\}/)?.[0] ?? "";

    expect(eventBlock).not.toBe("");
    expect(eventBlock).toMatch(/(?:grid-template-columns\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)|flex-direction\s*:\s*column)/);
    expect(eventBlock).not.toMatch(/text-overflow\s*:\s*ellipsis|white-space\s*:\s*nowrap|line-clamp|display\s*:\s*-webkit-box/i);
  });

  test("formal parent CSS keeps ordinary family copy regular and quoted names bold, with safe wrapping", () => {
    const css = readFileSync(new URL("../src/components/invitation-formal.css", import.meta.url), "utf8");
    const parents = css.match(/\.traditional-card \.traditional-parents\s*\{[^}]*\}/)?.[0] ?? "";
    const unit = css.match(/\.traditional-card \.traditional-parent-unit\s*\{[^}]*\}/)?.[0] ?? "";
    const emphasis = css.match(/\.traditional-card \.traditional-parent-emphasis\s*\{[^}]*\}/)?.[0] ?? "";
    const fallback = css.match(/\.invitation-paper:has\(\.traditional-card\[data-fit="oversize"\]\)\s*\{[^}]*\}/)?.[0] ?? "";
    expect(parents).toMatch(/font:\s*400\b/);
    expect(parents).toMatch(/overflow-wrap:\s*normal/);
    expect(unit).toMatch(/display:\s*inline-block/);
    expect(unit).toMatch(/max-width:\s*100%/);
    expect(unit).toMatch(/overflow-wrap:\s*anywhere/);
    expect(unit).toMatch(/word-break:\s*normal/);
    expect(emphasis).toMatch(/font-weight:\s*700/);
    expect(emphasis).toMatch(/overflow-wrap:\s*anywhere/);
    expect(fallback).toMatch(/overflow-y:\s*auto/);
    expect(fallback).toMatch(/overflow-x:\s*hidden/);
  });

  test("time wording is not duplicated or converted into invented clock data", () => {
    expect(invitationTime(eventTime)).toBe(eventTime);
    expect(invitationTime("09:30")).toBe("၀၉:၃၀ နာရီ");
    expect(isClockTime(eventTime)).toBe(false);
    expect(isClockTime("09:30")).toBe(true);
    expect(isClockTime("25:90")).toBe(false);
  });
});
