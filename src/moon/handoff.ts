/** The real-sky hand-off line assembled at goodnight (TKT-0003 AC #3, #4, #5). Pure text logic;
 * the astronomy lives in position.ts. */
import {
  HANDOFF_DIRECTION_WORDS_BG,
  HANDOFF_HIDDEN_BG,
  HANDOFF_NO_LOCATION_BG,
  HANDOFF_VISIBLE_PREFIX_BG,
} from '../audio/greeting';
import { directionWord, moonPosition } from './position';

/** Above this altitude the direction word is replaced by "high up" (AC #3). */
export const HIGH_UP_ALTITUDE_DEG = 60;

export interface HandOffLocation {
  lat: number;
  lon: number;
}

export function handOffLine(now: Date, location: HandOffLocation | null): string {
  if (!location) return HANDOFF_NO_LOCATION_BG;

  const { altitude, azimuth } = moonPosition(now, location.lat, location.lon);
  if (altitude <= 0) return HANDOFF_HIDDEN_BG;

  const word = altitude > HIGH_UP_ALTITUDE_DEG ? 'high' : directionWord(azimuth);
  return `${HANDOFF_VISIBLE_PREFIX_BG}, ${HANDOFF_DIRECTION_WORDS_BG[word]}.`;
}
