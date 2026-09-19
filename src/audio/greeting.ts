import type { CompassDirection } from '../moon/position';

/** The moon's spoken greeting (Bulgarian). Kept short so it fits in ≈ 2–3 s. */
export const GREETING_BG = 'Здравей! Аз съм Луната.';

/**
 * Same-origin URL of a recorded greeting, used when the device has no Bulgarian voice.
 * Stays null until a recording is added under public/audio/ — while null no request is made,
 * so an offline open never logs a failed request (AC #3, TKT-0006).
 */
export const GREETING_FALLBACK_URL: string | null = null;

/**
 * Optional lullaby (≤ 20 s, CC0 or Parent-made — PRD-0001 §9). When set it plays at goodnight
 * instead of the spoken line. Same-origin path under /audio/ or null.
 */
export const LULLABY_URL: string | null = null;

/**
 * The real-sky hand-off line (TKT-0003), spoken in the same slot as GOODNIGHT_BG used to occupy
 * when no lullaby is set. Plain hyphens, not em-dashes, so the existing Cyrillic-charset test
 * needs no widening.
 */
export const HANDOFF_VISIBLE_PREFIX_BG = 'Луната е навън - да отидем да я видим';
export const HANDOFF_HIDDEN_BG = 'Луната се крие тази вечер - да помахаме за лека нощ на небето.';
export const HANDOFF_NO_LOCATION_BG = 'Хайде да потърсим луната навън.';

export const HANDOFF_DIRECTION_WORDS_BG: Record<CompassDirection | 'high', string> = {
  north: 'на север',
  'north-east': 'на североизток',
  east: 'на изток',
  'south-east': 'на югоизток',
  south: 'на юг',
  'south-west': 'на югозапад',
  west: 'на запад',
  'north-west': 'на северозапад',
  high: 'високо горе',
};
