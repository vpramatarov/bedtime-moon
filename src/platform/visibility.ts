/**
 * Page visibility port. `visibilitychange` is the only reliable resume hook on mobile —
 * timers are throttled or frozen while hidden (RES-0001 finding 14), so the scene re-evaluates
 * the session from the wall clock every time the page becomes visible again (AC #5).
 */

export interface VisibilityPort {
  isVisible(): boolean;
  /** Subscribe to visibility changes; returns an unsubscribe function. */
  onChange(listener: (visible: boolean) => void): () => void;
}

export function createDocumentVisibility(doc: Document = document): VisibilityPort {
  return {
    isVisible: () => doc.visibilityState !== 'hidden',
    onChange(listener) {
      const handler = (): void => listener(doc.visibilityState !== 'hidden');
      doc.addEventListener('visibilitychange', handler);
      return () => doc.removeEventListener('visibilitychange', handler);
    },
  };
}
