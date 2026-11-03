import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import LoveGalaxyExperience, {
  ASCENT_START_PROGRESS,
  PHOTO_BAND_EXIT_PROGRESS,
  SPHERE_EXIT_PROGRESS,
  createGalaxyCameraFlight,
  galaxyCameraPhase,
} from "../src/components/LoveGalaxyExperience";

const source = readFileSync(new URL("../src/components/LoveGalaxyExperience.tsx", import.meta.url), "utf8");

describe("Love Galaxy single entry", () => {
  test("offers one prepare action and a separate creator link, with the journey and song not started", () => {
    const html = renderToStaticMarkup(<LoveGalaxyExperience />);
    expect(html).toContain("PREPARE GALAXY");
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-journey-started="false"');
    expect(html).toContain('data-memory-count="1200"');
    expect(html).toContain('preload="auto"');
    expect(html).toContain('href="/love-galaxy/create"');
    expect(html).toContain("Create your own Love Galaxy");
    expect(html.match(/<button /g)?.length).toBe(1);
    expect(html).not.toContain("autoplay");
    for (const text of ["1,200", "DEMO PLACEHOLDERS", "MEMORY CARDS", "DRAG TO ORBIT", "lg-scene-copy", "lg-brand", "lg-camera-hint", "lg-count-badge"]) {
      expect(html).not.toContain(text);
    }
  });

  test("only enables entry after a frame with all four photo textures and starts audio in the same gesture", () => {
    expect(source).toContain("!scenePrepared && loadedDemoTextures === images.length");
    expect(source).toContain('rendererReady ? "ENTER GALAXY" : "PREPARE GALAXY"');
    expect(source).toContain("if (!rendererReady || journeyStarted || entering || !audio || !mounted) return;");
    expect(source).toContain("const playback = audio.play();");
    expect(source).toContain("void playback.then(() => {");
    expect(source).toContain("mounted.startJourney();");
    expect(source).toContain("if (journeyStarted && !reducedMotion.matches) cinematicElapsed += delta;");
    expect(source).toContain('!journeyStarted ? "waiting"');
  });

  test("matches the standalone 18-second route and flattened oblique camera finale", () => {
    expect(source).toContain("intro < 2.5 ? travel(0, 2.5, 0, SPHERE_EXIT_PROGRESS)");
    expect(source).toContain("intro < 11.5 ? travel(2.5, 9, SPHERE_EXIT_PROGRESS, PHOTO_BAND_EXIT_PROGRESS)");
    expect(source).toContain("intro < 13 ? travel(11.5, 1.5, PHOTO_BAND_EXIT_PROGRESS, ASCENT_START_PROGRESS)");
    expect(source).toContain("travel(13, 5, ASCENT_START_PROGRESS, 1)");
    const { path } = createGalaxyCameraFlight();
    expect(path.getPoint(0).length()).toBeLessThan(2.5);
    expect(path.getPoint(PHOTO_BAND_EXIT_PROGRESS).z).toBeGreaterThan(13.2);
    expect(path.getPoint(ASCENT_START_PROGRESS).z).toBeCloseTo(17.8, 1);
    expect(path.getPoint(1).y / path.getPoint(1).length()).toBeCloseTo(0.2356, 3);
    expect(path.getPoint(1).z / path.getPoint(1).length()).toBeCloseTo(0.9719, 3);
    expect([0, SPHERE_EXIT_PROGRESS, PHOTO_BAND_EXIT_PROGRESS, ASCENT_START_PROGRESS, 1].map(galaxyCameraPhase)).toEqual([
      "sphere-exit", "photo-band", "band-exit", "rising-above-orbit", "above-orbit",
    ]);
  });
});
