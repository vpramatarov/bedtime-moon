import { describe, it, expect } from 'vitest';
import {
  BUDGET_MINUTES_OPTIONS,
  COOLDOWN_MS,
  DEFAULT_BUDGET_MINUTES,
  EMPTY_RECORD,
  WIND_DOWN_FRACTION,
  budgetMs,
  evaluate,
} from '../src/session/session';

const B = budgetMs(5);
const START = Date.UTC(2026, 8, 15, 18, 0, 0);
const withStart = { sessionStart: START, sleptAt: null };

describe('session constants (PRD-0001 §7, decisions of 2026-09-15)', () => {
  it('cooldown is a fixed 2 h, wind-down at 80 %, budgets 5 or 10 minutes with 5 as default', () => {
    expect(COOLDOWN_MS).toBe(2 * 60 * 60 * 1000);
    expect(WIND_DOWN_FRACTION).toBe(0.8);
    expect([...BUDGET_MINUTES_OPTIONS]).toEqual([5, 10]);
    expect(DEFAULT_BUDGET_MINUTES).toBe(5);
    expect(budgetMs(5)).toBe(300_000);
    expect(budgetMs(10)).toBe(600_000);
  });
});

describe('evaluate() — awake / active', () => {
  it('AC #1 — no record means awake with nothing elapsed', () => {
    const result = evaluate(START, EMPTY_RECORD, B);
    expect(result.phase).toBe('awake');
    expect(result.elapsedMs).toBe(0);
    expect(result.record).toEqual(EMPTY_RECORD);
  });

  it('a started session is active until 80 % of the budget', () => {
    expect(evaluate(START + 1, withStart, B).phase).toBe('active');
    expect(evaluate(START + WIND_DOWN_FRACTION * B - 1, withStart, B).phase).toBe('active');
    expect(evaluate(START + 60_000, withStart, B).elapsedMs).toBe(60_000);
  });
});

describe('evaluate() — wind-down and goodnight', () => {
  it('AC #2 — winding-down from exactly 0.8 × B until the budget', () => {
    expect(evaluate(START + WIND_DOWN_FRACTION * B, withStart, B).phase).toBe('winding-down');
    expect(evaluate(START + B - 1, withStart, B).phase).toBe('winding-down');
  });

  it('AC #3 — asleep at exactly the budget, recording sleptAt = start + B', () => {
    const result = evaluate(START + B, withStart, B);
    expect(result.phase).toBe('asleep');
    expect(result.record.sleptAt).toBe(START + B);
    expect(result.record.sessionStart).toBe(START);
  });

  it('AC #8 — an abandoned session sleeps at start + B and the cooldown counts from there', () => {
    const later = evaluate(START + B + 60 * 60 * 1000, withStart, B);
    expect(later.phase).toBe('asleep');
    expect(later.record.sleptAt).toBe(START + B);
    const expired = evaluate(START + B + COOLDOWN_MS, withStart, B);
    expect(expired.phase).toBe('awake');
    expect(expired.record).toEqual(EMPTY_RECORD);
  });

  it('a 10-minute budget shifts every threshold', () => {
    const B10 = budgetMs(10);
    expect(evaluate(START + 7 * 60_000, withStart, B10).phase).toBe('active');
    expect(evaluate(START + 8 * 60_000, withStart, B10).phase).toBe('winding-down');
    expect(evaluate(START + 10 * 60_000, withStart, B10).phase).toBe('asleep');
  });
});

describe('evaluate() — cooldown', () => {
  const slept = { sessionStart: START, sleptAt: START + B };

  it('AC #6 — stays asleep until sleptAt + 2 h', () => {
    expect(evaluate(START + B, slept, B).phase).toBe('asleep');
    expect(evaluate(START + B + COOLDOWN_MS - 1, slept, B).phase).toBe('asleep');
  });

  it('AC #7 — at sleptAt + 2 h the record clears and the moon is awake again', () => {
    const result = evaluate(START + B + COOLDOWN_MS, slept, B);
    expect(result.phase).toBe('awake');
    expect(result.record).toEqual(EMPTY_RECORD);
  });

  it('a sleptAt without a sessionStart (legacy or manual edit) still honours the cooldown', () => {
    const record = { sessionStart: null, sleptAt: START };
    expect(evaluate(START + 1, record, B).phase).toBe('asleep');
    expect(evaluate(START + COOLDOWN_MS, record, B).phase).toBe('awake');
  });
});
