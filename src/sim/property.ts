import type { Random } from './random';
import type { ServiceId } from './types';
import { t } from '../i18n';

/**
 * Shop units on the streets around the services, and the space the
 * organisation rents. Rendering-free.
 *
 * When the street stops feeling safe, trade falls and shops close one by one;
 * their units go up to let. The organisation can rent one and open a small
 * satellite of a service there, or send another outreach camper to a new spot.
 * When trade recovers, a new business may take a vacant unit.
 *
 * ILLUSTRATIVE rates and prices throughout.
 */

/** Services that can open a satellite in a rented shop unit. */
export const SATELLITE_SERVICES = ['dropIn', 'drugChecking', 'footPatrol'] as const;
export type SatelliteService = (typeof SATELLITE_SERVICES)[number];
/** What a satellite is called on the street and in notices. */
export const SATELLITE_NAME: Record<SatelliteService, string> = { dropIn: t('drop-in'), drugChecking: t('drug checking point'), footPatrol: t('needle exchange') };

export const PROPERTY = {
  /** Shop units the model tracks around the services. */
  units: 8,
  /** Fitting out a unit: one-off. */
  fitOut: 250,
  /** Rent and running costs per clock hour. */
  rentPerHour: 20,
  /** Places a satellite adds to its service. */
  satellitePlaces: 2,
  /** A second (or third) camper: one-off, then per clock hour. */
  camperCost: 400,
  camperPerHour: 25,
  camperPlaces: 2,
  maxExtraCampers: 5,
  /** A harm reduction point in any ordinary building: fitting out, rent, and growing it level by level. */
  point: { fitOut: 150, rentPerHour: 15, upgrade: 150, rentPerLevel: 5, placesAtZero: 1, placesPerLevel: 1, maxLevel: 3 },
  /** Below this trade level shops start to close; above `reopenAbove` new ones open. */
  closeBelow: 0.7,
  reopenAbove: 0.8,
} as const;

export type UnitState =
  | { kind: 'trading' }
  | { kind: 'vacant'; since: number }
  | { kind: 'rented'; service: SatelliteService };

export type PropertyEvent =
  | { kind: 'closed'; unit: number }
  | { kind: 'reopened'; unit: number }
  | { kind: 'lost'; unit: number; service: SatelliteService }
  | { kind: 'pointLost'; building: number; service: SatelliteService };

/** A harm reduction point the organisation opened in an ordinary building. */
export interface Point { building: number; service: SatelliteService; level: number }

export class Property {
  /** Harm reduction points in ordinary buildings, by building id. */
  readonly points: Point[] = [];
  readonly units: UnitState[] = Array.from({ length: PROPERTY.units }, () => ({ kind: 'trading' }) as UnitState);
  /** Spots (by index in CAMPER_SPOTS) where extra campers stand. */
  readonly campers: number[] = [];

  get extraCampers(): number {
    return this.campers.length;
  }

  constructor(private readonly random: Random) {}

  /** Places added to a service by its satellites and extra campers. */
  extraPlaces(id: ServiceId): number {
    if (id === 'outreach') return this.extraCampers * PROPERTY.camperPlaces;
    const p = PROPERTY.point;
    const points = this.points.filter((q) => q.service === id).reduce((n, q) => n + p.placesAtZero + q.level * p.placesPerLevel, 0);
    return this.units.filter((u) => u.kind === 'rented' && u.service === id).length * PROPERTY.satellitePlaces + points;
  }

  /** Running cost per clock hour of everything rented. */
  get costPerHour(): number {
    const rented = this.units.filter((u) => u.kind === 'rented').length;
    const points = this.points.reduce((n, q) => n + PROPERTY.point.rentPerHour + q.level * PROPERTY.point.rentPerLevel, 0);
    return rented * PROPERTY.rentPerHour + this.extraCampers * PROPERTY.camperPerHour + points;
  }

  pointAt(building: number): Point | undefined {
    return this.points.find((q) => q.building === building);
  }

  openPoint(building: number, service: SatelliteService): boolean {
    if (this.pointAt(building)) return false;
    this.points.push({ building, service, level: 0 });
    return true;
  }

  upgradePoint(building: number): boolean {
    const q = this.pointAt(building);
    if (!q || q.level >= PROPERTY.point.maxLevel) return false;
    q.level++;
    return true;
  }

  closePoint(building: number): Point | undefined {
    const i = this.points.findIndex((q) => q.building === building);
    return i >= 0 ? this.points.splice(i, 1)[0] : undefined;
  }

  get vacant(): number {
    return this.units.filter((u) => u.kind === 'vacant').length;
  }

  rent(unit: number, service: SatelliteService): boolean {
    if (this.units[unit]?.kind !== 'vacant') return false;
    this.units[unit] = { kind: 'rented', service };
    return true;
  }

  /** Hands a rented unit back; it stands empty again. */
  release(unit: number, now: number): void {
    if (this.units[unit]?.kind === 'rented') this.units[unit] = { kind: 'vacant', since: now };
  }

  /**
   * Advances by `dtMinutes`. `trade` is the neighbourhood's shop trade
   * (0..1). `paid` false means rent could not be paid this step: the newest
   * rental is given up.
   */
  tick(dtMinutes: number, now: number, trade: number, paid: boolean): PropertyEvent[] {
    const hours = dtMinutes / 60;
    if (hours <= 0) return [];
    const out: PropertyEvent[] = [];
    if (!paid) {
      let i = this.units.length - 1;
      while (i >= 0 && this.units[i].kind !== 'rented') i--;
      if (i >= 0) {
        const u = this.units[i] as { kind: 'rented'; service: SatelliteService };
        out.push({ kind: 'lost', unit: i, service: u.service });
        this.release(i, now);
      } else if (this.points.length > 0) {
        const q = this.points.pop()!;
        out.push({ kind: 'pointLost', building: q.building, service: q.service });
      } else if (this.campers.length > 0) {
        this.campers.pop();
      }
    }
    // Each trading shop closes with a chance that grows as trade falls;
    // each vacant one finds a new tenant once trade is good again.
    const closeRate = Math.max(0, PROPERTY.closeBelow - trade) * 0.6;
    const reopenRate = Math.max(0, trade - PROPERTY.reopenAbove) * 0.8;
    this.units.forEach((u, i) => {
      if (u.kind === 'trading' && this.random() < closeRate * hours) {
        this.units[i] = { kind: 'vacant', since: now };
        out.push({ kind: 'closed', unit: i });
      } else if (u.kind === 'vacant' && now - u.since > 120 && this.random() < reopenRate * hours) {
        this.units[i] = { kind: 'trading' };
        out.push({ kind: 'reopened', unit: i });
      }
    });
    return out;
  }
}
