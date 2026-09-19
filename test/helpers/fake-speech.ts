import type { AudioLike, SpeechSynthesisLike, UtteranceLike, VoiceLike } from '../../src/audio/greeter';

export class FakeUtterance implements UtteranceLike {
  voice: VoiceLike | null = null;
  lang = '';
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
  fireStart(): void {
    this.onstart?.();
  }
  fireError(): void {
    this.onerror?.();
  }
}

export class FakeSpeechSynthesis implements SpeechSynthesisLike {
  spoken: FakeUtterance[] = [];
  cancelled = false;
  private listeners = new Set<() => void>();
  constructor(private voices: VoiceLike[]) {}
  utterance = (text: string): UtteranceLike => new FakeUtterance(text);
  getVoices(): VoiceLike[] {
    return this.voices;
  }
  speak(utterance: UtteranceLike): void {
    this.spoken.push(utterance as FakeUtterance);
  }
  cancel(): void {
    this.cancelled = true;
  }
  addEventListener(_type: 'voiceschanged', listener: () => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'voiceschanged', listener: () => void): void {
    this.listeners.delete(listener);
  }
  loadVoices(voices: VoiceLike[]): void {
    this.voices = voices;
    for (const listener of this.listeners) listener();
  }
}

export function fakeAudioFactory(opts: { playResolves: boolean }): { created: string[]; create: (url: string) => AudioLike } {
  const created: string[] = [];
  return {
    created,
    create: (url: string) => {
      created.push(url);
      return {
        play: () => (opts.playResolves ? Promise.resolve() : Promise.reject(new Error('NotAllowedError'))),
      };
    },
  };
}
