import type { AudioContextLike, AudioParamLike, GainLike, OscillatorLike } from '../../src/audio/tap-sound';

class FakeParam implements AudioParamLike {
  value = 0;
  setValueAtTime(value: number): this {
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
}

export class FakeOscillator implements OscillatorLike {
  type = 'sine';
  frequency = new FakeParam();
  startAt = NaN;
  stopAt = NaN;
  connect<T>(node: T): T {
    return node;
  }
  start(when = 0): void {
    this.startAt = when;
  }
  stop(when = 0): void {
    this.stopAt = when;
  }
}

class FakeGain implements GainLike {
  gain = new FakeParam();
  connect<T>(node: T): T {
    return node;
  }
}

export class FakeAudioContext implements AudioContextLike {
  currentTime = 0;
  state: 'suspended' | 'running' | 'closed' = 'running';
  destination = {};
  oscillators: FakeOscillator[] = [];
  createOscillator(): OscillatorLike {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain(): GainLike {
    return new FakeGain();
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}
