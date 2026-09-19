/**
 * localStorage keys for the session model. localStorage is safe in a Safari home-screen app
 * (exempt from the 7-day script-writable storage purge — RES-0001 finding 12).
 *
 * - `bedtime-moon.sessionStart`  epoch ms, written on the Child's first tap
 * - `bedtime-moon.sleptAt`       epoch ms, written when goodnight is reached or detected (= start + budget)
 * - `bedtime-moon.budgetMinutes` "5" | "10" — set by the Parent settings screen (TKT-0005)
 */

import { BUDGET_MINUTES_OPTIONS, DEFAULT_BUDGET_MINUTES, EMPTY_RECORD, type BudgetMinutes, type SessionRecord } from './session';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const KEYS = Object.freeze({
  sessionStart: 'bedtime-moon.sessionStart',
  sleptAt: 'bedtime-moon.sleptAt',
  budgetMinutes: 'bedtime-moon.budgetMinutes',
});

function readEpoch(storage: StorageLike, key: string): number | null {
  const raw = storage.getItem(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function readRecord(storage: StorageLike): SessionRecord {
  return { sessionStart: readEpoch(storage, KEYS.sessionStart), sleptAt: readEpoch(storage, KEYS.sleptAt) };
}

export function writeRecord(storage: StorageLike, record: SessionRecord): void {
  if (record.sessionStart === null) storage.removeItem(KEYS.sessionStart);
  else storage.setItem(KEYS.sessionStart, String(record.sessionStart));
  if (record.sleptAt === null) storage.removeItem(KEYS.sleptAt);
  else storage.setItem(KEYS.sleptAt, String(record.sleptAt));
}

export function clearRecord(storage: StorageLike): void {
  writeRecord(storage, { ...EMPTY_RECORD });
}

export function readBudgetMinutes(storage: StorageLike): BudgetMinutes {
  const value = Number(storage.getItem(KEYS.budgetMinutes));
  return (BUDGET_MINUTES_OPTIONS as readonly number[]).includes(value) ? (value as BudgetMinutes) : DEFAULT_BUDGET_MINUTES;
}

export function writeBudgetMinutes(storage: StorageLike, minutes: BudgetMinutes): void {
  storage.setItem(KEYS.budgetMinutes, String(minutes));
}
