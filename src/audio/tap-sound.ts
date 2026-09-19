/**
 * Soft tap chime synthesised with Web Audio — no audio file to ship (AC #6).
 * The AudioContext is created lazily on the first play(), which happens inside a
 * pointerdown handler, so the user-gesture requirement is satisfied.
 * The port refuses to stack: play() while a chime is sounding is a no-op.
 */

export interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}

export interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  connect(node: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainLike {
  gain: AudioParamLike;
  connect(node: unknown): unknown;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume(): Promise<void>;
}

export interface TapSound {
  /** Start the chime unless one is still sounding. */
  play(): void;
  /** True from play() until the chime's envelope has ended. */
  isPlaying(): boolean;
}

export interface TapSoundOptions {
  /** Boundary: returns a Web Audio context, or null where unavailable. */
  createContext?: () => AudioContextLike | null;
  /** Boundary: monotonic milliseconds clock. */
  clock?: () => number;
}

/** Total chime length in seconds — must stay ≤ 1 s (AC #6). */
export const TAP_SOUND_DURATION_S = 0.6;

const NOTE_LOW_HZ = 523.25; // C5
const NOTE_HIGH_HZ = 783.99; // G5
const PEAK_GAIN = 0.16;

function defaultCreateContext(): AudioContextLike | null {
  if (typeof AudioContext === 'undefined') return null;
  return new AudioContext() as unknown as AudioContextLike;
}

export function createTapSound(options: TapSoundOptions = {}): TapSound {
  const createContext = options.createContext ?? defaultCreateContext;
  const clock = options.clock ?? (() => performance.now());
  let ctx: AudioContextLike | null | undefined;
  let playingUntil = -Infinity;

  const isPlaying = (): boolean => clock() < playingUntil;

  const play = (): void => {
    if (isPlaying()) return;
    if (ctx === undefined) ctx = createContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(NOTE_LOW_HZ, t);
    osc.frequency.exponentialRampToValueAtTime(NOTE_HIGH_HZ, t + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + TAP_SOUND_DURATION_S);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + TAP_SOUND_DURATION_S);

    playingUntil = clock() + TAP_SOUND_DURATION_S * 1000;
  };

  return { play, isPlaying };
}
