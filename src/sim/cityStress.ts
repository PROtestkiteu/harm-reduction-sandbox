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
  easePerHour: 0.12,
  crime: 0.05,
  scuffle: 0.1,
  policeStop: 0.03,
  /** An overdose staff did not reach: an ambulance and an A&E bed. */
  overdoseAlone: 0.12,
  /** An overdose staff reached: a check-up at most. */
  overdoseHelped: 0.02,
  exposure: 0.1,
  /** A drunk club leaver taken in to sober up. */
  drunk: 0.04,
  /**
   * One person turned away, by where they went next: no bed means a night
   * outdoors (police called, medics for the cold); no kit, no check or no
   * talk means riskier use (medics); a club leaver with no help sobers up in
   * the izba. Turned away eighty times a day holds a bar near a third.
   */
  turnedAway: {
    shelter: { police: 0.008, medics: 0.006 },
    dropIn: { medics: 0.01, police: 0.004 },
    outreach: { medics: 0.01, police: 0.004 },
    pharmacy: { medics: 0.012 },
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

export class CityStress {
  police = 0.1;
  medics = 0.1;
  sobering = 0.1;

  /** What one simulation event adds. */
  note(e: SimEvent): void {
    if (e.type === 'city' && e.happening.kind === 'crime') this.police += e.happening.crime === 'scuffle' ? STRESS.scuffle : e.happening.responded ? STRESS.crime : 0;
    else if (e.type === 'policeStop') this.police += STRESS.policeStop;
    else if (e.type === 'clubLeaver') {
      if (e.intoxicated) this.sobering += STRESS.drunk;
      if (e.acute) this.medics += e.acute.helpedBy ? STRESS.overdoseHelped : STRESS.overdoseAlone;
    } else if (e.type === 'aftermath') {
      // Someone turned away: their next hours land on the city's services.
      const w: Partial<Record<'police' | 'medics' | 'sobering', number>> = STRESS.turnedAway[e.service];
      this.police += w.police ?? 0;
      this.medics += w.medics ?? 0;
      this.sobering += w.sobering ?? 0;
      if (e.acute) this.medics += e.acute.helpedBy ? STRESS.overdoseHelped : STRESS.overdoseAlone;
    }
    else if (e.type === 'exposure') this.medics += STRESS.exposure;
    this.clamp();
  }

  tick(dtMinutes: number, camp: number, crisis: number): void {
    const hours = dtMinutes / 60;
    const keep = Math.exp(-STRESS.easePerHour * hours);
    this.police = this.police * keep + STRESS.camp * camp * hours;
    this.medics = this.medics * keep + STRESS.crisis * crisis * hours;
    this.sobering *= keep;
    this.clamp();
  }

  private clamp(): void {
    this.police = Math.min(1, Math.max(0, this.police));
    this.medics = Math.min(1, Math.max(0, this.medics));
    this.sobering = Math.min(1, Math.max(0, this.sobering));
  }
}
