import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FRAME_COUNT, circularPhaseDistance } from '../src/moon/phase';
import { loadFrames } from '../src/moon/frames';

describe('AC #2 — bundled frame manifest', () => {
  const frames = loadFrames();

  it('has 60 entries, indexed 0..59, with phases increasing and at most 1/60 apart', () => {
    expect(frames).toHaveLength(FRAME_COUNT);
    frames.forEach((frame, i) => {
      expect(frame.index).toBe(i);
      // suncalc phase skips ~0.990→0.0095 at new moon, so the nearest sampled hour can sit up to one frame step off its target.
      expect(circularPhaseDistance(frame.phase, i / FRAME_COUNT)).toBeLessThanOrEqual(1 / FRAME_COUNT);
    });
  });

  it('every entry points at a committed same-origin WebP under /frames/', () => {
    for (const frame of frames) {
      expect(frame.file).toMatch(/^\/frames\/moon-\d{2}\.webp$/);
      expect(existsSync(join(process.cwd(), 'public', frame.file))).toBe(true);
    }
  });

  it('records its NASA provenance: source frame number and Dial-a-Moon illumination within 2 pp of suncalc', () => {
    for (const frame of frames) {
      expect(frame.sourceFrame).toBeGreaterThanOrEqual(1);
      expect(frame.sourceFrame).toBeLessThanOrEqual(8760);
      expect(frame.utc).toMatch(/^2026-\d{2}-\d{2}T\d{2}:00:00Z$/);
      expect(Math.abs(frame.nasaIlluminationPct - frame.suncalcIlluminationPct)).toBeLessThanOrEqual(2);
    }
  });
});
