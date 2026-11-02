import { Group, Mesh, MeshLambertMaterial, PlaneGeometry, type Object3D } from 'three';
import type { Archetype } from '../../agents/character';
import { CAMPUS, HALL, HANGOUTS, LIBRARY, PLAZA, SHIFT, STUDENT_BAR, STUDENTS_OUT, WALKS } from '../../config/flavour/campus';
import { add, box, cylinder, gableRoof, pixelTextTexture, tree } from '../kit';
import { glowMat, mat } from '../materials';
import { dynamic, mergeStatic } from '../mergeStatic';
import type { Rect } from '../layout';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * The university on the district's south-west edge: an old brick hall with a
 * columned portico and its name over the door, a glass library, a student bar
 * with a terrace, and a paved plaza with a fountain, benches, bikes and trees.
 * Students sit on the hall's steps, stand about by the fountain and the bar,
 * sit on the park's lawn past the corner and walk to and from the district.
 * Built once, the first time the pack is on; it replaces (hides) the ordinary
 * housing kept for its site.
 */

const TOP = 0.12;

function slab(g: Object3D, q: Rect, m: MeshLambertMaterial, top: number): void {
  add(g, box(q.x1 - q.x0, 0.22, q.z1 - q.z0, m, (q.x0 + q.x1) / 2, top - 0.22, (q.z0 + q.z1) / 2));
}

/** Rows of windows on one face, as thin glowing panes (a few draws for the lot, after merging). */
function windowRows(g: Object3D, glass: MeshLambertMaterial, x: number, z0: number, z1: number, floors: number, storey: number, face: 1 | -1, every = 2.4): void {
  for (let f = 0; f < floors; f++) {
    for (let z = z0 + every / 2; z < z1 - 0.6; z += every) {
      add(g, box(0.06, storey * 0.5, 1.1, glass, x + face * 0.03, TOP + 0.9 + f * storey, z));
    }
  }
}

function lampPost(g: Object3D, head: MeshLambertMaterial, x: number, z: number): void {
  add(g, cylinder(0.07, 3.6, mat(0x2a2c2e), 6, x, TOP, z));
  add(g, box(0.36, 0.28, 0.36, head, x, TOP + 3.55, z));
}

function bikeRack(g: Object3D, x: number, z: number, n: number): void {
  const metal = mat(0x6a6e72);
  const paints = [0x8a2a2a, 0x2a4a6a, 0x3a5a3a, 0xc8a030, 0x2a2a30];
  for (let i = 0; i < n; i++) {
    const zz = z + i * 0.8;
    add(g, box(0.05, 0.7, 0.05, metal, x, TOP, zz));
    // A bike in most of the stands, side on.
    if (i % 4 !== 3) {
      const p = mat(paints[i % paints.length]);
      for (const dx of [-0.42, 0.42]) add(g, cylinder(0.3, 0.04, mat(0x1a1a1a), 8, x + dx, TOP + 0.3, zz)).rotation.x = Math.PI / 2;
      add(g, box(0.8, 0.05, 0.05, p, x, TOP + 0.55, zz));
      add(g, box(0.05, 0.38, 0.05, p, x - 0.12, TOP + 0.3, zz));
    }
  }
}

export function buildCampusScene(parent: Object3D, random: () => number): { root: Group; windows: MeshLambertMaterial[] } {
  const root = new Group();
  const g = add(root, new Group());
  const windows = [glowMat(0x22262c, 0xffd8a0, 0.6), glowMat(0x1e242c, 0xc8dcf0, 0.7)];
  const brick = mat(0x8a4a38);
  const stone = mat(0xc8beac);
  const roof = mat(0x3a3a3e);
  const pave = mat(0x8a8478);
  const flag = mat(0xa09888);
  const lawn = mat(0x3e5a32);
  // Ground: paving over the whole site, a lighter plaza, lawns round the hall.
  slab(g, { x0: CAMPUS.x0, x1: CAMPUS.x1, z0: CAMPUS.z0, z1: CAMPUS.z1 }, pave, TOP);
  slab(g, PLAZA, flag, TOP + 0.01);
  slab(g, { x0: HALL.x0 - 3, x1: HALL.x0, z0: HALL.z0, z1: HALL.z1 }, lawn, TOP + 0.01);
  slab(g, { x0: CAMPUS.x0 + 1, x1: HALL.x1, z0: CAMPUS.z0 + 1, z1: HALL.z0 - 1.5 }, lawn, TOP + 0.01);

  // The hall: brick on a stone plinth, three storeys under a cornice and a low hipped roof.
  const storey = 2.9;
  const hw = HALL.x1 - HALL.x0;
  const hd = HALL.z1 - HALL.z0;
  const cx = (HALL.x0 + HALL.x1) / 2;
  const cz = (HALL.z0 + HALL.z1) / 2;
  add(g, box(hw + 0.3, 0.9, hd + 0.3, stone, cx, TOP, cz));
  add(g, box(hw, storey * 3, hd, brick, cx, TOP + 0.5, cz));
  add(g, box(hw + 0.5, 0.35, hd + 0.5, stone, cx, TOP + 0.5 + storey * 3, cz));
  add(g, gableRoof(hd + 0.4, hw + 0.4, 1.6, roof), Math.PI / 2).position.set(cx, TOP + 0.85 + storey * 3, cz);
  windowRows(g, windows[0], HALL.x1, HALL.z0, HALL.z1, 3, storey, 1);
  windowRows(g, windows[0], HALL.x0, HALL.z0, HALL.z1, 3, storey, -1);
  // The portico on the east front: steps, six columns, an entablature and a pediment.
  const px = HALL.x1;
  for (let s = 0; s < 3; s++) add(g, box(1.0, 0.18, 9 - s * 0.6, stone, px + 2.2 - s * 0.7, TOP + s * 0.18, cz));
  for (let i = 0; i < 6; i++) add(g, cylinder(0.32, 5.6, stone, 10, px + 1.4, TOP + 0.54, cz - 3.6 + i * 1.44));
  add(g, box(2.4, 0.7, 9.2, stone, px + 1.2, TOP + 6.1, cz));
  add(g, gableRoof(9.6, 2.6, 1.4, stone), Math.PI / 2).position.set(px + 1.2, TOP + 6.8, cz);
  add(g, box(0.1, 3.2, 2.6, mat(0x2a1e18), px + 0.06, TOP + 0.9, cz));

  // The library: a glass box, lit from inside.
  const lw = LIBRARY.x1 - LIBRARY.x0;
  const ld = LIBRARY.z1 - LIBRARY.z0;
  add(g, box(lw, 0.4, ld, mat(0x4a4e52), (LIBRARY.x0 + LIBRARY.x1) / 2, TOP, (LIBRARY.z0 + LIBRARY.z1) / 2));
  add(g, box(lw - 0.2, 6.2, ld - 0.2, windows[1], (LIBRARY.x0 + LIBRARY.x1) / 2, TOP + 0.4, (LIBRARY.z0 + LIBRARY.z1) / 2));
  for (let x = LIBRARY.x0; x <= LIBRARY.x1 + 0.01; x += 2) add(g, box(0.12, 6.4, 0.12, mat(0x2a2e32), x, TOP + 0.3, LIBRARY.z0));
  add(g, box(lw + 0.4, 0.3, ld + 0.4, mat(0x2a2e32), (LIBRARY.x0 + LIBRARY.x1) / 2, TOP + 6.6, (LIBRARY.z0 + LIBRARY.z1) / 2));

  // The student bar: one storey, a striped awning over its terrace.
  const bx = (STUDENT_BAR.x0 + STUDENT_BAR.x1) / 2;
  add(g, box(STUDENT_BAR.x1 - STUDENT_BAR.x0, 3.4, STUDENT_BAR.z1 - STUDENT_BAR.z0, mat(0x5a4a3a), bx, TOP, (STUDENT_BAR.z0 + STUDENT_BAR.z1) / 2));
  add(g, box(STUDENT_BAR.x1 - STUDENT_BAR.x0 - 1, 1.4, 0.06, windows[0], bx, TOP + 0.8, STUDENT_BAR.z0 - 0.02));
  const awning = add(g, box(STUDENT_BAR.x1 - STUDENT_BAR.x0 + 0.4, 0.08, 2.2, mat(0x2e6a5a), bx, TOP + 2.7, STUDENT_BAR.z0 - 1.0));
  awning.rotation.x = 0.18;
  for (const x of [bx - 2, bx, bx + 2]) {
    add(g, cylinder(0.4, 0.05, mat(0x4a3a2a), 8, x, TOP + 0.72, STUDENT_BAR.z0 - 1.8));
    add(g, cylinder(0.05, 0.72, mat(0x2a2a2a), 5, x, TOP, STUDENT_BAR.z0 - 1.8));
  }

  // The plaza: a fountain, benches, bike racks, trees and lamps.
  const fx = -78.4 + SHIFT.x;
  const fz = 90 + SHIFT.z;
  add(g, cylinder(2.2, 0.5, stone, 16, fx, TOP, fz));
  add(g, cylinder(1.9, 0.05, glowMat(0x3a5a68, 0x1a3a48, 0.6), 16, fx, TOP + 0.46, fz));
  add(g, cylinder(0.3, 1.5, stone, 8, fx, TOP, fz));
  const wood = mat(0x6a5038);
  for (const [x, z, r] of [[-77.2, 81.2, 0], [-79.6, 81.2, 0], [-76.2, 96.4, Math.PI / 2], [-84.4, 82.2, Math.PI / 2]] as const) {
    const b = add(g, new Group(), r);
    b.position.set(x + SHIFT.x, TOP, z + SHIFT.z);
    add(b, box(1.6, 0.08, 0.42, wood, 0, 0.42, 0));
    add(b, box(1.6, 0.36, 0.07, wood, 0, 0.5, -0.2));
    add(b, box(1.5, 0.42, 0.3, mat(0x3a3a3a), 0, 0, 0));
  }
  bikeRack(g, -76.6 + SHIFT.x, 99.2 + SHIFT.z, 7);
  bikeRack(g, -86.4 + SHIFT.x, 101.6 + SHIFT.z, 5);
  // The name over the door, and on a stone plinth by the plaza's edge.
  const name = pixelTextTexture('UNIVERSITY', '#2a2620', '#d8cdb8');
  const nameMat = new MeshLambertMaterial({ map: name, emissive: 0xffffff, emissiveMap: name, emissiveIntensity: 0.25 });
  const plate = new Mesh(new PlaneGeometry(5.4, 0.6), nameMat);
  plate.rotation.y = Math.PI / 2;
  plate.position.set(px + 2.42, TOP + 6.45, cz);
  root.add(plate);
  add(g, box(0.6, 1.0, 3.6, stone, -76.2 + SHIFT.x, TOP, 78.6 + SHIFT.z));
  const plate2 = new Mesh(new PlaneGeometry(3.2, 0.36), nameMat);
  plate2.rotation.y = Math.PI / 2;
  plate2.position.set(-75.88 + SHIFT.x, TOP + 0.6, 78.6 + SHIFT.z);
  root.add(plate2);
  const head = glowMat(0xfff0d0, 0xffe0a8, 1.4);
  for (const [x, z] of [[-76.2, 84], [-76.2, 93], [-87.2, 79], [-87.2, 101.5]]) lampPost(g, head, x + SHIFT.x, z + SHIFT.z);
  for (const [x, z, v] of [[-107, 77, 1], [-106.5, 101, 2], [-91, 77, 0], [-76.4, 103.5, 3], [-107, 108, 1]] as const) {
    const tr = add(g, tree(v, 0.9 + random() * 0.3));
    tr.position.set(x + SHIFT.x, TOP, z + SHIFT.z);
  }
  mergeStatic(g);
  root.traverse((o) => { o.castShadow = false; });
  parent.add(dynamic(root));
  return { root, windows };
}

const STYLES: readonly Archetype[] = ['student', 'student', 'student', 'hiphop', 'punk', 'raver', 'goth', 'student'];

export function buildCampus({ scene, pool, random, setCampusSite }: PackDeps): Pack {
  const { root, windows } = buildCampusScene(scene, random);
  const hang: { a: Actor; i: number }[] = HANGOUTS.map((h, i) => {
    const a = pool.add({ style: STYLES[i % STYLES.length], extra: i % 2 ? 'backpack' : 'bag' }, h.at.x, h.at.z);
    a.heading = h.face;
    a.pose = h.pose;
    a.voice = 'student';
    if (i === 5) { a.glow = 'ember'; a.smokes = true; }
    if (i === 2 || i === 10) a.glow = 'phone';
    return { a, i };
  });
  const walkers = WALKS.flatMap((w, i) => [0, 1].map((k) => {
    const a = pool.add({ style: STYLES[(i * 2 + k + 3) % STYLES.length], extra: 'backpack' }, w[0].x, w[0].z);
    a.voice = 'student';
    return { a, w, t: k * 0.5, dir: k ? -1 : 1, wait: random() * 10 };
  }));
  let lastNight = -1;
  return {
    setEnabled(on) {
      root.visible = on;
      setCampusSite(on);
      if (!on) for (const a of [...hang.map((h) => h.a), ...walkers.map((w) => w.a)]) a.shown = 0;
    },
    update(dt, ctx) {
      // Windows lit after dark (stepped, so materials change rarely).
      const n = Math.round(ctx.night * 8) / 8;
      if (n !== lastNight) {
        lastNight = n;
        windows[0].emissiveIntensity = 0.15 + 0.6 * n;
        windows[1].emissiveIntensity = 0.2 + 0.7 * n;
      }
      let share = 0;
      for (const s of STUDENTS_OUT) if (ctx.clock >= s.from) share = s.share;
      for (const h of hang) fade(h.a, h.i / HANGOUTS.length < share, dt, 0.6);
      for (const w of walkers) {
        if (w.wait > 0) { w.wait -= dt; fade(w.a, false, dt, 2); continue; }
        const to = w.dir > 0 ? w.w[1] : w.w[0];
        const from = w.dir > 0 ? w.w[0] : w.w[1];
        const d = Math.hypot(to.x - w.a.x, to.z - w.a.z);
        fade(w.a, d > 2 && Math.hypot(from.x - w.a.x, from.z - w.a.z) > 0.5, dt, 1.5);
        if (walkTo(w.a, to.x, to.z, 1.25, dt)) {
          // Start again from the other end after a while.
          w.dir = -w.dir as 1 | -1;
          w.wait = 6 + random() * 18;
        }
      }
    },
  };
}
