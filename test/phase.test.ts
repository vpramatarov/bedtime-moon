import { describe, it, expect } from 'vitest';
import { getMoonIllumination } from 'suncalc';
import {
  FRAME_COUNT,
  circularPhaseDistance,
  frameIndexForPhase,
  nearestFrame,
} from '../src/moon/phase';
import { loadFrames } from '../src/moon/frames';
import oracle from './fixtures/moon-phase.skyfield.json';

const frames = loadFrames();

describe("AC #2 — tonight's moon is the bundled frame nearest the suncalc phase", () => {
  it('every night of 2026–2027 at 21:00 local maps to a frame within 1/60 of suncalc phase', () => {
    const start = new Date(2026, 0, 1, 21, 0, 0);
    for (let day = 0; day < 730; day++) {
      const night = new Date(start.getTime() + day * 86_400_000);
      const phase = getMoonIllumination(night).phase;
      const frame = nearestFrame(phase, frames);
      expect(circularPhaseDistance(phase, frame.phase)).toBeLessThanOrEqual(1 / FRAME_COUNT);
    }
  });

  it('frame chosen from suncalc phase is within ±1 of the frame chosen from the Skyfield oracle phase (40 cases)', () => {
    expect(oracle.cases).toHaveLength(40);
    for (const c of oracle.cases) {
      const fromSuncalc = frameIndexForPhase(getMoonIllumination(new Date(c.utc)).phase);
      const fromOracle = frameIndexForPhase(c.phaseDeg / 360);
      const apart = Math.abs(fromSuncalc - fromOracle);
      expect(Math.min(apart, FRAME_COUNT - apart)).toBeLessThanOrEqual(1);
    }
  });

  it('suncalc phase stays within 3° of the Skyfield oracle on every fixture case', () => {
    for (const c of oracle.cases) {
      const suncalcDeg = getMoonIllumination(new Date(c.utc)).phase * 360;
      expect(circularPhaseDistance(suncalcDeg / 360, c.phaseDeg / 360) * 360).toBeLessThanOrEqual(3);
    }
  });

  it('frameIndexForPhase wraps: phase just below 1 is frame 0, quarters land on 15/30/45', () => {
    expect(frameIndexForPhase(0)).toBe(0);
    expect(frameIndexForPhase(0.999)).toBe(0);
    expect(frameIndexForPhase(0.25)).toBe(15);
    expect(frameIndexForPhase(0.5)).toBe(30);
    expect(frameIndexForPhase(0.75)).toBe(45);
  });

  it('circularPhaseDistance measures the short way round the phase circle', () => {
    expect(circularPhaseDistance(0.98, 0.02)).toBeCloseTo(0.04, 10);
    expect(circularPhaseDistance(0.4, 0.6)).toBeCloseTo(0.2, 10);
    expect(circularPhaseDistance(0.3, 0.3)).toBe(0);
  });
});
