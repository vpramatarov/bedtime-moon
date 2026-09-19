import { describe, it, expect } from 'vitest';
import { TOWNS } from '../src/settings/towns';

// Bulgaria's bounding box (per tech plan TKT-0005).
const LAT_MIN = 41.2;
const LAT_MAX = 44.3;
const LON_MIN = 22.3;
const LON_MAX = 28.7;

describe('TOWNS — bundled offline town list (TKT-0005)', () => {
  it('has exactly 40 towns', () => {
    expect(TOWNS.length).toBe(40);
  });

  it('has a unique id for every town', () => {
    const ids = TOWNS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a unique, non-empty name for every town', () => {
    const names = TOWNS.map((t) => t.name);
    for (const name of names) {
      expect(name.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps every latitude and longitude inside the Bulgaria bounding box', () => {
    for (const town of TOWNS) {
      expect(town.lat).toBeGreaterThanOrEqual(LAT_MIN);
      expect(town.lat).toBeLessThanOrEqual(LAT_MAX);
      expect(town.lon).toBeGreaterThanOrEqual(LON_MIN);
      expect(town.lon).toBeLessThanOrEqual(LON_MAX);
    }
  });

  it('includes Sofia', () => {
    expect(TOWNS.some((t) => t.id === 'sofia')).toBe(true);
  });
});
