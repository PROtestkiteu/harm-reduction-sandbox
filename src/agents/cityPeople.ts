import { Group, type Object3D } from 'three';
import type { Appearance, Figure } from './character';
import type { CrisisPerson } from '../sim/chaosDaemon';
import type { PersonRole, PersonState } from './crowd';

/** Background people share selection identity with the crowd without becoming service arrivals. */
export class CityPeople {
  private readonly people = new Map<number, { -readonly [K in keyof PersonState]: PersonState[K] }>();
  private readonly proxies = new Map<number, Group>();
  private readonly logical = new Map<number, CrisisPerson & { eligible: boolean }>();
  private readonly candidates: CrisisPerson[] = [];
  private readonly excluded = new Set<number>();
  private readonly departed = new Set<number>();
  private crisis: { id: number; figure: Figure } | null = null;

  /** Source ranges are disjoint from the crowd's positive IDs. */
  add(id: number, look: Appearance, role: PersonRole = 'passerby', seated = false, crisisEligible = true): void {
    if (this.people.has(id)) throw new Error(`Duplicate city person ${id}`);
    if (!crisisEligible) this.excluded.add(id);
    const proxy = new Group();
    this.proxies.set(id, proxy);
    this.logical.set(id, { id, x: 0, z: 0, eligible: false, identity: JSON.stringify(look) });
    this.people.set(id, { id, look, role, archetype: look.style ?? 'everyday', resting: false,
      mode: 'standing', seated, moving: false, visible: false, root: proxy, ambient: true });
    if (this.crisis?.id === id) this.beginCrisis(id, this.crisis.figure);
  }

  update(id: number, x: number, y: number, z: number, visible: boolean, moving: boolean, root?: Object3D, present = visible): void {
    const logical = this.logical.get(id)!;
    logical.x = x; logical.z = z; logical.eligible = present;
    if (this.departed.has(id) && !present) this.departed.delete(id);
    if (this.claimed(id)) return;
    const p = this.people.get(id)!;
    // These views are owned here; consumers only receive the read-only PersonState contract.
    p.visible = visible; p.moving = moving; p.mode = moving ? 'walking' : 'standing';
    p.root = root ?? this.proxies.get(id)!;
    this.proxies.get(id)!.position.set(x, y, z);
  }

  setAppearance(id: number, look: Appearance): void { const p = this.people.get(id); if (p) { p.look = look; this.logical.get(id)!.identity = JSON.stringify(look); } }

  appearance(id: number): Appearance | undefined { return this.people.get(id)?.look; }

  person(id: number): PersonState | undefined {
    const p = this.people.get(id);
    return p?.visible ? p : undefined;
  }

  forEachVisible(visit: (p: PersonState) => void): void {
    for (const p of this.people.values()) if (p.visible) visit(p);
  }

  /** Logical people, independent of camera, mesh detail and GPU quality. Uniformed workers and children are excluded. */
  crisisCandidates(): readonly CrisisPerson[] {
    this.candidates.length = 0;
    for (const p of this.people.values()) {
      const logical = this.logical.get(p.id)!;
      if (this.claimed(p.id) || !logical.eligible || p.role === 'police' || p.role === 'staff' || p.seated || p.look.height < 1.4 || this.excluded.has(p.id)) continue;
      this.candidates.push(logical);
    }
    this.candidates.sort((a, b) => a.id - b.id);
    return this.candidates;
  }

  claimed(id: number): boolean { return this.crisis?.id === id || this.departed.has(id); }

  beginCrisis(id: number, figure: Figure): void {
    this.crisis = { id, figure };
    const p = this.people.get(id);
    if (!p) return;
    p.root.visible = false;
    Object.assign(p, { root: figure.root, visible: true, moving: true, crisis: true });
  }

  endCrisis(): void {
    if (!this.crisis) return;
    this.departed.add(this.crisis.id);
    const p = this.people.get(this.crisis.id);
    if (p) Object.assign(p, { root: this.proxies.get(p.id)!, visible: false, crisis: false });
    this.crisis = null;
  }
}

/** The simulation carries this opaque visual identity through a save, without reading it. */
export function restoreCityAppearance(identity?: string): Appearance | undefined {
  if (!identity) return;
  try {
    const p = JSON.parse(identity);
    if (!p || typeof p !== 'object') return;
    for (const key of ['skin', 'hair', 'top', 'bottom', 'accent', 'height', 'build', 'hairStyle']) {
      if (typeof p[key] !== 'number' || !Number.isFinite(p[key])) return;
    }
    if (p.height < 0.5 || p.height > 2.5 || p.build < 0.5 || p.build > 2 || !Number.isInteger(p.hairStyle) || p.hairStyle < 0 || p.hairStyle > 7) return;
    if (!['none', 'backpack', 'bag', 'scarf', 'jacket'].includes(p.extra) || typeof p.staff !== 'boolean') return;
    // Reconstruct the stable face, clothes and proportions; optional kit remains source-owned.
    return { skin: p.skin, hair: p.hair, top: p.top, bottom: p.bottom, accent: p.accent,
      height: p.height, build: p.build, hairStyle: p.hairStyle, extra: p.extra, staff: p.staff,
      beard: p.beard === true, skirt: p.skirt === true, kit: {} };
  } catch { return; }
}
