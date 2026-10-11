import { describe, it, expect } from 'vitest';
import { nearestTownWithin, TOWNS, type Town } from '../src/settings/towns';

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

describe('nearestTownWithin (PRD-0003 / TKT-0012)', () => {
  // On a meridian 1° of latitude = 6371 km · π/180 ≈ 111.195 km, so 10 km ≈ 0.08993°.
  const A: Town = { id: 'a', name: 'А', lat: 0, lon: 0 };
  const B: Town = { id: 'b', name: 'Б', lat: 0, lon: 0.05 };

  it('includes a town just inside 10 km and excludes one just outside', () => {
    expect(nearestTownWithin([A], 0.0899, 0, 10)).toBe(A); // ≈ 9.996 km
    expect(nearestTownWithin([A], 0.09, 0, 10)).toBeNull(); // ≈ 10.008 km
  });

  it('picks the closest of several towns in range', () => {
    expect(nearestTownWithin([A, B], 0, 0.04, 10)).toBe(B);
    expect(nearestTownWithin([B, A], 0, 0.01, 10)).toBe(A);
  });

  it('returns null for an empty list or when nothing is in range', () => {
    expect(nearestTownWithin([], 0, 0, 10)).toBeNull();
    expect(nearestTownWithin(TOWNS, 48.2082, 16.3738, 10)).toBeNull(); // Vienna
  });
});
