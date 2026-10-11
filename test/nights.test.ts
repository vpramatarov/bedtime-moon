import { describe, it, expect } from 'vitest';
import { getMoonIllumination } from 'suncalc';
import { loadFrames } from '../src/moon/frames';
import { nearestFrame } from '../src/moon/phase';
import { NIGHT_HOUR_LOCAL, NIGHT_WINDOW, TOTAL_NIGHTS, nightsAround } from '../src/moon/nights';

const frames = loadFrames();
const NOW = new Date('2026-09-16T15:00:00Z');

describe('AC #2 — 15 nights, tonight +/- 7, each the nearest bundled frame at 21:00 local', () => {
  it('has exactly 15 entries with offsets -7..7 in order', () => {
    const nights = nightsAround(NOW, frames);
    expect(nights).toHaveLength(TOTAL_NIGHTS);
    expect(nights.map((n) => n.offset)).toEqual(
      Array.from({ length: TOTAL_NIGHTS }, (_, i) => i - NIGHT_WINDOW),
    );
  });

  it('each night is the frame nearest to that calendar day at 21:00 local time', () => {
    const nights = nightsAround(NOW, frames);
    for (const night of nights) {
      const local = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + night.offset, NIGHT_HOUR_LOCAL, 0, 0, 0);
      const expected = nearestFrame(getMoonIllumination(local).phase, frames);
      expect(night.frame.file).toBe(expected.file);
    }
  });

  it("offset 0 is tonight, offset -7/+7 are the window edges", () => {
    const nights = nightsAround(NOW, frames);
    expect(nights[NIGHT_WINDOW]!.offset).toBe(0);
    expect(nights[0]!.offset).toBe(-NIGHT_WINDOW);
    expect(nights[nights.length - 1]!.offset).toBe(NIGHT_WINDOW);
  });

  it('phases advance smoothly across adjacent nights (no gaps > 3 steps)', () => {
    // Ceiling is 3, not 2: 60 frames / ~29.53-day synodic month is an average of ~2.03
    // frame-steps/night, already above 2, so a calendar-day sample of the true nearest frame
    // will occasionally round to a 3-step gap (see TEST CHANGE REQUEST, 2026-09-19). 4+ would
    // mean a frame was skipped outright and is still a bug.
    const nights = nightsAround(NOW, frames);
    for (let i = 1; i < nights.length; i++) {
      const prevIndex = nights[i - 1]!.frame.index;
      const currIndex = nights[i]!.frame.index;
      const rawDelta = Math.abs(currIndex - prevIndex);
      const wrapped = Math.min(rawDelta, 60 - rawDelta);
      expect(wrapped).toBeLessThanOrEqual(3);
    }
  });
});
