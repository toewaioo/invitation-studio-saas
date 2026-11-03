import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";
import LoveGalaxyExperience, {
  ASCENT_START_PROGRESS,
  PHOTO_BAND_EXIT_PROGRESS,
  SPHERE_EXIT_PROGRESS,
  createGalaxyCameraFlight,
  fitRingFontPixels,
  fitRingWordsAroundCrossing,
  galaxyCameraPhase,
} from "../src/components/LoveGalaxyExperience";
import { createSharedJourneyLayout, createSharedJourneyLocalSpaceSpecs, normalizeSharedJourneySampleId, SHARED_JOURNEY_LOCAL_SPACE_RADIUS_LIGHT_YEARS, SHARED_JOURNEY_SCENE_UNITS_PER_LIGHT_YEAR, SHARED_JOURNEY_START_DISTANCE, SHARED_JOURNEY_WORLD_COUNT } from "../src/components/love-galaxy-shared-journey";
import Showcase from "../src/components/Showcase";

const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
afterEach(() => {
  if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
  else Reflect.deleteProperty(globalThis, "location");
});

describe("standalone Love Galaxy experience", () => {
  test("renders a fullscreen 3D galaxy with 1,200 cards from four repeated source photos", () => {
    const html = renderToStaticMarkup(<LoveGalaxyExperience />);
    expect(html).toContain('data-experience="love-galaxy"');
    expect(html).toContain('data-renderer="three.js"');
    expect(html).toContain('data-memory-count="1200"');
    expect(html).toContain('data-photo-orbit-count="1"');
    expect(html).toContain('data-photo-orbit-shape="single-wide-band"');
    expect(html).toContain('data-curved-text-rings="2"');
    expect(html).toContain('data-camera-stop="sphere"');
    expect(html).toContain('data-motion-prototype="disabled"');
    expect(html).not.toContain("data-prototype-demo");
    expect(html).not.toContain("lg-demo-actions");
    expect(html).not.toContain("DEMO · SAMPLE COPY");
    expect(html).toContain("Interactive full-screen Three.js 3D galaxy");
    expect(html).toContain("PREPARE GALAXY");
    expect(html).not.toContain("wedding");
    expect(html).not.toContain("lg-camera-nav");
  });

  test("does not render the removed constellation or infinity demo on any Love Galaxy page", () => {
    const standalone = renderToStaticMarkup(<LoveGalaxyExperience />);
    const story = renderToStaticMarkup(<LoveGalaxyExperience story={{ title: "Private story" }} />);
    for (const html of [standalone, story]) {
      expect(html).not.toContain("data-prototype-demo");
      expect(html).not.toContain("data-prototype-action");
      expect(html).not.toContain("lg-demo-actions");
      expect(html).not.toContain("DEMO · SAMPLE COPY");
    }
  });

  test("keeps 1,200 photos in seven equatorial rows and preserves configurable story content", () => {
    const source = readFileSync(new URL("../src/components/LoveGalaxyExperience.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/components/love-galaxy.css", import.meta.url), "utf8");
    expect(source).toContain("const MEMORY_COUNT = 1200");
    expect(source).toContain('const DEFAULT_RING_TEXT_ONE = "အမှတ်တရတွေက ကြယ်တွေပါ"');
    expect(source).toContain('const DEFAULT_RING_TEXT_TWO = "နှလုံးသားနှစ်ခု၊ မိုးကုပ်စက်ဝိုင်းတစ်ခု"');
    expect(source).toContain("Keep all 1,200 flat photo cards in a wide stream with three tidy rows above and below center");
    expect(source).toContain("new THREE.WebGLRenderer");
    expect(source).toContain("new THREE.InstancedMesh");
    expect(source).toContain("new THREE.CatmullRomCurve3");
    expect(source).toContain("new THREE.TorusGeometry");
    expect(source).toContain("const photoOrbitPlane = new THREE.Euler");
    expect(source).toContain("new THREE.Vector3(0, 0, 0.35)");
    expect(source).toContain("new THREE.Vector3(0.16, -1.78, 17.8)");
    expect(source).toContain("const home = THREE.MathUtils.clamp((13.2 + 0.85) / Math.sin(Math.min(halfFov, halfHorizontalFov)) * 1.06, 28, 76)");
    expect(source).toContain("max: Math.min(82, Math.max(52, home * 1.45))");
    expect(source).toContain("const PHOTO_BAND_INNER_RADIUS = 6.2");
    expect(source).toContain("const PHOTO_BAND_OUTER_RADIUS = 13.2");
    expect(source).toContain("const random = seeded(20261030)");
    expect(source).toContain('canvas.dataset.textRingCopyCount = "2"');
    expect(source).toContain('canvas.dataset.photoDistribution = "dense-equatorial-seven-row-stream"');
    expect(source).toContain("const PHOTO_STREAM_ROWS_ABOVE_BELOW = 3");
    expect(source).toContain("const PHOTO_STREAM_ROW_SPACING = 0.68");
    expect(source).toContain("canvas.dataset.photoStreamRowCount = String(PHOTO_STREAM_ROWS_ABOVE_BELOW * 2 + 1)");
    expect(source).toContain("photoStreamHorizontalScale = THREE.MathUtils.clamp");
    expect(source).toContain("record.lift + Math.sin(drift) * (record.row === 0 ? 0.1 : 0.06)");
    expect(source).not.toContain("outlier");
    expect(source).toContain('canvas.dataset.planetNebulaHalo = "soft-pink-behind-sphere"');
    expect(source).toContain("nebulaHalo.position.set(-0.08, 0.12, -2.62)");
    expect(source).toContain('canvas.dataset.photoLightWave = "traveling-gaussian"');
    expect(source).toContain('canvas.dataset.photoLightWaveTrailFree = "true"');
    expect(source).toContain("photoWaveCenter = sin(uPhotoWaveTime * 0.18) * uPhotoWaveSpan");
    expect(source).toContain("photoWaveTime.value = time");
    expect(source).toContain("new THREE.PlaneGeometry(0.33, 0.45)");
    expect(source).toContain("const angle = id * Math.PI * (3 - Math.sqrt(5))");
    expect(source).toContain("const radius = Math.sqrt(THREE.MathUtils.lerp(PHOTO_BAND_INNER_RADIUS ** 2, PHOTO_BAND_OUTER_RADIUS ** 2, (id + 0.5) / MEMORY_COUNT))");
    expect(source).toContain('canvas.dataset.textRingRendering = "orbital-curved-3d-glyphs"');
    expect(source).toContain('canvas.dataset.curvedTextRingSweep = "360"');
    expect(source).toContain('canvas.dataset.crossedTextRingPlanes = "true"');
    expect(source).toContain("const copyCount = 2");
    expect(source).toContain("const gapEm = 2.4");
    expect(source).toContain("const textRingOneAngle = time * 0.045");
    expect(source).toContain("const textRingTwoAngle = -time * 0.035");
    expect(source).toContain("ctx.strokeText(character, sourceLeft + padding, centerY)");
    expect(source).toContain('new Segmenter(undefined, { granularity: "grapheme" })');
    expect(source).toContain("const characters = Segmenter");
    expect(source).toContain("story?.photos?.length === 4");
    expect(source).toContain("ringPhrases[0]");
    expect(source).toContain("ringPhrases[1]");
    expect(source).toContain("story?.musicSrc || backgroundMusic");
    expect(source).toContain("const STAR_COUNT = 4200");
    expect(source).toContain("const SHOOTING_STAR_COUNT = 3");
    expect(source).toContain("camera.lookAt(cameraTargetPath.getPoint(cinematicProgress))");
    expect(source).toContain("getByteFrequencyData");
    expect(source).toContain('canvas.dataset.musicReactiveGlow = "true"');
    expect(source).toContain("musicGlow=1.0+uMusic*.16");
    expect(source).toContain("dataset.musicReactiveLevel = musicPulse.toFixed(3)");
    expect(source).not.toContain("DEMO_COUPLE_NAMES");
    expect(source).not.toContain("DEMO_PROMISE_TEXT");
    expect(source).not.toContain("DEMO_INFINITY_WORD");
    expect(source).not.toContain("activateConstellation");
    expect(source).not.toContain("activatePlanet");
    expect(source).not.toContain("updateDemoEffects");
    expect(source).not.toContain("data-prototype");
    expect(css).not.toContain(".lg-demo-actions");
    expect(css).not.toContain(".lg-demo-moment");
    expect(source).toContain('import.meta.env.VITE_LOVE_GALAXY_REVIEW_MOTION === "true"');
    expect(source).toContain('new URLSearchParams(window.location.search).get("review") === "motion"');
    expect(source).toContain('canvas.dataset.dragRipplePrototype = reviewMotionPrototypeEnabled ? "enabled" : "disabled"');
    expect(source).toContain('canvas.dataset.passingStarPrototype = reviewMotionPrototypeEnabled ? "enabled" : "disabled"');
    expect(source).toContain("uniform vec2 uDragRippleCenter");
    expect(source).toContain("vPhotoDragRipple =");
    expect(source).toContain("const updatePreviewDrag = (delta: number) =>");
    expect(source).toContain("previewDragTargetOffset.set(0, 0, 0)");
    expect(source).toContain("const updatePreviewPassingStar = (time: number) =>");
    expect(source).toContain("function makePassingStarTexture()");
    expect(source).toContain("color=mix(color,passingStarTint,uPassingStar*.78)");
    expect(source).toContain("color*=1.0-uPassingStar*.28");
    expect(source).toContain("canvas.dataset.dragStreamOffset = `${previewDragOffset.x.toFixed(2)},${previewDragOffset.y.toFixed(2)}`");
    expect(source).toContain('texture.colorSpace = THREE.SRGBColorSpace');
    expect(css).toContain(".lg-three-canvas");
    expect(css).toContain(".lg-entry-overlay");
    expect(css).toContain("touch-action: none");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("camera flight exits the photo band and matches the standalone flattened oblique finale", () => {
    const { path, target } = createGalaxyCameraFlight();
    expect(path).toBeInstanceOf(THREE.CatmullRomCurve3);
    expect(target).toBeInstanceOf(THREE.CatmullRomCurve3);
    expect(path.getPoint(0).length()).toBeLessThan(2.5);

    const samples = Array.from({ length: 221 }, (_, index) => path.getPoint(index / 220));
    const outbound = samples.slice(0, 155);
    for (let index = 1; index < outbound.length; index += 1) {
      expect(outbound[index].z).toBeGreaterThanOrEqual(outbound[index - 1].z - 0.02);
    }
    for (let index = 0; index <= Math.round(220 * PHOTO_BAND_EXIT_PROGRESS); index += 1) {
      const point = samples[index];
      if (point.z >= 6.2 && point.z <= 13.2) expect(Math.abs(point.y + 0.1 * point.z)).toBeLessThan(0.35);
    }
    for (const point of samples) {
      if (point.length() <= 13.2) expect(point.y).toBeLessThanOrEqual(0.01);
    }

    expect(path.getPoint(PHOTO_BAND_EXIT_PROGRESS).z).toBeGreaterThan(13.2);
    expect(path.getPoint(ASCENT_START_PROGRESS).z).toBeCloseTo(17.8, 0.45);
    expect(path.points.at(-2)?.y).toBeCloseTo(6.1, 5);
    expect(path.points.at(-2)?.z).toBeCloseTo(24.5, 5);
    expect(Math.atan2(path.getPoint(1).y, path.getPoint(1).z)).toBeCloseTo(THREE.MathUtils.degToRad(13.6229663289), 5);
    expect(path.getPoint(1).length()).toBeCloseTo(26.6, 5);
    expect(target.getPoint(1).length()).toBeLessThan(0.01);

    for (const progress of [0, 0.1, SPHERE_EXIT_PROGRESS, 0.4, PHOTO_BAND_EXIT_PROGRESS]) {
      expect(target.getPoint(progress).dot(new THREE.Vector3(0, 0, 1))).toBeGreaterThan(0);
    }
  });

  test("exports the camera phases and bounded two-copy ring font sizing", () => {
    expect(SPHERE_EXIT_PROGRESS).toBeCloseTo(2 / 11);
    expect(PHOTO_BAND_EXIT_PROGRESS).toBeCloseTo(6 / 11);
    expect(ASCENT_START_PROGRESS).toBeCloseTo(7 / 11);
    expect(galaxyCameraPhase(0)).toBe("sphere-exit");
    expect(galaxyCameraPhase(SPHERE_EXIT_PROGRESS)).toBe("photo-band");
    expect(galaxyCameraPhase(PHOTO_BAND_EXIT_PROGRESS)).toBe("band-exit");
    expect(galaxyCameraPhase(ASCENT_START_PROGRESS)).toBe("rising-above-orbit");
    expect(galaxyCameraPhase(1)).toBe("above-orbit");

    for (const compact of [true, false]) {
      const font = fitRingFontPixels(100, 10, compact);
      expect(Number.isFinite(font)).toBe(true);
      expect(font).toBeGreaterThan(0);
      expect(font).toBeLessThanOrEqual(compact ? 14 : 18);
      expect(2 * 10 * 1.35 * font).toBeLessThanOrEqual(100 + 1e-8);
    }
    expect(fitRingFontPixels(10000, 10, true)).toBe(14);
    expect(fitRingFontPixels(10000, 10, false)).toBe(18);
  });

  test("keeps complete words clear of the ring crossings without clipping either side", () => {
    const phraseSpanEm = 14;
    const wordBreaks = [
      { leftEndEm: -3.8, rightStartEm: -3.3 },
      { leftEndEm: -0.8, rightStartEm: -0.2 },
      { leftEndEm: 1.9, rightStartEm: 2.4 },
    ];
    for (const crossing of [75, 150, 225]) {
      const layout = fitRingWordsAroundCrossing(300, crossing, phraseSpanEm, wordBreaks, 14);
      expect(layout).not.toBeNull();
      if (!layout) throw new Error("Missing word layout");
      expect(layout.fontPixels).toBeGreaterThan(0);
      expect(layout.fontPixels).toBeLessThanOrEqual(14);
      expect(layout.rightAnchor - layout.leftAnchor).toBe(32);
      const firstEdge = layout.leftAnchor + (-phraseSpanEm / 2 - layout.leftEndEm) * layout.fontPixels;
      const lastEdge = layout.rightAnchor + (phraseSpanEm / 2 - layout.rightStartEm) * layout.fontPixels;
      expect(firstEdge).toBeGreaterThanOrEqual(7 - 1e-8);
      expect(lastEdge).toBeLessThanOrEqual(293 + 1e-8);
    }
    expect(fitRingWordsAroundCrossing(300, 0, phraseSpanEm, wordBreaks, 14)).toBeNull();
    expect(fitRingWordsAroundCrossing(300, 300, phraseSpanEm, wordBreaks, 14)).toBeNull();
  });

  test("includes all four sample image files and retains them as the standalone scene fallback", () => {
    const source = readFileSync(new URL("../src/components/LoveGalaxyExperience.tsx", import.meta.url), "utf8");
    for (const suffix of ["01", "02", "03", "04"]) {
      expect(source).toContain(`/assets/galaxy-memory-${suffix}.jpg`);
      expect(existsSync(new URL(`../public/assets/galaxy-memory-${suffix}.jpg`, import.meta.url))).toBe(true);
    }
    expect(source).toContain("DEFAULT_RING_TEXT_ONE");
    expect(source).toContain("const MEMORY_COUNT = 1200");
  });

  test("is a separate route and never renders wedding project, invitation-card, or private fields", () => {
    Object.defineProperty(globalThis, "location", { configurable: true, value: { pathname: "/love-galaxy" } });
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('data-experience="love-galaxy-loading"');
    expect(html).not.toContain("data-design=");
    expect(html).not.toContain("traditional-card");
    expect(html).not.toContain("customer_email");
    expect(html).not.toContain("private_notes");
    expect(html.toLowerCase()).not.toContain("wedding");
  });

  test("keeps three wedding templates and features Love Galaxy separately outside their grid", () => {
    const html = renderToStaticMarkup(<Showcase lang="en" onLanguage={() => {}} onPreview={() => {}} onCreate={() => {}} onSignIn={() => {}} checking={false} configured={false} />);
    expect(html).toContain("Thazin");
    expect(html).toContain("Golden Vow");
    expect(html).toContain("Rose Reverie");
    expect((html.match(/class="library-design\s/g) ?? []).length).toBe(3);
    expect(html).toContain('class="showcase-love-galaxy"');
    expect(html).toContain('href="/love-galaxy"');
    expect(html).toContain('href="/love-galaxy/create"');
    expect(html).toContain("not a wedding invitation template");
    const weddingGrid = html.match(/<div class="design-library-grid">([\s\S]*?)<\/div><\/section>/)?.[1] ?? "";
    expect(weddingGrid).toContain("Thazin");
    expect(weddingGrid).toContain("Golden Vow");
    expect(weddingGrid).toContain("Rose Reverie");
    expect(weddingGrid).not.toContain("Love Galaxy");
    expect(weddingGrid).not.toContain("galaxy-memory");
  });

  test("the shared-journey prototype is explicitly gated and keeps the normal experience disabled by default", () => {
    const html = renderToStaticMarkup(<LoveGalaxyExperience />);
    const source = readFileSync(new URL("../src/components/LoveGalaxyExperience.tsx", import.meta.url), "utf8");
    expect(html).toContain('data-shared-journey-review="disabled"');
    expect(html).not.toContain("SHARED GALAXY · FICTIONAL TEST RUN");
    expect(html).not.toContain("lg-shared-world-tooltip");
    expect(html).not.toContain("lg-return-home-button");
    expect(source).toContain('import.meta.env.VITE_LOVE_GALAXY_SHARED_JOURNEY === "true"');
    expect(source).toContain('sharedJourneyQuery?.get("review") === "shared-journey"');
    expect(source).toContain('canvas.dataset.sharedJourneySource = reviewSharedJourneyPrototypeEnabled ? "fictional-review-test-only" : "none"');
    expect(source).toContain('canvas.dataset.sharedJourneyDestinationVisible = reviewDestinationReveal > 0.95 ? "true" : "false"');
    expect(source).toContain('canvas.dataset.sharedJourneyWorldDepths = reviewLayout?.worlds.map(world => world.position[2].toFixed(2)).join(",") ?? "none"');
    expect(source).toContain('canvas.dataset.sharedJourneyWorldLabels = JSON.stringify(reviewLayout?.worlds.map(world => world.label) ?? [])');
    expect(source).toContain('canvas.dataset.sharedJourneyWorldAppearance = "distance-fade-approach-scale-persistent-distant-worlds"');
    expect(source).toContain('canvas.dataset.sharedJourneyLocalSpaceCount = String(sharedJourneyEnvironment?.localSpaceCount ?? 0)');
    expect(source).toContain('canvas.dataset.sharedJourneyLocalSpaceAppearance = "independent-100-light-year-3d-destination-regions"');
    expect(source).toContain('LOCAL SPACE · {SHARED_JOURNEY_LOCAL_SPACE_RADIUS_LIGHT_YEARS} LY RADIUS');
    expect(source).toContain('const updateSharedJourneyLocalSpaces = () =>');
    expect(source).toContain('updateSharedJourneyLocalSpaces();');
    expect(source).toContain('const sharedJourneyClearColor = reviewSharedJourneyPrototypeEnabled ? "#080614" : "#03040a"');
    expect(source).toContain('camera.far = 7200');
    expect(source).toContain('canvas.dataset.cameraLookMode = journeyLookActive && cinematicProgress < 0.95 ? "free-look" : "path"');
    expect(source).toContain('if (reviewSharedJourneyPrototypeEnabled && journeyStarted && cinematicProgress < 1)');
    expect(source).toContain('THREE.MathUtils.smoothstep(cinematicProgress, 0.90, 1)');
    expect(source).toContain("camera.position.set(destinationAnchor.x, destinationAnchor.y, destinationAnchor.z + THREE.MathUtils.lerp(SHARED_JOURNEY_START_DISTANCE, endDistance, eased))");
    expect(source).toContain("currentOrbit.setFromVector3(camera.position.clone().sub(orbitCenter))");
  });

  test("review-only arrival exposes fictional in-view planet tooltips and a selected-world camera hop", () => {
    const html = renderToStaticMarkup(<LoveGalaxyExperience />);
    const source = readFileSync(new URL("../src/components/LoveGalaxyExperience.tsx", import.meta.url), "utf8");
    const helper = readFileSync(new URL("../src/components/love-galaxy-shared-journey.ts", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/components/love-galaxy.css", import.meta.url), "utf8");
    expect(html).not.toContain("lg-shared-world-tooltip");
    expect(html).not.toContain("lg-return-home-button");
    expect(source).toContain('className="lg-shared-world-tooltip"');
    expect(source).toContain('worldTooltipElement.hidden = true');
    expect(source).toContain('tooltip.setAttribute("aria-label", `Visit ${nearestTarget.label}`)');
    expect(source).toContain('canvas.dataset.sharedJourneyPhase = progress < 1 ? "world-hop" : "world-arrived"');
    expect(source).toContain('canvas.dataset.sharedJourneySelectedWorldId = travel.target.id');
    expect(source).toContain('sharedJourneyWorldTargets.find(world => world.id === worldId)');
    expect(source).toContain('raycaster.intersectObjects(sharedJourneyWorldRaycastTargets, false)[0]');
    expect(source).toContain('startTravelToTarget(placeholderTravelTarget, destinationAnchor.clone(), getZoomBounds().home)');
    expect(source).toContain('startTravelToTarget(target, targetPosition, Math.max(84, target.radius * 8.4))');
    expect(source).toContain('currentSharedJourneyWorldId = travel.target.id === placeholderTravelTarget.id ? null : travel.target.id');
    expect(source).toContain('sharedJourneyWorldStatus.label.startsWith("TEST WORLD ")');
    expect(source).toContain('aria-label="Return to my planet"');
    expect(source).toContain('className="lg-return-home-button"');
    expect(source).toContain('returnToHome: () => void');
    expect(css).toContain(".lg-return-home-button");
    expect(helper).toContain("const radiusFromRoute = 40 + random() * 300");
    expect(helper).toContain("export const SHARED_JOURNEY_LOCAL_SPACE_RADIUS_LIGHT_YEARS = 100");
    expect(helper).toContain("export const SHARED_JOURNEY_SCENE_UNITS_PER_LIGHT_YEAR = 1");
    expect(helper).toContain("const localStarsPerSpace = 480");
    expect(helper).toContain("const localGalaxiesPerSpace = 2");
    expect(helper).toContain("const hazeCount = 320");
    expect(helper).toContain("volumetric colored nebula dust");
    expect(helper).toContain('worldTargets.push({ id: spec.id, label: spec.label, group: world, surface, radius: spec.radius })');
    expect(helper).toContain('surface.userData.sharedJourneyWorldId = spec.id');
  });

  test("sample share links resolve to unique placeholder locations while each visit layout stays stable in flight", () => {
    const firstVisit = createSharedJourneyLayout("demo-share-1", 12345);
    const repeatedVisitState = createSharedJourneyLayout("demo-share-1", 12345);
    const newVisit = createSharedJourneyLayout("demo-share-1", 67890);
    const secondSample = createSharedJourneyLayout("demo-share-2", 12345);
    expect(firstVisit).toEqual(repeatedVisitState);
    expect(firstVisit.destination).not.toEqual(secondSample.destination);
    expect(firstVisit.destination).toEqual(newVisit.destination);
    expect(firstVisit.worlds).toHaveLength(SHARED_JOURNEY_WORLD_COUNT);
    expect(firstVisit.galaxies).toHaveLength(11);
    expect(firstVisit.worlds.map(world => world.position)).not.toEqual(newVisit.worlds.map(world => world.position));
    expect(firstVisit.worlds.every(world => world.source === "fictional-review-test-only" && world.id.startsWith("test-world-"))).toBe(true);
    expect(firstVisit.worlds.every(world => world.label.startsWith("TEST WORLD ") && world.radius > 8 && world.radius < 14 && world.position.every(Number.isFinite))).toBe(true);
    expect(new Set(firstVisit.worlds.map(world => world.id)).size).toBe(20);
    expect(new Set(firstVisit.worlds.map(world => world.label)).size).toBe(20);
    expect(new Set(firstVisit.worlds.map(world => world.color)).size).toBe(20);
    expect(new Set(firstVisit.worlds.map(world => world.pattern)).size).toBe(5);
    const azimuthSectors = new Set(firstVisit.worlds.map(world => Math.floor(((Math.atan2(world.position[1], world.position[0]) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2))));
    expect(azimuthSectors.size).toBe(4);
    expect(firstVisit.galaxies.every(galaxy => galaxy.position.every(Number.isFinite) && galaxy.radius >= 9)).toBe(true);
    const localSpaces = createSharedJourneyLocalSpaceSpecs(firstVisit);
    expect(localSpaces).toHaveLength(SHARED_JOURNEY_WORLD_COUNT + 1);
    expect(localSpaces.every(space => space.radiusLightYears === SHARED_JOURNEY_LOCAL_SPACE_RADIUS_LIGHT_YEARS)).toBe(true);
    expect(SHARED_JOURNEY_SCENE_UNITS_PER_LIGHT_YEAR).toBe(1);
    expect(new Set(localSpaces.map(space => space.id)).size).toBe(21);
    expect(localSpaces[0]).toMatchObject({ destinationId: `placeholder-${firstVisit.sampleId}`, label: "YOUR HOME", center: [0, 0, 0] });
    expect(localSpaces.slice(1).map(space => space.center)).toEqual(firstVisit.worlds.map(world => world.position));
    const depths = firstVisit.worlds.map(world => world.position[2]).sort((a, b) => b - a);
    expect(SHARED_JOURNEY_START_DISTANCE).toBe(6400);
    expect(Math.min(...depths)).toBeGreaterThan(1020);
    for (let index = 1; index < depths.length; index++) expect(depths[index - 1] - depths[index]).toBeGreaterThan(200);
    for (let left = 0; left < firstVisit.worlds.length; left++) {
      for (let right = left + 1; right < firstVisit.worlds.length; right++) {
        const a = new THREE.Vector3(...firstVisit.worlds[left].position);
        const b = new THREE.Vector3(...firstVisit.worlds[right].position);
        expect(a.distanceTo(b)).toBeGreaterThan(200);
      }
    }
    const revealEase = 0.78 ** 2 * (3 - 2 * 0.78);
    const farthestCameraAtReveal = THREE.MathUtils.lerp(SHARED_JOURNEY_START_DISTANCE, 76, revealEase);
    expect(Math.min(...firstVisit.worlds.map(world => world.position[2] - world.radius))).toBeGreaterThan(farthestCameraAtReveal);
    expect(normalizeSharedJourneySampleId("demo-share-3")).toBe("demo-share-3");
    expect(normalizeSharedJourneySampleId("a-real-name-or-key")).toBe("demo-share-1");
  });

  test("the review scene uses no creator lookup and preserves the existing photo and ring interaction scene", () => {
    const helper = readFileSync(new URL("../src/components/love-galaxy-shared-journey.ts", import.meta.url), "utf8");
    const source = readFileSync(new URL("../src/components/LoveGalaxyExperience.tsx", import.meta.url), "utf8");
    expect(helper).toContain('source: "fictional-review-test-only"');
    expect(helper).not.toContain("fetch(");
    expect(helper).not.toContain("/api/");
    expect(source).toContain('canvas.dataset.photoDistribution = "dense-equatorial-seven-row-stream"');
    expect(source).toContain('const memoryId = memoryIds?.[hit.instanceId]');
    expect(source).toContain("if (memoryId !== undefined) selectMemory(memoryId)");
    expect(source).toContain('canvas.dataset.textRingRendering = "orbital-curved-3d-glyphs"');
    expect(source).toContain("mounted.startJourney()");
  });

  test("keeps the Love Galaxy creation experience on its own page and route", () => {
    const scene = renderToStaticMarkup(<LoveGalaxyExperience />);
    expect(scene).toContain('href="/love-galaxy/create"');
    expect(scene).toContain("Create your own Love Galaxy");

    Object.defineProperty(globalThis, "location", { configurable: true, value: { pathname: "/love-galaxy/create" } });
    const creator = renderToStaticMarkup(<App />);
    expect(creator).toContain("Opening Love Galaxy creator");
    expect(creator).not.toContain("THE WEDDING COLLECTION");
  });
});
