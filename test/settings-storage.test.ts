import { describe, expect, it } from 'vitest';
import {
  clearLocation,
  KEYS,
  readCalmMode,
  readLocation,
  writeCalmMode,
  writeLocation,
} from '../src/settings/settings-storage';
import { MemoryStorage } from './helpers/memory-storage';

describe('settings-storage: location', () => {
  it('round-trips a geolocation-sourced location', () => {
    const storage = new MemoryStorage();
    writeLocation(storage, { lat: 42.7, lon: 23.32, source: 'geolocation', townId: null });
    expect(readLocation(storage)).toEqual({ lat: 42.7, lon: 23.32, source: 'geolocation', townId: null });
  });

  it('round-trips a town-sourced location including townId', () => {
    const storage = new MemoryStorage();
    writeLocation(storage, { lat: 42.14, lon: 24.75, source: 'town', townId: 'plovdiv' });
    expect(readLocation(storage)).toEqual({ lat: 42.14, lon: 24.75, source: 'town', townId: 'plovdiv' });
  });

  it('round-trips a manually-entered location', () => {
    const storage = new MemoryStorage();
    writeLocation(storage, { lat: -12.5, lon: 100.1, source: 'manual', townId: null });
    expect(readLocation(storage)).toEqual({ lat: -12.5, lon: 100.1, source: 'manual', townId: null });
  });

  it('returns null when nothing is stored', () => {
    const storage = new MemoryStorage();
    expect(readLocation(storage)).toBeNull();
  });

  it('writing a town location then a manual location clears the stale townId', () => {
    const storage = new MemoryStorage();
    writeLocation(storage, { lat: 42.14, lon: 24.75, source: 'town', townId: 'plovdiv' });
    writeLocation(storage, { lat: 1, lon: 2, source: 'manual', townId: null });
    expect(readLocation(storage)).toEqual({ lat: 1, lon: 2, source: 'manual', townId: null });
  });

  it('clearLocation removes everything, including townId', () => {
    const storage = new MemoryStorage();
    writeLocation(storage, { lat: 42.14, lon: 24.75, source: 'town', townId: 'plovdiv' });
    clearLocation(storage);
    expect(readLocation(storage)).toBeNull();
    expect(storage.getItem(KEYS.locationLat)).toBeNull();
    expect(storage.getItem(KEYS.locationLon)).toBeNull();
    expect(storage.getItem(KEYS.locationSource)).toBeNull();
    expect(storage.getItem(KEYS.locationTownId)).toBeNull();
  });

  it('treats a non-numeric stored lat as absent', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.locationLat, 'not-a-number');
    storage.setItem(KEYS.locationLon, '23.32');
    storage.setItem(KEYS.locationSource, 'manual');
    expect(readLocation(storage)).toBeNull();
  });

  it('treats a non-numeric stored lon as absent', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.locationLat, '42.7');
    storage.setItem(KEYS.locationLon, 'nope');
    storage.setItem(KEYS.locationSource, 'manual');
    expect(readLocation(storage)).toBeNull();
  });

  it('treats an unrecognized source value as absent', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.locationLat, '42.7');
    storage.setItem(KEYS.locationLon, '23.32');
    storage.setItem(KEYS.locationSource, 'gps-satellite');
    expect(readLocation(storage)).toBeNull();
  });

  it('treats a blank stored lat as absent', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.locationLat, '   ');
    storage.setItem(KEYS.locationLon, '23.32');
    storage.setItem(KEYS.locationSource, 'manual');
    expect(readLocation(storage)).toBeNull();
  });
});

describe('settings-storage: calm mode', () => {
  it('defaults to false when nothing is stored', () => {
    const storage = new MemoryStorage();
    expect(readCalmMode(storage)).toBe(false);
  });

  it('round-trips true', () => {
    const storage = new MemoryStorage();
    writeCalmMode(storage, true);
    expect(readCalmMode(storage)).toBe(true);
    expect(storage.getItem(KEYS.calmMode)).toBe('1');
  });

  it('round-trips false', () => {
    const storage = new MemoryStorage();
    writeCalmMode(storage, true);
    writeCalmMode(storage, false);
    expect(readCalmMode(storage)).toBe(false);
    expect(storage.getItem(KEYS.calmMode)).toBe('0');
  });

  it('treats a malformed stored value as false', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.calmMode, 'yes');
    expect(readCalmMode(storage)).toBe(false);
  });
});
