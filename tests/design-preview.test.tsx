import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import Invitation from "../src/components/Invitation";
import {
  createDesignPreview,
  SAMPLE_MAP_NOTICE,
} from "../src/lib/designPreview";
import type { Design, Project } from "../src/types";
import { renderedParentTexts } from "./helpers/markup-text";

const designs: Design[] = ["thazin", "noir", "rose"];
const languages = ["my", "en"] as const;

const formal = (project: Project) =>
  renderToStaticMarkup(<Invitation project={project} preview />).match(
    /<article class="paper invitation-paper"[\s\S]*?<\/article>/,
  )?.[0] || "";

describe("in-memory design previews", () => {
  test("keep the sample date, omit sample time UI, and render complete family wording", () => {
    for (const design of designs) for (const language of languages) {
      const project = createDesignPreview(design, language);
      const html = renderToStaticMarkup(<Invitation project={project} preview />);
      const card = formal(project);

      expect(project.id).toBe("design-preview");
      expect(project.status).toBe("draft");
      expect(project.public_key).toBeNull();
      expect(project.event_date).toBe("2027-02-14");
      expect(project.event_time).toBe("");
      expect(renderedParentTexts(card)).toContain(project.parent_a);
      expect(card).toContain(project.person_a);
      expect(renderedParentTexts(card)).toContain(project.parent_b);
      expect(card).toContain(project.person_b);
      expect(card).toContain(project.message);
      expect(renderedParentTexts(card).join("\n")).toContain("တို့၏ သား");
      expect(renderedParentTexts(card).join("\n")).toContain("တို့၏ သမီး");
      for (const wording of ["မိဘနှစ်ပါး", "ညီအစ်ကိုမောင်နှမများ", "ဆွေမျိုးမိတ်သင်္ဂဟများ"])
        expect(card).toContain(wording);
      expect(html).toContain("2027");
      expect(html).toContain("14");
      expect(html).not.toContain('id="calendar"');
      expect(html).not.toContain("traditional-time");
      expect(html).not.toContain("ချစ်ခင်ရသူများကို ကြိုဆိုမယ်");
      expect(html).not.toContain('selected-copy"><span>');
      expect(html).toContain("/assets/wedding-1.jpg");
      expect(html).toContain("/assets/wedding-2.jpg");
      expect(html).toContain("/assets/wedding-3.jpg");
      expect(html).toContain("Together, a beautiful beginning.");
      expect(html).toContain("All the beautiful days");
      expect(html).toContain("You, always");
      expect(html).toContain("maps.google.com/maps?q=17.0002815%2C96.0650261");
      expect(SAMPLE_MAP_NOTICE).toContain("Sample map only");
      expect(html).not.toContain("design-preview-qr");
    }
  });

  test("never renders private owner fields into the public invitation", () => {
    const project = createDesignPreview("thazin", "en");
    const html = renderToStaticMarkup(<Invitation project={project} preview />);
    expect(project.customer_name).toBe("");
    expect(project.customer_email).toBe("");
    expect(project.customer_phone).toBe("");
    expect(project.private_notes).toBe("");
    expect(html).not.toContain("customer_name");
    expect(html).not.toContain("private_notes");
  });

  test("returns fresh nested objects and does not change real project defaults", () => {
    for (const design of designs) for (const language of languages) {
      const first = createDesignPreview(design, language);
      const second = createDesignPreview(design, language);
      first.photos[0].caption = "mutated";
      first.photos.push({ id: "extra", url: "/extra.jpg", caption: "extra", position: 3 });
      expect(second.photos).toHaveLength(3);
      expect(second.photos[0].caption).toBe("Together, a beautiful beginning.");
      expect(first.photos).not.toBe(second.photos);
      expect(first).not.toHaveProperty("customer_email", "demo@example.com");
    }
  });

  test("does not render a real supplied time in guest-facing cards", () => {
    for (const design of designs) for (const language of languages) {
      const project = { ...createDesignPreview(design, language), id: "real-project", event_time: "18:30" };
      const html = renderToStaticMarkup(<Invitation project={project} preview />);
      const card = formal(project);
      expect(card).not.toContain("traditional-time");
      expect(html).not.toContain("၁၈:၃၀ နာရီ");
      expect(html).toContain("wedding-schedule");
      expect(html).not.toContain("route-information");
      expect(html).not.toContain('id="calendar"');
    }
  });

  test("real empty optional fields never become demo data or empty placeholders", () => {
    for (const template of designs) {
      const project = {
        ...createDesignPreview(template, "my"), id: "real-draft-not-demo",
        parent_a: "", parent_b: "", message: "", event_date: "", event_time: "",
        venue: "", map_url: "", photos: [], customer_email: "PRIVATE_EMAIL_CANARY",
        customer_phone: "PRIVATE_PHONE_CANARY", private_notes: "PRIVATE_NOTES_CANARY",
      };
      const html = renderToStaticMarkup(<Invitation project={project} preview />);
      expect(html).toContain(project.person_a);
      expect(html).toContain(project.person_b);
      for (const omitted of ["traditional-parents", "traditional-wording", "traditional-event",
        "journey-venue", "journey-map-button", "data-map-src", "/assets/wedding-1.jpg",
        "ဓာတ်ပုံ မထည့်ရသေးပါ", "နေရာ မသတ်မှတ်ရသေးပါ", "အချိန် မသတ်မှတ်ရသေးပါ",
        "မြေပုံလင့်ခ် မထည့်ထားပါ", "PRIVATE_EMAIL_CANARY", "PRIVATE_PHONE_CANARY", "PRIVATE_NOTES_CANARY"])
        expect(html).not.toContain(omitted);
    }
  });
});
