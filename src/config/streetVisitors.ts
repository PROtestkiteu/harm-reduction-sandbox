import { t } from '../i18n';
import type { ServiceId } from '../sim/types';

/**
 * People who come to the services with a view of them: a picket, a priest or
 * a nun. Each is as likely to be for harm reduction as against it, as
 * attitudes are split (Caluzzi 2023: 56% of Australians supported drug
 * checking; Hutchison 2025: from welcoming to oppositional). A picket against
 * holds placards at the door; one for it holds a vigil with candles for those
 * who died. A priest or nun against preaches at the queue; one for it hands
 * out tea and blankets. ILLUSTRATIVE numbers.
 */
export type VisitorKind = 'picket' | 'priest' | 'nun';
export type Stance = 'support' | 'oppose';

export const VISITORS = {
  /** Chance someone comes on a given evening, and the share of each kind. */
  chance: 0.4,
  kinds: { picket: 0.4, priest: 0.3, nun: 0.3 } as Record<VisitorKind, number>,
  /** Share who support harm reduction. */
  support: 0.5,
  /** When they come (clock minutes) and how long they stay. */
  arrive: [1170, 1290] as const,
  stay: [120, 200] as const,
  /** Where they go if it is open (the drop-in's pavement is where the street shows them). */
  places: ['dropIn'] as readonly ServiceId[],
  /** Extra share of people heading there who turn back while they are there (negative: fewer turn back). */
  deter: { oppose: { picket: 0.14, priest: 0.08, nun: 0.08 }, support: { picket: -0.05, priest: -0.08, nun: -0.1 } } as Record<Stance, Record<VisitorKind, number>>,
  /** Support gets a mention in the parish newsletter or the local paper: funders' trust, once a visit. */
  supportTrust: 0.02,
} as const;

/** What the event feed says when they arrive, with the service's name. */
export const VISIT_NOTICE: Record<Stance, Record<VisitorKind, (place: string) => string>> = {
  oppose: {
    picket: (place) => t('A picket against the {place} has set up at its door with placards. More people heading there turn back.', { place }),
    priest: (place) => t('A priest is preaching against drug use at the queue for the {place}. Some people turn back.', { place }),
    nun: (place) => t('A nun is telling the queue at the {place} to go home and pray. Some people turn back.', { place }),
  },
  support: {
    picket: (place) => t('A candlelit vigil for people lost to overdose stands by the {place}. Fewer people turn back, and the funders hear of it.', { place }),
    priest: (place) => t('A priest is handing out tea at the {place} and telling people they are welcome. Fewer turn back.', { place }),
    nun: (place) => t('A nun is handing out blankets at the {place} and sitting with whoever wants company. Fewer turn back.', { place }),
  },
};
