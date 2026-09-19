import { describe, it, expect } from 'vitest';
import { TAP_SOUND_DURATION_S, createTapSound } from '../src/audio/tap-sound';
import { FakeAudioContext } from './helpers/fake-audio';

describe('AC #6 — one soft sound per tap, ≤ 1 s, no stacking', () => {
  it('the chime lasts at most one second', () => {
    expect(TAP_SOUND_DURATION_S).toBeLessThanOrEqual(1);
    expect(TAP_SOUND_DURATION_S).toBeGreaterThan(0);
  });

  it('play() starts exactly one oscillator that stops within one second', () => {
    const ctx = new FakeAudioContext();
    let now = 0;
    const sound = createTapSound({ createContext: () => ctx, clock: () => now });
    sound.play();
    expect(ctx.oscillators).toHaveLength(1);
    const osc = ctx.oscillators[0]!;
    expect(osc.stopAt - osc.startAt).toBeLessThanOrEqual(1);
    expect(sound.isPlaying()).toBe(true);
    now = TAP_SOUND_DURATION_S * 1000 + 1;
    expect(sound.isPlaying()).toBe(false);
  });

  it('a second play() while the chime is still sounding does not start another oscillator', () => {
    const ctx = new FakeAudioContext();
    let now = 0;
    const sound = createTapSound({ createContext: () => ctx, clock: () => now });
    sound.play();
    now = 200;
    sound.play();
    expect(ctx.oscillators).toHaveLength(1);
    now = TAP_SOUND_DURATION_S * 1000 + 1;
    sound.play();
    expect(ctx.oscillators).toHaveLength(2);
  });

  it('creates the AudioContext lazily, on the first play (a user gesture), not on construction', () => {
    let created = 0;
    const sound = createTapSound({
      createContext: () => {
        created++;
        return new FakeAudioContext();
      },
      clock: () => 0,
    });
    expect(created).toBe(0);
    sound.play();
    expect(created).toBe(1);
  });

  it('is silent but harmless where Web Audio is unavailable', () => {
    const sound = createTapSound({ createContext: () => null, clock: () => 0 });
    expect(() => sound.play()).not.toThrow();
    expect(sound.isPlaying()).toBe(false);
  });
});
