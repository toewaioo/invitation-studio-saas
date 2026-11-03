import * as THREE from "three";

export const SHARED_JOURNEY_DURATION_SECONDS = 14;
export const SHARED_JOURNEY_START_DISTANCE = 5600;
export const SHARED_JOURNEY_WORLD_COUNT = 20;

export type SharedJourneySampleId = "demo-share-1" | "demo-share-2" | "demo-share-3";
export type SharedJourneyPlanetPattern = "banded" | "islands" | "cratered" | "crystalline" | "mottled";
export type SharedJourneyPlanetSpec = {
  id: string;
  label: string;
  source: "fictional-review-test-only";
  position: readonly [number, number, number];
  radius: number;
  color: number;
  accentColor: number;
  shadowColor: number;
  pattern: SharedJourneyPlanetPattern;
  seed: number;
  ringed: boolean;
};
export type SharedJourneyGalaxySpec = {
  id: string;
  position: readonly [number, number, number];
  radius: number;
  color: number;
  rotation: readonly [number, number, number];
};
export type SharedJourneyLayout = {
  sampleId: SharedJourneySampleId;
  destination: readonly [number, number, number];
  worlds: SharedJourneyPlanetSpec[];
  galaxies: SharedJourneyGalaxySpec[];
  visitSeed: number;
};

type TestWorldStyle = Omit<SharedJourneyPlanetSpec, "label" | "source" | "position" | "seed"> & { name: string };

const SAMPLE_IDS: readonly SharedJourneySampleId[] = ["demo-share-1", "demo-share-2", "demo-share-3"];
const WORLD_DEPTH_START = 5210;
const WORLD_DEPTH_GAP = 220;
const GALAXY_DEPTHS = [5450, 4950, 4450, 3950, 3450, 2950, 2450, 1950, 1450, 900, 450] as const;
// Hand-authored fictional art fixtures. These IDs, labels and styles do not refer to real creators.
const TEST_WORLD_STYLES: readonly TestWorldStyle[] = [
  { id: "test-world-01", name: "Ember Reef", radius: 10.2, color: 0xd65c4a, accentColor: 0xffca8a, shadowColor: 0x3d1229, pattern: "islands", ringed: true },
  { id: "test-world-02", name: "Tidal Archive", radius: 11.4, color: 0x236b9b, accentColor: 0x70e6d2, shadowColor: 0x102740, pattern: "banded", ringed: false },
  { id: "test-world-03", name: "Glacier Bell", radius: 9.4, color: 0xbfefff, accentColor: 0xffffff, shadowColor: 0x3f6e9b, pattern: "crystalline", ringed: true },
  { id: "test-world-04", name: "Amber Dunes", radius: 10.8, color: 0xc79a46, accentColor: 0xffe39a, shadowColor: 0x5a3c28, pattern: "banded", ringed: false },
  { id: "test-world-05", name: "Cobalt Bloom", radius: 8.8, color: 0x345fca, accentColor: 0x94b6ff, shadowColor: 0x171b57, pattern: "islands", ringed: true },
  { id: "test-world-06", name: "Verdant Lantern", radius: 10.4, color: 0x397e54, accentColor: 0xa5e49b, shadowColor: 0x173d36, pattern: "mottled", ringed: true },
  { id: "test-world-07", name: "Amethyst Crown", radius: 9.8, color: 0x7553be, accentColor: 0xd9a4ff, shadowColor: 0x241d50, pattern: "crystalline", ringed: false },
  { id: "test-world-08", name: "Copper Storm", radius: 11.8, color: 0xb65a37, accentColor: 0xffb37c, shadowColor: 0x48201c, pattern: "banded", ringed: true },
  { id: "test-world-09", name: "Pearl Current", radius: 9.6, color: 0x9ecde5, accentColor: 0xffffff, shadowColor: 0x395d8d, pattern: "banded", ringed: false },
  { id: "test-world-10", name: "Obsidian Caldera", radius: 10.6, color: 0x424358, accentColor: 0xfb795b, shadowColor: 0x11121f, pattern: "cratered", ringed: true },
  { id: "test-world-11", name: "Coral Chorus", radius: 8.6, color: 0xd35472, accentColor: 0xffb1ba, shadowColor: 0x481e55, pattern: "mottled", ringed: false },
  { id: "test-world-12", name: "Solar Orchard", radius: 12.4, color: 0xd19b32, accentColor: 0xffed8d, shadowColor: 0x6d3124, pattern: "banded", ringed: true },
  { id: "test-world-13", name: "Mossglass", radius: 10.1, color: 0x72904a, accentColor: 0xd2e68b, shadowColor: 0x31402c, pattern: "crystalline", ringed: false },
  { id: "test-world-14", name: "Violet Atoll", radius: 9.1, color: 0x7752a8, accentColor: 0xc7a5ff, shadowColor: 0x2c164b, pattern: "islands", ringed: true },
  { id: "test-world-15", name: "Rose Quartz", radius: 10.7, color: 0xd978a8, accentColor: 0xffd4e5, shadowColor: 0x593052, pattern: "cratered", ringed: false },
  { id: "test-world-16", name: "Aqua Meridian", radius: 11.2, color: 0x2e9da8, accentColor: 0x8df7e1, shadowColor: 0x153858, pattern: "banded", ringed: true },
  { id: "test-world-17", name: "Saffron Halo", radius: 9.9, color: 0xe28a32, accentColor: 0xffdf8a, shadowColor: 0x6a2624, pattern: "banded", ringed: true },
  { id: "test-world-18", name: "Silver Fern", radius: 10.3, color: 0x85958e, accentColor: 0xcdf4de, shadowColor: 0x283945, pattern: "mottled", ringed: false },
  { id: "test-world-19", name: "Night Orchid", radius: 8.7, color: 0x583c8c, accentColor: 0xcc8fff, shadowColor: 0x191536, pattern: "crystalline", ringed: true },
  { id: "test-world-20", name: "Turquoise Mesa", radius: 11.6, color: 0x299b82, accentColor: 0x9cf2bf, shadowColor: 0x144438, pattern: "islands", ringed: false },
];
const GALAXY_COLORS = [0x9f8aff, 0x6de4eb, 0xff92ce, 0x86a5ff, 0x6fd3bb, 0xffcb8a, 0xc5a5ff, 0x7dd6f6, 0xf68fba, 0xa9ed80, 0xff9e72] as const;

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeSharedJourneySampleId(value: string | null | undefined): SharedJourneySampleId {
  return SAMPLE_IDS.includes(value as SharedJourneySampleId) ? value as SharedJourneySampleId : SAMPLE_IDS[0];
}

export function createSharedJourneyLayout(sampleId: string, visitSeed: number): SharedJourneyLayout {
  const safeId = normalizeSharedJourneySampleId(sampleId);
  const identity = hashString(safeId);
  const random = seeded((visitSeed ^ identity) >>> 0);
  const destinationX = ((identity & 0xff) / 255 - 0.5) * 30;
  const destinationY = (((identity >>> 8) & 0xff) / 255 - 0.5) * 22;
  const styles = [...TEST_WORLD_STYLES];
  const depths = Array.from({ length: SHARED_JOURNEY_WORLD_COUNT }, (_, index) => WORLD_DEPTH_START - index * WORLD_DEPTH_GAP);
  const azimuthAngles = Array.from({ length: SHARED_JOURNEY_WORLD_COUNT }, (_, index) => ((index % 4) + random()) * Math.PI / 2);
  const colors = [...GALAXY_COLORS];
  const shuffle = <T,>(items: T[]) => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [items[index], items[swap]] = [items[swap], items[index]];
    }
  };
  shuffle(styles);
  shuffle(depths);
  shuffle(azimuthAngles);
  shuffle(colors);
  const worlds = styles.map((style, index): SharedJourneyPlanetSpec => {
    const angle = azimuthAngles[index];
    const radiusFromRoute = 40 + random() * 300;
    return {
      id: style.id,
      label: `TEST WORLD ${style.id.slice(-2)} · ${style.name}`,
      source: "fictional-review-test-only",
      position: [Math.cos(angle) * radiusFromRoute, Math.sin(angle) * radiusFromRoute, depths[index] + (random() - 0.5) * 18],
      radius: style.radius * (0.94 + random() * 0.12),
      color: style.color,
      accentColor: style.accentColor,
      shadowColor: style.shadowColor,
      pattern: style.pattern,
      seed: Math.floor(random() * 0x7fffffff),
      ringed: style.ringed,
    };
  });
  const galaxies = GALAXY_DEPTHS.map((depth, index): SharedJourneyGalaxySpec => {
    const angle = random() * Math.PI * 2;
    const radiusFromRoute = 28 + random() * 88;
    return {
      id: `demo-galaxy-${String(index + 1).padStart(2, "0")}`,
      position: [Math.cos(angle) * radiusFromRoute, Math.sin(angle) * radiusFromRoute, depth + (random() - 0.5) * 34],
      radius: 10 + random() * 12,
      color: colors[index % colors.length],
      rotation: [(random() - 0.5) * 1.25, random() * Math.PI * 2, (random() - 0.5) * 1.25],
    };
  });
  return { sampleId: safeId, destination: [destinationX, destinationY, 0], worlds, galaxies, visitSeed: visitSeed >>> 0 };
}

function hexColor(color: number) {
  return `#${new THREE.Color(color).getHexString()}`;
}

function makePlanetTexture(spec: SharedJourneyPlanetSpec, register: <T extends { dispose: () => void }>(resource: T) => T) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable for sample planet texture generation");
  const random = seeded(spec.seed ^ 0xa511e9b3);
  const baseStyle = hexColor(spec.color);
  const accent = hexColor(spec.accentColor);
  const shadow = hexColor(spec.shadowColor);
  const gradient = context.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, baseStyle);
  gradient.addColorStop(0.5, shadow);
  gradient.addColorStop(1, baseStyle);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 256);

  if (spec.pattern === "banded") {
    for (let band = 0; band < 16; band += 1) {
      context.beginPath();
      const y = band * 16 + random() * 10;
      context.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) context.lineTo(x, y + Math.sin(x * 0.018 + band) * (5 + random() * 7));
      context.strokeStyle = band % 2 ? accent : shadow;
      context.globalAlpha = 0.26 + random() * 0.28;
      context.lineWidth = 5 + random() * 14;
      context.stroke();
    }
  } else if (spec.pattern === "islands") {
    for (let feature = 0; feature < 56; feature += 1) {
      const x = random() * 512;
      const y = random() * 256;
      const rx = 5 + random() * 24;
      const ry = 3 + random() * 13;
      const points = 6 + Math.floor(random() * 6);
      context.beginPath();
      for (let point = 0; point < points; point += 1) {
        const angle = point / points * Math.PI * 2;
        const wobble = 0.72 + random() * 0.48;
        const px = x + Math.cos(angle) * rx * wobble;
        const py = y + Math.sin(angle) * ry * wobble;
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fillStyle = feature % 2 ? accent : shadow;
      context.globalAlpha = 0.25 + random() * 0.35;
      context.fill();
    }
  } else if (spec.pattern === "cratered") {
    for (let feature = 0; feature < 120; feature += 1) {
      const x = random() * 512;
      const y = random() * 256;
      const rx = 3 + random() * 17;
      const ry = 2 + random() * 9;
      context.beginPath();
      context.ellipse(x, y, rx, ry, random() * Math.PI, 0, Math.PI * 2);
      context.fillStyle = shadow;
      context.globalAlpha = 0.22 + random() * 0.34;
      context.fill();
      context.beginPath();
      context.ellipse(x - rx * 0.2, y - ry * 0.2, rx * 0.66, ry * 0.6, random() * Math.PI, 0, Math.PI * 2);
      context.fillStyle = accent;
      context.globalAlpha = 0.14 + random() * 0.22;
      context.fill();
    }
  } else if (spec.pattern === "crystalline") {
    for (let feature = 0; feature < 88; feature += 1) {
      const x = random() * 512;
      const y = random() * 256;
      const radius = 4 + random() * 24;
      const points = 3 + Math.floor(random() * 4);
      context.beginPath();
      for (let point = 0; point < points; point += 1) {
        const angle = point / points * Math.PI * 2 + random() * 0.25;
        const length = radius * (0.55 + random() * 0.7);
        const px = x + Math.cos(angle) * length;
        const py = y + Math.sin(angle) * length;
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fillStyle = feature % 2 ? accent : shadow;
      context.globalAlpha = 0.19 + random() * 0.3;
      context.fill();
    }
  } else {
    for (let feature = 0; feature < 190; feature += 1) {
      context.beginPath();
      const x = random() * 512;
      const y = random() * 256;
      const rx = 3 + random() * 20;
      const ry = 2 + random() * 12;
      context.ellipse(x, y, rx, ry, random() * Math.PI, 0, Math.PI * 2);
      context.fillStyle = feature % 2 ? accent : shadow;
      context.globalAlpha = 0.16 + random() * 0.32;
      context.fill();
    }
  }
  context.globalAlpha = 1;
  const texture = register(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function addSharedJourneyEnvironment(
  scene: THREE.Scene,
  layout: SharedJourneyLayout,
  destination: THREE.Vector3,
  register: <T extends { dispose: () => void }>(resource: T) => T,
) {
  const environment = new THREE.Group();
  environment.name = "Fictional review-test shared-world environment";
  environment.position.copy(destination);
  scene.add(environment);
  scene.add(new THREE.AmbientLight(0x8094bd, 0.54));
  const sun = new THREE.DirectionalLight(0xf2dfff, 1.55);
  sun.position.set(destination.x - 80, destination.y + 110, destination.z + 210);
  scene.add(sun);

  const starRandom = seeded(layout.visitSeed ^ 0x68bc21eb);
  const starCount = 3600;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    starPositions.set([(starRandom() - 0.5) * 340, (starRandom() - 0.5) * 240, 12 + starRandom() * 5600], index * 3);
    const tint = starRandom();
    starColors.set(tint > 0.86 ? [0.68, 0.82, 1] : tint > 0.66 ? [1, 0.62, 0.84] : [0.9, 0.92, 1], index * 3);
  }
  const starGeometry = register(new THREE.BufferGeometry());
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const starMaterial = register(new THREE.PointsMaterial({ size: 1.25, vertexColors: true, transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.name = "Fictional review-test corridor stars";
  environment.add(stars);

  let galaxyPointCount = 0;
  layout.galaxies.forEach((spec, galaxyIndex) => {
    const random = seeded(layout.visitSeed ^ hashString(spec.id));
    const group = new THREE.Group();
    group.name = spec.id;
    group.position.set(spec.position[0], spec.position[1], spec.position[2]);
    group.rotation.set(...spec.rotation);
    environment.add(group);
    const count = 620;
    galaxyPointCount += count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tint = new THREE.Color(spec.color);
    const arms = 3 + galaxyIndex % 2;
    for (let index = 0; index < count; index += 1) {
      const radius = Math.sqrt(random()) * spec.radius;
      const arm = index % arms;
      const angle = arm * Math.PI * 2 / arms + radius * 0.34 + (random() - 0.5) * 0.45;
      const thickness = (random() + random() + random() - 1.5) * spec.radius * 0.11;
      positions.set([Math.cos(angle) * radius, thickness, Math.sin(angle) * radius * 0.72], index * 3);
      const brightness = 0.48 + random() * 0.85;
      colors.set([tint.r * brightness, tint.g * brightness, tint.b * brightness], index * 3);
    }
    const geometry = register(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = register(new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    group.add(points);
    const core = new THREE.Mesh(
      register(new THREE.SphereGeometry(0.8 + random() * 0.45, 14, 12)),
      register(new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    );
    group.add(core);
  });

  layout.worlds.forEach(spec => {
    const world = new THREE.Group();
    world.name = spec.label;
    world.position.set(spec.position[0], spec.position[1], spec.position[2]);
    environment.add(world);
    const texture = makePlanetTexture(spec, register);
    const surface = new THREE.Mesh(
      register(new THREE.SphereGeometry(spec.radius, 40, 32)),
      register(new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.84, metalness: 0.035, emissive: spec.color, emissiveIntensity: 0.055 })),
    );
    surface.name = `${spec.label} · OPAQUE 3D TEST PLANET`;
    world.add(surface);
    const atmosphere = new THREE.Mesh(
      register(new THREE.SphereGeometry(spec.radius * 1.07, 28, 20)),
      register(new THREE.MeshBasicMaterial({ color: spec.color, side: THREE.BackSide, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    );
    world.add(atmosphere);
    if (spec.ringed) {
      const ring = new THREE.Mesh(
        register(new THREE.TorusGeometry(spec.radius * 1.42, 0.16, 8, 56)),
        register(new THREE.MeshStandardMaterial({ color: spec.accentColor, roughness: 0.62, metalness: 0.18, side: THREE.DoubleSide })),
      );
      ring.rotation.set(0.92, 0.18, -0.24);
      world.add(ring);
    }
  });

  return { environment, starCount, galaxyCount: layout.galaxies.length, galaxyPointCount, worldCount: layout.worlds.length };
}
