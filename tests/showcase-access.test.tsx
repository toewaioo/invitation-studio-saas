import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import App from "../src/App";
import Editor from "../src/components/Editor";
import Showcase, { getShowcaseDesigns, showcaseCategories, showcaseDesigns } from "../src/components/Showcase";
import { guestPublicInput } from "../src/lib/guestInvitation";
import { studioRoute, workspaceAccess } from "../src/lib/access";
import type { ProjectInput } from "../src/types";

const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function setBrowserStubs(pathname: string, seeded = "") {
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { pathname, origin: "http://localhost", search: "" },
  });
  const values = new Map([["invitation-studio.projects.v1", seeded]]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
}

afterEach(() => {
  if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
  else Reflect.deleteProperty(globalThis, "location");
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

describe("public and management access", () => {
  test("maps public, guest-create, management, and invitation paths without granting guest access", () => {
    expect(studioRoute("/")).toBe("showcase");
    expect(studioRoute("/create")).toBe("create");
    expect(studioRoute("/manage")).toBe("manage");
    expect(studioRoute("/i/sample?key=public")).toBe("invitation");
    expect(workspaceAccess("showcase", "admin", "admin")).toBe(false);
    expect(workspaceAccess("create", "admin", "admin")).toBe(false);
    expect(workspaceAccess("manage", null, "admin")).toBe(false);
    expect(workspaceAccess("manage", "other", "admin")).toBe(false);
    expect(workspaceAccess("manage", "admin", "")).toBe(false);
    expect(workspaceAccess("manage", "admin", "admin")).toBe(true);
  });

  test("renders exactly the three public samples in both languages without account or dashboard actions", () => {
    for (const lang of ["en", "my"] as const) {
      const html = renderToStaticMarkup(
        <Showcase
          lang={lang}
          onLanguage={() => {}}
          onPreview={() => {}}
          onCreate={() => {}}
          onSignIn={() => {}}
          checking={false}
          configured={false}
        />,
      );
      expect(html).toContain("Thazin");
      expect(html).toContain("Golden Vow");
      expect(html).toContain("Rose Reverie");
      expect((html.match(/class="library-design\s/g) ?? []).length).toBe(3);
      expect(html).not.toContain("Dashboard");
      expect(html).not.toContain("Projects");
      expect(html).not.toContain("Customers");
      expect(html).not.toContain("Sign in");
      expect(html).not.toContain("Log in");
      expect(html).not.toContain("Save draft");
      expect(html).not.toContain("Edit invitation");
    }
  });

  test("keeps categories extensible and only exposes the three existing wedding templates", () => {
    expect(showcaseCategories.map(category => category.id)).toEqual([
      "wedding", "3d-experiences", "event", "birthday", "business", "holiday", "others",
    ]);
    expect(showcaseDesigns.map(({ id, category }) => [id, category])).toEqual([
      ["thazin", "wedding"], ["noir", "wedding"], ["rose", "wedding"],
    ]);
    expect(getShowcaseDesigns("all")).toHaveLength(3);
    expect(getShowcaseDesigns("wedding").map(design => design.id)).toEqual(["thazin", "noir", "rose"]);
    for (const category of ["3d-experiences", "event", "birthday", "business", "holiday", "others"] as const) {
      expect(getShowcaseDesigns(category)).toEqual([]);
    }

    for (const lang of ["en", "my"] as const) {
      const html = renderToStaticMarkup(
        <Showcase lang={lang} onLanguage={() => {}} onPreview={() => {}} onCreate={() => {}} onSignIn={() => {}} checking={false} configured={false} />,
      );
      expect((html.match(/class="showcase-category-card/g) ?? []).length).toBe(7);
      expect(html).toContain('id="category-3d-experiences"');
      expect((html.match(/data-category="wedding"/g) ?? []).length).toBe(3);
      expect(html).toContain("/assets/showcase-preview/thazin.webp");
      expect(html).toContain("/assets/showcase-preview/golden-vow.webp");
      expect(html).toContain("/assets/showcase-preview/rose-reverie.webp");
      expect(html).toContain("/assets/showcase-preview/love-galaxy.webp");
      expect(html).not.toContain('class="cover-paper"');
      expect(html).toContain(lang === "en" ? "Coming soon" : "မကြာမီလာမည်");
      const featuredStart = html.indexOf('<section class="showcase-designs"');
      const galaxyStart = html.indexOf('<section class="showcase-love-galaxy"');
      expect(galaxyStart).toBeGreaterThan(featuredStart);
      expect(html.slice(featuredStart, galaxyStart)).not.toContain("Love Galaxy</h2>");
    }
  });

  test("puts the three real wedding previews in an editorial hero and keeps guest trust and steps clear", () => {
    for (const lang of ["en", "my"] as const) {
      const html = renderToStaticMarkup(
        <Showcase lang={lang} onLanguage={() => {}} onPreview={() => {}} onCreate={() => {}} onSignIn={() => {}} checking={false} configured={false} />,
      );
      expect(html).toContain('data-showcase-design="thazin"');
      expect(html).toContain('data-showcase-design="noir"');
      expect(html).toContain('data-showcase-design="rose"');
      expect(html).toContain(lang === "en" ? "No account needed" : "အကောင့်မလိုပါ");
      expect(html).toContain(lang === "en" ? "Owner space stays private" : "ပိုင်ရှင်နေရာ သီးသန့်ဖြစ်သည်");
      expect(html).toContain("Toewaioo&#x27;s Studio");
      expect(html).toContain(lang === "en" ? "Choose. Customize. Share." : "ရွေးချယ်ပါ။ ပြင်ဆင်ပါ။ မျှဝေပါ။");
      expect(html).not.toContain("Download HTML");
      expect(html).not.toContain("Online shop");
      expect(html).not.toContain("Personal portfolio");
    }
  });

  test("root showcase ignores seeded local projects, while unauthenticated /manage has no project table", () => {
    const seeded = JSON.stringify([{ id: "canary", title: "CANARY PROJECT", customer_name: "CANARY CUSTOMER" }]);
    setBrowserStubs("/", seeded);
    const root = renderToStaticMarkup(<App />);
    expect(root).toContain("Thazin");
    expect(root).not.toContain("CANARY PROJECT");
    expect(root).not.toContain("Invitation projects");
    expect(root).not.toContain("Search projects");

    setBrowserStubs("/manage", seeded);
    const manage = renderToStaticMarkup(<App />);
    expect(manage).toContain('class="showcase-access"');
    expect(manage).toContain("သီးသန့်စီမံခန့်ခွဲမှု");
    expect(manage).not.toContain("CANARY PROJECT");
    expect(manage).not.toContain("Invitation projects");
    expect(manage).not.toContain("Search projects");
    expect(manage).not.toContain("New invitation");
  });
});

describe("guest invitation privacy", () => {
  const validInput = (): ProjectInput => ({
    title: "  Our Day  ",
    customer_name: "CANARY CUSTOMER",
    customer_email: "canary@example.com",
    customer_phone: "+959000000000",
    private_notes: "CANARY PRIVATE NOTE",
    person_a: "Min Khant",
    person_b: "Thazin",
    parent_a: "Family A",
    parent_b: "Family B",
    event_date: "2027-02-14",
    event_time: "18:00",
    venue: "Yangon",
    message: "Please join us.",
    map_url: "https://maps.google.com",
    username: "CANARY-USERNAME",
    template: "thazin",
    theme: "sage",
    project_type: "wedding",
  });

  test("guest editor starts at event details and exposes no customer or draft controls", () => {
    const html = renderToStaticMarkup(
      <Editor guest project={null} lang="en" onClose={() => {}} onSaved={() => {}} onPreview={() => {}} />,
    );
    expect(html).toContain("Event details");
    expect(html).toContain("event_date");
    expect(html).not.toContain("Customer details");
    expect(html).not.toContain("customer_name");
    expect(html).not.toContain("customer_email");
    expect(html).not.toContain("customer_phone");
    expect(html).not.toContain("private_notes");
    expect(html).not.toContain("username");
    expect(html).not.toContain("Save draft");
    expect(html).not.toContain("CANARY");
  });

  test("guest public input validates required event data and strips all customer, private, and username fields", () => {
    const publicInput = guestPublicInput(validInput());
    expect(Object.keys(publicInput).sort()).toEqual([
      "event_date", "event_time", "map_url", "message", "parent_a", "parent_b",
      "person_a", "person_b", "project_type", "template", "theme", "title", "venue",
    ].sort());
    expect(publicInput.title).toBe("Our Day");
    const serialized = JSON.stringify(publicInput);
    expect(serialized).not.toContain("CANARY");
    expect(serialized).not.toContain("customer");
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("username");
    expect(() => guestPublicInput({ ...validInput(), person_a: "" })).toThrow("First person is required");
  });
});
