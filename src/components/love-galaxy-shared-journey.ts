import * as THREE from "three";

export const SHARED_JOURNEY_DURATION_SECONDS = 14;
export const SHARED_JOURNEY_START_DISTANCE = 3200;

export type SharedJourneySampleId = "demo-share-1" | "demo-share-2" | "demo-share-3";
export type SharedJourneyPlanetSurface = "ocean" | "rust" | "ice" | "gas" | "stone" | "jade" | "indigo";
export type SharedJourneyPlanetSpec = {
  id: string;
  source: "anonymous-demo-only";
  position: readonly [number, number, number];
  radius: number;
  color: number;
  surface: SharedJourneyPlanetSurface;
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

const SAMPLE_IDS: readonly SharedJourneySampleId[] = ["demo-share-1", "demo-share-2", "demo-share-3"];
const WORLD_DEPTHS = [2600, 2300, 2000, 1700, 1400, 1100, 800] as const;
const GALAXY_DEPTHS = [3000, 2700, 2400, 2100, 1800, 1500, 1200, 850, 500] as const;
const PLANETS: readonly { radius: number; color: number; surface: SharedJourneyPlanetSurface; ringed: boolean }[] = [
  { radius: 4.1, color: 0x438a9e, surface: "ocean", ringed: true },
  { radius: 4.5, color: 0xb5674d, surface: "rust", ringed: false },
  { radius: 3.8, color: 0x9bc8da, surface: "ice", ringed: false },
  { radius: 4.2, color: 0xd3b076, surface: "gas", ringed: true },
  { radius: 4.0, color: 0x898b83, surface: "stone", ringed: false },
  { radius: 4.4, color: 0x528f6d, surface: "jade", ringed: true },
  { radius: 4.0, color: 0x8275b6, surface: "indigo", ringed: false },
];
const GALAXY_COLORS = [0x9f8aff, 0x6de4eb, 0xff92ce, 0x86a5ff, 0x6fd3bb, 0xffcb8a, 0xc5a5ff, 0x7dd6f6, 0xf68fba] as const;

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
  const templates = [...PLANETS];
  const colors = [...GALAXY_COLORS];
  const shuffle = <T,>(items: T[]) => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [items[index], items[swap]] = [items[swap], items[index]];
    }
  };
  shuffle(templates);
  shuffle(colors);
  const worlds = WORLD_DEPTHS.map((depth, index): SharedJourneyPlanetSpec => {
    const angle = random() * Math.PI * 2;
    const radiusFromRoute = 7 + random() * 12;
    const template = templates[index % templates.length];
    return {
      id: `anonymous-world-${String(index + 1).padStart(2, "0")}`,
      source: "anonymous-demo-only",
      position: [Math.cos(angle) * radiusFromRoute, Math.sin(angle) * radiusFromRoute, depth + (random() - 0.5) * 12],
      radius: template.radius * (0.92 + random() * 0.16),
      color: template.color,
      surface: template.surface,
      seed: Math.floor(random() * 0x7fffffff),
      ringed: template.ringed,
    };
  });
  const galaxies = GALAXY_DEPTHS.map((depth, index): SharedJourneyGalaxySpec => {
    const angle = random() * Math.PI * 2;
    const radiusFromRoute = 22 + random() * 68;
    return {
      id: `demo-galaxy-${String(index + 1).padStart(2, "0")}`,
      position: [Math.cos(angle) * radiusFromRoute, Math.sin(angle) * radiusFromRoute, depth + (random() - 0.5) * 26],
      radius: 9 + random() * 8,
      color: colors[index % colors.length],
      rotation: [(random() - 0.5) * 1.25, random() * Math.PI * 2, (random() - 0.5) * 1.25],
    };
  });
  return { sampleId: safeId, destination: [destinationX, destinationY, 0], worlds, galaxies, visitSeed: visitSeed >>> 0 };
}

function makePlanetTexture(spec: SharedJourneyPlanetSpec, register: <T extends { dispose: () => void }>(resource: T) => T) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable for sample planet texture generation");
  const random = seeded(spec.seed ^ 0xa511e9b3);
  const base = new THREE.Color(spec.color);
  const baseStyle = `#${base.getHexString()}`;
  const highlight = spec.surface === "ice" ? "rgba(232,250,255,.72)" : spec.surface === "rust" ? "rgba(247,160,105,.62)" : spec.surface === "ocean" ? "rgba(85,217,207,.68)" : "rgba(231,218,180,.56)";
  const shadow = spec.surface === "ocean" ? "rgba(6,32,59,.9)" : spec.surface === "ice" ? "rgba(48,93,129,.78)" : "rgba(28,21,42,.76)";
  const gradient = context.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, baseStyle);
  gradient.addColorStop(0.5, shadow);
  gradient.addColorStop(1, baseStyle);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 256);
  if (spec.surface === "gas") {
    for (let band = 0; band < 13; band += 1) {
      context.beginPath();
      const y = band * 22 + random() * 12;
      context.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) context.lineTo(x, y + Math.sin(x * 0.018 + band) * (5 + random() * 5));
      context.strokeStyle = band % 2 ? highlight : shadow;
      context.globalAlpha = 0.24 + random() * 0.24;
      context.lineWidth = 7 + random() * 15;
      context.stroke();
    }
  } else {
    for (let feature = 0; feature < 180; feature += 1) {
      context.beginPath();
      const x = random() * 512;
      const y = random() * 256;
      const rx = 3 + random() * (spec.surface === "stone" ? 25 : 17);
      const ry = 2 + random() * 10;
      context.ellipse(x, y, rx, ry, random() * Math.PI, 0, Math.PI * 2);
      context.fillStyle = feature % 2 ? highlight : shadow;
      context.globalAlpha = 0.16 + random() * 0.28;
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
  environment.name = "Anonymous shared-world review environment";
  environment.position.copy(destination);
  scene.add(environment);
  scene.add(new THREE.AmbientLight(0x8094bd, 0.54));
  const sun = new THREE.DirectionalLight(0xf2dfff, 1.55);
  sun.position.set(destination.x - 80, destination.y + 110, destination.z + 210);
  scene.add(sun);

  const starRandom = seeded(layout.visitSeed ^ 0x68bc21eb);
  const starCount = 2200;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    starPositions.set([(starRandom() - 0.5) * 250, (starRandom() - 0.5) * 180, 12 + starRandom() * 3200], index * 3);
    const tint = starRandom();
    starColors.set(tint > 0.86 ? [0.68, 0.82, 1] : tint > 0.66 ? [1, 0.62, 0.84] : [0.9, 0.92, 1], index * 3);
  }
  const starGeometry = register(new THREE.BufferGeometry());
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const starMaterial = register(new THREE.PointsMaterial({ size: 1.25, vertexColors: true, transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.name = "Anonymous review corridor stars";
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
    world.name = spec.id;
    world.position.set(spec.position[0], spec.position[1], spec.position[2]);
    environment.add(world);
    const texture = makePlanetTexture(spec, register);
    const surface = new THREE.Mesh(
      register(new THREE.SphereGeometry(spec.radius, 32, 24)),
      register(new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.84, metalness: 0.035, emissive: spec.color, emissiveIntensity: 0.055 })),
    );
    surface.name = `Opaque anonymous sample world ${spec.id}`;
    world.add(surface);
    const atmosphere = new THREE.Mesh(
      register(new THREE.SphereGeometry(spec.radius * 1.07, 24, 18)),
      register(new THREE.MeshBasicMaterial({ color: spec.color, side: THREE.BackSide, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    );
    world.add(atmosphere);
    if (spec.ringed) {
      const ring = new THREE.Mesh(
        register(new THREE.TorusGeometry(spec.radius * 1.42, 0.12, 6, 48)),
        register(new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.62, metalness: 0.18, side: THREE.DoubleSide })),
      );
      ring.rotation.set(0.92, 0.18, -0.24);
      world.add(ring);
    }
  });

  return { environment, starCount, galaxyCount: layout.galaxies.length, galaxyPointCount, worldCount: layout.worlds.length };
}
