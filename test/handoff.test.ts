import { describe, it, expect } from 'vitest';
import { handOffLine, HIGH_UP_ALTITUDE_DEG } from '../src/moon/handoff';
import {
  HANDOFF_DIRECTION_WORDS_BG,
  HANDOFF_HIDDEN_BG,
  HANDOFF_NO_LOCATION_BG,
  HANDOFF_VISIBLE_PREFIX_BG,
} from '../src/audio/greeting';

const SOFIA = { lat: 42.7, lon: 23.32 };

describe('handOffLine (TKT-0003)', () => {
  it('AC #5 — no location: the generic line, no direction word', () => {
    expect(handOffLine(new Date(), null)).toBe(HANDOFF_NO_LOCATION_BG);
  });

  it('AC #4 — altitude <= 0: the hidden line (verified: well before Sofia moonrise on 2026-09-16)', () => {
    const line = handOffLine(new Date('2026-09-16T04:00:00Z'), SOFIA);
    expect(line).toBe(HANDOFF_HIDDEN_BG);
  });

  it('AC #3 — 0 < altitude <= 60: the visible line plus the correct compass word (verified: south-east)', () => {
    const line = handOffLine(new Date('2026-09-16T10:06:59Z'), SOFIA);
    expect(line).toBe(`${HANDOFF_VISIBLE_PREFIX_BG}, ${HANDOFF_DIRECTION_WORDS_BG['south-east']}.`);
  });

  it(`AC #3 — altitude > ${HIGH_UP_ALTITUDE_DEG}: "high up" regardless of azimuth (verified: alt ~65.5deg)`, () => {
    const line = handOffLine(new Date('2026-01-14T07:00:00Z'), { lat: -50, lon: 23.32 });
    expect(line).toBe(`${HANDOFF_VISIBLE_PREFIX_BG}, ${HANDOFF_DIRECTION_WORDS_BG.high}.`);
  });
});
