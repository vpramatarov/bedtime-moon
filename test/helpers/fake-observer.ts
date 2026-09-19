import { vi } from 'vitest';
import type { IntersectionObserverEntryLike, IntersectionObserverLike } from '../../src/scene/night-strip';

/** Fake IntersectionObserver: lets a test manually fire "this element is now centred" without real layout. */
export function fakeObserverFactory() {
  let callback: ((entries: IntersectionObserverEntryLike[]) => void) | null = null;
  const observed: Element[] = [];
  const disconnect = vi.fn();
  const factory = (cb: (entries: IntersectionObserverEntryLike[]) => void): IntersectionObserverLike => {
    callback = cb;
    return {
      observe: (target: Element) => observed.push(target),
      disconnect,
    };
  };
  return {
    factory,
    observed,
    disconnect,
    fireCentered(target: Element): void {
      callback?.([{ target, intersectionRatio: 0.9 }]);
    },
  };
}
