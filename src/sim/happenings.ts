import { HAPPENING_IDS, HAPPENINGS, type HappeningId } from '../config/happenings';
import type { CalendarDate } from './calendar';

/**
 * What regular happening is on tonight and how far along (config/happenings.ts).
 * Rendering-free and stateless: worked out from the date and the clock, so
 * a save, a reload or a clock jump never leaves one half started.
 */
export type HappeningPhase = 'arriving' | 'on' | 'leaving';

export interface Happening {
  id: HappeningId;
  phase: HappeningPhase;
  /** How many people it brings out now, 0 to 1 (rising as they arrive, falling as they leave). */
  crowd: number;
}

/** Happenings on at `clock` (counted from 18:00) on the evening of `date`. */
export function happeningsAt(date: CalendarDate, clock: number): Happening[] {
  const out: Happening[] = [];
  for (const id of HAPPENING_IDS) {
    const h = HAPPENINGS[id];
    if (!h.when(date) || clock < h.arrive || clock >= h.leave) continue;
    if (clock < h.start) out.push({ id, phase: 'arriving', crowd: (clock - h.arrive) / (h.start - h.arrive) });
    else if (clock < h.end) out.push({ id, phase: 'on', crowd: 1 });
    else out.push({ id, phase: 'leaving', crowd: 1 - (clock - h.end) / (h.leave - h.end) });
  }
  return out;
}
