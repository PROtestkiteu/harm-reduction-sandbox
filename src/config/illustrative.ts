/**
 * ILLUSTRATIVE VALUES ONLY. None of these numbers come from evidence. They are
 * tuned so the diorama shows legible activity at a glance and are kept in one
 * place so a sourced model can replace them without touching scene code.
 *
 * Demand, attendance, unmet need and adverse outcomes are counted separately.
 * Higher attendance can mean better access, so nothing here treats it as harm.
 * Adverse outcomes use a neutral placeholder: no effect of any service on harm
 * is assumed until a sourced model exists.
 */
import type { ServiceId } from '../sim/types';

export interface ServiceParams {
  name: string;
  /** People per minute of scene time who set out to use this service. */
  demandPerMinute: number;
  /** Staff who walk to their posts when the service is switched on. */
  staff: number;
  /** People served at the same time once fully staffed. */
  capacityPerStaff: number;
  /** Visible waiting places (seats or queue spots). */
  waitingSlots: number;
  /** Seconds of scene time spent being served. */
  serviceSeconds: readonly [number, number];
  /** Seconds a person waits before leaving unserved. */
  patienceSeconds: number;
}

export const ILLUSTRATIVE = {
  /** Clock minutes shown per real second at 1x. Walking stays real time. */
  clockMinutesPerSecond: 1,
  clockStartMinutes: 19 * 60,
  seed: 20261031,

  services: {
    dropIn: {
      name: 'Drop-in centre',
      demandPerMinute: 3.0,
      staff: 2,
      capacityPerStaff: 1.5,
      waitingSlots: 8,
      serviceSeconds: [35, 60],
      patienceSeconds: 60,
    },
    outreach: {
      name: 'Mobile outreach',
      demandPerMinute: 2.2,
      staff: 2,
      capacityPerStaff: 0.5,
      waitingSlots: 5,
      serviceSeconds: [14, 24],
      patienceSeconds: 45,
    },
    clubHr: {
      name: 'Club harm reduction stand',
      // Demand here is the share of club arrivals who look for the stand.
      demandPerMinute: 0,
      staff: 2,
      capacityPerStaff: 1,
      waitingSlots: 3,
      serviceSeconds: [5, 9],
      patienceSeconds: 20,
    },
    pharmacy: {
      name: 'Pharmacy needle and syringe programme',
      demandPerMinute: 1.6,
      staff: 2,
      capacityPerStaff: 1,
      waitingSlots: 4,
      serviceSeconds: [20, 40],
      patienceSeconds: 50,
    },
    drugChecking: {
      name: 'Drug checking service',
      demandPerMinute: 1.2,
      staff: 2,
      capacityPerStaff: 1,
      waitingSlots: 5,
      serviceSeconds: [40, 70],
      patienceSeconds: 70,
    },
    shelter: {
      name: 'Night shelter and day centre',
      demandPerMinute: 1.4,
      staff: 3,
      capacityPerStaff: 2,
      waitingSlots: 6,
      serviceSeconds: [60, 110],
      patienceSeconds: 80,
    },
    clinic: {
      name: 'Opioid treatment clinic',
      demandPerMinute: 1.4,
      staff: 3,
      capacityPerStaff: 1.5,
      waitingSlots: 6,
      serviceSeconds: [40, 80],
      patienceSeconds: 70,
    },
  } satisfies Record<ServiceId, ServiceParams>,

  club: {
    name: 'Music club',
    arrivalsPerMinute: 4.2,
    /** Share of arriving club-goers who look for the stand on the way in. */
    standInterest: 0.4,
    capacity: 180,
    initialInside: 64,
    doorIntervalSeconds: [10, 15] as const,
    queueSlots: 7,
    leaversPerMinute: 1.6,
  },

  /** People walking through to somewhere else. */
  passersbyPerMinute: 2.4,
  /** Share of people served at a checking site who bring a sample. The stand exists for it; elsewhere it is one service among several. */
  checkingShare: { dropIn: 0.35, outreach: 0.35, clubHr: 1, drugChecking: 1, pharmacy: 0.2, shelter: 0.2, clinic: 0.2 } satisfies Record<ServiceId, number>,
  /**
   * How people fare, for what the crowd shows. All illustrative. Sources give
   * direction and context only: Wallace 2022 (people seek places without arrest
   * risk), Hunt 2004 (supervised consumption: 50 overdoses managed in Sydney's
   * first six months), Krieger 2018 (people who overdosed were more often
   * arrested: 91% vs 63%), Hungerbuehler 2011 (alcohol on 56.5% of typical
   * nights among Zurich nightlife checking clients). No library source measures
   * how often unmet need leads to use in hidden places.
   */
  people: {
    /** Share of unmet need at the drop-in or outreach followed by use in a hidden spot. */
    hiddenUseShare: 0.35,
    /** Share of possession stops that end in arrest. */
    arrestShare: 0.3,
    /** Share of club leavers visibly intoxicated, early evening to late night. */
    intoxication: { early: 0.1, late: 0.55 },
  },
  /** Possession stops per minute for each patrolling officer, where possession is an offence. */
  policeStopsPerMinutePerOfficer: 0.5,
  /** Cars along the one-way street. */
  carsPerMinute: 1.4,

  adverse: {
    /** Placeholder chance per person whose need went unmet. */
    perUnmetNeed: 0.02,
    /** Placeholder chance per club entry. */
    perClubEntry: 0.004,
    /** Neutral by design: 1 means no assumed effect of service contact. */
    serviceContactMultiplier: 1,
  },
} as const;
