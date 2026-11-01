import { createRandom, pick, type Random } from './random';
import { SERVICE_IDS, type ServiceId } from './types';
import { t } from '../i18n';

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
  /** Extra share of capacity per person at these services (0.3 = 30% more). */
  bonus: Partial<Record<ServiceId, number>>;
  /** Applies at every service. */
  everywhere?: number;
}

export const TRAITS: Record<TraitId, Trait> = {
  peer: { label: t('Peer worker'), detail: t('Lived experience; people open up to them'), bonus: { dropIn: 0.3, outreach: 0.3, clubHr: 0.2, shelter: 0.2 } },
  nurse: { label: t('Nurse'), detail: t('Wound care, overdose response, prescriptions'), bonus: { clinic: 0.4, pharmacy: 0.3, dropIn: 0.1 } },
  chemist: { label: t('Chemist'), detail: t('Runs the analysis and explains results'), bonus: { drugChecking: 0.5 } },
  social: { label: t('Social worker'), detail: t('Housing, benefits and referrals'), bonus: { shelter: 0.35, dropIn: 0.2 } },
  languages: { label: t('Several languages'), detail: t('Reaches people others cannot'), bonus: {}, everywhere: 0.12 },
  calm: { label: t('Calm under pressure'), detail: t('Good with crowds and crises'), bonus: { clubHr: 0.25, outreach: 0.15 } },
  nightOwl: { label: t('Night owl'), detail: t('Tires slower after midnight'), bonus: {} },
  new: { label: t('New to the work'), detail: t('Still learning; a little slower'), bonus: {}, everywhere: -0.15 },
};

/** Where a worker goes: placed automatically, pinned to a service, or resting. */
export type Assignment = 'auto' | 'rest' | ServiceId;

export interface Member {
  readonly id: number;
  readonly name: string;
  readonly paid: boolean;
  readonly traits: readonly TraitId[];
  /** 0 exhausted, 1 fresh. */
  energy: number;
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

  /** How good `m` is at `service`: 1 is ordinary, tiredness drags it down. */
  static fit(m: Member, service: ServiceId): number {
    let f = 1;
    for (const t of m.traits) f += (TRAITS[t].bonus[service] ?? 0) + (TRAITS[t].everywhere ?? 0);
    if (m.energy < 0.35) f -= 0.25;
    return Math.max(0.4, f);
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
    return { id: this.nextId++, name, paid, traits, energy: 0.75 + this.random() * 0.25, assignment: 'auto', workingAt: null, worn: false };
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
  tick(hours: number, lateNight: boolean): boolean {
    let changed = false;
    for (const m of this.members) {
      const before = m.energy;
      if (m.workingAt) m.energy -= hours * (lateNight && m.traits.includes('nightOwl') ? 0.04 : 0.08);
      else m.energy += hours * 0.12;
      m.energy = Math.min(1, Math.max(0, m.energy));
      if (m.assignment !== 'auto') continue;
      if (!m.worn && before >= TIRED && m.energy < TIRED) { m.worn = true; changed = true; }
      else if (m.worn && m.energy >= RESTED) { m.worn = false; changed = true; }
    }
    return changed;
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
