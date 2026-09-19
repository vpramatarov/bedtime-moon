/**
 * Goodnight clouds — four soft lavender blobs that drift in over the moon (AC #3).
 * Pure DOM, no text; motion lives in CSS (`@keyframes clouds-in`, transform + opacity only).
 */

export interface Cloud {
  /** Percent of scene width for the left edge. */
  x: number;
  /** Percent of scene height for the top edge. */
  y: number;
  /** Width as a percentage of the moon size. */
  width: number;
  /** Slide-in direction: -1 from the left, 1 from the right. */
  from: -1 | 1;
  /** Stagger, seconds. */
  delay: number;
}

/** Positions relative to the moon (centre 50 %, 46 %; diameter --moon-size). */
export const CLOUDS: readonly Cloud[] = [
  { x: 18, y: 38, width: 78, from: -1, delay: 0 },
  { x: 44, y: 46, width: 84, from: 1, delay: 0.4 },
  { x: 24, y: 53, width: 70, from: 1, delay: 0.8 },
  { x: 50, y: 36, width: 62, from: -1, delay: 1.1 },
];

export function buildClouds(clouds: readonly Cloud[] = CLOUDS): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'clouds';
  for (const cloud of clouds) {
    const node = document.createElement('span');
    node.className = 'cloud';
    node.style.setProperty('--cx', `${cloud.x}%`);
    node.style.setProperty('--cy', `${cloud.y}%`);
    node.style.setProperty('--cw', `calc(var(--moon-size) * ${cloud.width / 100})`);
    node.style.setProperty('--from', String(cloud.from));
    node.style.setProperty('--delay', `${cloud.delay}s`);
    layer.appendChild(node);
  }
  return layer;
}
