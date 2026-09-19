import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGreeter, detectBulgarianVoice } from '../src/audio/greeter';
import { FakeSpeechSynthesis, fakeAudioFactory } from './helpers/fake-speech';

afterEach(() => vi.useRealTimers());

describe('AC #7 — Bulgarian greeting: bg voice first, recorded file second, honest false otherwise', () => {
  it('speaks with the first voice whose lang starts with "bg" and resolves true when speech starts', async () => {
    const synth = new FakeSpeechSynthesis([
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'bg-BG', name: 'Daria' },
    ]);
    const greeter = createGreeter({ text: 'Здравей', fallbackUrl: null, synth, createUtterance: synth.utterance });
    const result = greeter.speak();
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]!.voice?.name).toBe('Daria');
    expect(synth.spoken[0]!.text).toBe('Здравей');
    synth.spoken[0]!.fireStart();
    await expect(result).resolves.toBe(true);
  });

  it('waits for voiceschanged when the voice list is still empty', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis([]);
    const greeter = createGreeter({ text: 'Здравей', fallbackUrl: null, synth, createUtterance: synth.utterance });
    const result = greeter.speak();
    synth.loadVoices([{ lang: 'bg-BG', name: 'Daria' }]);
    await vi.advanceTimersByTimeAsync(10);
    expect(synth.spoken).toHaveLength(1);
    synth.spoken[0]!.fireStart();
    await expect(result).resolves.toBe(true);
  });

  it('falls back to the recorded file when no bg voice exists', async () => {
    const synth = new FakeSpeechSynthesis([{ lang: 'en-US', name: 'Samantha' }]);
    const audio = fakeAudioFactory({ playResolves: true });
    const greeter = createGreeter({
      text: 'Здравей',
      fallbackUrl: '/audio/greeting-bg.mp3',
      synth,
      createUtterance: synth.utterance,
      createAudio: audio.create,
    });
    await expect(greeter.speak()).resolves.toBe(true);
    expect(synth.spoken).toHaveLength(0);
    expect(audio.created).toEqual(['/audio/greeting-bg.mp3']);
  });

  it('resolves false when there is no bg voice and no recorded file, without creating any audio element', async () => {
    const synth = new FakeSpeechSynthesis([{ lang: 'en-US', name: 'Samantha' }]);
    const audio = fakeAudioFactory({ playResolves: true });
    const greeter = createGreeter({
      text: 'Здравей',
      fallbackUrl: null,
      synth,
      createUtterance: synth.utterance,
      createAudio: audio.create,
    });
    await expect(greeter.speak()).resolves.toBe(false);
    expect(audio.created).toEqual([]);
  });

  it('resolves false when the recorded file is blocked by the autoplay policy', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis([]);
    const audio = fakeAudioFactory({ playResolves: false });
    const greeter = createGreeter({
      text: 'Здравей',
      fallbackUrl: '/audio/greeting-bg.mp3',
      synth,
      createUtterance: synth.utterance,
      createAudio: audio.create,
    });
    const result = greeter.speak();
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(result).resolves.toBe(false);
  });

  it('resolves false when speech neither starts nor errors within the watchdog (silent iOS case)', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis([{ lang: 'bg-BG', name: 'Daria' }]);
    const greeter = createGreeter({ text: 'Здравей', fallbackUrl: null, synth, createUtterance: synth.utterance });
    const result = greeter.speak();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(result).resolves.toBe(false);
    expect(synth.cancelled).toBe(true);
  });

  it('works without any speechSynthesis object at all', async () => {
    const greeter = createGreeter({ text: 'Здравей', fallbackUrl: null, synth: null, createUtterance: () => null });
    await expect(greeter.speak()).resolves.toBe(false);
  });
});

describe('speak(override) — per-call text for the real-sky hand-off (TKT-0003)', () => {
  it('speaks the override text instead of the constructor default when one is given', async () => {
    const synth = new FakeSpeechSynthesis([{ lang: 'bg-BG', name: 'Daria' }]);
    const greeter = createGreeter({ text: 'default text', fallbackUrl: null, synth, createUtterance: synth.utterance });
    const result = greeter.speak({ text: 'override text' });
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]!.text).toBe('override text');
    synth.spoken[0]!.fireStart();
    await expect(result).resolves.toBe(true);
  });
});

describe('detectBulgarianVoice — reusable bg-voice availability check', () => {
  it('resolves true when a bg voice is present immediately', async () => {
    const synth = new FakeSpeechSynthesis([
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'bg-BG', name: 'Daria' },
    ]);
    await expect(detectBulgarianVoice(synth)).resolves.toBe(true);
  });

  it('resolves true when a bg voice only appears after voiceschanged fires within the wait window', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis([]);
    const result = detectBulgarianVoice(synth, 1_000);
    synth.loadVoices([{ lang: 'bg-BG', name: 'Daria' }]);
    await vi.advanceTimersByTimeAsync(10);
    await expect(result).resolves.toBe(true);
  });

  it('resolves false when the wait times out with no bg voice', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis([]);
    const result = detectBulgarianVoice(synth, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe(false);
  });

  it('resolves false when synth is null', async () => {
    await expect(detectBulgarianVoice(null)).resolves.toBe(false);
  });
});
