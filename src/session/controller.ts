/**
 * Session controller — owns the stored record, re-evaluates it from the wall clock and
 * notifies subscribers on phase changes. The 1 s interval only *triggers* an evaluation;
 * elapsed time is never accumulated from timer callbacks, so throttled or frozen hidden-tab
 * timers cannot make the session drift (AC #5).
 */

import { evaluate, type Phase } from './session';
import { clearRecord, readRecord, writeRecord, type StorageLike } from './storage';

export type PhaseListener = (next: Phase, prev: Phase) => void;

export interface SessionController {
  /** Effective budget for this session, ms; reflects the last setBudgetMs() call, if any. */
  readonly budgetMs: number;
  phase(): Phase;
  /** Start a session if the moon is awake. Returns true when a new session began. */
  start(): boolean;
  /** Recompute from storage + now(); emits on change. Call on visibilitychange → visible. */
  evaluateNow(): Phase;
  /** Parent's Restart: clears session and cooldown, back to awake. */
  restart(): void;
  /**
   * Change the effective budget and re-evaluate immediately (Parent settings, TKT-0005), so a
   * lowered budget can flip straight to asleep and a raised one straight back to active without
   * waiting for the next tick. While awake or asleep this only changes the number the next
   * session will use — it never touches the current phase or record on its own.
   */
  setBudgetMs(ms: number): void;
  subscribe(listener: PhaseListener): () => void;
  destroy(): void;
}

export interface SessionControllerOptions {
  now: () => number;
  storage: StorageLike;
  budgetMs: number;
  /** Interval between evaluations while a session is running. Default 1 000 ms. */
  tickMs?: number;
}

const RUNNING: ReadonlySet<Phase> = new Set<Phase>(['active', 'winding-down']);

export function createSessionController(options: SessionControllerOptions): SessionController {
  const { now, storage } = options;
  let effectiveBudgetMs = options.budgetMs;
  const tickMs = options.tickMs ?? 1_000;
  const listeners = new Set<PhaseListener>();
  let current: Phase = 'awake';
  let interval: ReturnType<typeof setInterval> | undefined;
  let destroyed = false;

  const syncInterval = (): void => {
    const shouldRun = !destroyed && RUNNING.has(current);
    if (shouldRun && interval === undefined) interval = setInterval(evaluateNow, tickMs);
    if (!shouldRun && interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }
  };

  function evaluateNow(): Phase {
    const stored = readRecord(storage);
    const result = evaluate(now(), stored, effectiveBudgetMs);
    if (result.record.sessionStart !== stored.sessionStart || result.record.sleptAt !== stored.sleptAt) {
      writeRecord(storage, result.record);
    }
    const prev = current;
    current = result.phase;
    syncInterval();
    if (prev !== current) for (const listener of listeners) listener(current, prev);
    return current;
  }

  evaluateNow();

  return {
    get budgetMs(): number {
      return effectiveBudgetMs;
    },
    phase: () => current,
    start(): boolean {
      if (evaluateNow() !== 'awake') return false;
      writeRecord(storage, { sessionStart: now(), sleptAt: null });
      evaluateNow();
      return true;
    },
    evaluateNow,
    restart(): void {
      clearRecord(storage);
      evaluateNow();
    },
    setBudgetMs(ms: number): void {
      effectiveBudgetMs = ms;
      evaluateNow();
    },
    subscribe(listener: PhaseListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy(): void {
      destroyed = true;
      syncInterval();
      listeners.clear();
    },
  };
}
