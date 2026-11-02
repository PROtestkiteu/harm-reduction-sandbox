import { createRandom, pick, type Random } from './random';
import { SERVICE_IDS, type ServiceId } from './types';
import { t } from '../i18n';
import { GROWTH_IN_JOB, MORALE } from '../config/morale';

/**
 * The people behind the staff numbers. Rendering-free.
 *
 * Each worker is paid or a volunteer, has one or two qualities that make them
 * better (or, when new, a little slower) at particular services, and energy
 * that drains on shift and comes back off it. The player can pin someone to a
 * service or send them to rest; everyone else is placed automatically, best
 * fit first. ILLUSTRATIVE effects throughout.
 */

export type TraitId = 'peer' | 'nurse' | 'chemist' | 'social' | 'languages' | 'calm' | 'nightOwl' | 'new';

export interface Trait {
  label: string;
  detail: string;
  /** Extra share of capacity per person at these services (0.3 = 30% more, -0.15 = 15% less). */
  bonus: Partial<Record<ServiceId, number>>;
  /** Applies at every service. */
  everywhere?: number;
}

export const TRAITS: Record<TraitId, Trait> = {
  peer: { label: t('Peer worker'), detail: t('Lived experience; people open up to them. No clinical training'), bonus: { dropIn: 0.3, outreach: 0.3, clubHr: 0.2, shelter: 0.2, clinic: -0.2 } },
  nurse: { label: t('Nurse'), detail: t('Wound care, overdose response, prescriptions'), bonus: { clinic: 0.4, footPatrol: 0.3, dropIn: 0.1 } },
  chemist: { label: t('Chemist'), detail: t('Runs the analysis and explains results. Less at home on the street'), bonus: { drugChecking: 0.5, outreach: -0.15, footPatrol: -0.15, clubHr: -0.1 } },
  social: { label: t('Social worker'), detail: t('Housing, benefits and referrals. Less used to the club floor'), bonus: { shelter: 0.35, dropIn: 0.2, clubHr: -0.15 } },
  languages: { label: t('Several languages'), detail: t('Reaches people others cannot'), bonus: {}, everywhere: 0.12 },
  calm: { label: t('Calm under pressure'), detail: t('Good with crowds and crises'), bonus: { clubHr: 0.25, outreach: 0.15 } },
  nightOwl: { label: t('Night owl'), detail: t('Tires slower after midnight'), bonus: {} },
  new: { label: t('New to the work'), detail: t('Still learning; a little slower'), bonus: {}, everywhere: -0.15 },
};

/** What wore a worker's morale down most: named when they quit. */
export type Blow = 'turnedAway' | 'overdose' | 'death' | 'overwork' | 'unpaid';

/** Where a worker goes: placed automatically, pinned to a service, or resting. */
export type Assignment = 'auto' | 'rest' | ServiceId;

export interface Member {
  readonly id: number;
  readonly name: string;
  readonly paid: boolean;
  /** Qualities; "new to the work" wears off with hours on shift (config/morale.ts). */
  traits: TraitId[];
  /** 0 exhausted, 1 fresh. */
  energy: number;
  /** 0 ready to quit, 1 full of heart (config/morale.ts). */
  morale: number;
  /** Clock hours worked at each place. */
  hours: Partial<Record<ServiceId, number>>;
  /** The place they have specialised in, if any. */
  special: ServiceId | null;
  /** Morale lost per cause since they joined, to say why they quit. Not saved. */
  blows: Record<Blow, number>;
  /** Whether the low-morale warning was given (until they recover). */
  warned: boolean;
  assignment: Assignment;
  /** Where they work right now (set by the simulation), or null. */
  workingAt: ServiceId | null;
  /** Worn out: sent home to rest until their energy is back. Only for automatic placement. */
  worn: boolean;
}

/** Below this, automatically placed workers go home to rest; back above `RESTED` they return. */
export const TIRED = 0.2;
const RESTED = 0.6;

const NAMES = [
  'Jonas', 'Mia', 'Emre', 'Aleksandra', 'Kofi', 'Lena', 'Dmytro', 'Sara', 'Yusuf', 'Hanna', 'Piotr', 'Amira', 'Felix', 'Noor',
  'Marta', 'Tobias', 'Zeynep', 'Olek', 'Chiara', 'Ines', 'Jakob', 'Lea', 'Bilal', 'Kasia', 'Mateusz', 'Fatima', 'Nils', 'Rosa',
  'Samir', 'Ida', 'Malik', 'Greta', 'Arash', 'Vera', 'Tomasz', 'Ayla', 'Luca', 'Johanna', 'Kwame', 'Nadia',
] as const;

const PAID_TRAITS: readonly TraitId[] = ['nurse', 'nurse', 'social', 'social', 'chemist', 'peer', 'languages', 'calm', 'nightOwl'];
const VOLUNTEER_TRAITS: readonly TraitId[] = ['peer', 'peer', 'peer', 'new', 'new', 'languages', 'calm', 'nightOwl', 'social'];

export class Team {
  readonly members: Member[] = [];
  private nextId = 1;
  private readonly random: Random;

  /** Its own random stream, so the team never shifts the simulation's draws. */
  constructor(seed: number) {
    this.random = createRandom(seed ^ 0x5eed7);
  }

  /** How good `m` is at `service` by their qualities alone: 1 is ordinary. */
  static traitFit(m: Member, service: ServiceId): number {
    let f = m.special === service ? 1 + GROWTH_IN_JOB.specialBonus : 1;
    for (const t of m.traits) f += (TRAITS[t].bonus[service] ?? 0) + (TRAITS[t].everywhere ?? 0);
    return Math.max(0.4, f);
  }

  /** How good `m` is at `service` right now: their qualities, dragged down by tiredness and low morale. */
  static fit(m: Member, service: ServiceId): number {
    return Math.max(0.4, Team.traitFit(m, service) - (m.energy < 0.35 ? 0.25 : 0) - (m.morale < MORALE.shakenBelow ? MORALE.shakenFit : 0));
  }

  /** Whether `m` is shaken: low morale, working slower. */
  static shaken(m: Member): boolean {
    return m.morale < MORALE.shakenBelow;
  }

  /** Grows or shrinks the team to the organisation's head counts. */
  sync(paid: number, volunteers: number): void {
    for (const isPaid of [true, false]) {
      const want = isPaid ? paid : volunteers;
      const have = this.members.filter((m) => m.paid === isPaid);
      for (let n = have.length; n < want; n++) this.members.push(this.recruit(isPaid));
      // Leavers: the most tired automatically placed person goes first, pinned people last.
      const leaving = have.length - want;
      if (leaving > 0) {
        const order = [...have].sort((a, b) => Number(a.assignment !== 'auto') - Number(b.assignment !== 'auto') || a.energy - b.energy);
        for (const m of order.slice(0, leaving)) this.members.splice(this.members.indexOf(m), 1);
      }
    }
  }

  private recruit(paid: boolean): Member {
    const used = new Set(this.members.map((m) => m.name));
    const free = NAMES.filter((n) => !used.has(n));
    const name = free.length ? pick(this.random, free) : `${pick(this.random, NAMES)} ${this.nextId}`;
    const pool = paid ? PAID_TRAITS : VOLUNTEER_TRAITS;
    const first = pick(this.random, pool);
    const traits: TraitId[] = [first];
    if (this.random() < 0.55) {
      const second = pick(this.random, pool);
      if (second !== first && !(second === 'new' && paid)) traits.push(second);
    }
    const morale = MORALE.start + (this.random() * 2 - 1) * MORALE.startSpread;
    return { id: this.nextId++, name, paid, traits, energy: 0.75 + this.random() * 0.25, morale, hours: {}, special: null, blows: Team.noBlows(), warned: false, assignment: 'auto', workingAt: null, worn: false };
  }

  static noBlows(): Record<Blow, number> {
    return { turnedAway: 0, overdose: 0, death: 0, overwork: 0, unpaid: 0 };
  }

  /**
   * Morale moves for one member: `amount` up or down, with the cause of a
   * fall remembered. Volunteers feel falls more (`steadier` halves the extra).
   */
  private static move(m: Member, amount: number, cause: Blow | null, steadier: boolean): void {
    if (amount < 0 && !m.paid) amount *= steadier ? 1 + (MORALE.volunteerFragility - 1) / 2 : MORALE.volunteerFragility;
    m.morale = Math.min(1, Math.max(0, m.morale + amount));
    if (amount < 0 && cause) m.blows[cause] -= amount;
  }

  /** Someone was helped at `service`: those on shift there feel it. */
  helpedAt(service: ServiceId): void {
    for (const m of this.members) if (m.workingAt === service) Team.move(m, MORALE.helped, null, false);
  }

  /** Someone was turned away at `service`: those there most, the rest a little. */
  turnedAwayAt(service: ServiceId, steadier: boolean, factor = 1): void {
    for (const m of this.members) Team.move(m, -(m.workingAt === service ? MORALE.turnedAway : MORALE.turnedAwayTeam) * factor, 'turnedAway', steadier);
  }

  /** A blow to the whole team: an overdose nobody reached, or a death. */
  blow(cause: 'overdose' | 'death', steadier: boolean): void {
    const amount = cause === 'death' ? MORALE.death : MORALE.overdoseAlone;
    for (const m of this.members) Team.move(m, -amount, cause, steadier);
  }

  /** A worker met a need their skill fits. */
  matched(m: Member): void {
    Team.move(m, MORALE.matched, null, false);
  }

  /** Who can be placed: not resting by choice, not worn out, and paid only when wages can be paid. */
  available(canPay: boolean): Member[] {
    return this.members.filter((m) => m.assignment !== 'rest' && (canPay || !m.paid) && !(m.assignment === 'auto' && m.worn));
  }

  /**
   * Drains energy on shift and restores it off shift. Returns true when an
   * automatically placed worker just tired out or recovered, so the rota
   * should be drawn up again.
   */
  tick(hours: number, lateNight: boolean, ctx: { unpaid: boolean; steadier: boolean; drain?: number } = { unpaid: false, steadier: false }): boolean {
    let changed = false;
    for (const m of this.members) {
      const before = m.energy;
      if (m.workingAt) {
        m.energy -= hours * (lateNight && m.traits.includes('nightOwl') ? 0.04 : 0.08) * (ctx.drain ?? 1);
        m.hours[m.workingAt] = (m.hours[m.workingAt] ?? 0) + hours;
        if (m.energy < TIRED + 0.1) Team.move(m, -MORALE.overworkedPerHour * hours, 'overwork', ctx.steadier);
      } else {
        m.energy += hours * 0.12;
        if (m.morale < MORALE.restTo) m.morale = Math.min(MORALE.restTo, m.morale + MORALE.restPerHour * hours);
      }
      if (m.paid && ctx.unpaid) Team.move(m, -MORALE.unpaidPerHour * hours, 'unpaid', ctx.steadier);
      m.energy = Math.min(1, Math.max(0, m.energy));
      if (m.assignment !== 'auto') continue;
      if (!m.worn && before >= TIRED && m.energy < TIRED) { m.worn = true; changed = true; }
      else if (m.worn && m.energy >= RESTED) { m.worn = false; changed = true; }
    }
    return changed;
  }

  /**
   * Growing into the job and quitting, checked once a clock hour. Returns who
   * grew (lost "new", or specialised) and who quits now, already removed from
   * the team; the caller lowers the head counts and says so.
   */
  review(): { grew: { m: Member; what: 'experienced' | ServiceId }[]; quit: { m: Member; why: Blow }[]; low: Member[] } {
    const grew: { m: Member; what: 'experienced' | ServiceId }[] = [];
    const quit: { m: Member; why: Blow }[] = [];
    const low: Member[] = [];
    for (const m of this.members) {
      const total = Object.values(m.hours).reduce((n, h) => n + (h ?? 0), 0);
      if (m.traits.includes('new') && total >= GROWTH_IN_JOB.newWearsOffHours) {
        m.traits = m.traits.filter((x) => x !== 'new');
        grew.push({ m, what: 'experienced' });
      }
      if (!m.special) {
        const best = (Object.entries(m.hours) as [ServiceId, number][]).sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] >= GROWTH_IN_JOB.specialiseHours) {
          m.special = best[0];
          grew.push({ m, what: best[0] });
        }
      }
      if (m.morale < MORALE.leaveBelow) {
        const why = (Object.entries(m.blows) as [Blow, number][]).sort((a, b) => b[1] - a[1])[0][0];
        quit.push({ m, why });
      } else if (!m.warned && m.morale < MORALE.warnBelow) {
        m.warned = true;
        low.push(m);
      } else if (m.warned && m.morale >= MORALE.shakenBelow) m.warned = false;
    }
    for (const { m } of quit) this.members.splice(this.members.indexOf(m), 1);
    return { grew, quit, low };
  }

  /** Team morale: the average, or 0 with nobody left. */
  get morale(): number {
    return this.members.length ? this.members.reduce((n, m) => n + m.morale, 0) / this.members.length : 0;
  }

  assign(id: number, to: Assignment): boolean {
    const m = this.members.find((x) => x.id === id);
    if (!m || m.assignment === to) return false;
    m.assignment = to;
    return true;
  }
}

/** Every service id, for menus. */
export const ASSIGNABLE: readonly ServiceId[] = SERVICE_IDS;
