const GALAXY_NAME_SUFFIX_SPACE = 36 ** 5;

function randomUint32(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0x1_0000_0000);
}

export function createGalaxyPlanetName(randomValue: number = randomUint32()): string {
  const suffix = (randomValue >>> 0) % GALAXY_NAME_SUFFIX_SPACE;
  return `Planet #${suffix.toString(36).padStart(5, '0')}`;
}
