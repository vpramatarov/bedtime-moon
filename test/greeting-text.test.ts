import { describe, it, expect } from 'vitest';
import {
  GREETING_BG,
  GREETING_FALLBACK_URL,
  HANDOFF_DIRECTION_WORDS_BG,
  HANDOFF_HIDDEN_BG,
  HANDOFF_NO_LOCATION_BG,
  HANDOFF_VISIBLE_PREFIX_BG,
  LULLABY_URL,
} from '../src/audio/greeting';

const CYRILLIC = /^[Ѐ-ӿ\s!,.?…„“"'-]+$/;

describe('spoken lines and asset slots', () => {
  it('TKT-0001 AC #7 — the greeting line is Bulgarian and short', () => {
    expect(GREETING_BG.length).toBeLessThanOrEqual(40);
    expect(GREETING_BG).toMatch(CYRILLIC);
  });

  it('asset slots are null or same-origin paths, never cross-origin URLs (AC #3 no network)', () => {
    for (const url of [GREETING_FALLBACK_URL, LULLABY_URL]) {
      if (url !== null) expect(url).toMatch(/^\/audio\/[\w.-]+$/);
    }
  });

  it('TKT-0003 AC #3/#4 — every hand-off variant is Bulgarian and short enough to finish well inside 8 s', () => {
    for (const word of Object.values(HANDOFF_DIRECTION_WORDS_BG)) {
      const line = `${HANDOFF_VISIBLE_PREFIX_BG}, ${word}.`;
      expect(line.length).toBeLessThanOrEqual(70);
      expect(line).toMatch(CYRILLIC);
    }
    expect(HANDOFF_HIDDEN_BG.length).toBeLessThanOrEqual(70);
    expect(HANDOFF_HIDDEN_BG).toMatch(CYRILLIC);
  });

  it('TKT-0003 AC #5 — the no-location line is Bulgarian and short, with no direction word', () => {
    expect(HANDOFF_NO_LOCATION_BG.length).toBeLessThanOrEqual(40);
    expect(HANDOFF_NO_LOCATION_BG).toMatch(CYRILLIC);
    for (const word of Object.values(HANDOFF_DIRECTION_WORDS_BG)) {
      expect(HANDOFF_NO_LOCATION_BG).not.toContain(word);
    }
  });
});
