import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { directionWord, moonPosition } from '../src/moon/position';

interface OracleCase {
  utc: string;
  lat: number;
  lon: number;
  altitudeDeg: number;
  azimuthDeg: number;
  up: boolean;
  direction: string | null;
}

const fixture: { cases: OracleCase[] } = JSON.parse(readFileSync('test/fixtures/moon-position.skyfield.json', 'utf8'));

describe('directionWord — 8-point compass, full circle', () => {
  it('exact cardinal/intercardinal azimuths map to themselves', () => {
    expect(directionWord(0)).toBe('north');
    expect(directionWord(45)).toBe('north-east');
    expect(directionWord(90)).toBe('east');
    expect(directionWord(135)).toBe('south-east');
    expect(directionWord(180)).toBe('south');
    expect(directionWord(225)).toBe('south-west');
    expect(directionWord(270)).toBe('west');
    expect(directionWord(315)).toBe('north-west');
  });

  it('wraps cleanly across the 0/360 seam', () => {
    expect(directionWord(359)).toBe('north');
    expect(directionWord(361 % 360)).toBe('north');
    expect(directionWord(-1 + 360)).toBe('north');
  });

  it('nearest-match: a point just past a bucket boundary flips to the next bucket', () => {
    expect(directionWord(22.4)).toBe('north');
    expect(directionWord(22.6)).toBe('north-east');
  });

  it('covers the full circle with no dead zone (every 1deg step returns a valid direction)', () => {
    for (let az = 0; az < 360; az++) {
      expect(directionWord(az)).toBeTypeOf('string');
    }
  });
});

describe('AC #6 — moon position matches a Skyfield oracle in every fixture case', () => {
  it('has at least 20 cases, both up and down, spanning more than one compass direction', () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(20);
    expect(fixture.cases.some((c) => c.up)).toBe(true);
    expect(fixture.cases.some((c) => !c.up)).toBe(true);
    expect(new Set(fixture.cases.filter((c) => c.up).map((c) => c.direction)).size).toBeGreaterThan(1);
  });

  for (const [i, c] of fixture.cases.entries()) {
    it(`case ${i} (${c.utc} lat=${c.lat} lon=${c.lon}): up/down and 8-point direction match Skyfield`, () => {
      const { altitude, azimuth } = moonPosition(new Date(c.utc), c.lat, c.lon);
      expect(altitude > 0).toBe(c.up);
      if (c.up) {
        expect(directionWord(azimuth)).toBe(c.direction);
      }
    });
  }
});
