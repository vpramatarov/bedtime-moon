import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSessionController, type SessionController } from '../src/session/controller';
import { COOLDOWN_MS, budgetMs, type Phase } from '../src/session/session';
import { KEYS, readBudgetMinutes, readRecord } from '../src/session/storage';
import { MemoryStorage } from './helpers/memory-storage';

const B = budgetMs(5);
const T0 = Date.UTC(2026, 8, 15, 18, 0, 0);

let nowMs = T0;
const now = (): number => nowMs;

function make(storage = new MemoryStorage()): { ctrl: SessionController; storage: MemoryStorage; phases: Array<[Phase, Phase]> } {
  const phases: Array<[Phase, Phase]> = [];
  const ctrl = createSessionController({ now, storage, budgetMs: B });
  ctrl.subscribe((next, prev) => phases.push([next, prev]));
  return { ctrl, storage, phases };
}

/** Advance both the fake clock and the injected wall clock together. */
async function elapse(ms: number): Promise<void> {
  nowMs += ms;
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  nowMs = T0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AC #1 — start() records the session start once', () => {
  it('writes bedtime-moon.sessionStart on the first start and ignores later calls', () => {
    const { ctrl, storage } = make();
    expect(ctrl.phase()).toBe('awake');
    expect(ctrl.start()).toBe(true);
    expect(storage.getItem(KEYS.sessionStart)).toBe(String(T0));
    expect(ctrl.phase()).toBe('active');
    nowMs += 1_000;
    expect(ctrl.start()).toBe(false);
    expect(storage.getItem(KEYS.sessionStart)).toBe(String(T0));
  });

  it('documents its keys under the bedtime-moon. prefix', () => {
    expect(KEYS).toEqual({
      sessionStart: 'bedtime-moon.sessionStart',
      sleptAt: 'bedtime-moon.sleptAt',
      budgetMinutes: 'bedtime-moon.budgetMinutes',
    });
  });
});

describe('AC #2 / #3 — phase transitions fire from wall-clock evaluation', () => {
  it('emits winding-down at 0.8 B and asleep at B, persisting sleptAt', async () => {
    const { ctrl, storage, phases } = make();
    ctrl.start();
    await elapse(0.8 * B - 1_000);
    expect(ctrl.phase()).toBe('active');
    await elapse(1_000);
    expect(ctrl.phase()).toBe('winding-down');
    await elapse(0.2 * B);
    expect(ctrl.phase()).toBe('asleep');
    expect(storage.getItem(KEYS.sleptAt)).toBe(String(T0 + B));
    expect(phases).toEqual([
      ['active', 'awake'],
      ['winding-down', 'active'],
      ['asleep', 'winding-down'],
    ]);
  });
});

describe('AC #5 — elapsed time comes from the stored start and now(), never from ticks', () => {
  it('a clock jump with no timer activity is honoured by evaluateNow()', () => {
    const { ctrl } = make();
    ctrl.start();
    nowMs += B; // phone was hidden; no interval fired
    expect(ctrl.evaluateNow()).toBe('asleep');
  });

  it('timers firing without the clock moving do not advance the session', async () => {
    const { ctrl } = make();
    ctrl.start();
    await vi.advanceTimersByTimeAsync(B * 2); // interval runs, but now() is frozen
    expect(ctrl.phase()).toBe('active');
  });
});

describe('AC #6 / #7 — reopening during and after the cooldown', () => {
  it('a stored sleptAt inside the cooldown starts asleep', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.sessionStart, String(T0 - B));
    storage.setItem(KEYS.sleptAt, String(T0));
    nowMs = T0 + COOLDOWN_MS - 1;
    const { ctrl } = make(storage);
    expect(ctrl.phase()).toBe('asleep');
    expect(ctrl.start()).toBe(false);
  });

  it('at sleptAt + 2 h the record is cleared, the moon is awake and start() begins a fresh session', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.sessionStart, String(T0 - B));
    storage.setItem(KEYS.sleptAt, String(T0));
    nowMs = T0 + COOLDOWN_MS;
    const { ctrl } = make(storage);
    expect(ctrl.phase()).toBe('awake');
    expect(readRecord(storage)).toEqual({ sessionStart: null, sleptAt: null });
    expect(ctrl.start()).toBe(true);
    expect(storage.getItem(KEYS.sessionStart)).toBe(String(nowMs));
  });
});

describe('AC #8 — abandoned session', () => {
  it('opening after start + B shows goodnight and writes sleptAt = start + B', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.sessionStart, String(T0));
    nowMs = T0 + B + 30 * 60_000;
    const { ctrl } = make(storage);
    expect(ctrl.phase()).toBe('asleep');
    expect(storage.getItem(KEYS.sleptAt)).toBe(String(T0 + B));
  });
});

describe('AC #9 — restart()', () => {
  it('clears both keys and returns to awake, emitting the transition', async () => {
    const { ctrl, storage, phases } = make();
    ctrl.start();
    await elapse(B);
    expect(ctrl.phase()).toBe('asleep');
    ctrl.restart();
    expect(ctrl.phase()).toBe('awake');
    expect(storage.getItem(KEYS.sessionStart)).toBeNull();
    expect(storage.getItem(KEYS.sleptAt)).toBeNull();
    expect(phases.at(-1)).toEqual(['awake', 'asleep']);
  });
});

describe('storage helpers', () => {
  it('readBudgetMinutes accepts 5 or 10 and falls back to 5 for anything else', () => {
    const storage = new MemoryStorage();
    expect(readBudgetMinutes(storage)).toBe(5);
    storage.setItem(KEYS.budgetMinutes, '10');
    expect(readBudgetMinutes(storage)).toBe(10);
    storage.setItem(KEYS.budgetMinutes, '7');
    expect(readBudgetMinutes(storage)).toBe(5);
    storage.setItem(KEYS.budgetMinutes, 'ten');
    expect(readBudgetMinutes(storage)).toBe(5);
  });

  it('readRecord treats malformed timestamps as absent', () => {
    const storage = new MemoryStorage();
    storage.setItem(KEYS.sessionStart, 'yesterday');
    storage.setItem(KEYS.sleptAt, '');
    expect(readRecord(storage)).toEqual({ sessionStart: null, sleptAt: null });
  });

  it('destroy() stops the interval', async () => {
    const { ctrl } = make();
    ctrl.start();
    ctrl.destroy();
    await elapse(B);
    expect(ctrl.phase()).toBe('active');
  });
});

describe('setBudgetMs() — runtime budget change (TKT-0005)', () => {
  it('lowering the budget below the already-elapsed time immediately flips the phase to asleep and persists sleptAt', async () => {
    const { ctrl, storage } = make();
    ctrl.start();
    await elapse(2 * 60_000); // 2 minutes into the 5-minute (B) budget — still active
    expect(ctrl.phase()).toBe('active');

    const smaller = budgetMs(1); // below the 2 minutes already elapsed
    ctrl.setBudgetMs(smaller);

    expect(ctrl.phase()).toBe('asleep');
    expect(storage.getItem(KEYS.sleptAt)).toBe(String(T0 + smaller));
  });

  it('raising the budget while winding-down immediately returns the phase to active', async () => {
    const { ctrl } = make();
    ctrl.start();
    await elapse(0.8 * B); // 4 of 5 minutes — winding-down
    expect(ctrl.phase()).toBe('winding-down');

    ctrl.setBudgetMs(budgetMs(10));

    expect(ctrl.phase()).toBe('active');
  });

  it('calling it while asleep only changes the number the next session will use, not the current phase', async () => {
    const { ctrl, storage } = make();
    ctrl.start();
    await elapse(B);
    expect(ctrl.phase()).toBe('asleep');
    const sleptAtBefore = storage.getItem(KEYS.sleptAt);

    ctrl.setBudgetMs(budgetMs(10));

    expect(ctrl.phase()).toBe('asleep');
    expect(storage.getItem(KEYS.sleptAt)).toBe(sleptAtBefore);
  });

  it('calling it while awake only changes the number the next session will use, not the current phase', () => {
    const { ctrl, storage } = make();
    expect(ctrl.phase()).toBe('awake');

    ctrl.setBudgetMs(budgetMs(10));

    expect(ctrl.phase()).toBe('awake');
    expect(storage.getItem(KEYS.sessionStart)).toBeNull();
    expect(storage.getItem(KEYS.sleptAt)).toBeNull();
  });
});
