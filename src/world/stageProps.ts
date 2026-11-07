import { Group, type Matrix4, type Object3D } from 'three';
import { PALETTE } from '../config/palette';
import type { ServiceId } from '../sim/types';
import { add, bench, box, cylinder, signBoard } from './kit';
import { glowMat, mat } from './materials';
import { mergeStatic } from './mergeStatic';

/**
 * What each stage of a service puts on the street (SERVICE_STAGES): a table
 * of reagent kits, a tent with a spectrometer, a lab bus, a vending machine.
 * Stage 1 is the place as built; every later stage adds one piece beside it,
 * in a row of slots away from the door and the queue.
 *
 * Built in a local frame facing +z (the street), about three metres wide at
 * most. A new piece springs up out of the pavement and settles; a stage lost
 * to wear sinks away again. Idle, nothing moves.
 */

const white = mat(0xeeeeea);
const teal = mat(0x2e7d6b);
const blue = mat(0x3a6ea8);
const red = mat(0xc83a3a);
const yellow = mat(0xe8c020);
const dark = mat(0x2a2c30);
const metal = mat(PALETTE.metal);
const canvasTeal = mat(0x3a8f8a);
const canvasWhite = mat(0xe6e2d8);
const sofa = mat(0x6a3a5a);
const warm = glowMat(0x5a4a2a, 0xffd890, 1.2);
const screen = glowMat(0x1a2a3a, 0x8ad0ff, 1.4);

const table = (g: Object3D, x: number, z: number, w = 1.5) => {
  add(g, box(w, 0.05, 0.7, mat(0xe8e4dc), x, 0.72, z));
  for (const dx of [-w / 2 + 0.06, w / 2 - 0.06]) for (const dz of [-0.28, 0.28]) add(g, box(0.04, 0.72, 0.04, metal, x + dx, 0, z + dz));
};
const sign = (g: Object3D, text: string, fg: string, bg: string, x: number, y: number, z: number, w = 2.2) => {
  const s = signBoard(text, w, 0.42, fg, bg, 0.6);
  add(g, s.mesh).position.set(x, y, z);
};
const tent = (g: Object3D, canopy: ReturnType<typeof mat>, w = 2.6, d = 2.2) => {
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) add(g, cylinder(0.035, 2.2, metal, 5, x, 0, z));
  add(g, box(w + 0.2, 0.12, d + 0.2, canopy, 0, 2.2, 0));
  add(g, box(w + 0.2, 0.3, 0.04, canopy, 0, 1.92, d / 2 + 0.1));
};
const van = (g: Object3D, body: ReturnType<typeof mat>, stripe: ReturnType<typeof mat>, len = 4.6) => {
  add(g, box(1.9, 0.3, len, mat(PALETTE.tyre), 0, 0.25, 0));
  add(g, box(2.0, 1.9, len - 0.6, body, 0, 0.5, 0.3));
  add(g, box(1.9, 1.3, 0.9, body, 0, 0.5, -len / 2 + 0.45));
  add(g, box(2.02, 0.2, len - 0.6, stripe, 0, 1.15, 0.3));
  add(g, box(0.02, 0.5, len - 1.6, warm, 1.01, 1.4, 0.4));
  for (const z of [-len / 2 + 0.6, len / 2 - 0.7]) for (const x of [-0.95, 0.95]) add(g, box(0.22, 0.62, 0.62, mat(PALETTE.tyre), x, 0, z));
};

/** One piece per stage beyond the first, by service: [stage 2, stage 3, stage 4]. */
const PIECES: Record<ServiceId, ((g: Group) => void)[]> = {
  drugChecking: [
    // Spectrometer in a tent: a teal gazebo over a table with a lit instrument and a laptop.
    (g) => { tent(g, canvasTeal); table(g, 0, -0.3); add(g, box(0.5, 0.3, 0.4, white, -0.3, 0.77, -0.3)); add(g, box(0.36, 0.02, 0.26, screen, 0.35, 0.78, -0.3)); },
    // Lab bus: long white bus with a blue stripe and lit windows.
    (g) => { const b = add(g, new Group(), Math.PI / 2); van(b, white, blue, 6.2); },
    // Lab drop-off: a counter with a hatch, a courier crate and a LAB sign.
    (g) => { add(g, box(1.8, 1.1, 0.6, blue, 0, 0, 0)); add(g, box(1.2, 0.5, 0.02, warm, 0, 0.5, 0.31)); add(g, box(0.6, 0.4, 0.4, yellow, 1.3, 0, 0.3)); sign(g, 'LAB DROP-OFF', '#eafffb', '#245c58', 0, 1.6, 0, 2.4); },
  ],
  clubHr: [
    // Chill-out space: two sofas, string lights on poles.
    (g) => { for (const x of [-0.9, 0.9]) { add(g, box(1.4, 0.4, 0.7, sofa, x, 0, 0)); add(g, box(1.4, 0.5, 0.18, sofa, x, 0.3, -0.3)); } for (const x of [-1.6, 1.6]) add(g, cylinder(0.03, 2.2, metal, 5, x, 0, -0.5)); add(g, box(3.2, 0.06, 0.06, warm, 0, 2.15, -0.5)); },
    // Testing corner: a small white tent with a table.
    (g) => { tent(g, canvasWhite, 2.0, 1.8); table(g, 0, 0, 1.2); add(g, box(0.36, 0.02, 0.26, screen, 0, 0.78, 0)); },
    // Safer nightlife label: a water tap on a post and a plaque.
    (g) => { add(g, box(0.5, 1.0, 0.4, blue, -0.6, 0, 0)); add(g, cylinder(0.04, 0.3, metal, 5, -0.6, 1.0, 0.2)); sign(g, 'SAFER NIGHTLIFE', '#ffffff', '#b04a8a', 0.7, 1.5, 0, 2.0); add(g, cylinder(0.04, 1.5, metal, 5, 0.7, 0, 0)); },
  ],
  outreach: [
    // A yellow lockbox for samples on a post.
    (g) => { add(g, cylinder(0.05, 0.9, metal, 5, 0, 0, 0)); add(g, box(0.5, 0.5, 0.4, yellow, 0, 0.9, 0)); add(g, box(0.4, 0.04, 0.02, dark, 0, 1.25, 0.21)); },
    // A folding table with a spectrometer and a laptop.
    (g) => { table(g, 0, 0, 1.3); add(g, box(0.5, 0.3, 0.4, white, -0.3, 0.77, 0)); add(g, box(0.36, 0.02, 0.26, screen, 0.35, 0.78, 0)); },
    // The clinical van: white with a red stripe.
    (g) => { const b = add(g, new Group(), Math.PI / 2); van(b, white, red); },
  ],
  footPatrol: [
    // Sharps return bin and a crate of kits.
    (g) => { add(g, box(0.45, 0.8, 0.4, yellow, -0.4, 0, 0)); add(g, box(0.6, 0.35, 0.4, blue, 0.4, 0, 0)); add(g, box(0.6, 0.35, 0.4, blue, 0.4, 0.35, 0)); },
    // Vending machine with a lit front.
    (g) => { add(g, box(1.0, 1.9, 0.7, teal, 0, 0, 0)); add(g, box(0.7, 1.1, 0.02, screen, -0.05, 0.6, 0.36)); add(g, box(0.15, 0.4, 0.02, warm, 0.38, 0.9, 0.36)); },
    // Sample tubes on a rack, for the lab.
    (g) => { table(g, 0, 0, 1.0); for (let i = 0; i < 6; i++) add(g, cylinder(0.03, 0.16, i % 2 ? blue : yellow, 6, -0.35 + i * 0.14, 0.77, 0)); },
  ],
  dropIn: [
    // Test strips: a little counter with a sign.
    (g) => { add(g, box(1.2, 1.0, 0.5, teal, 0, 0, 0)); sign(g, 'TEST STRIPS', '#ffffff', '#2e7d6b', 0, 1.25, 0, 1.6); },
    // Mobile consumption van: teal with a white stripe.
    (g) => { const b = add(g, new Group(), Math.PI / 2); van(b, teal, white); },
    // Supervised consumption room: a glass-walled extension with a lit inside.
    (g) => { add(g, box(3.0, 2.6, 2.4, mat(PALETTE.glassDark), 0, 0, 0)); add(g, box(2.8, 2.2, 0.02, warm, 0, 0.2, 1.21)); add(g, box(3.2, 0.15, 2.6, dark, 0, 2.6, 0)); },
  ],
  shelter: [
    // Dispensing hatch with a sign.
    (g) => { add(g, box(1.4, 1.2, 0.5, mat(0x8a6a3a), 0, 0, 0)); add(g, box(0.8, 0.5, 0.02, warm, 0, 0.6, 0.26)); sign(g, 'DISPENSING', '#fff1d8', '#5a3a28', 0, 1.5, 0, 1.8); },
    // Checking session: a table, a bench beside it in the same row (not out across the pavement) and an instrument.
    (g) => { table(g, 0, 0, 1.3); add(g, box(0.5, 0.3, 0.4, white, 0, 0.77, 0)); add(g, bench()).position.set(1.55, 0, 0); },
  ],
  clinic: [
    // Medical tent: white with a red cross.
    (g) => { tent(g, canvasWhite); add(g, box(0.6, 0.18, 0.05, red, 0, 2.3, 1.22)); add(g, box(0.18, 0.6, 0.05, red, 0, 2.1, 1.22)); },
    // Clinical van.
    (g) => { const b = add(g, new Group(), Math.PI / 2); van(b, white, red); },
    // Substitution clinic: a dispensing kiosk with a sign.
    (g) => { add(g, box(1.6, 2.0, 1.0, mat(0xd6d8d8), 0, 0, 0)); add(g, box(0.9, 0.6, 0.02, warm, 0, 0.9, 0.51)); sign(g, 'DISPENSING', '#f4f8ff', '#334a73', 0, 2.1, 0, 1.8); },
  ],
};

/** Seconds for a piece to spring up or sink away. */
const GROW = 0.9;

/** Overshoots a little and settles, like something put down with a thump. */
const springUp = (v: number) => {
  const t = Math.min(1, Math.max(0, v));
  return t < 0.7 ? (t / 0.7) * 1.12 : 1.12 - 0.12 * ((t - 0.7) / 0.3);
};

interface Piece { group: Group; t: number; want: boolean }

/**
 * A place's stage pieces. `slots` are the positions (in the parent's frame) of
 * the pieces for stages 2, 3 and 4, with the turn that faces each to the street.
 */
export class StageProps {
  private readonly pieces: Piece[] = [];
  private moving = false;

  constructor(parent: Object3D, service: ServiceId, slots: readonly { x: number; z: number; rot: number }[]) {
    PIECES[service].forEach((build, i) => {
      const slot = slots[i];
      if (!slot) return;
      const group = add(parent, new Group(), slot.rot);
      group.position.set(slot.x, 0.12, slot.z);
      build(group);
      // One draw call per material inside a piece; the piece itself still scales as a whole.
      mergeStatic(group);
      group.visible = false;
      group.scale.set(1, 0.001, 1);
      this.pieces.push({ group, t: 0, want: false });
    });
  }

  transform(matrix: Matrix4): void {
    for (const p of this.pieces) p.group.applyMatrix4(matrix);
  }

  /** Shows the pieces up to `stage` (1 = none). With `instant`, no animation. */
  set(stage: number, instant: boolean): void {
    this.pieces.forEach((p, i) => {
      const want = stage >= i + 2;
      if (p.want === want) return;
      p.want = want;
      if (instant) {
        p.t = want ? 1 : 0;
        p.group.visible = want;
        p.group.scale.set(1, want ? 1 : 0.001, 1);
      } else {
        p.group.visible = true;
        this.moving = true;
      }
    });
  }

  update(dt: number, still: boolean): void {
    if (!this.moving) return;
    let busy = false;
    for (const p of this.pieces) {
      const target = p.want ? 1 : 0;
      if (p.t === target) continue;
      p.t = still ? target : Math.min(1, Math.max(0, p.t + (p.want ? dt : -dt) / GROW));
      const h = p.want ? springUp(p.t) : p.t;
      p.group.scale.set(1, Math.max(0.001, h), 1);
      if (p.t === 0) p.group.visible = false;
      if (p.t !== target) busy = true;
    }
    this.moving = busy;
  }
}
