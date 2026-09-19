/**
 * Settings entry glyph (AC #1). The one interactive element on the child screen with an
 * `aria-label` instead of a text node — TKT-0001's zero-text-nodes rule bans visible text, not
 * accessible names, so "Настройки" lives on the attribute only.
 *
 * Built as an inline SVG (a `<circle>` via `createElementNS`, never `innerHTML`) so nothing here
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
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', '12');
  dot.setAttribute('cy', '12');
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', 'currentColor');
  svg.appendChild(dot);
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
