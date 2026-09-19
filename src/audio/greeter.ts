/**
 * Spoken Bulgarian line (AC #7, PRD §7 "Audio and language").
 * Primary: speechSynthesis with the first voice whose lang starts with "bg".
 * Fallback: a bundled recording, when one exists.
 * speak() resolves true only when something audibly started; false otherwise, so the
 * scene can defer the greeting to the next tap (autoplay policy) without guessing.
 */

export interface VoiceLike {
  lang: string;
  name: string;
}

export interface UtteranceLike {
  text: string;
  voice: VoiceLike | null;
  lang: string;
  rate: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export interface SpeechSynthesisLike {
  getVoices(): VoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  addEventListener(type: 'voiceschanged', listener: () => void): void;
  removeEventListener(type: 'voiceschanged', listener: () => void): void;
}

export interface AudioLike {
  play(): Promise<void>;
}

export interface GreeterOptions {
  /** The line to speak. */
  text: string;
  /** Same-origin URL of a recorded line, or null when no recording is bundled. */
  fallbackUrl: string | null;
  /** Boundary: the platform speech engine, or null where absent. Defaults to window.speechSynthesis. */
  synth?: SpeechSynthesisLike | null;
  /** Boundary: utterance factory. Defaults to new SpeechSynthesisUtterance(text). */
  createUtterance?: (text: string) => UtteranceLike | null;
  /** Boundary: audio element factory for the recorded fallback. Defaults to new Audio(url). */
  createAudio?: (url: string) => AudioLike;
  /** How long to wait for `voiceschanged` when the voice list is still empty. */
  voiceWaitMs?: number;
  /** How long speech may take to start before it is declared silent and cancelled. */
  watchdogMs?: number;
}

/** Per-call text, overriding a Greeter's constructor-time default (TKT-0003). */
export interface SpeakOverride {
  text: string;
}

export interface Greeter {
  speak(override?: SpeakOverride): Promise<boolean>;
}

const DEFAULT_VOICE_WAIT_MS = 1_000;
const DEFAULT_WATCHDOG_MS = 2_500;
const DEFAULT_DETECT_WAIT_MS = 1_000;

function defaultSynth(): SpeechSynthesisLike | null {
  if (typeof speechSynthesis === 'undefined') return null;
  return speechSynthesis as unknown as SpeechSynthesisLike;
}

function defaultCreateUtterance(text: string): UtteranceLike | null {
  if (typeof SpeechSynthesisUtterance === 'undefined') return null;
  return new SpeechSynthesisUtterance(text) as unknown as UtteranceLike;
}

function defaultCreateAudio(url: string): AudioLike {
  return new Audio(url);
}

function isBulgarian(voice: VoiceLike): boolean {
  return voice.lang.toLowerCase().startsWith('bg');
}

/**
 * Resolves once `voiceschanged` fires or `waitMs` elapses, then re-reads the voice list.
 * Shared by `detectBulgarianVoice` and `createGreeter`'s `speak()`, so the wait-for-voices
 * behaviour (and its timing) lives in exactly one place.
 */
function waitForVoices(engine: SpeechSynthesisLike, waitMs: number): Promise<VoiceLike[]> {
  return new Promise<VoiceLike[]>((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      engine.removeEventListener('voiceschanged', done);
      resolve(engine.getVoices());
    };
    const timer = setTimeout(done, waitMs);
    engine.addEventListener('voiceschanged', done);
  });
}

/**
 * Resolves true only when a voice whose lang starts with "bg" (case-insensitive) is
 * available, waiting for `voiceschanged` the same way `speak()` does when the list starts
 * empty. Lets UI (e.g. the settings panel's voice status line) ask "is one available?"
 * without queuing an utterance.
 */
export function detectBulgarianVoice(
  synth: SpeechSynthesisLike | null,
  waitMs: number = DEFAULT_DETECT_WAIT_MS,
): Promise<boolean> {
  if (!synth) return Promise.resolve(false);
  const voices = synth.getVoices();
  if (voices.length > 0) return Promise.resolve(voices.some(isBulgarian));
  return waitForVoices(synth, waitMs).then((list) => list.some(isBulgarian));
}

export function createGreeter(options: GreeterOptions): Greeter {
  const synth = options.synth === undefined ? defaultSynth() : options.synth;
  const createUtterance = options.createUtterance ?? defaultCreateUtterance;
  const createAudio = options.createAudio ?? defaultCreateAudio;
  const voiceWaitMs = options.voiceWaitMs ?? DEFAULT_VOICE_WAIT_MS;
  const watchdogMs = options.watchdogMs ?? DEFAULT_WATCHDOG_MS;

  function speakWith(voice: VoiceLike, text: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const utterance = createUtterance(text);
      if (!synth || !utterance) {
        resolve(false);
        return;
      }
      let settled = false;
      const settle = (started: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        resolve(started);
      };
      const watchdog = setTimeout(() => {
        synth.cancel();
        settle(false);
      }, watchdogMs);

      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.9;
      utterance.onstart = () => settle(true);
      utterance.onerror = () => settle(false);
      synth.speak(utterance);
    });
  }

  async function playRecording(url: string): Promise<boolean> {
    try {
      await createAudio(url).play();
      return true;
    } catch {
      return false;
    }
  }

  function speakFrom(voices: VoiceLike[], text: string): Promise<boolean> {
    const voice = voices.find(isBulgarian);
    if (voice) return speakWith(voice, text);
    if (options.fallbackUrl) return playRecording(options.fallbackUrl);
    return Promise.resolve(false);
  }

  return {
    /**
     * Starts speech synchronously when the voice list is already known, so a call made
     * inside a pointerdown handler still counts as gesture-triggered.
     */
    speak(override?: SpeakOverride): Promise<boolean> {
      const text = override?.text ?? options.text;
      if (!synth) return speakFrom([], text);
      const voices = synth.getVoices();
      if (voices.length > 0) return speakFrom(voices, text);
      return waitForVoices(synth, voiceWaitMs).then((list) => speakFrom(list, text));
    },
  };
}
