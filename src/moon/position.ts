/**
 * Moon horizontal position (altitude/azimuth) and its 8-point compass word (TKT-0003 AC #2, #3).
 *
 * Capability check (not assumed from training data — verified against this installed suncalc
 * 2.0.2's source, its own bundled index.d.ts, and cross-checked against a Skyfield oracle):
 * `getMoonPosition` returns `altitude`/`azimuth` already in DEGREES, standard compass convention
 * (0 = north, 90 = east, 180 = south, 270 = west, clockwise) — not radians measured from south,
 * which is how older suncalc documentation describes earlier major versions.
 */
import { getMoonPosition } from 'suncalc';

export const COMPASS_DIRECTIONS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number];

export interface MoonPositionResult {
  /** Degrees above the horizon; negative when below it. */
  altitude: number;
  /** Degrees clockwise from north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuth: number;
}

const DIRECTION_CENTERS_DEG: Record<CompassDirection, number> = {
  north: 0,
  'north-east': 45,
  east: 90,
  'south-east': 135,
  south: 180,
  'south-west': 225,
  west: 270,
  'north-west': 315,
};

/** Shortest distance between two compass bearings, degrees, always in [0, 180]. */
function circularDegreeDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
}

export function moonPosition(date: Date, lat: number, lon: number): MoonPositionResult {
  const { altitude, azimuth } = getMoonPosition(date, lat, lon);
  return { altitude, azimuth };
}

/** Nearest of the 8 compass points to `azimuthDeg`, full circle, no dead zone. */
export function directionWord(azimuthDeg: number): CompassDirection {
  let best: CompassDirection = 'north';
  let bestDist = Infinity;
  for (const direction of COMPASS_DIRECTIONS) {
    const dist = circularDegreeDistance(azimuthDeg, DIRECTION_CENTERS_DEG[direction]);
    if (dist < bestDist) {
      bestDist = dist;
      best = direction;
    }
  }
  return best;
}
