/**
 * Session rules — pure, clock-in / phase-out (PRD-0001 §7 "Session and time").
 * Elapsed time is always `now − sessionStart` on the wall clock; nothing here accumulates ticks.
 */

/** After goodnight the moon sleeps this long, then any open starts a fresh session. Tuning knob, not a setting. */
export const COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Wind-down (palette shift + yawn) begins at this fraction of the budget. */
export const WIND_DOWN_FRACTION = 0.8;

export const BUDGET_MINUTES_OPTIONS = [5, 10] as const;
export type BudgetMinutes = (typeof BUDGET_MINUTES_OPTIONS)[number];
export const DEFAULT_BUDGET_MINUTES: BudgetMinutes = 5;

export function budgetMs(minutes: number): number {
  return minutes * 60_000;
}

export interface SessionRecord {
  /** Epoch ms when the Child first tapped the moon; null when no session is stored. */
  sessionStart: number | null;
  /** Epoch ms when goodnight was reached (= sessionStart + budget); null while awake or active. */
  sleptAt: number | null;
}

export const EMPTY_RECORD: Readonly<SessionRecord> = Object.freeze({ sessionStart: null, sleptAt: null });

export type Phase = 'awake' | 'active' | 'winding-down' | 'asleep';

export interface Evaluation {
  phase: Phase;
  /** The record as it should now be persisted (sleptAt filled in, or cleared after the cooldown). */
  record: SessionRecord;
  /** Wall-clock time elapsed inside the session; 0 when awake. */
  elapsedMs: number;
}

export function evaluate(now: number, record: SessionRecord, budget: number): Evaluation {
  const { sessionStart, sleptAt } = record;

  if (sleptAt !== null) {
    if (now < sleptAt + COOLDOWN_MS) {
      return { phase: 'asleep', record: { sessionStart, sleptAt }, elapsedMs: budget };
    }
    return { phase: 'awake', record: { ...EMPTY_RECORD }, elapsedMs: 0 };
  }

  if (sessionStart !== null) {
    const elapsedMs = now - sessionStart;
    if (elapsedMs >= budget) {
      // Abandoned or completed: the cooldown counts from start + budget, not from now.
      return evaluate(now, { sessionStart, sleptAt: sessionStart + budget }, budget);
    }
    if (elapsedMs >= WIND_DOWN_FRACTION * budget) {
      return { phase: 'winding-down', record: { sessionStart, sleptAt: null }, elapsedMs };
    }
    return { phase: 'active', record: { sessionStart, sleptAt: null }, elapsedMs };
  }

  return { phase: 'awake', record: { ...EMPTY_RECORD }, elapsedMs: 0 };
}
