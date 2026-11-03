import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import Invitation from "../src/components/Invitation";
import { emptyProject, type Project } from "../src/types";

const fixture: Project = {
  ...emptyProject,
  id: "cinematic-opening-test",
  status: "published",
  created_at: "",
  updated_at: "",
  public_key: "cinematic-opening",
  person_a: "Min",
  person_b: "Thazin",
  event_date: "2027-02-14",
  event_time: "09:00",
  venue: "Yangon Hall",
  photos: [],
};

const markup = renderToStaticMarkup(<Invitation project={fixture} />);
const css = readFileSync(
  new URL("../src/components/invitation-opening.css", import.meta.url),
  "utf8",
);
const motion = readFileSync(
  new URL("../src/components/useInvitationMotion.ts", import.meta.url),
  "utf8",
);

describe("cinematic invitation opening", () => {
  test("renders the seal crack, two fragments, envelope flap and twelve petals", () => {
    expect(markup).toContain('id="envelope"');
    expect(markup).toContain('class="envelope-flap"');
    expect(markup).toContain('class="seal-crack"');
    expect(markup).toMatch(/class="[^"]*seal-fragment[^"]*left[^"]*"/);
    expect(markup).toMatch(/class="[^"]*seal-fragment[^"]*right[^"]*"/);
    expect(markup).toContain('class="letter-peek"');

    const petals = markup.match(
      /class="opening-petals"[^>]*>([\s\S]*?)<\/div>/,
    )?.[1];
    expect(petals).toBeDefined();
    expect((petals?.match(/<i\b/g) || []).length).toBe(12);
  });

  test("keeps cinematic phases and reduced-motion rules declarative in CSS", () => {
    for (const phase of ["opening", "extracting", "presenting"]) {
      expect(css).toMatch(new RegExp(`\\.arrival\\.${phase}\\b`));
    }
    expect(css).toMatch(/seal-fragment/);
    expect(css).toMatch(/seal-crack/);
    expect(css).toMatch(/opening-petals/);
    expect(css).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
    expect(css).toMatch(/opening-petals[^{}]*i|opening-petals[\s\S]*?i\s*\{/);
  });

  test("keeps the closed letter inside the envelope and restores a finite bounce", () => {
    expect(css).toMatch(/\.arrival \.letter-peek\s*\{[^}]*top:\s*4px;[^}]*height:\s*calc\(100% - 9px\);[^}]*z-index:\s*2;/);
    expect(css).toContain("animation: ir-cover-envelope-bounce 2100ms 420ms 2 both;");
    expect(css).toMatch(/@keyframes ir-cover-envelope-bounce/);
    expect(css).toMatch(/\.arrival\.opening \.envelope\s*\{\s*animation:\s*none;/);
    expect(css).toMatch(/@media \(max-width: 350px\)[\s\S]*?\.arrival \.envelope\s*\{\s*width:\s*74%;/);
  });

  test("motion advances through named phases and rewrap clears the cinematic state", () => {
    expect(motion).toMatch(/classList\.add\(["']opening["']\)/);
    expect(motion).toMatch(/classList\.add\(["']extracting["']\)/);
    expect(motion).toMatch(/classList\.add\(["']presenting["']\)/);
    expect(motion).toContain('arrival.setAttribute("aria-busy", "true")');
    expect(motion).toMatch(/rewrap/);
    expect(motion).toMatch(/classList\.remove\([\s\S]*?opening[\s\S]*?extracting[\s\S]*?presenting/);
    expect(motion).toContain('arrival.hidden = false');
    expect(motion).toContain('arrival.removeAttribute("aria-busy")');
  });

  test("keeps cover decoration non-semantic and links the real seal to its instructions", () => {
    expect(markup).toContain('class="cover-atmosphere" aria-hidden="true"');
    expect(markup).toContain('class="arrival-crest" aria-hidden="true"');
    expect(markup).toContain('data-has-photo="false"');
    const instructionId = markup.match(/class="open-whisper" id="([^"]+)"/)?.[1];
    expect(instructionId).toBeDefined();
    expect(markup).toContain(`aria-describedby="${instructionId}"`);
    expect(markup).toContain('aria-label="Open invitation"');
    expect(markup).toContain('id="share"');
    const withPhoto = renderToStaticMarkup(<Invitation project={{ ...fixture, photos: [{ id: "cover-photo", url: "/test/cover.jpg", caption: "Our photo", position: 0 }] }} />);
    expect(withPhoto).toContain('data-has-photo="true"');
    expect(withPhoto).toContain('src="/test/cover.jpg"');
  });

  test("uses finite cover effects and an instant reduced-motion path without new assets", () => {
    expect(css).not.toMatch(/animation\s*:[^;{}]*\binfinite\b/);
    expect(css).not.toMatch(/@import|url\(/);
    expect(css).toContain('.invite.invite.sealed .floating-petals { display: none; }');
    expect(css).toMatch(/\.arrival \*::after\s*\{\s*animation: none !important; transition: none !important;/);
    expect(css).toContain('animation: ir-cover-seal-cue 2600ms 1800ms 2');
    for (const delay of [900, 1100, 350]) expect(motion).toContain(`wait(${delay}, reduced, signal)`);
  });
});
