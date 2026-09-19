/**
 * localStorage keys for the Parent settings screen (TKT-0005), same `bedtime-moon.` prefix and
 * malformed-value-is-absent discipline as `session/storage.ts`.
 *
 * - `bedtime-moon.location.lat`     signed decimal degrees
 * - `bedtime-moon.location.lon`     signed decimal degrees
 * - `bedtime-moon.location.source`  'geolocation' | 'town' | 'manual' — how lat/lon were set
 * - `bedtime-moon.location.townId`  optional — set only when source is 'town'
 * - `bedtime-moon.calmMode`         "1" | "0"
 */

import type { StorageLike } from '../session/storage';

export const KEYS = Object.freeze({
  locationLat: 'bedtime-moon.location.lat',
  locationLon: 'bedtime-moon.location.lon',
  locationSource: 'bedtime-moon.location.source',
  locationTownId: 'bedtime-moon.location.townId',
  calmMode: 'bedtime-moon.calmMode',
});

export type LocationSource = 'geolocation' | 'town' | 'manual';

const LOCATION_SOURCES: readonly LocationSource[] = ['geolocation', 'town', 'manual'];

export interface LocationRecord {
  lat: number;
  lon: number;
  source: LocationSource;
  townId: string | null;
}

function readNumber(storage: StorageLike, key: string): number | null {
  const raw = storage.getItem(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readSource(storage: StorageLike): LocationSource | null {
  const raw = storage.getItem(KEYS.locationSource);
  return raw !== null && (LOCATION_SOURCES as readonly string[]).includes(raw) ? (raw as LocationSource) : null;
}

function readTownId(storage: StorageLike): string | null {
  const raw = storage.getItem(KEYS.locationTownId);
  return raw === null || raw.trim() === '' ? null : raw;
}

/** Returns the stored location, or null when any required field is missing or malformed. */
export function readLocation(storage: StorageLike): LocationRecord | null {
  const lat = readNumber(storage, KEYS.locationLat);
  const lon = readNumber(storage, KEYS.locationLon);
  const source = readSource(storage);
  if (lat === null || lon === null || source === null) return null;
  return { lat, lon, source, townId: readTownId(storage) };
}

export function writeLocation(storage: StorageLike, location: LocationRecord): void {
  storage.setItem(KEYS.locationLat, String(location.lat));
  storage.setItem(KEYS.locationLon, String(location.lon));
  storage.setItem(KEYS.locationSource, location.source);
  if (location.townId === null || location.townId === undefined) storage.removeItem(KEYS.locationTownId);
  else storage.setItem(KEYS.locationTownId, location.townId);
}

export function clearLocation(storage: StorageLike): void {
  storage.removeItem(KEYS.locationLat);
  storage.removeItem(KEYS.locationLon);
  storage.removeItem(KEYS.locationSource);
  storage.removeItem(KEYS.locationTownId);
}

export function readCalmMode(storage: StorageLike): boolean {
  return storage.getItem(KEYS.calmMode) === '1';
}

export function writeCalmMode(storage: StorageLike, enabled: boolean): void {
  storage.setItem(KEYS.calmMode, enabled ? '1' : '0');
}
