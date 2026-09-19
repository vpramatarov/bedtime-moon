/**
 * The 15-card horizontal scroll-snap strip (TKT-0004): tonight +/- 7 nights. Zero JavaScript for
 * the drag-to-snap gesture itself -- `scroll-snap-type: x mandatory` plus full-width
 * `scroll-snap-align: center` cards do that natively. This module only builds the DOM, tracks
 * which card is centred, and moves the strip on a nav-zone tap.
 *
 * Capability check (verified empirically in this project's jsdom, not assumed): neither
 * `IntersectionObserver` nor `Element.scrollIntoView`/`scrollTo`/`scrollBy` exist in this jsdom
 * (30.x) -- both real browser APIs are ports here, defaulting to a feature-detecting
 * implementation that never throws where the API is absent.
 */
import type { MoonFrame } from '../moon/frames';
import type { NightFrame } from '../moon/nights';
import { el } from './dom';

export interface IntersectionObserverEntryLike {
  target: Element;
  intersectionRatio: number;
}

export interface IntersectionObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

export type IntersectionObserverFactory = (
  callback: (entries: IntersectionObserverEntryLike[]) => void,
  options: { root: Element; threshold: number[] },
) => IntersectionObserverLike;

export interface NightCardHandle {
  readonly element: HTMLElement;
  readonly moon: HTMLElement;
  readonly body: HTMLElement;
  readonly offset: number;
}

export interface NightStripDeps {
  createObserver?: IntersectionObserverFactory;
  scrollToCard?: (card: HTMLElement) => void;
}

export interface NightStripHandle {
  readonly element: HTMLElement;
  readonly cards: readonly NightCardHandle[];
  centeredIndex(): number;
  onCenterChange(listener: (index: number) => void): () => void;
  scrollBy(delta: 1 | -1): void;
  destroy(): void;
}

const CENTER_THRESHOLD = 0.6;

function buildMoon(frame: MoonFrame, basePath: string): { moon: HTMLElement; body: HTMLElement } {
  const moon = el('div', 'moon');
  const body = el('div', 'moon-body');
  const halo = el('span', 'halo');
  const img = el('img', 'moon-img');
  img.src = basePath + frame.file.slice(1);
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  const shade = el('span', 'moon-shade');
  const glow = el('span', 'glow');
  body.append(halo, img, shade, glow);
  moon.appendChild(body);
  return { moon, body };
}

function defaultCreateObserver(
  callback: (entries: IntersectionObserverEntryLike[]) => void,
  options: { root: Element; threshold: number[] },
): IntersectionObserverLike {
  if (typeof IntersectionObserver === 'undefined') {
    return { observe: () => undefined, disconnect: () => undefined };
  }
  const real = new IntersectionObserver(
    (entries) => callback(entries.map((entry) => ({ target: entry.target, intersectionRatio: entry.intersectionRatio }))),
    options,
  );
  return {
    observe: (target: Element) => real.observe(target),
    disconnect: () => real.disconnect(),
  };
}

function defaultScrollToCard(card: HTMLElement): void {
  if (typeof card.scrollIntoView === 'function') {
    card.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' } as ScrollIntoViewOptions);
  }
}

export function buildNightStrip(
  nights: readonly NightFrame[],
  deps: NightStripDeps = {},
  basePath: string = import.meta.env.BASE_URL,
): NightStripHandle {
  const createObserver = deps.createObserver ?? defaultCreateObserver;
  const scrollToCard = deps.scrollToCard ?? defaultScrollToCard;

  const strip = el('div', 'night-strip');
  const track = el('div', 'night-strip-track');
  const navLeft = el('div', 'night-nav-zone left');
  const navRight = el('div', 'night-nav-zone right');

  const cards: NightCardHandle[] = nights.map((night) => {
    const card = el('div', 'night-card');
    card.dataset.nightOffset = String(night.offset);
    const { moon, body } = buildMoon(night.frame, basePath);
    card.appendChild(moon);
    return { element: card, moon, body, offset: night.offset };
  });
  track.append(...cards.map((c) => c.element));
  strip.append(track, navLeft, navRight);

  const tonightIndex = cards.findIndex((c) => c.offset === 0);
  let currentIndex = tonightIndex;
  const listeners = new Set<(index: number) => void>();

  const observer = createObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio < CENTER_THRESHOLD) continue;
        const index = cards.findIndex((c) => c.element === entry.target);
        if (index === -1 || index === currentIndex) continue;
        currentIndex = index;
        for (const listener of listeners) listener(index);
      }
    },
    { root: track, threshold: [CENTER_THRESHOLD] },
  );
  for (const card of cards) observer.observe(card.element);

  scrollToCard(cards[tonightIndex]!.element);

  function scrollBy(delta: 1 | -1): void {
    const clamped = Math.max(0, Math.min(cards.length - 1, currentIndex + delta));
    scrollToCard(cards[clamped]!.element);
  }

  navLeft.addEventListener('pointerdown', () => scrollBy(-1));
  navRight.addEventListener('pointerdown', () => scrollBy(1));

  return {
    element: strip,
    cards,
    centeredIndex: () => currentIndex,
    onCenterChange(listener: (index: number) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    scrollBy,
    destroy(): void {
      observer.disconnect();
      listeners.clear();
      strip.remove();
    },
  };
}
