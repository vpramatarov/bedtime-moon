import type { WakeLockPort } from '../../src/platform/wake-lock';
import type { VisibilityPort } from '../../src/platform/visibility';

export class FakeWakeLock implements WakeLockPort {
  requests = 0;
  releases = 0;
  held = false;
  request(): Promise<void> {
    this.requests++;
    this.held = true;
    return Promise.resolve();
  }
  release(): Promise<void> {
    this.releases++;
    this.held = false;
    return Promise.resolve();
  }
}

export class FakeVisibility implements VisibilityPort {
  private visible = true;
  private listeners = new Set<(visible: boolean) => void>();
  isVisible(): boolean {
    return this.visible;
  }
  onChange(listener: (visible: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(visible: boolean): void {
    this.visible = visible;
    for (const listener of this.listeners) listener(visible);
  }
}
