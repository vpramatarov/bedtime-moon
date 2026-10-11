import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountSettingsEntry } from '../src/settings/entry';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(root: HTMLElement, onOpen: () => void): ReturnType<typeof mountSettingsEntry> {
  return mountSettingsEntry(root, onOpen);
}

describe('mountSettingsEntry (TKT-0005 AC #1)', () => {
  it('renders exactly one button.settings-entry with no text nodes and an inline SVG glyph', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const { element } = mount(root, () => {});

    const buttons = root.querySelectorAll('button.settings-entry');
    expect(buttons.length).toBe(1);
    expect(buttons[0]).toBe(element);
    expect(element.getAttribute('aria-label')).toBe('Настройки');
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('svg')).not.toBeNull();

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNodeCount = 0;
    while (walker.nextNode()) textNodeCount++;
    expect(textNodeCount).toBe(0);
  });

  it('pointerdown fires onOpen exactly once and does not bubble to a parent listener', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const parentListener = vi.fn();
    root.addEventListener('pointerdown', parentListener);
    const onOpen = vi.fn();

    const { element } = mount(root, onOpen);
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(parentListener).not.toHaveBeenCalled();
  });

  it('is appended as a sibling of a pre-existing .scene element, never inside it', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const scene = document.createElement('div');
    scene.className = 'scene';
    root.appendChild(scene);

    const { element } = mount(root, () => {});

    expect(element.parentElement).toBe(root);
    expect(scene.contains(element)).toBe(false);
    expect(Array.from(root.children)).toEqual([scene, element]);
  });
});

describe('hamburger glyph (PRD-0003 / TKT-0013)', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function glyph(): SVGSVGElement {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const svg = mount(root, () => {}).element.querySelector('svg');
    if (!svg) throw new Error('no svg glyph');
    return svg;
  }

  it('AC #1 — glyph is three round-capped 2px bars, 16px wide, 5px apart, centred, no circle', () => {
    const svg = glyph();

    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('circle').length).toBe(0);

    const bars = Array.from(svg.children);
    expect(bars.map((bar) => bar.localName)).toEqual(['line', 'line', 'line']);
    expect(bars.map((bar) => bar.getAttribute('y1'))).toEqual(['3', '8', '13']);
    for (const bar of bars) {
      expect(bar.getAttribute('y2')).toBe(bar.getAttribute('y1'));
      // x 1→15 plus a 1px round cap at each end = 16px wide, flush with the 16-unit viewBox
      expect(bar.getAttribute('x1')).toBe('1');
      expect(bar.getAttribute('x2')).toBe('15');
      expect(bar.getAttribute('stroke')).toBe('currentColor');
      expect(bar.getAttribute('stroke-width')).toBe('2');
      expect(bar.getAttribute('stroke-linecap')).toBe('round');
    }
  });

  it('AC #4 — every glyph node is in the SVG namespace and entry.ts never uses innerHTML', () => {
    const svg = glyph();

    expect(svg.namespaceURI).toBe(SVG_NS);
    for (const node of Array.from(svg.querySelectorAll('*'))) expect(node.namespaceURI).toBe(SVG_NS);
    // property access only — the header comment legitimately says "never `innerHTML`"
    expect(readFileSync('src/settings/entry.ts', 'utf8')).not.toMatch(/\.(?:inner|outer)HTML\b|insertAdjacentHTML/);
  });
});
