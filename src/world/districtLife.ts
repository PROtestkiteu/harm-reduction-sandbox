import { ConeGeometry, Group, Mesh, type MeshLambertMaterial, type Object3D } from 'three';
import { DEAL_SPOTS, USE_SPOTS } from '../config/flavour/street';
import { createRandom, type Random } from '../sim/random';
import { claimRoof, flatRoofTop, frontFrame, roofClaimed, type CityBuilding } from './cityBuildings';
import { awning } from './dressing';
import { scaffolding } from './grit';
import { add, box, cylinder, planter } from './kit';
import { PARK_CAMP, STATION_CAMP, clearOfWalks, type P2 } from './layout';
import { mat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';

/**
 * How the district's ordinary buildings answer to the district, the way a
 * Manor Lords village answers to how it is run. Each building has a condition
 * (0 run down, 1 done up) that drifts, game hour by game hour, towards a local
 * target: the district doing well and its shops trading pull it up, most near
 * the services and venues; dealing corners, the tent camps and litter pull it
 * down, most near them. Below a threshold the ground floor is shuttered and
 * tagged, then boarded up; above one, scaffolding goes up for a few hours and
 * the front comes out smartened. Purely what is seen: it feeds nothing back.
 * ILLUSTRATIVE thresholds and rates.
 */
export type FrontState = 'boarded' | 'shuttered' | 'ordinary' | 'works' | 'smart';

/** What the district is like now (0..1 each), from the simulation's meters. */
export interface DistrictNow {
  vitality: number;
  safety: number;
  shopTrade: number;
  streetMarket: number;
  litter: number;
  /** The park camp and the station camp, 0 (none) to 1 (full). */
  camp: number;
  stationCamp: number;
  /** Buildings with a harm reduction point in them: kept as they are, open for business. */
  skip: readonly number[];
}

/** Where states begin and end: entering at the first number, leaving at the second, so a building does not flicker between two. */
const BOARDED = [0.2, 0.27];
const SHUTTERED = [0.36, 0.43];
const SMART = [0.72, 0.64];
/** How fast a condition closes on its target, per game hour (a share of the gap). */
const DRIFT = 0.06;
/** Scaffolding stands this many game hours before the smartened front is revealed. */
const WORKS_HOURS = [3, 8] as const;

const near = (d: number, reach: number) => Math.max(0, 1 - d / reach);

interface Site {
  b: CityBuilding;
  /** 0..1: how close the services and venues are (they lift a street). */
  uplift: number;
  /** A building's own lean, so a street does not change all at once. */
  lean: number;
  condition: number;
  state: FrontState;
  /** Game minute the scaffolding comes down. */
  worksUntil: number;
  /** The top of its flat roof, or null for a pitched or mansard one. */
  roof: number | null;
  /** Its looks, built as first needed. */
  looks: Map<FrontState, Group>;
}

export class DistrictLife {
  private readonly sites: Site[];
  private readonly byId = new Map<number, Site>();
  private readonly root = dynamic(new Group());
  private lastMinute: number | null = null;
  /** Roofs this has dressed (and so claimed): it may dress them again in another look. */
  private readonly ownRoofs = new Set<number>();
  private readonly warm: MeshLambertMaterial;

  /**
   * `buildings`: the ordinary buildings that may change (not the shops, venues
   * and landmarks with looks of their own). `lifts`: the services and venues.
   * `changed` hears each building that changes look, with its roof's top (for a puff of dust or balloons).
   */
  /** Flat roofs take a terrace or a tarp, seen from any side. */
  constructor(parent: Object3D, buildings: readonly CityBuilding[], lifts: readonly P2[], warm: MeshLambertMaterial, private readonly random: Random, private readonly changed: (b: CityBuilding, to: FrontState, from: FrontState, roof: number) => void) {
    // Named for the dev page's checks (scripts/bots): which fronts have changed and how.
    this.root.name = 'districtLife';
    parent.add(this.root);
    this.warm = warm;
    this.sites = buildings.map((b) => {
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const uplift = Math.max(0, ...lifts.map((p) => near(Math.hypot(p.x - cx, p.z - cz), 28)));
      const site: Site = { b, uplift, lean: (random() - 0.5) * 0.12, condition: 0.5, state: 'ordinary', worksUntil: 0, roof: flatRoofTop(b), looks: new Map() };
      this.byId.set(b.id, site);
      return site;
    });
  }

  /** The look a building's front has now ('ordinary' for one this does not track). */
  state(id: number): FrontState {
    return this.byId.get(id)?.state ?? 'ordinary';
  }

  /** Where each building is heading, from the district now. */
  private target(s: Site, v: DistrictNow): number {
    const cx = (s.b.x0 + s.b.x1) / 2;
    const cz = (s.b.z0 + s.b.z1) / 2;
    const dist = (p: { x: number; z: number }) => Math.hypot(p.x - cx, p.z - cz);
    const decline = Math.max(
      v.streetMarket * Math.max(0, ...DEAL_SPOTS.map((d) => near(dist(d.at), 24))),
      v.litter * 0.7 * Math.max(0, ...USE_SPOTS.map((u) => near(dist(u.at), 18))),
      v.camp * near(dist({ x: (PARK_CAMP.x0 + PARK_CAMP.x1) / 2, z: (PARK_CAMP.z0 + PARK_CAMP.z1) / 2 }), 32),
      v.stationCamp * near(dist({ x: (STATION_CAMP.x0 + STATION_CAMP.x1) / 2, z: (STATION_CAMP.z0 + STATION_CAMP.z1) / 2 }), 26),
    );
    const t = 0.5 + s.lean
      + (v.vitality - 0.5) * (0.55 + 0.45 * s.uplift)
      + (v.shopTrade - 0.5) * 0.3
      + (v.safety - 0.5) * 0.25
      - 0.65 * decline;
    return Math.min(1, Math.max(0, t));
  }

  /**
   * Moves every building on by the game time since the last call (`minute`
   * counts game minutes and only goes up). The first call sets each condition
   * straight to its target, so a game starts with the district as it is.
   */
  set(v: DistrictNow, minute: number): void {
    const hours = this.lastMinute === null ? null : Math.min(4, Math.max(0, minute - this.lastMinute) / 60);
    this.lastMinute = minute;
    if (hours === 0) return;
    for (const s of this.sites) {
      const target = this.target(s, v);
      s.condition = hours === null ? target : s.condition + (target - s.condition) * Math.min(1, DRIFT * hours);
      const next = v.skip.includes(s.b.id) ? 'ordinary' : this.next(s, minute, hours === null);
      if (next !== s.state) {
        const from = s.state;
        s.state = next;
        this.show(s);
        if (hours !== null) this.changed(s.b, next, from, s.roof ?? s.b.height + 2);
      }
    }
  }

  /** A building's next look, with hysteresis; done-up fronts come through a spell of scaffolding (not at the first look). */
  private next(s: Site, minute: number, first: boolean): FrontState {
    const c = s.condition;
    switch (s.state) {
      case 'boarded': return c > BOARDED[1] ? 'shuttered' : 'boarded';
      case 'shuttered': return c < BOARDED[0] ? 'boarded' : c > SHUTTERED[1] ? 'ordinary' : 'shuttered';
      case 'works': return c < SMART[1] ? 'ordinary' : minute >= s.worksUntil ? 'smart' : 'works';
      case 'smart': return c < SMART[1] ? 'ordinary' : 'smart';
      default:
        if (c < SHUTTERED[0]) return c < BOARDED[0] ? 'boarded' : 'shuttered';
        if (c > SMART[0]) {
          if (first) return 'smart';
          s.worksUntil = minute + 60 * (WORKS_HOURS[0] + this.random() * (WORKS_HOURS[1] - WORKS_HOURS[0]));
          return 'works';
        }
        return 'ordinary';
    }
  }

  /**
   * Shows each building's look for its state: built the first time that
   * building needs it (merged into a draw call or two) and kept, so a change
   * later only swaps which look is shown.
   */
  private show(s: Site): void {
    for (const [state, g] of s.looks) g.visible = state === s.state;
    if (s.state === 'ordinary' || s.looks.has(s.state)) return;
    const f = frontFrame(s.b);
    const look = add(this.root, new Group());
    const front = add(look, new Group(), f.rot);
    front.position.set(f.x, 0.12, f.z);
    // Pieces out on the pavement only where the crowd's walking lines leave room for them.
    const c = Math.cos(f.rot);
    const sn = Math.sin(f.rot);
    const clear = (x: number, z: number, w: number, d: number) => clearOfWalks(f.x + x * c + z * sn, f.z - x * sn + z * c, f.rot, w, d);
    // Its own random, from its id: the same scaffolding and awning whenever it is built.
    this.dress(front, s.state, f.width, s.b.height, s.b.id, createRandom(s.b.id * 7919 + 13), clear);
    // On a flat roof nobody else has taken (a mosque, a rooftop party), something seen from every side; claimed for it.
    if (s.roof !== null && (this.ownRoofs.has(s.b.id) || !roofClaimed(s.b.id))) {
      this.ownRoofs.add(s.b.id);
      claimRoof([s.b.id]);
      const depth = Math.abs(Math.sin(f.rot)) > 0.5 ? s.b.x1 - s.b.x0 : s.b.z1 - s.b.z0;
      const onRoof = add(front, new Group());
      onRoof.position.set(0, s.roof - 0.12, -depth / 2);
      this.dressRoof(onRoof, s.state, f.width, depth, s.b.id);
    }
    mergeStatic(look);
    s.looks.set(s.state, look);
  }

  /** What a flat roof shows (origin at the roof's middle): a tarp over a hole, or a terrace with planters and a parasol. */
  private dressRoof(g: Group, state: FrontState, w: number, d: number, id: number): void {
    const pick = (k: number) => ((Math.sin(id * 3.17 + k * 41.9) * 24634.6345) % 1 + 1) % 1;
    if (state === 'boarded') {
      const tarp = add(g, box(Math.min(w * 0.5, 4), 0.08, Math.min(d * 0.45, 3.5), mat(0x2f5a9a), (pick(1) - 0.5) * w * 0.3, 0.05, (pick(2) - 0.5) * d * 0.3));
      tarp.rotation.y = (pick(3) - 0.5) * 0.6;
      tarp.rotation.z = (pick(4) - 0.5) * 0.15;
      for (const [dx, dz] of [[-0.45, -0.4], [0.4, 0.42], [0.42, -0.38]] as const) add(g, box(0.35, 0.3, 0.35, mat(0x8a857a), tarp.position.x + dx * Math.min(w * 0.5, 4), 0.05, tarp.position.z + dz * Math.min(d * 0.45, 3.5)));
    }
    if (state === 'smart') {
      // Decking over half the roof, planters round it, a parasol and two chairs.
      const dw = Math.min(w - 1.2, 7);
      const dd = Math.min(d - 1.2, 5);
      add(g, box(dw, 0.1, dd, mat(0x9a7450), 0, 0.02, 0));
      for (const x of [-dw / 2 + 0.3, dw / 2 - 0.3]) add(g, box(0.5, 0.5, dd - 0.4, mat(0x6a5a48), x, 0.1, 0));
      for (const x of [-dw / 2 + 0.3, dw / 2 - 0.3]) add(g, box(0.45, 0.45, dd - 0.5, mat(0x4a7a3a), x, 0.55, 0));
      const shade = [0xd8d0b8, 0xb84a3a, 0x2e7d6b][Math.floor(pick(5) * 3)];
      add(g, cylinder(0.04, 2.2, mat(0x5a5a5a), 4, 0, 0.1, 0));
      const umbrella = add(g, new Mesh(new ConeGeometry(1.5, 0.6, 8), mat(shade)));
      umbrella.position.set(0, 2.5, 0);
      for (const x of [-0.9, 0.9]) add(g, box(0.5, 0.45, 0.5, mat(0xe8e2d0), x, 0.12, 0.6));
    }
  }

  /** The look on one front (local +z out from the wall, x along it, origin at its middle on the ground). */
  private dress(g: Group, state: FrontState, w: number, h: number, id: number, random: Random, clear: (x: number, z: number, w: number, d: number) => boolean): void {
    // A building's own picks (tag colours, which windows): from its id, so they stay put across rebuilds.
    const pick = (k: number) => ((Math.sin(id * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    const ground = Math.min(w - 0.6, 9);
    if (state === 'shuttered' || state === 'boarded') {
      // Roller shutters down over the ground floor, ribbed, a tag sprayed across them.
      add(g, box(ground, 2.3, 0.08, mat(0x6a6c6e), 0, 0.1, 0.07));
      for (let y = 0.4; y < 2.3; y += 0.35) add(g, box(ground, 0.04, 0.1, mat(0x55575a), 0, y, 0.09));
      const tags = [0xc84a8a, 0x3ac8c8, 0xe0d040, 0x8a5ac8, 0xd06a3a];
      add(g, box(Math.min(ground - 0.4, 1.4 + pick(1) * 1.4), 0.5 + pick(2) * 0.3, 0.02, mat(tags[Math.floor(pick(3) * tags.length)]), (pick(4) - 0.5) * (ground - 2), 0.8 + pick(5) * 0.6, 0.13));
    }
    if (state === 'boarded') {
      // Boards nailed over the upper windows too, never quite level, and a notice on the door.
      const wood = [mat(0x8a7656), mat(0x7a6650), mat(0x6a5a48)];
      for (let y = 3.6; y < h - 1.2; y += 3) {
        for (let k = 0; k < 3; k++) {
          if (pick(10 + y + k) < 0.35) continue;
          const x = -w / 2 + (w * (k + 0.5)) / 3;
          for (let p = 0; p < 3; p++) add(g, box(1.1, 0.22, 0.05, wood[p], x, y + 0.2 + p * 0.38, 0.06)).rotation.z = (pick(20 + y + k + p) - 0.5) * 0.3;
        }
      }
      add(g, box(0.5, 0.7, 0.02, mat(0xe8e2d0), ground / 2 - 0.8, 1.2, 0.14));
    }
    if (state === 'shuttered' || state === 'boarded') {
      // Bin bags piled by the wall, more where it is boarded.
      const bags = clear(-ground / 2 + 1.1, 0.45, 1.6, 0.7) ? (state === 'boarded' ? 6 : 3) : 0;
      for (let k = 0; k < bags; k++) add(g, box(0.5, 0.45, 0.45, mat(k % 3 ? 0x1c1c1e : 0x2a3a2a), -ground / 2 + 0.6 + (k % 3) * 0.5, Math.floor(k / 3) * 0.4, 0.35 + (k % 2) * 0.15)).rotation.y = pick(30 + k) - 0.5;
    }
    if (state === 'works') {
      // Scaffolding up the front under netting, a skip at the kerb.
      add(g, scaffolding(Math.min(w - 0.4, 10), Math.min(h - 0.3, 12), random));
      const skipX = (pick(6) - 0.5) * (w - 3);
      if (clear(skipX, 2.2, 2.2, 1.2)) add(g, box(2.2, 1.0, 1.2, mat(0xd8a020), skipX, 0, 2.2));
    }
    if (state === 'smart') {
      // A fresh shopfront: a painted fascia, lit windows, a striped awning, planters, window boxes upstairs.
      const fascia = [0x2e5a4a, 0x3a3a5a, 0x6a2a2a, 0x2a4a5a][Math.floor(pick(7) * 4)];
      add(g, box(ground, 0.55, 0.12, mat(fascia), 0, 2.45, 0.08));
      add(g, box(ground - 0.4, 1.9, 0.06, this.warm, 0, 0.4, 0.07));
      for (const x of [-ground / 3, 0, ground / 3]) add(g, box(0.1, 1.9, 0.1, mat(fascia), x, 0.4, 0.1));
      add(g, awning(Math.min(ground - 0.6, 6), random)).position.set(0, 2.6, 0.1);
      for (const x of [-ground / 2 + 0.6, ground / 2 - 0.6]) if (clear(x, 0.35, 0.9, 0.45)) add(g, planter(0.9, 0.45)).position.set(x, 0, 0.35);
      for (let x = -w / 2 + 1.2; x < w / 2 - 1; x += 1.9) if (h > 5) add(g, box(0.9, 0.22, 0.25, mat(0x4a7a3a), x, 3.25, 0.14));
    }
  }
}
