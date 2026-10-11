/**
 * Settings entry glyph (AC #1). The one interactive element on the child screen with an
 * `aria-label` instead of a text node — TKT-0001's zero-text-nodes rule bans visible text, not
 * accessible names, so "Настройки" lives on the attribute only.
 *
 * Built as an inline SVG (three hamburger `<line>`s via `createElementNS`, never `innerHTML`;
 * PRD-0003 / TKT-0013) so nothing here
 * is an `<img>` or a network request, and so mounting adds no whitespace text nodes either.
 *
 * Appended as a SIBLING of `.scene`, never inside it: the scene gets `inert` during the
 * goodnight screen (TKT-0002), and Restart lives behind this glyph, so it must stay reachable
 * even then.
 *
 * pointerdown calls `event.stopPropagation()` before `onOpen()` so opening settings is never
 * also read by the scene as a tap on the moon and never arms its idle-greeting timer — both key
 * off pointerdown bubbling up from inside `.scene`.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildGlyph(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  // 1 viewBox unit = 1px. Bars at y 3/8/13 (5px apart, centred); x 1→15 plus the 1px round caps
  // makes each bar 16px wide.
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const y of ['3', '8', '13']) {
    const bar = document.createElementNS(SVG_NS, 'line');
    bar.setAttribute('x1', '1');
    bar.setAttribute('x2', '15');
    bar.setAttribute('y1', y);
    bar.setAttribute('y2', y);
    bar.setAttribute('stroke', 'currentColor');
    bar.setAttribute('stroke-width', '2');
    bar.setAttribute('stroke-linecap', 'round');
    svg.appendChild(bar);
  }
  return svg;
}

export function mountSettingsEntry(
  root: HTMLElement,
  onOpen: () => void,
): { element: HTMLElement; destroy(): void } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'settings-entry';
  button.setAttribute('aria-label', 'Настройки');
  button.appendChild(buildGlyph());

  const handlePointerDown = (event: PointerEvent): void => {
    event.stopPropagation();
    onOpen();
  };
  button.addEventListener('pointerdown', handlePointerDown);

  root.appendChild(button);

  return {
    element: button,
    destroy(): void {
      button.removeEventListener('pointerdown', handlePointerDown);
      button.remove();
    },
  };
}
