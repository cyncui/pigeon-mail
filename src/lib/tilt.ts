export const MAX_TILT = 2;

/**
 * Stable pseudo-random tilt (degrees) in [-MAX_TILT, MAX_TILT] derived from a seed.
 * Uses FNV-1a + an avalanche step so even short, sequential ids ("1", "2", …)
 * spread out in both magnitude and direction instead of clustering.
 */
export function tiltFromSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h >>>= 0;
  return (h / 0xffffffff) * (MAX_TILT * 2) - MAX_TILT;
}

/** Fresh random tilt (degrees) in [-MAX_TILT, MAX_TILT]. */
export function randomTilt(): number {
  return Math.random() * (MAX_TILT * 2) - MAX_TILT;
}
