import type { SimEvent } from './simulation';
import type { ServiceId } from './types';

/**
 * Pressure on the city's own services: police, ambulances and A&E, and the
 * sobering-up centre (izba wytrzeźwień). Each runs 0 (quiet) to 1
 * (overstretched): incidents, overdoses nobody reached, people harmed by cold
 * or heat and drunk club leavers add to it; it eases over a few hours. Harm
 * reduction takes load off: an overdose staff reach in time needs no
 * ambulance. ILLUSTRATIVE weights, placeholders for play.
 */
export const STRESS = {
  /** Share that eases per clock hour. */
  easePerHour: 0.15,
  crime: 0.02,
  scuffle: 0.03,
  policeStop: 0.03,
  /** An overdose staff did not reach: an ambulance and an A&E bed. */
  overdoseAlone: 0.08,
  /** An overdose staff reached: a check-up at most. */
  overdoseHelped: 0.02,
  exposure: 0.1,
  /** A drunk club leaver taken in to sober up. */
  drunk: 0.04,
  /**
   * One person turned away, by where they went next: no bed means a night
   * outdoors (police called, medics for the cold); no kit, no check or no
   * talk means riskier use (medics); a club leaver with no help sobers up in
   * the izba. Turned away eighty times a day holds a bar near a quarter.
   */
  turnedAway: {
    shelter: { police: 0.008, medics: 0.006 },
    dropIn: { medics: 0.01, police: 0.004 },
    outreach: { medics: 0.01, police: 0.004 },
    footPatrol: { medics: 0.012 },
    clinic: { medics: 0.012 },
    drugChecking: { medics: 0.01 },
    clubHr: { sobering: 0.012, medics: 0.004 },
  } satisfies Record<ServiceId, Partial<Record<'police' | 'medics' | 'sobering', number>>>,
  /** Per clock hour at full camp size, and at the worst of a crisis. */
  camp: 0.03,
  crisis: 0.03,
  /** Overstretched medics: more people harmed outdoors do not survive (up to this share more). */
  medicsDeaths: 0.6,
  /** Overstretched police: the council leans on funders (grant chances down by up to this share). */
  policeGrantCut: 0.2,
} as const;

export type StressMeter = 'police' | 'medics' | 'sobering';

/**
 * Why a meter is where it is: what each kind of event added, easing at the
 * meter's own pace, so the shares say what holds it up now. `turnedAway` is
 * split by the service that turned people away.
 */
export type StressCause =
  | 'crime' | 'scuffle' | 'policeStop' | 'drunk' | 'overdoseAlone' | 'overdoseHelped' | 'exposure' | 'camp' | 'crisis'
  | `turnedAway:${ServiceId}`;

export class CityStress {
  police = 0.1;
  medics = 0.1;
  sobering = 0.1;
  /** Recent contributions per meter and cause (eased like the meter). Read with `causesOf`. */
  private readonly recent: Record<StressMeter, Map<StressCause, number>> = { police: new Map(), medics: new Map(), sobering: new Map() };

  private add(meter: StressMeter, cause: StressCause, amount: number): void {
    if (amount <= 0) return;
    this[meter] += amount;
    const m = this.recent[meter];
    m.set(cause, (m.get(cause) ?? 0) + amount);
  }

  /** What is pushing `meter` up now, largest first, as shares of the recent total (0..1). */
  causesOf(meter: StressMeter): { cause: StressCause; share: number }[] {
    const m = this.recent[meter];
    let total = 0;
    for (const v of m.values()) total += v;
    if (total < 1e-4) return [];
    return [...m].map(([cause, v]) => ({ cause, share: v / total })).filter((c) => c.share >= 0.03).sort((a, b) => b.share - a.share);
  }

  /** What one simulation event adds. */
  note(e: SimEvent): void {
    if (e.type === 'city' && e.happening.kind === 'crime') {
      if (e.happening.crime === 'scuffle') this.add('police', 'scuffle', STRESS.scuffle);
      else if (e.happening.responded) this.add('police', 'crime', STRESS.crime);
    } else if (e.type === 'policeStop') this.add('police', 'policeStop', STRESS.policeStop);
    else if (e.type === 'clubLeaver') {
      if (e.intoxicated) this.add('sobering', 'drunk', STRESS.drunk);
      if (e.acute) this.overdose(!!e.acute.helpedBy);
    } else if (e.type === 'aftermath') {
      // Someone turned away: their next hours land on the city's services.
      const w: Partial<Record<StressMeter, number>> = STRESS.turnedAway[e.service];
      const cause = `turnedAway:${e.service}` as const;
      this.add('police', cause, w.police ?? 0);
      this.add('medics', cause, w.medics ?? 0);
      this.add('sobering', cause, w.sobering ?? 0);
      if (e.acute) this.overdose(!!e.acute.helpedBy);
    }
    else if (e.type === 'exposure') this.add('medics', 'exposure', STRESS.exposure);
    this.clamp();
  }

  private overdose(helped: boolean): void {
    this.add('medics', helped ? 'overdoseHelped' : 'overdoseAlone', helped ? STRESS.overdoseHelped : STRESS.overdoseAlone);
  }

  /** `ease` speeds up how fast a service recovers (partnerships with A&E or the izba): 1 is the usual pace. */
  tick(dtMinutes: number, camp: number, crisis: number, ease: { medics: number; sobering: number } = { medics: 1, sobering: 1 }): void {
    const hours = dtMinutes / 60;
    const keep = { police: Math.exp(-STRESS.easePerHour * hours), medics: Math.exp(-STRESS.easePerHour * ease.medics * hours), sobering: Math.exp(-STRESS.easePerHour * ease.sobering * hours) };
    this.police *= keep.police;
    this.medics *= keep.medics;
    this.sobering *= keep.sobering;
    for (const meter of ['police', 'medics', 'sobering'] as const) for (const [k, v] of this.recent[meter]) this.recent[meter].set(k, v * keep[meter]);
    this.add('police', 'camp', STRESS.camp * camp * hours);
    this.add('medics', 'crisis', STRESS.crisis * crisis * hours);
    this.clamp();
  }

  private clamp(): void {
    this.police = Math.min(1, Math.max(0, this.police));
    this.medics = Math.min(1, Math.max(0, this.medics));
    this.sobering = Math.min(1, Math.max(0, this.sobering));
  }
}
