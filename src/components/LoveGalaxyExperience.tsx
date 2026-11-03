import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowLeft, ArrowRight, Volume2, VolumeX, X } from "lucide-react";
import { addSharedJourneyEnvironment, createSharedJourneyLayout, normalizeSharedJourneySampleId, SHARED_JOURNEY_DURATION_SECONDS, SHARED_JOURNEY_START_DISTANCE, SHARED_JOURNEY_WORLD_COUNT, type SharedJourneyWorldTarget } from "./love-galaxy-shared-journey";
import backgroundMusic from "./love-galaxy-bg.mp3";
import "./love-galaxy.css";

type CameraStop = "sphere" | "memories" | "above";
const MEMORY_COUNT = 1200;
const STAR_COUNT = 4200;
const PHOTO_BAND_INNER_RADIUS = 6.2;
const PHOTO_BAND_OUTER_RADIUS = 13.2;
const PHOTO_STREAM_ROWS_ABOVE_BELOW = 3;
const PHOTO_STREAM_ROW_SPACING = 0.68;
const SHOOTING_STAR_COUNT = 3;
export type LoveGalaxyStory = {
  title?: string;
  ringTextOne?: string;
  ringTextTwo?: string;
  photos?: readonly { src: string; alt: string }[];
  musicSrc?: string;
};
type LoveGalaxyExperienceProps = { story?: LoveGalaxyStory; onBack?: () => void };
const DEMO_IMAGES = [
  { src: "/assets/galaxy-memory-01.jpg", alt: "A couple together" },
  { src: "/assets/galaxy-memory-02.jpg", alt: "A couple sharing a moment" },
  { src: "/assets/galaxy-memory-03.jpg", alt: "A bright celebration" },
  { src: "/assets/galaxy-memory-04.jpg", alt: "A quiet moment in the garden" },
] as const;
const MEMORIES = Array.from({ length: MEMORY_COUNT }, (_, id) => ({
  id,
  ...DEMO_IMAGES[id % DEMO_IMAGES.length],
}));
const DEFAULT_RING_TEXT_ONE = "အမှတ်တရတွေက ကြယ်တွေပါ";
const DEFAULT_RING_TEXT_TWO = "နှလုံးသားနှစ်ခု၊ မိုးကုပ်စက်ဝိုင်းတစ်ခု";

type PhotoRecord = {
  id: number;
  image: number;
  radius: number;
  angle: number;
  phase: number;
  speed: number;
  lift: number;
  row: number;
  roll: number;
  scale: number;
};

type MountedScene = {
  startJourney: () => void;
  travelToWorld: (worldId: string) => void;
  returnToHome: () => void;
  dispose: () => void;
};

type SharedJourneyTravelTarget = Pick<SharedJourneyWorldTarget, "id" | "label"> & { radius: number };

type RingGlyphSlice = {
  character: string;
  advance: number;
  uvRect: THREE.Vector4;
};

type CurvedRingAtlas = {
  texture: THREE.CanvasTexture;
  fontSize: number;
  phraseWidth: number;
  glyphs: RingGlyphSlice[];
};

type CurvedTextGlyph = {
  copy: number;
  offsetEm: number;
  widthEm: number;
  uvRect: THREE.Vector4;
};

export const SPHERE_EXIT_PROGRESS = 2 / 11;
export const PHOTO_BAND_EXIT_PROGRESS = 6 / 11;
export const ASCENT_START_PROGRESS = 7 / 11;

export function createGalaxyCameraFlight() {
  // Match the live standalone preview's flattened 13.622966° oblique finale.
  const finalObliqueAngle = THREE.MathUtils.degToRad(13.6229663289);
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.35),
    new THREE.Vector3(0, -0.14, 2.45),
    new THREE.Vector3(0, -0.32, 3.2),
    new THREE.Vector3(0, -0.6, 6),
    new THREE.Vector3(0.08, -0.93, 9.3),
    new THREE.Vector3(0.12, -1.25, 12.5),
    new THREE.Vector3(0.16, -1.62, 16.2),
    new THREE.Vector3(0.16, -1.78, 17.8),
    new THREE.Vector3(0.12, 3.8, 18.8),
    new THREE.Vector3(0.08, 5.4, 21.8),
    new THREE.Vector3(0.03, 6.1, 24.5),
    new THREE.Vector3(0, 26.6 * Math.sin(finalObliqueAngle), 26.6 * Math.cos(finalObliqueAngle)),
  ], false, "catmullrom", 0.42);
  const target = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.6, 12),
    new THREE.Vector3(0, -0.8, 14),
    new THREE.Vector3(0, -1, 16),
    new THREE.Vector3(0, -1.2, 18),
    new THREE.Vector3(0.08, -1.4, 23),
    new THREE.Vector3(0.12, -1.6, 25),
    new THREE.Vector3(0.16, 0.2, 25),
    new THREE.Vector3(0, 3, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ], false, "catmullrom", 0.42);
  return { path, target };
}

export function galaxyCameraPhase(progress: number) {
  return progress < SPHERE_EXIT_PROGRESS ? "sphere-exit"
    : progress < PHOTO_BAND_EXIT_PROGRESS ? "photo-band"
      : progress < ASCENT_START_PROGRESS ? "band-exit"
        : progress < 9 / 11 ? "rising-above-orbit" : "above-orbit";
}

export function fitRingFontPixels(perimeter: number, phraseSpanEm: number, compact: boolean) {
  // Reserve a gap between phrase copies, including on strongly foreshortened rings.
  return Math.min(compact ? 14 : 18, Math.max(0, perimeter) / (2 * phraseSpanEm * 1.35));
}

export function fitRingWordsAroundCrossing(
  width: number,
  crossing: number,
  phraseSpanEm: number,
  wordBreaks: readonly { leftEndEm: number; rightStartEm: number }[],
  fontCap: number,
) {
  const gap = 32;
  const margin = 7;
  if (crossing < gap || crossing > width - gap) return null;
  const leftAnchor = crossing - gap / 2;
  const rightAnchor = crossing + gap / 2;
  let best: { fontPixels: number; leftEndEm: number; rightStartEm: number; leftAnchor: number; rightAnchor: number } | null = null;
  for (const split of wordBreaks) {
    const leftEm = split.leftEndEm + phraseSpanEm / 2;
    const rightEm = phraseSpanEm / 2 - split.rightStartEm;
    if (leftEm <= 0 || rightEm <= 0) continue;
    const fontPixels = Math.max(0, Math.min(fontCap, (leftAnchor - margin) / leftEm, (width - margin - rightAnchor) / rightEm));
    if (!best || fontPixels > best.fontPixels) best = { ...split, fontPixels, leftAnchor, rightAnchor };
  }
  return best;
}

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCurvedRingTexture(message: string, ink: string): CurvedRingAtlas {
  const canvas = document.createElement("canvas");
  const cellSize = 256;
  const columns = 8;
  type SegmenterConstructor = new (locales?: string | string[], options?: { granularity: "grapheme" }) => { segment(input: string): Iterable<{ segment: string }> };
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
  const characters = Segmenter
    ? Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(message), item => item.segment)
    : Array.from(message);
  canvas.width = columns * cellSize;
  canvas.height = Math.max(cellSize, Math.ceil(characters.length / columns) * cellSize);
  const ctx = canvas.getContext("2d")!;
  const fontSize = 128;
  ctx.font = `700 ${fontSize}px 'Noto Serif Myanmar', Georgia, 'Times New Roman', serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(3, 8, 22, .95)";
  ctx.fillStyle = ink;
  const padding = fontSize * 0.1;
  const glyphHeight = fontSize * 1.5;
  const glyphs: RingGlyphSlice[] = [];
  let phraseWidth = 0;
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const advance = ctx.measureText(character).width;
    phraseWidth += advance;
    if (character === " ") {
      glyphs.push({ character, advance, uvRect: new THREE.Vector4() });
      continue;
    }
    // Each character is painted in its own cell, never cropped from a shared word.
    const sourceLeft = (index % columns) * cellSize;
    const centerY = Math.floor(index / columns) * cellSize + cellSize / 2;
    const sourceWidth = advance + padding * 2;
    ctx.strokeText(character, sourceLeft + padding, centerY);
    ctx.fillText(character, sourceLeft + padding, centerY);
    const uvBottom = 1 - (centerY + glyphHeight / 2) / canvas.height;
    glyphs.push({
      character,
      advance,
      uvRect: new THREE.Vector4(sourceLeft / canvas.width, uvBottom, sourceWidth / canvas.width, glyphHeight / canvas.height),
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture, fontSize, phraseWidth, glyphs };
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(128, 128, 5, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,239,249,.78)");
  gradient.addColorStop(0.23, "rgba(255,132,190,.55)");
  gradient.addColorStop(0.48, "rgba(226,63,151,.25)");
  gradient.addColorStop(0.72, "rgba(151,45,164,.08)");
  gradient.addColorStop(1, "rgba(96,26,112,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePassingStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const centerGlow = ctx.createRadialGradient(128, 128, 2, 128, 128, 126);
  centerGlow.addColorStop(0, "rgba(255,255,245,1)");
  centerGlow.addColorStop(0.13, "rgba(255,247,218,.92)");
  centerGlow.addColorStop(0.38, "rgba(255,190,120,.32)");
  centerGlow.addColorStop(1, "rgba(255,172,112,0)");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = "rgba(255,246,207,.95)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(255,252,231,.96)";
  ctx.beginPath();
  for (let index = 0; index < 16; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 8;
    const radius = index % 2 === 0 ? 120 : 8;
    const x = 128 + Math.cos(angle) * radius;
    const y = 128 + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeShootingTrailTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const vertical = Math.max(0, 1 - Math.abs((y / (canvas.height - 1)) * 2 - 1));
    const edgeFade = Math.pow(vertical, 2.4);
    for (let x = 0; x < canvas.width; x += 1) {
      const progress = x / (canvas.width - 1);
      const tailFade = Math.pow(progress, 1.15);
      const offset = (y * canvas.width + x) * 4;
      image.data[offset] = 192 + 63 * progress;
      image.data[offset + 1] = 48 + 198 * progress;
      image.data[offset + 2] = 128 + 118 * progress;
      image.data[offset + 3] = Math.round(245 * edgeFade * tailFade);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function mountGalaxy(
  canvas: HTMLCanvasElement,
  images: readonly { src: string; alt: string }[],
  ringPhrases: readonly [string, string],
  selectMemory: (id: number) => void,
  reportRenderer: (ready: boolean) => void,
  reportView: (view: CameraStop) => void,
  readMusicLevel: () => number,
  reviewMotionPrototypeEnabled: boolean,
  reviewSharedJourneyPrototypeEnabled: boolean,
  reviewSampleId: string,
  reportReviewArrival: () => void,
  worldTooltipElement: HTMLButtonElement | null,
  reportWorldStatus: (label: string, phase: "traveling" | "arrived") => void,
): MountedScene {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const random = seeded(20261030);
  const visitSeedBuffer = new Uint32Array(1);
  if (reviewSharedJourneyPrototypeEnabled && window.crypto?.getRandomValues) window.crypto.getRandomValues(visitSeedBuffer);
  else visitSeedBuffer[0] = Math.floor(Math.random() * 0xffffffff);
  const reviewLayout = reviewSharedJourneyPrototypeEnabled ? createSharedJourneyLayout(reviewSampleId, visitSeedBuffer[0]) : null;
  const destinationAnchor = new THREE.Vector3(reviewLayout?.destination[0] ?? 0, reviewLayout?.destination[1] ?? 0, reviewLayout?.destination[2] ?? 0);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#03040a");
  const camera = new THREE.PerspectiveCamera(47, 1, 0.08, 170);
  if (reviewSharedJourneyPrototypeEnabled) camera.far = 6200;
  camera.position.set(destinationAnchor.x, destinationAnchor.y, destinationAnchor.z + (reviewSharedJourneyPrototypeEnabled ? SHARED_JOURNEY_START_DISTANCE : 20));
  camera.lookAt(destinationAnchor);
  camera.updateProjectionMatrix();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.autoClear = true; // Every frame is fresh: no photo afterimages or accumulation.
  renderer.setClearColor("#03040a", 1);
  const gl = renderer.getContext();
  const debugRendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererName = debugRendererInfo ? String(gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL)) : "";
  const softwareRenderer = /swiftshader|llvmpipe|software raster/i.test(rendererName);

  canvas.dataset.loadedDemoTextures = "0";
  canvas.dataset.photoCardShape = "flat-rectangle";
  canvas.dataset.photoOrbitPlanes = "1";
  canvas.dataset.photoOrbitShape = "single-wide-band";
  canvas.dataset.photoTrails = "disabled";
  canvas.dataset.photoTrailCount = "0";
  canvas.dataset.planetNebulaHalo = "soft-pink-behind-sphere";
  canvas.dataset.photoLightWave = "traveling-gaussian";
  canvas.dataset.photoLightWaveTrailFree = "true";
  canvas.dataset.dragRipplePrototype = reviewMotionPrototypeEnabled ? "enabled" : "disabled";
  canvas.dataset.passingStarPrototype = reviewMotionPrototypeEnabled ? "enabled" : "disabled";
  canvas.dataset.sharedJourneyReview = reviewSharedJourneyPrototypeEnabled ? "enabled" : "disabled";
  canvas.dataset.sharedJourneySource = reviewSharedJourneyPrototypeEnabled ? "fictional-review-test-only" : "none";
  canvas.dataset.sharedJourneySampleId = reviewLayout?.sampleId ?? "none";
  canvas.dataset.sharedJourneyDestinationId = reviewLayout ? `placeholder-${reviewLayout.sampleId}` : "none";
  canvas.dataset.sharedJourneyDestinationPosition = reviewLayout?.destination.map(value => value.toFixed(2)).join(",") ?? "none";
  canvas.dataset.sharedJourneyWorldDepths = reviewLayout?.worlds.map(world => world.position[2].toFixed(2)).join(",") ?? "none";
  canvas.dataset.sharedJourneyWorldLabels = JSON.stringify(reviewLayout?.worlds.map(world => world.label) ?? []);
  canvas.dataset.sharedJourneyWorldPositions = JSON.stringify(reviewLayout?.worlds.map(world => world.position) ?? []);
  canvas.dataset.sharedJourneyWorldProfiles = JSON.stringify(reviewLayout?.worlds.map(({ id, label, color, pattern }) => ({ id, label, color, pattern })) ?? []);
  canvas.dataset.sharedJourneyTooltipWorldId = "none";
  canvas.dataset.sharedJourneySelectedWorldId = "none";
  canvas.dataset.sharedJourneyHopProgress = "0";
  canvas.dataset.curvedTextRingSweep = "360";
  canvas.dataset.crossedTextRingPlanes = "true";
  canvas.dataset.textRingRotationOne = "0.000";
  canvas.dataset.textRingRotationTwo = "0.000";
  canvas.dataset.renderQuality = softwareRenderer ? "software-adaptive" : "hardware";
  delete canvas.dataset.drawCalls;
  delete canvas.dataset.cameraSettled;
  canvas.dataset.journeyStarted = "false";
  const sceneResources: { dispose: () => void }[] = [];
  let isDisposed = false;
  let contextLost = false;
  let scenePrepared = false;
  let scenePreparationFailed = false;
  let journeyStarted = false;
  let reviewDestinationReveal = reviewSharedJourneyPrototypeEnabled ? 0 : 1;
  let reviewJourneyArrived = false;
  let sharedJourneyWorldTravel: { target: SharedJourneyTravelTarget; startPosition: THREE.Vector3; endPosition: THREE.Vector3; targetPosition: THREE.Vector3; elapsed: number; duration: number } | null = null;
  let currentSharedJourneyWorldId: string | null = null;
  const placeholderTravelTarget: SharedJourneyTravelTarget = {
    id: canvas.dataset.sharedJourneyDestinationId || "placeholder-home",
    label: "YOUR PLACEHOLDER PLANET",
    radius: 2.5,
  };
  const addResource = <T extends { dispose: () => void }>(resource: T) => {
    sceneResources.push(resource);
    return resource;
  };
  const sharedJourneyEnvironment = reviewLayout
    ? addSharedJourneyEnvironment(scene, reviewLayout, destinationAnchor, addResource)
    : null;
  const sharedJourneyWorldTargets = sharedJourneyEnvironment?.worldTargets ?? [];
  canvas.dataset.sharedJourneyWorldCount = String(sharedJourneyEnvironment?.worldCount ?? 0);
  canvas.dataset.sharedJourneyGalaxyCount = String(sharedJourneyEnvironment?.galaxyCount ?? 0);
  canvas.dataset.sharedJourneyGalaxyPointCount = String(sharedJourneyEnvironment?.galaxyPointCount ?? 0);
  canvas.dataset.sharedJourneyStarCount = String(sharedJourneyEnvironment?.starCount ?? 0);
  canvas.dataset.sharedJourneyDuration = String(reviewSharedJourneyPrototypeEnabled ? SHARED_JOURNEY_DURATION_SECONDS : 0);
  const previewStarPass = { value: 0 };
  const dragRippleCenter = { value: new THREE.Vector2() };
  const dragRippleStrength = { value: 0 };
  const dragRippleTargetStrength = { value: 0 };

  // A slow, layered nebula painted on the inside of a giant celestial shell.
  const nebulaMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uMusic: { value: 0 }, uPassingStar: previewStarPass },
    vertexShader: `varying vec3 vPosition; varying vec2 vUv; void main(){ vPosition=position; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPosition; varying vec2 vUv; uniform float uTime; uniform float uMusic; uniform float uPassingStar;
      float cloud(vec2 p, vec2 c, vec2 s){ vec2 q=(p-c)/s; return exp(-dot(q,q)*1.7); }
      void main(){
      vec2 p=vUv;
      vec2 drift=vec2(sin(p.y*16.0+uTime*.018),cos(p.x*13.0-uTime*.014))*.018;
      vec2 q=p+drift;
      float a=cloud(q,vec2(.20,.62),vec2(.24,.15));
      float b=cloud(q,vec2(.78,.45),vec2(.27,.20));
      float c=cloud(q,vec2(.53,.78),vec2(.27,.13));
      float d=cloud(q,vec2(.08,.36),vec2(.22,.15));
      float e=cloud(q,vec2(.91,.73),vec2(.23,.16));
      float w=.5+.5*sin(vPosition.x*.09+vPosition.y*.04+uTime*.035);
      float neb=clamp(a*.55+b*.48+c*.44+d*.42+e*.36,0.,1.0);
      float filament=.5+.5*sin(p.x*44.0+p.y*27.0+sin(p.y*61.0+uTime*.02));
      float musicGlow=1.0+uMusic*.16;
      vec3 color=vec3(.008,.006,.022);
      color=mix(color,vec3(.19,.045,.23),neb*.90*musicGlow);
      color=mix(color,vec3(.30,.07,.32),b*.36*w*(1.0+uMusic*.10));
      color+=vec3(.16,.04,.24)*neb*smoothstep(.38,.88,filament)*.58*(1.0+uMusic*.12);
      color+=vec3(.17,.035,.17)*a*.42;
      vec3 passingStarTint=color*vec3(.62,.78,1.08)+vec3(.012,.018,.052);
      color=mix(color,passingStarTint,uPassingStar*.78);
      color*=1.0-uPassingStar*.28;
        gl_FragColor=vec4(color,1.0);
      }`,
  });
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(86, 40, 28), nebulaMaterial);
  nebula.frustumCulled = false;
  scene.add(nebula);
  addResource(nebula.geometry);
  addResource(nebulaMaterial);

  // Pearl stars mix with seven luminous clusters, still in one particle draw call.
  const starFieldGroup = new THREE.Group();
  scene.add(starFieldGroup);
  const starClusters = [
    new THREE.Vector3(-30, 22, -38), new THREE.Vector3(24, 16, -43),
    new THREE.Vector3(-45, -18, -21), new THREE.Vector3(40, -14, -28),
    new THREE.Vector3(3, 38, -44), new THREE.Vector3(-10, -30, 45),
    new THREE.Vector3(36, 25, 34),
  ];
  const clusterGlowTexture = addResource(makeGlowTexture());
  starClusters.forEach((center, index) => {
    const material = addResource(new THREE.SpriteMaterial({ map: clusterGlowTexture, color: index % 2 ? 0xb8baff : 0xffb9df, transparent: true, opacity: 0.27, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const clusterGlow = new THREE.Sprite(material);
    clusterGlow.position.copy(center);
    clusterGlow.scale.setScalar(22 + (index % 3) * 4);
    starFieldGroup.add(clusterGlow);
  });
  canvas.dataset.starClusterCount = String(starClusters.length);
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starColors = new Float32Array(STAR_COUNT * 3);
  const starSizes = new Float32Array(STAR_COUNT);
  const starPhases = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const theta = random() * Math.PI * 2;
    const z = random() * 2 - 1;
    const radius = 40 + random() * 36;
    const ring = Math.sqrt(1 - z * z);
    starPositions.set([radius * ring * Math.cos(theta), radius * z, radius * ring * Math.sin(theta)], i * 3);
    if (i % 3 === 0) {
      const center = starClusters[Math.floor(i / 3) % starClusters.length];
      const spread = 7 + random() * 8;
      const scatter = () => (random() + random() + random() - 1.5) * spread;
      starPositions.set([center.x + scatter(), center.y + scatter(), center.z + scatter()], i * 3);
    }
    const tint = random();
    starColors.set(tint > 0.9 ? [0.80, 0.86, 1] : tint > 0.68 ? [1, 0.67, 0.89] : [1, 0.94, 0.99], i * 3);
    starSizes[i] = 3.4 + random() * (tint > 0.9 ? 10 : 4.2);
    starPhases[i] = random() * Math.PI * 2;
  }
  const starGeometry = addResource(new THREE.BufferGeometry());
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  starGeometry.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
  starGeometry.setAttribute("aPhase", new THREE.BufferAttribute(starPhases, 1));
  const starMaterial = addResource(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    toneMapped: false,
    vertexShader: `attribute float aSize; attribute float aPhase; uniform float uTime; varying vec3 vColor; varying float vTwinkle; varying float vSparkle; void main(){ vec4 view=modelViewMatrix*vec4(position,1.0); vColor=color; vTwinkle=.76+.24*sin(uTime*1.2+aPhase); vSparkle=smoothstep(8.0,12.0,aSize); gl_PointSize=clamp(aSize*(52.0/max(1.0,-view.z)),1.7,14.0); gl_Position=projectionMatrix*view; }`,
    fragmentShader: `varying vec3 vColor; varying float vTwinkle; varying float vSparkle; void main(){ vec2 p=gl_PointCoord-vec2(.5); float radius=length(p); float halo=exp(-radius*radius*15.0); float core=1.0-smoothstep(.025,.18,radius); float rays=(exp(-abs(p.x)*65.0)+exp(-abs(p.y)*65.0))*(1.0-smoothstep(.08,.47,radius))*vSparkle; float alpha=(halo*.60+core*.85+rays*.34)*vTwinkle; gl_FragColor=vec4(mix(vColor,vec3(1.0),core*.5)*(1.0+vTwinkle*.25),alpha); }`,
  }));
  const starPoints = new THREE.Points(starGeometry, starMaterial);
  starFieldGroup.add(starPoints);

  // Three occasional meteor-like streaks add motion without adding per-star draw calls.
  const shootingTracks = Array.from({ length: SHOOTING_STAR_COUNT }, (_, index) => {
    const direction = index === 1 ? -1 : 1;
    const angle = (random() - 0.5) * 0.36;
    return {
      period: 7 + index * 1.7 + random() * 1.5,
      phase: index * 3.6 + random() * 0.7,
      lifetime: 2.0,
      startX: direction > 0 ? -12.5 : 12.5,
      startY: 13.5 + random() * 2,
      directionX: direction * Math.cos(angle),
      directionY: Math.sin(angle),
      speed: 19 + random() * 5,
      length: 4.8 + random() * 1.8,
    };
  });
  const shootingHeads = new Float32Array(SHOOTING_STAR_COUNT * 3);
  const shootingTrailGeometry = addResource(new THREE.PlaneGeometry(1, 1));
  const shootingTrailTexture = addResource(makeShootingTrailTexture());
  const shootingTrails = shootingTracks.map(() => {
    const material = addResource(new THREE.MeshBasicMaterial({ map: shootingTrailTexture, color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const trail = new THREE.Mesh(shootingTrailGeometry, material);
    trail.frustumCulled = false;
    trail.visible = false;
    scene.add(trail);
    return trail;
  });
  const shootingHeadGeometry = addResource(new THREE.BufferGeometry());
  shootingHeadGeometry.setAttribute("position", new THREE.BufferAttribute(shootingHeads, 3));
  const shootingHeadMaterial = addResource(new THREE.PointsMaterial({ map: addResource(makeGlowTexture()), color: 0xffe8f2, size: 0.58, sizeAttenuation: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const shootingHeadPoints = new THREE.Points(shootingHeadGeometry, shootingHeadMaterial);
  shootingHeadPoints.frustumCulled = false;
  scene.add(shootingHeadPoints);

  // A smooth luminous sphere, deliberately made from light and color rather than an Earth texture.
  const sphereMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPassingStar: previewStarPass },
    side: THREE.DoubleSide,
    vertexShader: `varying vec3 vNormal; varying vec3 vPosition; varying vec3 vViewPosition; void main(){ vNormal=normalize(normalMatrix*normal); vPosition=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vViewPosition=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `
      varying vec3 vNormal; varying vec3 vPosition; varying vec3 vViewPosition; uniform float uTime; uniform float uPassingStar;
      void main(){
        vec3 n=normalize(vNormal); vec3 v=normalize(vViewPosition); vec3 l=normalize(vec3(-.48,.72,.88));
        float diffuse=max(dot(n,l),0.0);
        float bands=.5+.5*sin(vPosition.y*3.3+vPosition.x*1.9+sin(vPosition.z*2.8+uTime*.2));
        float pearlBand=smoothstep(.7,.98,bands);
        vec3 deep=vec3(.085,.018,.12); vec3 magenta=vec3(.55,.10,.40); vec3 rose=vec3(.88,.28,.62); vec3 blush=vec3(.96,.60,.79);
        vec3 base=mix(deep,magenta,smoothstep(-.9,.78,n.y));
        base=mix(base,rose,smoothstep(.08,.9,bands)*.68);
        base=mix(base,blush,smoothstep(.32,.96,diffuse)*.4);
        base=mix(base,vec3(1.0,.79,.88),pearlBand*.22);
        float spec=pow(max(dot(reflect(-l,n),v),0.0),40.0);
        float pearly=pow(max(dot(n,normalize(vec3(-.38,.76,.78))),0.0),18.0)*.24;
        float rim=pow(1.0-max(dot(n,v),0.0),2.45);
        vec3 color=base*(.76+diffuse*.58)+vec3(1.0,.91,.98)*(spec*.9+pearly)+vec3(.88,.24,.70)*rim*.92;
        vec3 passingStarTint=color*vec3(.68,.80,1.10)+vec3(.025,.018,.055);
        color=mix(color,passingStarTint,uPassingStar*.78);
        color*=1.0-uPassingStar*.33;
        gl_FragColor=vec4(color,1.0);
      }`,
  });
  const core = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.5, 80, 64), sphereMaterial);
  core.add(sphere);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({ color: 0xf39ad3, side: THREE.BackSide, transparent: true, opacity: 0.19, blending: THREE.AdditiveBlending, depthWrite: false });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2.72, 48, 40), atmosphereMaterial);
  core.add(atmosphere);
  const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xd72c9b, side: THREE.BackSide, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(3.2, 40, 32), haloMaterial);
  core.add(halo);
  const nebulaHaloTexture = addResource(makeGlowTexture());
  const nebulaHaloMaterial = addResource(new THREE.SpriteMaterial({ map: nebulaHaloTexture, color: 0xff86ca, transparent: true, opacity: 0.66, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false }));
  const nebulaHalo = new THREE.Sprite(nebulaHaloMaterial);
  nebulaHalo.position.set(-0.08, 0.12, -2.62);
  nebulaHalo.scale.set(12, 12, 1);
  nebulaHalo.renderOrder = 0;
  core.add(nebulaHalo);
  const glowMaterial = addResource(new THREE.SpriteMaterial({ map: addResource(makeGlowTexture()), transparent: true, opacity: 0.84, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true }));
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(13.2, 13.2, 1);
  core.add(glow);
  // Keep the sphere, atmosphere, and glow balanced as one slightly smaller orb.
  core.position.copy(destinationAnchor);
  core.visible = !reviewSharedJourneyPrototypeEnabled;
  core.scale.setScalar(0.82 * (reviewSharedJourneyPrototypeEnabled ? 0.001 : 1));
  scene.add(core);
  addResource(sphere.geometry);
  addResource(sphereMaterial);
  addResource(atmosphere.geometry);
  addResource(atmosphereMaterial);
  addResource(halo.geometry);
  addResource(haloMaterial);
  const homeLight = new THREE.PointLight(0xee86d0, 3.0, 22, 1.8);
  homeLight.position.copy(destinationAnchor);
  scene.add(homeLight);
  const violetLight = new THREE.PointLight(0xb642c7, 2.0, 16, 1.7);
  violetLight.position.set(destinationAnchor.x - 5, destinationAnchor.y + 3, destinationAnchor.z - 3);
  scene.add(violetLight);
  const passingStarGroup = new THREE.Group();
  passingStarGroup.visible = false;
  const passingStarTexture = addResource(makeGlowTexture());
  const passingStarCoreTexture = addResource(makePassingStarTexture());
  const passingStarAuraMaterial = addResource(new THREE.SpriteMaterial({ map: passingStarTexture, color: 0xffb86f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  const passingStarAura = new THREE.Sprite(passingStarAuraMaterial);
  passingStarAura.scale.set(6.2, 6.2, 1);
  passingStarAura.renderOrder = 20;
  passingStarGroup.add(passingStarAura);
  const passingStarCoreMaterial = addResource(new THREE.SpriteMaterial({ map: passingStarCoreTexture, color: 0xffffe0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  const passingStarCore = new THREE.Sprite(passingStarCoreMaterial);
  passingStarCore.scale.set(3, 3, 1);
  passingStarCore.renderOrder = 21;
  passingStarGroup.add(passingStarCore);
  scene.add(passingStarGroup);

  // Two complete text orbits share a radius, but cross on distinct tilted planes.
  const textRingOne = new THREE.Group();
  const textRingTwo = new THREE.Group();
  const textRingLocalAxis = new THREE.Vector3(0, 0, 1);
  const textRingOneNormal = new THREE.Vector3(0.35, 0.78, 0.52).normalize();
  const textRingTwoNormal = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();
  const textRingOneOrientation = new THREE.Quaternion().setFromUnitVectors(
    textRingLocalAxis, textRingOneNormal,
  );
  const textRingTwoOrientation = new THREE.Quaternion().setFromUnitVectors(
    textRingLocalAxis, textRingTwoNormal,
  );
  const textRingOneSpin = new THREE.Quaternion();
  const textRingTwoSpin = new THREE.Quaternion();
  const textRingSpecs = [
    { group: textRingOne, radius: 3.92, tube: 0.012, color: 0xff9bc9, ink: "#ffe5f1", phrase: ringPhrases[0] },
    { group: textRingTwo, radius: 3.92, tube: 0.012, color: 0xffc3df, ink: "#ffd4e9", phrase: ringPhrases[1] },
  ];
  for (const spec of textRingSpecs) {
    const trackMaterial = addResource(new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    const track = new THREE.Mesh(addResource(new THREE.TorusGeometry(spec.radius, spec.tube, 8, 360)), trackMaterial);
    spec.group.add(track);
    const atlas = makeCurvedRingTexture(spec.phrase, spec.ink);
    const texture = addResource(atlas.texture);
    const textMaterial = addResource(new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: true, toneMapped: false, alphaTest: 0.015 }));
    textMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 instanceGlyphUvRect;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = vMapUv * instanceGlyphUvRect.zw + instanceGlyphUvRect.xy;\n#endif");
    };
    textMaterial.customProgramCacheKey = () => "love-galaxy-orbital-curved-3d-glyphs-v3";

    const copyCount = 2;
    const gapEm = 2.4;
    const padding = atlas.fontSize * 0.1;
    const letterSpacing = atlas.fontSize * 0.065;
    const visibleGlyphCount = atlas.glyphs.filter(glyph => glyph.character !== " ").length;
    const copySpan = atlas.phraseWidth + (atlas.glyphs.length - 1) * letterSpacing;
    const instanceCount = visibleGlyphCount * copyCount;
    const glyphGeometry = addResource(new THREE.PlaneGeometry(1, 1));
    const glyphUvRects = new Float32Array(instanceCount * 4);
    const glyphInstances: CurvedTextGlyph[] = [];
    for (let copy = 0; copy < copyCount; copy += 1) {
      let cursor = 0;
      for (const glyph of atlas.glyphs) {
        if (glyph.character !== " ") {
          glyphInstances.push({
            copy,
            offsetEm: (cursor + glyph.advance / 2 - copySpan / 2) / atlas.fontSize,
            widthEm: (glyph.advance + padding * 2) / atlas.fontSize,
            uvRect: glyph.uvRect,
          });
        }
        cursor += glyph.advance + letterSpacing;
      }
    }
    const glyphUvAttribute = new THREE.InstancedBufferAttribute(glyphUvRects, 4);
    glyphInstances.forEach((glyph, index) => glyphUvAttribute.setXYZW(index, glyph.uvRect.x, glyph.uvRect.y, glyph.uvRect.z, glyph.uvRect.w));
    glyphGeometry.setAttribute("instanceGlyphUvRect", glyphUvAttribute);
    const glyphMesh = addResource(new THREE.InstancedMesh(glyphGeometry, textMaterial, instanceCount));
    glyphMesh.frustumCulled = false;
    glyphMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    glyphMesh.renderOrder = 2;
    const fontWorld = (Math.PI * 2 * spec.radius) / (copyCount * (copySpan / atlas.fontSize + gapEm));
    const glyphDummy = new THREE.Object3D();
    glyphInstances.forEach((glyph, index) => {
      const copyCenterAngle = (glyph.copy / copyCount) * Math.PI * 2;
      const angle = copyCenterAngle - (glyph.offsetEm * fontWorld) / spec.radius;
      glyphDummy.position.set(Math.cos(angle) * spec.radius, Math.sin(angle) * spec.radius, 0);
      glyphDummy.rotation.set(0, 0, angle - Math.PI / 2);
      glyphDummy.scale.set(glyph.widthEm * fontWorld * 0.82, fontWorld * 1.5 * 0.82, 1);
      glyphDummy.updateMatrix();
      glyphMesh.setMatrixAt(index, glyphDummy.matrix);
    });
    glyphMesh.instanceMatrix.needsUpdate = true;
    spec.group.add(glyphMesh);
    spec.group.position.copy(destinationAnchor);
    spec.group.visible = !reviewSharedJourneyPrototypeEnabled;
    spec.group.scale.setScalar(reviewSharedJourneyPrototypeEnabled ? 0.001 : 1);
    scene.add(spec.group);
  }
  canvas.dataset.textRingRendering = "orbital-curved-3d-glyphs";
  canvas.dataset.textRingBillboard = "false";
  canvas.dataset.textRingCopyCount = "2";
  canvas.dataset.textRingPlaneNormalOne = textRingOneNormal.toArray().map(value => value.toFixed(2)).join(",");
    canvas.dataset.textRingPlaneNormalTwo = textRingTwoNormal.toArray().map(value => value.toFixed(2)).join(",");
    canvas.dataset.textRingPlaneCrossAngleDegrees = THREE.MathUtils.radToDeg(textRingOneNormal.angleTo(textRingTwoNormal)).toFixed(1);
    canvas.dataset.musicReactiveGlow = "true";
  canvas.dataset.photoOrbitPlanes = "1";
  canvas.dataset.photoOrbitShape = "single-wide-band";
  canvas.dataset.photoBandInnerRadius = String(PHOTO_BAND_INNER_RADIUS);
  canvas.dataset.photoBandOuterRadius = String(PHOTO_BAND_OUTER_RADIUS);
  canvas.dataset.photoDistribution = "dense-equatorial-seven-row-stream";
  canvas.dataset.photoStreamRowsAboveBelow = String(PHOTO_STREAM_ROWS_ABOVE_BELOW);
  canvas.dataset.photoStreamRowCount = String(PHOTO_STREAM_ROWS_ABOVE_BELOW * 2 + 1);
  canvas.dataset.journeyDuration = String(reviewSharedJourneyPrototypeEnabled ? SHARED_JOURNEY_DURATION_SECONDS : 18);
  canvas.dataset.cameraPathPhotoClearance = "16.2";

  const { path: cameraPath, target: cameraTargetPath } = createGalaxyCameraFlight();

  // Keep all 1,200 flat photo cards in a wide stream with three tidy rows above and below center.
  const cloud = new THREE.Group();
  cloud.position.copy(destinationAnchor);
  cloud.scale.setScalar(reviewSharedJourneyPrototypeEnabled ? 0.001 : 1);
  scene.add(cloud);
  const photoOrbitPlane = new THREE.Euler(0.1, 0.08, -0.04);
  let photoStreamHorizontalScale = 1;
  const orbitBandGeometry = addResource(new THREE.RingGeometry(PHOTO_BAND_INNER_RADIUS - 0.25, PHOTO_BAND_OUTER_RADIUS + 0.25, 360, 10));
  const orbitBandMaterial = addResource(new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float radius=length(vUv-vec2(.5))*2.0; float edge=smoothstep(.48,.53,radius)*(1.0-smoothstep(.93,1.0,radius)); float grain=.5+.5*sin(radius*210.0); vec3 color=mix(vec3(.16,.025,.12),vec3(.42,.12,.3),grain); float alpha=edge*(.04+.035*grain); gl_FragColor=vec4(color,alpha); }`,
  }));
  const orbitBand = new THREE.Mesh(orbitBandGeometry, orbitBandMaterial);
  orbitBand.rotation.set(Math.PI / 2 + photoOrbitPlane.x, photoOrbitPlane.y, photoOrbitPlane.z);
  orbitBand.renderOrder = 1;
  cloud.add(orbitBand);
  const records: PhotoRecord[] = [];
  for (let id = 0; id < MEMORY_COUNT; id += 1) {
    const angle = id * Math.PI * (3 - Math.sqrt(5));
    const radius = Math.sqrt(THREE.MathUtils.lerp(PHOTO_BAND_INNER_RADIUS ** 2, PHOTO_BAND_OUTER_RADIUS ** 2, (id + 0.5) / MEMORY_COUNT));
    const row = Math.floor(random() * (PHOTO_STREAM_ROWS_ABOVE_BELOW * 2 + 1)) - PHOTO_STREAM_ROWS_ABOVE_BELOW;
    const lift = row * PHOTO_STREAM_ROW_SPACING + (random() - 0.5) * 0.12;
    records.push({
      id,
      image: id % images.length,
      radius,
      angle,
      phase: random() * Math.PI * 2,
      speed: 0.0095,
      lift,
      row,
      roll: (random() - 0.5) * 0.12,
      scale: random() < 0.06 ? 1.45 + random() * 0.35 : 0.72 + random() * 0.58,
    });
  }
  const recordsByImage = images.map((_, image) => records.filter(record => record.image === image));
  const photoMeshes: THREE.InstancedMesh[] = [];
  const frameMeshes: THREE.InstancedMesh[] = [];
  const photoGeometry = addResource(new THREE.PlaneGeometry(0.33, 0.45));
  const frameGeometry = addResource(new THREE.PlaneGeometry(0.355, 0.475));
  const photoWaveTime = { value: 0 };
  const photoWaveSpan = { value: 15 };
  const addPhotoLightWave = (material: THREE.MeshBasicMaterial) => {
    material.onBeforeCompile = shader => {
      shader.uniforms.uPhotoWaveTime = photoWaveTime;
      shader.uniforms.uPhotoWaveSpan = photoWaveSpan;
      shader.uniforms.uDragRippleCenter = dragRippleCenter;
      shader.uniforms.uDragRippleStrength = dragRippleStrength;
      shader.uniforms.uPassingStar = previewStarPass;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uPhotoWaveTime;\nuniform float uPhotoWaveSpan;\nuniform vec2 uDragRippleCenter;\nuniform float uDragRippleStrength;\nvarying float vPhotoWave;\nvarying float vPhotoDragRipple;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvec4 photoCardWorld = modelMatrix * vec4(instanceMatrix[3].xyz, 1.0);\nfloat photoWaveCenter = sin(uPhotoWaveTime * 0.18) * uPhotoWaveSpan;\nfloat photoWaveDistance = abs(photoCardWorld.x - photoWaveCenter);\nvPhotoWave = exp(-0.5 * (photoWaveDistance / 1.15) * (photoWaveDistance / 1.15));\nfloat dragDistance = distance(photoCardWorld.xy, uDragRippleCenter);\nfloat dragEnvelope = exp(-0.5 * (dragDistance / 5.2) * (dragDistance / 5.2));\nvPhotoDragRipple = (0.54 + 0.46 * sin(dragDistance * 1.42 - uPhotoWaveTime * 3.2)) * dragEnvelope * uDragRippleStrength;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vPhotoWave;\nvarying float vPhotoDragRipple;\nuniform float uPassingStar;")
        .replace("#include <map_fragment>", "#include <map_fragment>\nfloat photoWave = clamp(vPhotoWave, 0.0, 1.0);\nfloat dragRipple = clamp(vPhotoDragRipple, 0.0, 1.0);\ndiffuseColor.rgb *= 1.0 + photoWave * 0.82;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.91), photoWave * 0.12);\ndiffuseColor.rgb *= 1.0 + dragRipple * 0.70;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.91), dragRipple * 0.24);\ndiffuseColor.rgb *= 1.0 - uPassingStar * 0.22;");
    };
    material.customProgramCacheKey = () => "love-galaxy-traveling-photo-wave-drag-ripple-star-pass-v2";
  };
  const frameMaterial = addResource(new THREE.MeshBasicMaterial({ color: 0xffb7d7, side: THREE.DoubleSide, transparent: true, opacity: reviewSharedJourneyPrototypeEnabled ? 0 : 0.48, depthWrite: false }));
  addPhotoLightWave(frameMaterial);
  const textureLoader = new THREE.TextureLoader();
  const photoRaycastTargets: THREE.InstancedMesh[] = [];
  const sharedJourneyWorldRaycastTargets = sharedJourneyWorldTargets.map(target => target.surface);
  const sharedJourneyWorldOcclusionTargets: THREE.Object3D[] = [...sharedJourneyWorldRaycastTargets, sphere];
  let loadedDemoTextures = 0;
  for (let image = 0; image < images.length; image += 1) {
    const texture = addResource(textureLoader.load(images[image].src, loaded => {
      if (isDisposed) { loaded.dispose(); return; }
      const picture = loaded.image as HTMLImageElement;
      const aspect = picture.width / picture.height;
      const cardAspect = 0.33 / 0.45;
      if (aspect > cardAspect) { loaded.repeat.x = cardAspect / aspect; loaded.offset.x = (1 - loaded.repeat.x) / 2; }
      else { loaded.repeat.y = aspect / cardAspect; loaded.offset.y = (1 - loaded.repeat.y) / 2; }
      loaded.needsUpdate = true;
      loadedDemoTextures += 1;
      canvas.dataset.loadedDemoTextures = String(loadedDemoTextures);
    }, undefined, () => {
      if (isDisposed) return;
      scenePreparationFailed = true;
      reportRenderer(false);
    }));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const material = addResource(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false, transparent: reviewSharedJourneyPrototypeEnabled, opacity: reviewSharedJourneyPrototypeEnabled ? 0 : 1 }));
    addPhotoLightWave(material);
    const subset = recordsByImage[image];
    const photos = addResource(new THREE.InstancedMesh(photoGeometry, material, subset.length));
    photos.userData.memoryIds = subset.map(record => record.id);
    photos.frustumCulled = false;
    photos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    photos.visible = !reviewSharedJourneyPrototypeEnabled;
    scene.add(photos);
    const frames = addResource(new THREE.InstancedMesh(frameGeometry, frameMaterial, subset.length));
    frames.frustumCulled = false;
    frames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    frames.visible = !reviewSharedJourneyPrototypeEnabled;
    scene.add(frames);
    photoMeshes.push(photos);
    photoRaycastTargets.push(photos);
    frameMeshes.push(frames);
  }
  sharedJourneyWorldOcclusionTargets.push(...photoRaycastTargets);

  canvas.dataset.photoInstanceCount = String(photoMeshes.reduce((count, mesh) => count + mesh.count, 0));
  canvas.dataset.backgroundStarCount = String(STAR_COUNT);
  canvas.dataset.shootingStarCount = String(SHOOTING_STAR_COUNT);
  canvas.dataset.threeRevision = THREE.REVISION;
  const raycaster = new THREE.Raycaster();
  const worldVisibilityRaycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cameraForward = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const framePosition = new THREE.Vector3();
  const previewDragOffset = new THREE.Vector3();
  const previewDragTargetOffset = new THREE.Vector3();
  const previewDragGestureOrigin = new THREE.Vector2();
  const previewDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const previewDragWorldPoint = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const journeyLookDirection = new THREE.Vector3();
  const journeyLookTarget = new THREE.Vector3();
  const projectedWorldPoint = new THREE.Vector3();
  const worldViewDirection = new THREE.Vector3();
  let previewDragActive = false;
  let finalViewStartedAt: number | null = null;
  const dummy = new THREE.Object3D();
  let orbitCenter = destinationAnchor.clone();
  const currentOrbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbitCenter));
  const targetOrbit = currentOrbit.clone();
  const takeoverQuaternion = new THREE.Quaternion();
  const manualLookQuaternion = new THREE.Quaternion();
  const manualLookMatrix = new THREE.Matrix4();
  const takeoverDuration = 0.32;
  let takeoverElapsed = takeoverDuration;
  const pointerPositions = new Map<number, { x: number; y: number }>();
  const pointerOrigins = new Map<number, { x: number; y: number }>();
  let cinematicElapsed = 0;
  let cinematicProgress = 0;
  let manualCamera = false;
  let journeyLookActive = false;
  let cameraView: CameraStop = "sphere";
  let pinchDistance = 0;
  let pinchStartDistance = 0;
  let gestureMode: "none" | "orbit" | "pinch" = "none";
  let dragged = false;
  let ignoreClickUntil = 0;
  let frameId = 0;
  let lastFrame = 0;
  let fpsSampleStart = performance.now();
  let renderedFrames = 0;
  let updateTimeTotal = 0;
  let drawTimeTotal = 0;
  let timingFrames = 0;
  const fpsCap = window.innerWidth <= 700 ? 1000 / 30 : 1000 / 50;
  let lastTick = performance.now();
  let elapsedTime = 0;

  const getZoomBounds = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfHorizontalFov = Math.atan(Math.tan(halfFov) * width / height);
    const home = THREE.MathUtils.clamp((13.2 + 0.85) / Math.sin(Math.min(halfFov, halfHorizontalFov)) * 1.06, 28, 76);
    return { min: width <= 700 ? 12.5 : 8.8, max: Math.min(82, Math.max(52, home * 1.45)), home };
  };
  const clampRadius = (radius: number) => {
    const bounds = getZoomBounds();
    return THREE.MathUtils.clamp(radius, bounds.min, bounds.max);
  };
  const clampPhi = (phi: number) => THREE.MathUtils.clamp(phi, 0.16, Math.PI - 0.16);
  const gestureDimension = () => Math.max(1, Math.min(canvas.clientWidth, canvas.clientHeight));
  const setReviewDestinationReveal = (progress: number) => {
    reviewDestinationReveal = reviewSharedJourneyPrototypeEnabled ? THREE.MathUtils.smoothstep(progress, 0.78, 0.98) : 1;
    const scale = Math.max(0.001, reviewDestinationReveal);
    core.visible = !reviewSharedJourneyPrototypeEnabled || reviewDestinationReveal > 0.015;
    core.scale.setScalar(0.82 * scale);
    textRingOne.visible = textRingTwo.visible = !reviewSharedJourneyPrototypeEnabled || reviewDestinationReveal > 0.015;
    textRingOne.scale.setScalar(scale);
    textRingTwo.scale.setScalar(scale);
    cloud.scale.setScalar(scale);
    homeLight.intensity = 3 * reviewDestinationReveal;
    violetLight.intensity = 2 * reviewDestinationReveal;
    frameMaterial.opacity = 0.48 * reviewDestinationReveal;
    for (const mesh of photoMeshes) {
      mesh.visible = !reviewSharedJourneyPrototypeEnabled || reviewDestinationReveal > 0.015;
      if (reviewSharedJourneyPrototypeEnabled) (mesh.material as THREE.MeshBasicMaterial).opacity = reviewDestinationReveal;
    }
    for (const mesh of frameMeshes) mesh.visible = !reviewSharedJourneyPrototypeEnabled || reviewDestinationReveal > 0.015;
    canvas.dataset.sharedJourneyDestinationReveal = reviewDestinationReveal.toFixed(3);
    canvas.dataset.sharedJourneyDestinationVisible = reviewDestinationReveal > 0.95 ? "true" : "false";
  };

  const updateCamera = (delta: number) => {
    if (sharedJourneyWorldTravel && reviewSharedJourneyPrototypeEnabled) {
      const travel = sharedJourneyWorldTravel;
      travel.elapsed += delta;
      const progress = THREE.MathUtils.clamp(travel.elapsed / travel.duration, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(travel.startPosition, travel.endPosition, eased);
      camera.up.set(0, 1, 0);
      camera.lookAt(travel.targetPosition);
      canvas.dataset.sharedJourneyHopProgress = progress.toFixed(3);
      canvas.dataset.sharedJourneyPhase = progress < 1 ? "world-hop" : "world-arrived";
      if (progress >= 1) {
        currentSharedJourneyWorldId = travel.target.id === placeholderTravelTarget.id ? null : travel.target.id;
        orbitCenter.copy(travel.targetPosition);
        currentOrbit.setFromVector3(camera.position.clone().sub(orbitCenter));
        targetOrbit.copy(currentOrbit);
        takeoverQuaternion.copy(camera.quaternion);
        takeoverElapsed = takeoverDuration;
        manualCamera = true;
        journeyLookActive = false;
        sharedJourneyWorldTravel = null;
        canvas.dataset.sharedJourneySelectedWorldId = travel.target.id;
        canvas.dataset.sharedJourneySelectedWorldLabel = travel.target.label;
        canvas.dataset.sharedJourneyTooltipWorldId = "none";
        if (worldTooltipElement) worldTooltipElement.hidden = true;
        reportWorldStatus(travel.target.label, "arrived");
      }
    } else if (!manualCamera && reviewSharedJourneyPrototypeEnabled) {
      if (journeyStarted && !reducedMotion.matches) cinematicElapsed += delta;
      cinematicProgress = journeyStarted ? (reducedMotion.matches ? 1 : THREE.MathUtils.clamp(cinematicElapsed / SHARED_JOURNEY_DURATION_SECONDS, 0, 1)) : 0;
      const eased = cinematicProgress * cinematicProgress * (3 - 2 * cinematicProgress);
      const endDistance = getZoomBounds().home;
      camera.position.set(destinationAnchor.x, destinationAnchor.y, destinationAnchor.z + THREE.MathUtils.lerp(SHARED_JOURNEY_START_DISTANCE, endDistance, eased));
      camera.up.set(0, 1, 0);
      if (journeyLookActive) {
        currentOrbit.theta = THREE.MathUtils.damp(currentOrbit.theta, targetOrbit.theta, 16, Math.min(delta, 0.06));
        currentOrbit.phi = THREE.MathUtils.damp(currentOrbit.phi, targetOrbit.phi, 16, Math.min(delta, 0.06));
        const returnToDestination = THREE.MathUtils.smoothstep(cinematicProgress, 0.90, 1);
        const theta = currentOrbit.theta * (1 - returnToDestination);
        const phi = Math.PI / 2 + (currentOrbit.phi - Math.PI / 2) * (1 - returnToDestination);
        const sinPhi = Math.sin(phi);
        journeyLookDirection.set(-sinPhi * Math.sin(theta), -Math.cos(phi), -sinPhi * Math.cos(theta)).normalize();
        camera.lookAt(journeyLookTarget.copy(camera.position).add(journeyLookDirection));
      } else {
        camera.lookAt(destinationAnchor);
      }
      setReviewDestinationReveal(cinematicProgress);
      canvas.dataset.sharedJourneyProgress = cinematicProgress.toFixed(3);
      canvas.dataset.sharedJourneyPhase = !journeyStarted ? "ready" : cinematicProgress < 0.78 ? "anonymous-worlds" : cinematicProgress < 1 ? "destination-approach" : "arrived";
      if (cinematicProgress >= 1 && !reviewJourneyArrived) {
        reviewJourneyArrived = true;
        reportReviewArrival();
      }
    } else if (!manualCamera) {
      if (journeyStarted && !reducedMotion.matches) cinematicElapsed += delta;
      const intro = reducedMotion.matches ? 0 : cinematicElapsed;
      const travel = (start: number, duration: number, from: number, to: number) => {
        const amount = THREE.MathUtils.clamp((intro - start) / duration, 0, 1);
        const eased = amount * amount * (3 - 2 * amount);
        return THREE.MathUtils.lerp(from, to, eased);
      };
      cinematicProgress = reducedMotion.matches && journeyStarted ? 1
        : intro < 2.5 ? travel(0, 2.5, 0, SPHERE_EXIT_PROGRESS)
          : intro < 11.5 ? travel(2.5, 9, SPHERE_EXIT_PROGRESS, PHOTO_BAND_EXIT_PROGRESS)
            : intro < 13 ? travel(11.5, 1.5, PHOTO_BAND_EXIT_PROGRESS, ASCENT_START_PROGRESS)
              : travel(13, 5, ASCENT_START_PROGRESS, 1);
      camera.position.copy(cameraPath.getPoint(cinematicProgress));
      // Ease out to a fully framed orbit at the end, including tall phone screens.
      const framing = THREE.MathUtils.smoothstep(cinematicProgress, 0.76, 1);
      camera.position.multiplyScalar(THREE.MathUtils.lerp(1, Math.max(1, getZoomBounds().home / cameraPath.getPoint(1).length()), framing));
      camera.up.set(0, 1 - framing, -framing).normalize();
      camera.lookAt(cameraTargetPath.getPoint(cinematicProgress));
    } else {
      camera.up.set(0, 1, 0);
      currentOrbit.theta = THREE.MathUtils.damp(currentOrbit.theta, targetOrbit.theta, 16, Math.min(delta, 0.06));
      currentOrbit.phi = THREE.MathUtils.damp(currentOrbit.phi, targetOrbit.phi, 16, Math.min(delta, 0.06));
      currentOrbit.radius = THREE.MathUtils.damp(currentOrbit.radius, targetOrbit.radius, 14, Math.min(delta, 0.06));
      camera.position.setFromSpherical(currentOrbit).add(orbitCenter);
      takeoverElapsed = Math.min(takeoverDuration, takeoverElapsed + delta);
      manualLookMatrix.lookAt(camera.position, orbitCenter, camera.up);
      manualLookQuaternion.setFromRotationMatrix(manualLookMatrix);
      camera.quaternion.slerpQuaternions(takeoverQuaternion, manualLookQuaternion, THREE.MathUtils.smoothstep(takeoverElapsed, 0, takeoverDuration));
    }
    const cameraOffset = camera.position.clone().sub(orbitCenter);
    const manualPhi = manualCamera || journeyLookActive ? currentOrbit.phi : Math.acos(THREE.MathUtils.clamp(cameraOffset.y / Math.max(0.001, cameraOffset.length()), -1, 1));
    const nextView: CameraStop = manualPhi < 0.42 ? "above" : manualCamera || journeyLookActive ? (manualCamera && currentOrbit.radius < 18 ? "memories" : "sphere") : reviewSharedJourneyPrototypeEnabled ? (cinematicProgress >= 0.78 ? "memories" : "sphere") : cinematicProgress < 2 / 11 ? "sphere" : cinematicProgress < 8 / 11 ? "memories" : "above";
    if (nextView !== cameraView) {
      cameraView = nextView;
      reportView(nextView);
    }
    canvas.dataset.cameraView = cameraView;
    canvas.dataset.cameraMode = manualCamera ? "manual" : journeyLookActive && cinematicProgress < 1 ? "cinematic-look" : reviewSharedJourneyPrototypeEnabled && cinematicProgress >= 1 ? "shared-journey-arrived" : !journeyStarted ? "waiting" : reducedMotion.matches ? "reduced-motion" : "cinematic";
    canvas.dataset.cameraLookMode = journeyLookActive && cinematicProgress < 0.95 ? "free-look" : "path";
    canvas.dataset.cameraProgress = cinematicProgress.toFixed(3);
    canvas.dataset.cameraPhase = reviewSharedJourneyPrototypeEnabled ? (cinematicProgress >= 1 ? "arrived" : cinematicProgress >= 0.78 ? "destination-approach" : "anonymous-worlds") : galaxyCameraPhase(cinematicProgress);
    camera.updateMatrixWorld();
    canvas.dataset.cameraForward = camera.getWorldDirection(cameraForward).toArray().map(value => value.toFixed(6)).join(",");
    canvas.dataset.cameraPose = camera.position.toArray().map(value => value.toFixed(2)).join(",");
    canvas.dataset.cameraTarget = manualCamera || reviewSharedJourneyPrototypeEnabled ? orbitCenter.toArray().map(value => value.toFixed(2)).join(",") : cameraTargetPath.getPoint(cinematicProgress).toArray().map(value => value.toFixed(2)).join(",");
    canvas.dataset.cameraRadius = cameraOffset.length().toFixed(3);
    canvas.dataset.cameraTheta = (manualCamera ? currentOrbit.theta : Math.atan2(cameraOffset.x, cameraOffset.z)).toFixed(4);
    canvas.dataset.cameraPhi = manualPhi.toFixed(4);
    canvas.dataset.cameraHomeRadius = getZoomBounds().home.toFixed(3);
  };
  const updatePreviewDrag = (delta: number) => {
    const damping = previewDragActive ? 11 : 2.15;
    previewDragOffset.x = THREE.MathUtils.damp(previewDragOffset.x, previewDragTargetOffset.x, damping, delta);
    previewDragOffset.y = THREE.MathUtils.damp(previewDragOffset.y, previewDragTargetOffset.y, damping, delta);
    const rippleTarget = reviewMotionPrototypeEnabled && previewDragActive ? dragRippleTargetStrength.value : 0;
    dragRippleStrength.value = THREE.MathUtils.damp(dragRippleStrength.value, rippleTarget, previewDragActive ? 9 : 2.25, delta);
    starFieldGroup.position.set(previewDragOffset.x * 0.24, previewDragOffset.y * 0.24, 0);
    starFieldGroup.rotation.set(-previewDragOffset.y * 0.003, previewDragOffset.x * 0.002, previewDragOffset.x * 0.003);
    canvas.dataset.dragRippleStrength = dragRippleStrength.value.toFixed(3);
    canvas.dataset.dragStreamOffset = `${previewDragOffset.x.toFixed(2)},${previewDragOffset.y.toFixed(2)}`;
  };
  const updatePhotos = (time: number) => {
    cloud.rotation.y = time * 0.018;
    cloud.rotation.x = Math.sin(time * 0.049) * 0.055;
    cloud.position.set(destinationAnchor.x + previewDragOffset.x, destinationAnchor.y + previewDragOffset.y, destinationAnchor.z);
    cloud.scale.setScalar(reviewSharedJourneyPrototypeEnabled ? Math.max(0.001, reviewDestinationReveal) : 1);
    cloud.updateMatrixWorld(true);
    camera.getWorldDirection(cameraForward);
    for (let image = 0; image < images.length; image += 1) {
      const subset = recordsByImage[image];
      const photos = photoMeshes[image];
      const frames = frameMeshes[image];
      for (let index = 0; index < subset.length; index += 1) {
        const record = subset[index];
        const orbitAngle = record.angle + time * record.speed;
        const drift = time * 0.22 + record.phase;
        localPosition.set(
          Math.cos(orbitAngle) * record.radius * photoStreamHorizontalScale,
          record.lift + Math.sin(drift) * (record.row === 0 ? 0.1 : 0.06),
          Math.sin(orbitAngle) * record.radius,
        ).applyEuler(photoOrbitPlane);
        worldPosition.copy(localPosition);
        cloud.localToWorld(worldPosition);
        if (reviewMotionPrototypeEnabled && dragRippleStrength.value > 0.001) {
          const rippleX = worldPosition.x - dragRippleCenter.value.x;
          const rippleY = worldPosition.y - dragRippleCenter.value.y;
          const rippleDistance = Math.hypot(rippleX, rippleY);
          const rippleEnvelope = Math.exp(-0.5 * (rippleDistance / 5.2) * (rippleDistance / 5.2));
          const ripplePulse = (0.54 + 0.46 * Math.sin(rippleDistance * 1.42 - time * 3.2)) * rippleEnvelope * dragRippleStrength.value;
          const rippleDirection = 1 / Math.max(0.25, rippleDistance);
          worldPosition.x += rippleX * rippleDirection * ripplePulse * 0.5;
          worldPosition.y += rippleY * rippleDirection * ripplePulse * 0.42;
          worldPosition.z += ripplePulse * 0.24;
        }
        dummy.position.copy(worldPosition);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(record.roll + Math.sin(drift) * 0.035);
        dummy.rotateY(Math.sin(record.phase) * 0.22);
        dummy.rotateX(Math.cos(record.phase) * 0.12);
        const approachScale = THREE.MathUtils.smoothstep(worldPosition.distanceTo(camera.position), 0.3, 2.0);
        const scale = record.scale * (1 + Math.sin(drift * 0.72) * 0.035) * approachScale * (reviewSharedJourneyPrototypeEnabled ? reviewDestinationReveal : 1);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        photos.setMatrixAt(index, dummy.matrix);
        framePosition.copy(worldPosition).addScaledVector(cameraForward, 0.014);
        dummy.position.copy(framePosition);
        dummy.scale.setScalar(scale * 1.045);
        dummy.updateMatrix();
        frames.setMatrixAt(index, dummy.matrix);
      }
      photos.instanceMatrix.needsUpdate = true;
      frames.instanceMatrix.needsUpdate = true;
    }
  };
  const updateShootingStars = (time: number) => {
    const headPositions = shootingHeadGeometry.getAttribute("position") as THREE.BufferAttribute;
    let activeCount = 0;
    for (let index = 0; index < shootingTracks.length; index += 1) {
      const track = shootingTracks[index];
      const trail = shootingTrails[index];
      const age = (time + track.phase) % track.period;
      const active = !reducedMotion.matches && age < track.lifetime;
      if (!active) {
        trail.visible = false;
        headPositions.setXYZ(index, 10000, 10000, 10000);
        continue;
      }
      activeCount += 1;
      const fade = Math.min(1, age / 0.18, (track.lifetime - age) / 0.3);
      const headX = track.startX + track.directionX * age * track.speed;
      const headY = track.startY + track.directionY * age * track.speed;
      const depth = -17 - index * 3;
      const tailX = headX - track.directionX * track.length;
      const tailY = headY - track.directionY * track.length;
      trail.position.set((tailX + headX) / 2, (tailY + headY) / 2, depth);
      trail.quaternion.copy(camera.quaternion);
      trail.rotateZ(Math.atan2(track.directionY, track.directionX));
      trail.scale.set(track.length, 0.36, 1);
      trail.material.opacity = fade;
      trail.visible = true;
      headPositions.setXYZ(index, headX, headY, depth);
    }
    headPositions.needsUpdate = true;
    canvas.dataset.activeShootingStars = String(activeCount);
  };
  const updatePreviewPassingStar = (time: number) => {
    if (!reviewMotionPrototypeEnabled || !journeyStarted || cinematicProgress < 1) {
      finalViewStartedAt = null;
      previewStarPass.value = 0;
      passingStarGroup.visible = false;
      canvas.dataset.passingStarPassProgress = "0.000";
      return;
    }
    if (finalViewStartedAt === null) finalViewStartedAt = time;
    const sinceFinalView = Math.max(0, time - finalViewStartedAt);
    const cycle = ((sinceFinalView - 0.65) % 14 + 14) % 14;
    const passDuration = 3.2;
    const active = cycle < passDuration;
    const progress = active ? cycle / passDuration : 0;
    const intensity = active ? Math.sin(Math.PI * progress) ** 2 : 0;
    previewStarPass.value = intensity;
    passingStarGroup.visible = active;
    canvas.dataset.passingStarPassProgress = progress.toFixed(3);
    canvas.dataset.passingStarIntensity = intensity.toFixed(3);
    if (active) {
      camera.getWorldDirection(cameraForward);
      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const sweep = THREE.MathUtils.smoothstep(progress, 0, 1);
    const foregroundDepth = Math.max(0.2, camera.position.distanceTo(orbitCenter) - 2.7);
      passingStarGroup.position.copy(camera.position)
        .addScaledVector(cameraForward, foregroundDepth)
        .addScaledVector(cameraRight, THREE.MathUtils.lerp(-8.5, 8.5, sweep))
        .addScaledVector(cameraUp, 0.25 + Math.sin(progress * Math.PI) * 0.35);
      passingStarGroup.quaternion.copy(camera.quaternion);
      passingStarAuraMaterial.opacity = intensity * 0.68;
      passingStarCoreMaterial.opacity = intensity * (0.82 + 0.18 * Math.sin(progress * Math.PI * 2) ** 2);
      passingStarAura.scale.setScalar(6.2 * (1 + intensity * 0.12));
      passingStarCore.scale.setScalar(3 * (1 + intensity * 0.16));
    }
    nebulaHaloMaterial.opacity = 0.66 * (1 - intensity * 0.18);
    glowMaterial.opacity = 0.84 * (1 - intensity * 0.32);
    atmosphereMaterial.opacity = 0.19 * (1 - intensity * 0.22);
  };
  const updateSharedWorldTooltip = () => {
    const tooltip = worldTooltipElement;
    if (!tooltip) return;
    if (!reviewSharedJourneyPrototypeEnabled || !reviewJourneyArrived || sharedJourneyWorldTravel || !journeyStarted) {
      tooltip.hidden = true;
      canvas.dataset.sharedJourneyTooltipWorldId = "none";
      return;
    }
    camera.getWorldDirection(cameraForward);
    const focalLength = canvas.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const candidates: { target: SharedJourneyWorldTarget; distance: number; score: number; x: number; y: number; direction: THREE.Vector3 }[] = [];
    for (const target of sharedJourneyWorldTargets) {
      if (target.id === currentSharedJourneyWorldId) continue;
      target.group.updateWorldMatrix(true, false);
      target.group.getWorldPosition(projectedWorldPoint);
      const distance = camera.position.distanceTo(projectedWorldPoint);
      if (distance <= 0) continue;
      const projectedRadius = target.radius * focalLength / distance;
      if (projectedRadius < 2) continue;
      worldViewDirection.subVectors(projectedWorldPoint, camera.position).normalize();
      if (worldViewDirection.dot(cameraForward) <= 0) continue;
      projectedWorldPoint.project(camera);
      if (projectedWorldPoint.z < -1 || projectedWorldPoint.z > 1 || Math.abs(projectedWorldPoint.x) > 0.94 || Math.abs(projectedWorldPoint.y) > 0.94) continue;
      const centerScore = projectedWorldPoint.x * projectedWorldPoint.x + projectedWorldPoint.y * projectedWorldPoint.y;
      candidates.push({
        target,
        distance,
        score: centerScore,
        x: (projectedWorldPoint.x + 1) * 0.5 * canvas.clientWidth,
        y: (1 - projectedWorldPoint.y) * 0.5 * canvas.clientHeight,
        direction: worldViewDirection.clone(),
      });
    }
    candidates.sort((left, right) => left.score - right.score);
    let nearestTarget: SharedJourneyWorldTarget | null = null;
    let nearestX = 0;
    let nearestY = 0;
    for (const candidate of candidates.slice(0, 8)) {
      worldVisibilityRaycaster.set(camera.position, candidate.direction);
      worldVisibilityRaycaster.near = 0;
      worldVisibilityRaycaster.far = candidate.distance + candidate.target.radius;
      const firstVisibleSurface = worldVisibilityRaycaster.intersectObjects(sharedJourneyWorldOcclusionTargets, false)[0];
      if (firstVisibleSurface?.object !== candidate.target.surface) continue;
      nearestTarget = candidate.target;
      nearestX = candidate.x;
      nearestY = candidate.y;
      break;
    }
    if (!nearestTarget) {
      tooltip.hidden = true;
      canvas.dataset.sharedJourneyTooltipWorldId = "none";
      return;
    }
    if (tooltip.dataset.worldId !== nearestTarget.id) {
      tooltip.dataset.worldId = nearestTarget.id;
      tooltip.setAttribute("aria-label", `Visit ${nearestTarget.label}`);
      const label = tooltip.querySelector<HTMLElement>(".lg-shared-world-tooltip-label");
      if (label) label.textContent = nearestTarget.label;
    }
    const tooltipBounds = tooltip.getBoundingClientRect();
    const halfWidth = Math.max(78, (tooltipBounds.width || 196) / 2);
    const tooltipHeight = tooltipBounds.height || 72;
    tooltip.style.left = `${THREE.MathUtils.clamp(nearestX, halfWidth + 8, canvas.clientWidth - halfWidth - 8)}px`;
    tooltip.style.top = `${THREE.MathUtils.clamp(nearestY, tooltipHeight + 18, canvas.clientHeight - 12)}px`;
    tooltip.hidden = false;
    canvas.dataset.sharedJourneyTooltipWorldId = nearestTarget.id;
  };
  const render = (timestamp: number) => {
    frameId = 0;
    if (isDisposed || contextLost || scenePreparationFailed || document.visibilityState === "hidden") return;
    if (timestamp - lastFrame < fpsCap) {
      frameId = window.requestAnimationFrame(render);
      return;
    }
    const cameraDelta = Math.max(0, (timestamp - lastTick) / 1000);
    const delta = Math.min(cameraDelta, 0.06);
    lastTick = timestamp;
    if (!reducedMotion.matches) elapsedTime += delta;
    const time = reducedMotion.matches ? 0 : elapsedTime;
    lastFrame = timestamp;
    const updateStarted = performance.now();
    updateCamera(cameraDelta);
    updatePreviewDrag(delta);
    updatePhotos(time);
    updateSharedWorldTooltip();
    photoWaveTime.value = time;
    photoWaveSpan.value = PHOTO_BAND_OUTER_RADIUS * photoStreamHorizontalScale + 1.6;
    canvas.dataset.photoLightWaveCenterX = (Math.sin(time * 0.18) * photoWaveSpan.value).toFixed(2);
    sphereMaterial.uniforms.uTime.value = time;
    nebulaMaterial.uniforms.uTime.value = time;
    starMaterial.uniforms.uTime.value = time;
    updateShootingStars(time);
    updatePreviewPassingStar(time);
    const textRingOneAngle = time * 0.045;
    const textRingTwoAngle = -time * 0.035;
    textRingOne.quaternion.copy(textRingOneOrientation).multiply(textRingOneSpin.setFromAxisAngle(textRingLocalAxis, textRingOneAngle));
    textRingTwo.quaternion.copy(textRingTwoOrientation).multiply(textRingTwoSpin.setFromAxisAngle(textRingLocalAxis, textRingTwoAngle));
    canvas.dataset.textRingRotationOne = textRingOneAngle.toFixed(3);
    canvas.dataset.textRingRotationTwo = textRingTwoAngle.toFixed(3);
    core.rotation.y = reducedMotion.matches ? 0 : Math.sin(time * 0.12) * 0.1;
    core.rotation.x = reducedMotion.matches ? 0 : Math.sin(time * 0.16) * 0.045;
    const musicPulse = THREE.MathUtils.clamp(readMusicLevel(), 0, 1);
    nebulaMaterial.uniforms.uMusic.value = musicPulse;
    canvas.dataset.musicReactiveLevel = musicPulse.toFixed(3);
    const drawStarted = performance.now();
    renderer.render(scene, camera);
    if (!scenePrepared && loadedDemoTextures === images.length) {
      scenePrepared = true;
      reportRenderer(true);
    }
    const drawFinished = performance.now();
    updateTimeTotal += drawStarted - updateStarted;
    drawTimeTotal += drawFinished - drawStarted;
    timingFrames += 1;
    renderedFrames += 1;
    if (timestamp - fpsSampleStart >= 1000) {
      canvas.dataset.renderFps = String(Math.round(renderedFrames * 1000 / (timestamp - fpsSampleStart)));
      canvas.dataset.updateMs = (updateTimeTotal / timingFrames).toFixed(1);
      canvas.dataset.drawMs = (drawTimeTotal / timingFrames).toFixed(1);
      renderedFrames = 0;
      updateTimeTotal = 0;
      drawTimeTotal = 0;
      timingFrames = 0;
      fpsSampleStart = timestamp;
    }
    if (!canvas.dataset.drawCalls) canvas.dataset.drawCalls = String(renderer.info.render.calls);
    const cameraSettling = sharedJourneyWorldTravel !== null || (journeyStarted && !manualCamera && cinematicProgress < 1) || (manualCamera && (
      Math.abs(currentOrbit.theta - targetOrbit.theta) > 0.0008
      || Math.abs(currentOrbit.phi - targetOrbit.phi) > 0.0008
      || Math.abs(currentOrbit.radius - targetOrbit.radius) > 0.001
      || takeoverElapsed < takeoverDuration
    ));
    canvas.dataset.cameraSettled = cameraSettling ? "false" : "true";
    canvas.dataset.animationPaused = reducedMotion.matches && !cameraSettling ? "true" : "false";
    if (!reducedMotion.matches || cameraSettling || !scenePrepared) frameId = window.requestAnimationFrame(render);
  };

  const wakeRenderer = () => {
    if (!frameId && !isDisposed && !contextLost && document.visibilityState !== "hidden") {
      lastTick = performance.now();
      frameId = window.requestAnimationFrame(render);
    }
  };
  const startTravelToTarget = (target: SharedJourneyTravelTarget, targetPosition: THREE.Vector3, cameraOffset: number) => {
    if (!reviewSharedJourneyPrototypeEnabled || !reviewJourneyArrived || sharedJourneyWorldTravel) return;
    const startPosition = camera.position.clone();
    const endPosition = targetPosition.clone().add(new THREE.Vector3(0, 0, cameraOffset));
    sharedJourneyWorldTravel = { target, startPosition, endPosition, targetPosition, elapsed: 0, duration: 5.2 };
    journeyLookActive = false;
    manualCamera = false;
    if (worldTooltipElement) worldTooltipElement.hidden = true;
    canvas.dataset.sharedJourneySelectedWorldId = target.id;
    canvas.dataset.sharedJourneySelectedWorldLabel = target.label;
    canvas.dataset.sharedJourneyTargetPosition = targetPosition.toArray().map(value => value.toFixed(2)).join(",");
    canvas.dataset.sharedJourneyPhase = "world-hop";
    canvas.dataset.sharedJourneyHopProgress = "0";
    reportWorldStatus(target.label, "traveling");
    wakeRenderer();
  };
  const travelToWorld = (worldId: string) => {
    if (!reviewSharedJourneyPrototypeEnabled || !reviewJourneyArrived || sharedJourneyWorldTravel) return;
    const target = sharedJourneyWorldTargets.find(world => world.id === worldId);
    if (!target) return;
    target.group.updateWorldMatrix(true, false);
    const targetPosition = target.group.getWorldPosition(new THREE.Vector3());
    startTravelToTarget(target, targetPosition, Math.max(56, target.radius * 5.2));
  };
  const returnToHome = () => {
    if (!reviewSharedJourneyPrototypeEnabled || !reviewJourneyArrived || sharedJourneyWorldTravel || !currentSharedJourneyWorldId) return;
    startTravelToTarget(placeholderTravelTarget, destinationAnchor.clone(), getZoomBounds().home);
  };
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const compact = width <= 700;
    const pixelRatioCap = softwareRenderer ? (compact ? 0.88 : 0.82) : compact ? 1.25 : 1.55;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = compact ? 52 : 47;
    camera.updateProjectionMatrix();
    const halfHorizontalFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const visibleSceneWidth = 2 * getZoomBounds().home * Math.tan(halfHorizontalFov);
    photoStreamHorizontalScale = THREE.MathUtils.clamp(visibleSceneWidth / (2 * PHOTO_BAND_OUTER_RADIUS) * 0.94, 1, 2.2);
    orbitBand.scale.x = photoStreamHorizontalScale;
    canvas.dataset.photoStreamHorizontalScale = photoStreamHorizontalScale.toFixed(3);
    if (manualCamera) targetOrbit.radius = clampRadius(targetOrbit.radius);
  };
  const intersect = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(photoRaycastTargets, false)[0];
  };
  const intersectSharedJourneyWorld = (event: PointerEvent) => {
    if (!sharedJourneyWorldRaycastTargets.length) return undefined;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(sharedJourneyWorldRaycastTargets, false)[0];
  };
  const updatePreviewDragPoint = (clientX: number, clientY: number) => {
    if (!reviewMotionPrototypeEnabled) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const worldPoint = raycaster.ray.intersectPlane(previewDragPlane, previewDragWorldPoint);
    if (worldPoint) dragRippleCenter.value.set(worldPoint.x, worldPoint.y);
  };
  const beginManualCamera = () => {
    if (manualCamera) return;
    if (reviewSharedJourneyPrototypeEnabled && journeyStarted && cinematicProgress < 1) {
      if (!journeyLookActive) {
        journeyLookActive = true;
        currentOrbit.setFromVector3(camera.position.clone().sub(orbitCenter));
        targetOrbit.copy(currentOrbit);
      }
      return;
    }
    journeyLookActive = false;
    manualCamera = true;
    currentOrbit.setFromVector3(camera.position.clone().sub(orbitCenter));
    takeoverQuaternion.copy(camera.quaternion);
    takeoverElapsed = 0;
    targetOrbit.copy(currentOrbit);
    targetOrbit.phi = clampPhi(targetOrbit.phi);
    targetOrbit.radius = clampRadius(targetOrbit.radius);
  };
  const pointerDistance = () => {
    const [first, second] = [...pointerPositions.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (pointerPositions.size >= 2) return;
    if (pointerPositions.size === 0) {
      dragged = false;
      gestureMode = "none";
      if (reviewMotionPrototypeEnabled) {
        previewDragGestureOrigin.set(event.clientX, event.clientY);
        updatePreviewDragPoint(event.clientX, event.clientY);
      }
    }
    const point = { x: event.clientX, y: event.clientY };
    pointerPositions.set(event.pointerId, point);
    pointerOrigins.set(event.pointerId, point);
    canvas.focus({ preventScroll: true });
    if (pointerPositions.size === 2) {
      gestureMode = "pinch";
      dragged = true;
      pinchStartDistance = pinchDistance = pointerDistance();
      ignoreClickUntil = performance.now() + 500;
    }
    try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer capture can be unavailable in embedded previews */ }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (pointerPositions.has(event.pointerId)) {
      const previous = pointerPositions.get(event.pointerId)!;
      const next = { x: event.clientX, y: event.clientY };
      pointerPositions.set(event.pointerId, next);
      if (pointerPositions.size > 1) {
        const nextDistance = pointerDistance();
        if (!manualCamera && Math.abs(nextDistance - pinchStartDistance) > 4) beginManualCamera();
        if (manualCamera && pinchDistance > 0 && nextDistance > 0) {
          targetOrbit.radius = clampRadius(targetOrbit.radius * pinchDistance / nextDistance);
        }
        dragged = true;
        pinchDistance = nextDistance;
      } else {
        const origin = pointerOrigins.get(event.pointerId) ?? next;
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        if (gestureMode !== "orbit" && Math.hypot(next.x - origin.x, next.y - origin.y) > 5) {
          beginManualCamera();
          gestureMode = "orbit";
          dragged = true;
        }
        if (gestureMode === "orbit" && (dx !== 0 || dy !== 0)) {
          const rotationPerPixel = 2 / gestureDimension();
          targetOrbit.theta -= dx * rotationPerPixel;
          targetOrbit.phi = clampPhi(targetOrbit.phi + dy * rotationPerPixel);
        }
        if (reviewMotionPrototypeEnabled && gestureMode === "orbit") {
          const rect = canvas.getBoundingClientRect();
          const progressX = (next.x - previewDragGestureOrigin.x) / Math.max(1, rect.width);
          const progressY = (next.y - previewDragGestureOrigin.y) / Math.max(1, rect.height);
          previewDragTargetOffset.set(
            THREE.MathUtils.clamp(progressX * 8.5, -4.8, 4.8),
            THREE.MathUtils.clamp(-progressY * 5.5, -3.3, 3.3),
            0,
          );
          updatePreviewDragPoint(next.x, next.y);
          dragRippleTargetStrength.value = THREE.MathUtils.clamp(0.22 + Math.hypot(dx, dy) / 25, 0.3, 1);
          previewDragActive = true;
        }
      }
      canvas.style.cursor = dragged ? "grabbing" : "grab";
      wakeRenderer();
      return;
    }
    if (event.pointerType !== "mouse") return;
    const hit = intersect(event);
    const worldHit = reviewSharedJourneyPrototypeEnabled && reviewJourneyArrived ? intersectSharedJourneyWorld(event) : undefined;
    canvas.style.cursor = hit || worldHit ? "pointer" : "grab";
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!pointerPositions.has(event.pointerId)) return;
    pointerPositions.delete(event.pointerId);
    pointerOrigins.delete(event.pointerId);
    pinchDistance = pinchStartDistance = 0;
    gestureMode = "none";
    // Rebase the surviving finger after a pinch; never turn it into an orbit jump.
    for (const [id, point] of pointerPositions) pointerOrigins.set(id, { ...point });
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* already released by the browser */ }
    if (pointerPositions.size === 0) {
      previewDragActive = false;
      previewDragTargetOffset.set(0, 0, 0);
      dragRippleTargetStrength.value = 0;
      if (dragged) ignoreClickUntil = performance.now() + 450;
      dragged = false;
      canvas.style.cursor = "grab";
    }
  };
  const clearPointers = () => {
    for (const id of pointerPositions.keys()) {
      try { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } catch { /* browser already released capture */ }
    }
    if (pointerPositions.size || dragged) ignoreClickUntil = performance.now() + 500;
    pointerPositions.clear();
    pointerOrigins.clear();
    pinchDistance = pinchStartDistance = 0;
    gestureMode = "none";
    dragged = false;
    previewDragActive = false;
    previewDragTargetOffset.set(0, 0, 0);
    dragRippleTargetStrength.value = 0;
    canvas.style.cursor = "grab";
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    beginManualCamera();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    targetOrbit.radius = clampRadius(targetOrbit.radius * Math.exp(THREE.MathUtils.clamp(pixels, -120, 120) / gestureDimension() * 1.05));
    wakeRenderer();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = 0.12;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"].includes(event.key)) return;
    event.preventDefault();
    beginManualCamera();
    if (event.key === "ArrowLeft") targetOrbit.theta += step;
    if (event.key === "ArrowRight") targetOrbit.theta -= step;
    if (event.key === "ArrowUp") targetOrbit.phi = clampPhi(targetOrbit.phi - step);
    if (event.key === "ArrowDown") targetOrbit.phi = clampPhi(targetOrbit.phi + step);
    if (event.key === "+" || event.key === "=") targetOrbit.radius = clampRadius(targetOrbit.radius * 0.88);
    if (event.key === "-") targetOrbit.radius = clampRadius(targetOrbit.radius / 0.88);
    wakeRenderer();
  };
  const onClick = (event: PointerEvent) => {
    if (pointerPositions.size || performance.now() < ignoreClickUntil) return;
    if (reviewSharedJourneyPrototypeEnabled && reviewJourneyArrived && !sharedJourneyWorldTravel) {
      const worldHit = intersectSharedJourneyWorld(event);
      const worldId = worldHit?.object.userData.sharedJourneyWorldId;
      if (typeof worldId === "string") {
        travelToWorld(worldId);
        return;
      }
    }
    const hit = intersect(event);
    if (!hit || hit.instanceId === undefined) return;
    const memoryIds = hit.object.userData.memoryIds as number[] | undefined;
    const memoryId = memoryIds?.[hit.instanceId];
    if (memoryId !== undefined) selectMemory(memoryId);
  };
  const onVisibility = () => {
    if (contextLost) return;
    if (document.visibilityState === "hidden" && frameId) {
      clearPointers();
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    } else wakeRenderer();
  };
  const onResize = () => { resize(); wakeRenderer(); };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    reportRenderer(false);
  };
  const onContextRestored = () => {
    if (isDisposed) return;
    contextLost = false;
    reportRenderer(true);
    wakeRenderer();
  };
  const onMotionPreferenceChange = () => wakeRenderer();
  canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerup", onPointerUp, { passive: true });
  canvas.addEventListener("pointercancel", clearPointers, { passive: true });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("blur", clearPointers);
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onMotionPreferenceChange);
  resize();
  frameId = window.requestAnimationFrame(render);

  return {
    startJourney: () => {
      if (journeyStarted || isDisposed) return;
      journeyStarted = true;
      cinematicElapsed = 0;
      lastTick = performance.now();
      canvas.dataset.journeyStarted = "true";
      wakeRenderer();
    },
    travelToWorld,
    returnToHome,
    dispose: () => {
      isDisposed = true;
      if (worldTooltipElement) worldTooltipElement.hidden = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", clearPointers);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", clearPointers);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      sceneResources.forEach(resource => resource.dispose());
      renderer.dispose();
    },
  };
}

export default function LoveGalaxyExperience({ story, onBack }: LoveGalaxyExperienceProps = {}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sharedWorldTooltip = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioAnalyser = useRef<AnalyserNode | null>(null);
  const audioSpectrum = useRef(new Uint8Array(0));
  const mountedScene = useRef<MountedScene | null>(null);
  const [cameraStop, setCameraStop] = useState<CameraStop>("sphere");
  const [activeMemory, setActiveMemory] = useState<number | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState(false);
  const [sharedJourneyArrived, setSharedJourneyArrived] = useState(false);
  const [sharedJourneyWorldStatus, setSharedJourneyWorldStatus] = useState<{ label: string; phase: "traveling" | "arrived" } | null>(null);
  const sharedJourneyQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const reviewSharedJourneyPrototypeEnabled = import.meta.env.VITE_LOVE_GALAXY_SHARED_JOURNEY === "true"
    && sharedJourneyQuery?.get("review") === "shared-journey";
  const rawSampleNumber = sharedJourneyQuery?.get("sample");
  const reviewSampleId = normalizeSharedJourneySampleId(rawSampleNumber === "2" ? "demo-share-2" : rawSampleNumber === "3" ? "demo-share-3" : "demo-share-1");
  const reviewMotionPrototypeEnabled = import.meta.env.VITE_LOVE_GALAXY_REVIEW_MOTION === "true"
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("review") === "motion";
  const images = story?.photos?.length === 4 ? story.photos : DEMO_IMAGES;
  const ringPhrases: readonly [string, string] = [story?.ringTextOne?.trim() || DEFAULT_RING_TEXT_ONE, story?.ringTextTwo?.trim() || DEFAULT_RING_TEXT_TWO];
  const musicSource = story?.musicSrc || backgroundMusic;
  const memories = images === DEMO_IMAGES ? MEMORIES : Array.from({ length: MEMORY_COUNT }, (_, id) => ({ id, ...images[id % images.length] }));

  const readMusicLevel = useCallback(() => {
    const audio = music.current;
    const analyser = audioAnalyser.current;
    const spectrum = audioSpectrum.current;
    if (!audio || audio.paused || !analyser || spectrum.length < 4) return 0;
    analyser.getByteFrequencyData(spectrum);
    const firstBin = 2;
    const lastBin = Math.min(24, spectrum.length);
    let total = 0;
    for (let index = firstBin; index < lastBin; index += 1) total += spectrum[index];
    return lastBin > firstBin ? Math.min(1, (total / ((lastBin - firstBin) * 255)) * 3.2) : 0;
  }, []);

  const reportSharedJourneyWorldStatus = useCallback((label: string, phase: "traveling" | "arrived") => {
    setSharedJourneyWorldStatus({ label, phase });
  }, []);

  const connectMusicAnalyser = useCallback((audio: HTMLAudioElement) => {
    if (audioAnalyser.current) return;
    let context: AudioContext | null = null;
    try {
      const sourceUrl = new URL(audio.currentSrc || audio.src, window.location.href);
      if (sourceUrl.protocol !== "blob:" && sourceUrl.protocol !== "data:" && sourceUrl.origin !== window.location.origin) return;
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.88;
      context.createMediaElementSource(audio).connect(analyser);
      analyser.connect(context.destination);
      audioContext.current = context;
      audioAnalyser.current = analyser;
      audioSpectrum.current = new Uint8Array(analyser.frequencyBinCount);
      void context.resume().catch(() => {});
    } catch {
      audioAnalyser.current = null;
      audioSpectrum.current = new Uint8Array(0);
      if (context && context.state !== "closed") void context.close().catch(() => {});
    }
  }, []);

  useEffect(() => () => {
    const context = audioContext.current;
    audioContext.current = null;
    audioAnalyser.current = null;
    audioSpectrum.current = new Uint8Array(0);
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = story?.title ? `${story.title} · Love Galaxy` : "Love Galaxy · 3D Memory Universe";
    return () => { document.title = previousTitle; };
  }, [story?.title]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    try {
      const mounted = mountGalaxy(node, images, ringPhrases, setActiveMemory, ready => {
        setRendererReady(ready);
        setRendererFailed(!ready);
      }, setCameraStop, readMusicLevel, reviewMotionPrototypeEnabled, reviewSharedJourneyPrototypeEnabled, reviewSampleId, () => setSharedJourneyArrived(true), sharedWorldTooltip.current, reportSharedJourneyWorldStatus);
      mountedScene.current = mounted;
      return () => { mountedScene.current = null; mounted.dispose(); };
    } catch {
      setRendererFailed(true);
      return undefined;
    }
  }, [images, ringPhrases[0], ringPhrases[1], readMusicLevel, reviewMotionPrototypeEnabled, reviewSharedJourneyPrototypeEnabled, reviewSampleId, reportSharedJourneyWorldStatus]);

  useEffect(() => {
    const node = dialog.current;
    if (activeMemory === null || !node) return;
    if (!node.open) node.showModal();
  }, [activeMemory]);

  const active = activeMemory === null ? null : memories[activeMemory];
  const closeMemory = () => { dialog.current?.close(); setActiveMemory(null); };
  const moveMemory = (direction: number) => {
    if (activeMemory === null) return;
    setActiveMemory((activeMemory + direction + MEMORY_COUNT) % MEMORY_COUNT);
  };
  const enterGalaxy = () => {
    const audio = music.current;
    const mounted = mountedScene.current;
    if (!rendererReady || journeyStarted || entering || !audio || !mounted) return;
    setEntering(true);
    setEntryError(false);
    // Request audio inside this tap, then launch the camera when playback begins.
    connectMusicAnalyser(audio);
    const playback = audio.play();
    void playback.then(() => {
      mounted.startJourney();
      setJourneyStarted(true);
      setEntering(false);
    }).catch(() => {
      setMusicEnabled(false);
      setEntering(false);
      setEntryError(true);
    });
  };
  const toggleMusic = () => {
    const audio = music.current;
    if (!audio) return;
    if (audio.paused) {
      const playback = audio.play();
      void playback.catch(() => setMusicEnabled(false));
    } else {
      audio.pause();
    }
  };
  return <main
    className={`lg-experience${rendererReady ? " lg-renderer-ready" : ""}${rendererFailed ? " lg-renderer-failed" : ""}`}
    data-experience="love-galaxy"
    data-renderer="three.js"
    data-memory-count={MEMORY_COUNT}
    data-photo-orbit-count="1"
    data-photo-orbit-shape="single-wide-band"
    data-curved-text-rings="2"
    data-camera-stop={cameraStop}
    data-journey-started={journeyStarted}
    data-motion-prototype={reviewMotionPrototypeEnabled ? "enabled" : "disabled"}
    data-shared-journey-review={reviewSharedJourneyPrototypeEnabled ? "enabled" : "disabled"}
    data-shared-journey-sample={reviewSharedJourneyPrototypeEnabled ? reviewSampleId : "none"}
  >
    <audio ref={music} src={musicSource} loop preload="auto" onPlay={() => setMusicEnabled(true)} onPause={() => setMusicEnabled(false)} aria-hidden="true" />
    <div className="lg-three-stage" aria-label="Interactive full-screen Three.js 3D galaxy">
      <canvas ref={canvas} className="lg-three-canvas" tabIndex={journeyStarted ? 0 : -1} onKeyDown={event => { if (journeyStarted && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setActiveMemory(0); } }} aria-label="Memory galaxy. Drag to orbit; pinch or scroll to zoom. Click a photo or press Enter to view it. Arrow keys orbit; plus and minus zoom." />
      <div className="lg-stage-vignette" aria-hidden="true" />
      {reviewSharedJourneyPrototypeEnabled && <button
        ref={sharedWorldTooltip}
        className="lg-shared-world-tooltip"
        type="button"
        hidden
        aria-label="Fictional test world in view. Tap to travel there."
        onClick={() => {
          const worldId = sharedWorldTooltip.current?.dataset.worldId;
          if (worldId) mountedScene.current?.travelToWorld(worldId);
        }}
      >
        <span className="lg-shared-world-tooltip-eyebrow">IN VIEW · FICTIONAL TEST WORLD</span>
        <strong className="lg-shared-world-tooltip-label">TEST WORLD</strong>
        <small>Tap to travel here</small>
      </button>}
      {reviewSharedJourneyPrototypeEnabled && sharedJourneyWorldStatus?.phase === "arrived" && sharedJourneyWorldStatus.label.startsWith("TEST WORLD ") && <button
        className="lg-return-home-button"
        type="button"
        data-shared-return-home="true"
        aria-label="Return to my planet"
        onClick={() => mountedScene.current?.returnToHome()}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        <span>Return to my planet</span>
      </button>}
      {rendererFailed && <div className="lg-renderer-message" role="status">3D scene could not start in this browser. Try enabling WebGL.</div>}
    </div>

    {!journeyStarted && !reviewSharedJourneyPrototypeEnabled && <a className="lg-create-link" href="/love-galaxy/create">Create your own Love Galaxy <ArrowRight size={14}/></a>}
    {!journeyStarted && !rendererFailed && <div className={`lg-entry-overlay${reviewSharedJourneyPrototypeEnabled ? " lg-entry-overlay-shared-journey" : ""}`}>
      {reviewSharedJourneyPrototypeEnabled && <aside className="lg-shared-journey-intro">
        <span>SHARED GALAXY · FICTIONAL TEST RUN</span>
        <strong>20 test planets, one placeholder destination.</strong>
        <p>All worlds are fictional test fixtures, not real creators. Their 3D arrangement changes on each visit and stays fixed during this 14-second journey.</p>
        <small>20 handcrafted test worlds · no real creator content or links are loaded</small>
      </aside>}
      <button className="lg-entry-button" type="button" disabled={!rendererReady || entering} aria-busy={!rendererReady || entering} onClick={enterGalaxy}>
        {reviewSharedJourneyPrototypeEnabled ? (rendererReady ? "BEGIN SHARED JOURNEY" : "PREPARE GALAXY") : rendererReady ? "ENTER GALAXY" : "PREPARE GALAXY"}
      </button>
      {entryError && <p className="lg-entry-error" role="alert">Music could not start. Tap {reviewSharedJourneyPrototypeEnabled ? "BEGIN SHARED JOURNEY" : "ENTER GALAXY"} to retry.</p>}
    </div>}

    {onBack && <button className="lg-back-button" type="button" onClick={onBack} aria-label="Back to Love Galaxy creation"><ArrowLeft size={17}/><span>Back</span></button>}

    {journeyStarted && <header className="lg-hud-top">
      {reviewSharedJourneyPrototypeEnabled && <div className="lg-shared-journey-status" role="status" aria-live="polite">
        <span>FICTIONAL TEST RUN · {reviewSampleId.toUpperCase()}</span>
        <strong>{sharedJourneyWorldStatus?.phase === "traveling"
          ? `TRAVELLING TO ${sharedJourneyWorldStatus.label}`
          : sharedJourneyWorldStatus
            ? `ARRIVED AT ${sharedJourneyWorldStatus.label}`
            : sharedJourneyArrived ? "ARRIVED AT PLACEHOLDER DESTINATION" : `PASSING ${SHARED_JOURNEY_WORLD_COUNT} FICTIONAL TEST WORLDS`}</strong>
      </div>}
      <div className="lg-hud-actions">
        <button className="lg-music-toggle" type="button" aria-label={musicEnabled ? "Pause background music" : "Play background music"} aria-pressed={musicEnabled} onClick={toggleMusic}>
          {musicEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>
    </header>}

    <dialog ref={dialog} className="lg-photo-dialog" aria-label="Memory photo" onClose={() => setActiveMemory(null)} onClick={event => { if (event.target === event.currentTarget) closeMemory(); }}>
      {active && <>
        <header><button type="button" onClick={closeMemory} aria-label="Close memory"><X size={19} /></button></header>
        <figure><img src={active.src} alt={active.alt} /></figure>
        <div className="lg-photo-controls"><button type="button" onClick={() => moveMemory(-1)} aria-label="Previous memory"><ArrowLeft size={17} /></button><button type="button" onClick={() => moveMemory(1)} aria-label="Next memory"><ArrowRight size={17} /></button></div>
      </>}
    </dialog>
  </main>;
}
