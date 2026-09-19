import type { MoonFrame } from './frames';

/** Number of bundled frames: one per 1/60 of the synodic month. */
export const FRAME_COUNT = 60;

/** Normalise any real number onto the [0, 1) phase circle. */
function wrapPhase(phase: number): number {
  return ((phase % 1) + 1) % 1;
}

/** Shortest distance between two phases on the 0..1 circle (0 = new, 0.5 = full). */
export function circularPhaseDistance(a: number, b: number): number {
  const d = wrapPhase(a - b);
  return Math.min(d, 1 - d);
}

/** Frame index for a phase when frames are evenly spaced at k/count; wraps 0.999 → 0. */
export function frameIndexForPhase(phase: number, count: number = FRAME_COUNT): number {
  return Math.round(wrapPhase(phase) * count) % count;
}

/** The manifest entry whose recorded phase is nearest to `phase`. */
export function nearestFrame(phase: number, frames: readonly MoonFrame[]): MoonFrame {
  const first = frames[0];
  if (!first) throw new Error('frame manifest is empty');
  let best = first;
  let bestDist = circularPhaseDistance(phase, first.phase);
  for (const frame of frames) {
    const dist = circularPhaseDistance(phase, frame.phase);
    if (dist < bestDist) {
      best = frame;
      bestDist = dist;
    }
  }
  return best;
}
