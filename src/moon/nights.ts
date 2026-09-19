/** Tonight +/- 7 nights, each mapped to the bundled frame nearest its own phase (TKT-0004 AC #2). */
import { getMoonIllumination } from 'suncalc';
import type { MoonFrame } from './frames';
import { nearestFrame } from './phase';

export const NIGHT_WINDOW = 7;
/** All 15 cards, tonight included, use the same 21:00-local rule -- a deliberate uniform choice
 * over TKT-0001's original "tonight = phase at the raw instant". */
export const NIGHT_HOUR_LOCAL = 21;
export const TOTAL_NIGHTS = NIGHT_WINDOW * 2 + 1;

export interface NightFrame {
  /** -7..7; 0 = tonight. */
  offset: number;
  frame: MoonFrame;
}

export function nightsAround(now: Date, frames: readonly MoonFrame[]): NightFrame[] {
  const nights: NightFrame[] = [];
  for (let offset = -NIGHT_WINDOW; offset <= NIGHT_WINDOW; offset++) {
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, NIGHT_HOUR_LOCAL, 0, 0, 0);
    nights.push({ offset, frame: nearestFrame(getMoonIllumination(local).phase, frames) });
  }
  return nights;
}
