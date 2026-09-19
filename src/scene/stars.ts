/**
 * Deterministic star field — same sky every night, no runtime randomness.
 * ≤ 30 elements (RES-0001 R11.5); the moon's area is kept clear so nothing shows
 * through the photo's dark limb under mix-blend-mode: screen.
 */

export interface Star {
  /** Percent of scene width. */
  x: number;
  /** Percent of scene height. */
  y: number;
  /** CSS pixels. */
  size: number;
  /** Twinkle period, seconds (6–12 s → calm, RES-0001 R11.6). */
  duration: number;
  /** Twinkle phase offset, seconds. */
  delay: number;
}

export const STAR_COUNT = 24;

/** mulberry32 — tiny seeded PRNG, good enough for star positions. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True when a point falls inside the moon's clear zone (centre 50 %, 46 %). */
function overlapsMoon(x: number, y: number): boolean {
  return Math.abs(x - 50) < 32 && Math.abs(y - 46) < 26;
}

export function starField(count: number = STAR_COUNT, seed = 20260915): Star[] {
  const rand = seeded(seed);
  const stars: Star[] = [];
  let guard = 0;
  while (stars.length < count && guard++ < count * 20) {
    const x = 3 + rand() * 94;
    const y = 3 + rand() * 94;
    if (overlapsMoon(x, y)) continue;
    stars.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      size: Math.round((1.5 + rand() * 2) * 10) / 10,
      duration: Math.round((6 + rand() * 6) * 10) / 10,
      delay: Math.round(-rand() * 12 * 10) / 10,
    });
  }
  return stars;
}
