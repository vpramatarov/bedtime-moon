import { describe, it, expect, vi, afterEach } from 'vitest';
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
