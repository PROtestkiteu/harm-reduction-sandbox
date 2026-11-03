import { Group, type MeshLambertMaterial, type Object3D } from 'three';
import type { SatelliteService } from '../sim/property';
import { createRandom } from '../sim/random';
import { claimRoof, flatRoofTop, frontFrame, roofClaimed, type CityBuilding } from './cityBuildings';
import { add, bench, box, cylinder, planter, signBoard } from './kit';
import { clearOfWalks } from './layout';
import { glowMat, mat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';

/**
 * What a building the organisation has taken over shows on the street, level
 * by level: a rented shop unit or a harm reduction point in an ordinary
 * building. A sign alone does not make a service; the front grows with it.
 *
 *  0  lit inside, notices in the windows in the service's colour
 *  1  a painted fascia and door frame, a pavement board, a bench by the wall
 *  2  an awning, planters, and the service's own extra by the door: a lit
 *     sharps bin and vending machine (needle exchange), a laundry and shower
 *     sign with lit portholes (drop-in), a results board (drug checking)
 *  3  tall banners in the service's colour down the front's ends, festoon
 *     lights, and on a flat roof a glazed rooftop room
 *
 * Each building's look is built the first time it is needed (merged into a
 * few draw calls) and kept; a change only swaps which is shown.
 */
export interface FitOutLook { service: SatelliteService; level: number }

const COLOUR: Record<SatelliteService, number> = { dropIn: 0x2e7d6b, drugChecking: 0x245c58, footPatrol: 0x2f7a48 };
const ACCENT: Record<SatelliteService, number> = { dropIn: 0xe8a33a, drugChecking: 0x6ad8e8, footPatrol: 0xf2d040 };

interface Shown { key: string; looks: Map<string, Group> }

export class FitOuts {
  private readonly root = dynamic(new Group());
  private readonly byBuilding = new Map<number, Shown>();
  private readonly glow = new Map<number, MeshLambertMaterial>();
  /** Roofs this has built on (and so claimed). */
  private readonly ownRoofs = new Set<number>();

  /** `warm`: the lit-window material shared with the street. */
  constructor(parent: Object3D, private readonly warm: MeshLambertMaterial) {
    this.root.name = 'fitOuts';
    parent.add(this.root);
  }

  /** One shared lit material per colour: a lit material is a draw call of its own. */
  private lit(colour: number): MeshLambertMaterial {
    let m = this.glow.get(colour);
    if (!m) { m = glowMat(0x1a1a1e, colour, 0.9); this.glow.set(colour, m); }
    return m;
  }

  /** Shows `look` on building `b`, or nothing (null) once it is given back. */
  set(b: CityBuilding, look: FitOutLook | null): void {
    let shown = this.byBuilding.get(b.id);
    if (!shown) { shown = { key: '', looks: new Map() }; this.byBuilding.set(b.id, shown); }
    const key = look ? `${look.service}:${look.level}` : '';
    if (key === shown.key) return;
    shown.key = key;
    if (look && !shown.looks.has(key)) shown.looks.set(key, this.build(b, look));
    for (const [k, g] of shown.looks) g.visible = k === key;
  }

  private build(b: CityBuilding, look: FitOutLook): Group {
    const f = frontFrame(b);
    const g = add(this.root, new Group());
    const front = add(g, new Group(), f.rot);
    front.position.set(f.x, 0.12, f.z);
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    // Pieces out on the pavement only where the crowd's walking lines leave room for them.
    const clear = (x: number, z: number, w: number, d: number) => clearOfWalks(f.x + x * c + z * s, f.z - x * s + z * c, f.rot, w, d);
    this.dress(front, look, f.width, b.height, b.id, clear);
    const top = flatRoofTop(b);
    // On a flat roof nobody else has taken (a mosque, a rooftop party, a district terrace); claimed for it.
    if (look.level >= 3 && top !== null && (this.ownRoofs.has(b.id) || !roofClaimed(b.id))) {
      this.ownRoofs.add(b.id);
      claimRoof([b.id]);
      const depth = Math.abs(s) > 0.5 ? b.x1 - b.x0 : b.z1 - b.z0;
      const onRoof = add(front, new Group());
      onRoof.position.set(0, top - 0.12, -depth / 2);
      // A glazed room on the roof: a frame, lit glass, a flat roof, plants along its front.
      const rw = Math.min(f.width - 2, 5);
      const rd = Math.min(depth - 2, 3.5);
      add(onRoof, box(rw, 2.4, rd, this.warm, 0, 0, 0));
      add(onRoof, box(rw + 0.3, 0.2, rd + 0.3, mat(COLOUR[look.service]), 0, 2.4, 0));
      for (const x of [-rw / 2, 0, rw / 2]) add(onRoof, box(0.1, 2.4, rd + 0.05, mat(0x3a3a3e), x, 0, 0));
      add(onRoof, box(rw, 0.4, 0.4, mat(0x4a7a3a), 0, 0, rd / 2 + 0.4));
    }
    mergeStatic(g);
    return g;
  }

  /** The front's pieces (local +z out from the wall, x along it, origin at its middle on the ground). */
  private dress(g: Group, look: FitOutLook, w: number, h: number, id: number, clear: (x: number, z: number, w: number, d: number) => boolean): void {
    const random = createRandom(id * 4021 + 7);
    const colour = mat(COLOUR[look.service]);
    const accent = this.lit(ACCENT[look.service]);
    const ground = Math.min(w - 0.6, 9);
    // Level 0: lit inside, notices in the windows.
    add(g, box(ground - 0.4, 1.9, 0.05, this.warm, 0, 0.4, 0.05));
    for (let k = 0; k < 3; k++) add(g, box(0.42, 0.6, 0.02, k === 1 ? mat(0xf0ead8) : colour, -ground / 2 + 0.8 + k * 0.55, 1.1, 0.09));
    if (look.level < 1) return;
    // Level 1: a painted fascia and door frame, a board on the pavement, a bench by the wall.
    add(g, box(ground, 0.6, 0.12, colour, 0, 2.45, 0.08));
    add(g, box(ground, 0.06, 0.14, accent, 0, 2.42, 0.1));
    for (const x of [ground / 2 - 2.0, ground / 2 - 0.8]) add(g, box(0.14, 2.4, 0.14, colour, x, 0, 0.1));
    if (clear(-ground / 2 + 1.1, 0.35, 1.65, 0.5)) add(g, bench()).position.set(-ground / 2 + 1.1, 0, 0.35);
    if (clear(ground / 2 - 1.4, 1.0, 0.7, 0.6)) {
      const board = add(g, new Group());
      board.position.set(ground / 2 - 1.4, 0, 1.0);
      add(board, box(0.6, 0.9, 0.06, colour, 0, 0, 0.12)).rotation.x = -0.25;
      add(board, box(0.6, 0.9, 0.06, colour, 0, 0, -0.12)).rotation.x = 0.25;
      add(board, box(0.5, 0.3, 0.02, mat(0xf0ead8), 0, 0.45, 0.17)).rotation.x = -0.25;
    }
    if (look.level < 2) return;
    // Level 2: an awning, planters, and the service's own extra by the door.
    const aw = add(g, box(Math.min(ground - 0.4, 6), 0.08, 1.3, colour, -0.6, 2.75, 0.7));
    aw.rotation.x = 0.28;
    for (let x = -Math.min(ground - 0.4, 6) / 2 - 0.6 + 0.5; x < Math.min(ground - 0.4, 6) / 2 - 0.6; x += 1.0) add(g, box(0.5, 0.09, 1.31, mat(0xf0ead8), x, 2.75, 0.7)).rotation.x = 0.28;
    for (const x of [-ground / 2 + 2.6, ground / 2 - 2.6]) if (clear(x, 0.3, 1.0, 0.45)) add(g, planter(1.0, 0.45)).position.set(x, 0, 0.3);
    const ex = ground / 2 - 2.9;
    if (look.service === 'footPatrol') {
      // A lit vending machine and a yellow sharps bin by the door.
      add(g, box(0.9, 1.9, 0.7, mat(0x2a2a30), ex, 0, 0.4));
      add(g, box(0.7, 1.2, 0.02, accent, ex, 0.5, 0.76));
      add(g, cylinder(0.25, 0.9, mat(0xf2c400), 8, ex - 0.9, 0, 0.3));
      add(g, box(0.3, 0.12, 0.3, mat(0xc83a2a), ex - 0.9, 0.9, 0.3));
    } else if (look.service === 'dropIn') {
      // Laundry and showers: lit portholes in the window and a sign.
      for (let k = 0; k < 3; k++) add(g, cylinder(0.28, 0.05, accent, 12, -ground / 2 + 2.2 + k * 0.75, 0.9, 0.08)).rotation.x = Math.PI / 2;
      const sign = signBoard('SHOWERS + LAUNDRY', 2.6, 0.4, '#ffffff', '#1e4a40', 0.6);
      add(g, sign.mesh).position.set(-ground / 2 + 2.9, 1.75, 0.1);
    } else {
      // A lit board of results in the window.
      const sign = signBoard('RESULTS', 1.4, 0.36, '#0a2a2a', '#9af0f8', 0.8);
      add(g, sign.mesh).position.set(ex, 1.75, 0.1);
      add(g, box(1.3, 0.9, 0.03, accent, ex, 0.75, 0.08));
    }
    if (look.level < 3) return;
    // Level 3: two tall banners in the service's colour hung down the front's ends (clear of the
    // windows), striped in its accent, and festoon lights along the front.
    if (h > 5) {
      const tall = Math.min(h - 3.8, 6);
      const stripe = mat(ACCENT[look.service]);
      for (const x of [-w / 2 + 0.55, w / 2 - 0.55]) {
        add(g, box(0.1, 0.1, 0.5, mat(0x3a3a3e), x, 3.3 + tall, 0.25));
        add(g, box(0.75, tall, 0.04, colour, x, 3.3, 0.5));
        for (let y = 3.6; y < 3.2 + tall; y += 1.2 + random() * 0.4) add(g, box(0.76, 0.16, 0.05, stripe, x, y, 0.5));
      }
    }
    for (let k = 0; k <= 10; k++) {
      const x = -ground / 2 + (ground * k) / 10;
      add(g, box(0.12, 0.12, 0.12, accent, x, 3.0 - Math.sin((k / 10) * Math.PI) * 0.3, 0.6));
    }
  }
}
