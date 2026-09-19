import { describe, it, expect, vi } from 'vitest';
import { buildNightStrip } from '../src/scene/night-strip';
import { loadFrames } from '../src/moon/frames';
import { nightsAround } from '../src/moon/nights';
import { fakeObserverFactory } from './helpers/fake-observer';

const frames = loadFrames();
const nights = nightsAround(new Date('2026-09-16T15:00:00Z'), frames);

function build(scrollToCard = vi.fn()) {
  const observer = fakeObserverFactory();
  const strip = buildNightStrip(nights, { createObserver: observer.factory, scrollToCard });
  return { strip, observer, scrollToCard };
}

describe('TKT-0007 AC #4 — frame image src under a non-root base path', () => {
  it('prefixes every rendered moon-card img src with the given base path', () => {
    const strip = buildNightStrip(nights, {}, '/base-test/');
    const img = strip.cards[7]!.moon.querySelector('.moon-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(`/base-test/${nights[7]!.frame.file.slice(1)}`);
  });

  it('matches today\'s unprefixed paths at the root base', () => {
    const strip = buildNightStrip(nights, {}, '/');
    const img = strip.cards[7]!.moon.querySelector('.moon-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(nights[7]!.frame.file);
  });
});

describe('AC #1, #2 — night strip structure', () => {
  it('builds exactly 15 cards, tagged with their offset, tonight in the middle', () => {
    const { strip } = build();
    expect(strip.cards).toHaveLength(15);
    expect(strip.cards.map((c) => c.offset)).toEqual(nights.map((n) => n.offset));
    expect(strip.cards[7]!.element.dataset.nightOffset).toBe('0');
    expect(strip.cards[7]!.moon.querySelector('.moon-img')).not.toBeNull();
  });

  it('scrolls to the tonight card once on build, with no animation (AC #1: centred on open)', () => {
    const scrollToCard = vi.fn();
    const { strip } = build(scrollToCard);
    expect(scrollToCard).toHaveBeenCalledTimes(1);
    expect(scrollToCard).toHaveBeenCalledWith(strip.cards[7]!.element);
  });

  it('starts centred on index 7 (tonight) before any observer event fires', () => {
    const { strip } = build();
    expect(strip.centeredIndex()).toBe(7);
  });
});

describe('AC #8 — centred-card tracking via the injected IntersectionObserver', () => {
  it('observes every card', () => {
    const { strip, observer } = build();
    expect(observer.observed).toHaveLength(15);
  });

  it('updates centeredIndex and notifies listeners when a different card becomes centred', () => {
    const { strip, observer } = build();
    const listener = vi.fn();
    strip.onCenterChange(listener);
    observer.fireCentered(strip.cards[3]!.element);
    expect(strip.centeredIndex()).toBe(3);
    expect(listener).toHaveBeenCalledWith(3);
  });

  it('unsubscribe stops further notifications', () => {
    const { strip, observer } = build();
    const listener = vi.fn();
    const unsubscribe = strip.onCenterChange(listener);
    unsubscribe();
    observer.fireCentered(strip.cards[3]!.element);
    expect(listener).not.toHaveBeenCalled();
  });

  it('destroy disconnects the observer', () => {
    const { strip, observer } = build();
    strip.destroy();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('AC #3 — scrollBy moves exactly one card and clamps at both ends', () => {
  it('scrollBy(1) scrolls to the next card', () => {
    const scrollToCard = vi.fn();
    const { strip } = build(scrollToCard);
    scrollToCard.mockClear();
    strip.scrollBy(1);
    expect(scrollToCard).toHaveBeenCalledWith(strip.cards[8]!.element);
  });

  it('scrollBy(-1) scrolls to the previous card', () => {
    const scrollToCard = vi.fn();
    const { strip } = build(scrollToCard);
    scrollToCard.mockClear();
    strip.scrollBy(-1);
    expect(scrollToCard).toHaveBeenCalledWith(strip.cards[6]!.element);
  });

  it('clamps at the last card', () => {
    const scrollToCard = vi.fn();
    const { strip, observer } = build(scrollToCard);
    observer.fireCentered(strip.cards[14]!.element);
    scrollToCard.mockClear();
    strip.scrollBy(1);
    expect(scrollToCard).toHaveBeenCalledWith(strip.cards[14]!.element);
  });

  it('clamps at the first card', () => {
    const scrollToCard = vi.fn();
    const { strip, observer } = build(scrollToCard);
    observer.fireCentered(strip.cards[0]!.element);
    scrollToCard.mockClear();
    strip.scrollBy(-1);
    expect(scrollToCard).toHaveBeenCalledWith(strip.cards[0]!.element);
  });

  it('nav zones exist on the outer thirds and call scrollBy on pointerdown', () => {
    const scrollToCard = vi.fn();
    const { strip } = build(scrollToCard);
    const left = strip.element.querySelector<HTMLElement>('.night-nav-zone.left')!;
    const right = strip.element.querySelector<HTMLElement>('.night-nav-zone.right')!;
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    scrollToCard.mockClear();
    right.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(scrollToCard).toHaveBeenCalledWith(strip.cards[8]!.element);
    scrollToCard.mockClear();
    left.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(scrollToCard).toHaveBeenCalledWith(strip.cards[6]!.element);
  });
});

describe('AC #6 — no history entries anywhere in this module', () => {
  it('never calls pushState or touches location.hash', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync('src/scene/night-strip.ts', 'utf8'));
    expect(source).not.toMatch(/pushState|location\.hash/);
  });
});

describe('default ports never throw when the underlying browser API is absent (this jsdom)', () => {
  it('builds and scrolls with zero deps supplied', () => {
    expect(() => buildNightStrip(nights)).not.toThrow();
  });
});
