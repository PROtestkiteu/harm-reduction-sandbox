import { ConeGeometry, Group, Mesh, MeshLambertMaterial, PlaneGeometry, type Object3D } from 'three';
import { bike } from '../details';
import { add, box, cylinder, pixelTextTexture } from '../kit';
import { glowMat, mat } from '../materials';
import { dynamic, mergeStatic } from '../mergeStatic';

/**
 * Small things the flavour packs put in the street. Each is a handful of boxes
 * on shared palette materials; they are kept out of the static merge (they come
 * and go with their pack) and cast no shadow, so they add no shadow pass work.
 */

const coin = glowMat(0xb89a48, 0xffd890, 0.4);
const glint = glowMat(0x9ab0b8, 0x6a8898, 0.5);
const lamp = glowMat(0xfff4dc, 0xfff0d0, 1.2);

/** Bakes the prop into a mesh or two (one per material), then keeps it out of the scene-wide merge. */
function prop(parent: Object3D, g: Group): Group {
  mergeStatic(g);
  g.traverse((o) => { o.castShadow = false; });
  parent.add(dynamic(g));
  return g;
}

/** A bike pointing along +z (the way a person faces), for someone riding or standing with it. */
export function bikeProp(parent: Object3D, frame: number): Group {
  const g = new Group();
  add(g, bike(frame), Math.PI / 2);
  return prop(parent, g);
}

/** A bike with a courier's insulated cube on the rack behind the saddle. */
export function courierBike(parent: Object3D, frame: number, cube: number): Group {
  const g = bikeProp(parent, frame);
  add(g, box(0.42, 0.4, 0.42, mat(cube), 0, 0.72, -0.38));
  return g;
}

/** A guitar case open on the ground, a few coins catching the light. */
export function openCase(parent: Object3D): Group {
  const g = new Group();
  add(g, box(1.0, 0.1, 0.38, mat(0x2a2224), 0, 0, 0));
  add(g, box(0.92, 0.04, 0.3, mat(0x7a2a34), 0, 0.08, 0));
  add(g, box(1.0, 0.36, 0.04, mat(0x2a2224), 0, 0.08, -0.2)).rotation.x = -0.35;
  for (const [x, z] of [[-0.2, 0.05], [0.1, -0.04], [0.25, 0.08]]) add(g, cylinder(0.03, 0.01, coin, 6, x, 0.1, z));
  return prop(parent, g);
}

/** A council wheelie bin. */
export function wheelieBin(parent: Object3D, colour: number): Group {
  const g = new Group();
  add(g, box(0.6, 0.95, 0.7, mat(colour), 0, 0.12, 0));
  add(g, box(0.64, 0.06, 0.74, mat(0x1e2420), 0, 1.07, 0));
  return prop(parent, g);
}

/** A dumped mattress and bin bags at the kerb. */
export function flyTip(parent: Object3D): Group {
  const g = new Group();
  const m = add(g, box(1.9, 0.18, 0.9, mat(0xc8c0a8), 0, 0.12, 0));
  m.rotation.y = 0.3;
  m.rotation.z = 0.08;
  add(g, box(1.7, 0.03, 0.75, mat(0x9a8a70), 0, 0.31, 0)).rotation.y = 0.3;
  const bag = mat(0x1a1c1e);
  for (const [x, z, s] of [[1.2, 0.4, 0.5], [1.5, -0.1, 0.42], [-1.1, 0.6, 0.46]]) add(g, box(s, s * 0.9, s, bag, x, 0.12, z)).rotation.y = x;
  return prop(parent, g);
}

/** Broken glass on the pavement: small pale glints. */
export function brokenGlass(parent: Object3D): Group {
  const g = new Group();
  const glass = glint;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.2 + (i % 4) * 0.22;
    add(g, box(0.16 - (i % 3) * 0.03, 0.01, 0.1, glass, Math.cos(a) * r, 0.13, Math.sin(a) * r)).rotation.y = a;
  }
  return prop(parent, g);
}

/** A small motor scooter for the phone snatcher, pointing along +z. */
export function scooter(parent: Object3D): Group {
  const g = new Group();
  const tyre = mat(0x141414);
  for (const z of [-0.55, 0.55]) add(g, cylinder(0.22, 0.12, tyre, 10, 0, 0.22, z)).rotation.z = Math.PI / 2;
  add(g, box(0.36, 0.3, 1.1, mat(0x2a2a30), 0, 0.3, 0));
  add(g, box(0.3, 0.12, 0.5, mat(0x18181a), 0, 0.62, -0.15));
  add(g, box(0.08, 0.5, 0.08, mat(0x2a2a30), 0, 0.55, 0.5)).rotation.x = -0.3;
  add(g, box(0.55, 0.05, 0.05, mat(0x18181a), 0, 1.02, 0.6));
  add(g, box(0.18, 0.1, 0.06, lamp, 0, 0.85, 0.66));
  return prop(parent, g);
}

/** A bedroll and a bag beside someone sitting at a wall. */
export function belongings(parent: Object3D): Group {
  const g = new Group();
  add(g, cylinder(0.16, 0.8, mat(0x4a5a48), 8, 0.55, 0.16, 0)).rotation.x = Math.PI / 2;
  add(g, box(0.35, 0.3, 0.25, mat(0x3a3430), -0.5, 0.12, 0.1));
  return prop(parent, g);
}

/** A park bench facing +z (its back at -z). */
export function parkBench(parent: Object3D): Group {
  const g = new Group();
  const wood = mat(0x6a5038);
  const metal = mat(0x2e302e);
  add(g, box(1.6, 0.08, 0.42, wood, 0, 0.42, 0));
  add(g, box(1.6, 0.36, 0.07, wood, 0, 0.5, -0.2));
  add(g, box(0.07, 0.42, 0.4, metal, -0.7, 0, 0));
  add(g, box(0.07, 0.42, 0.4, metal, 0.7, 0, 0));
  return prop(parent, g);
}

const sign = (text: string, fg: string, bg: string) => {
  const tex = pixelTextTexture(text, fg, bg);
  return new MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7 });
};
let hotdogSign: MeshLambertMaterial | null = null;
let busSign: MeshLambertMaterial | null = null;

/** A hot dog cart pointing along +z: a steel box on two wheels, a striped umbrella and a lit sign. */
export function hotdogCart(parent: Object3D): Group {
  const g = new Group();
  const steel = mat(0xb8bcc0);
  add(g, box(0.9, 0.85, 1.5, steel, 0, 0.25, 0));
  add(g, box(0.92, 0.06, 1.52, mat(0x3a3a3e), 0, 1.1, 0));
  for (const x of [-0.5, 0.5]) add(g, cylinder(0.25, 0.08, mat(0x1a1a1a), 10, x, 0.25, 0.3)).rotation.z = Math.PI / 2;
  add(g, box(0.06, 0.06, 0.6, mat(0x3a3a3e), 0, 0.9, -1.0));
  add(g, cylinder(0.03, 1.4, mat(0x3a3a3e), 5, 0, 1.1, 0));
  const shade = add(g, new Mesh(new ConeGeometry(1.1, 0.4, 8).translate(0, 2.7, 0), mat(0xc83a2a)));
  shade.castShadow = false;
  add(g, new Mesh(new ConeGeometry(1.12, 0.4, 8, 1, true, 0, Math.PI / 4).translate(0, 2.7, 0), mat(0xe8dcc0)));
  const s = new Mesh(new PlaneGeometry(0.8, 0.22), (hotdogSign ??= sign('HOT DOGS', '#ffe0a0', '#5a1a14')));
  s.rotation.y = Math.PI / 2;
  s.position.set(0.47, 0.85, 0);
  g.add(s);
  return prop(parent, g);
}

/** A bus shelter facing +z: a back and one side of glass, a roof, and a pole with the stop's sign. */
export function busShelter(parent: Object3D): Group {
  const g = new Group();
  const frame = mat(0x2e3236);
  const glass = glint;
  add(g, box(2.6, 0.06, 0.9, frame, 0, 2.3, 0.05));
  add(g, box(2.5, 1.9, 0.04, glass, 0, 0.35, -0.3));
  add(g, box(0.04, 1.9, 0.6, glass, -1.25, 0.35, -0.02));
  for (const x of [-1.25, 1.25]) add(g, box(0.06, 2.3, 0.06, frame, x, 0, -0.3));
  add(g, box(1.6, 0.08, 0.3, mat(0x6a6e72), 0, 0.45, -0.1));
  add(g, cylinder(0.04, 2.6, frame, 6, 1.6, 0, -0.2));
  const s = new Mesh(new PlaneGeometry(0.5, 0.3), (busSign ??= sign('BUS', '#ffffff', '#2a5a9a')));
  s.position.set(1.6, 2.4, -0.16);
  g.add(s);
  return prop(parent, g);
}

/** A shop's roller shutter, pulled down over its door: 2.2 m wide, facing +z. */
export function shutter(parent: Object3D): Group {
  const g = new Group();
  const steel = mat(0x5a5e62);
  const dark = mat(0x34373a);
  add(g, box(2.2, 2.4, 0.06, steel, 0, 1.2, 0));
  for (let i = 0; i < 8; i++) add(g, box(2.22, 0.03, 0.07, dark, 0, 0.2 + i * 0.28, 0.005));
  return prop(parent, g);
}

/** A hand-held placard on a stick, carried in front and above the head: the person faces +z. */
export function placard(parent: Object3D, colour: number): Group {
  const g = new Group();
  add(g, box(0.035, 1.25, 0.035, mat(0x6a5038), 0.18, 1.25, 0.28));
  add(g, box(0.7, 0.48, 0.03, mat(colour), 0.18, 2.0, 0.3));
  return prop(parent, g);
}

/** A Sheffield-style bike rack along x with `n` bikes leaned across it, frames from `colours`. */
export function bikeRack(parent: Object3D, n: number, colours: readonly number[], random: () => number): Group {
  const g = new Group();
  const steel = mat(0x6a6e72);
  const w = Math.max(1.6, n * 0.75);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (i / n) * w;
    add(g, box(0.05, 0.75, 0.05, steel, x, 0, 0));
  }
  add(g, box(w + 0.05, 0.05, 0.05, steel, 0, 0.72, 0));
  for (let i = 0; i < n; i++) {
    const b = add(g, bike(colours[Math.floor(random() * colours.length)]), Math.PI / 2);
    b.position.set(-w / 2 + ((i + 0.5) / n) * w, 0, 0.05);
  }
  return prop(parent, g);
}

/** A long planter by a wall: a concrete trough, earth and a few shrubs and flowers. */
export function planter(parent: Object3D): Group {
  const g = new Group();
  add(g, box(1.6, 0.45, 0.5, mat(0x8a867e), 0, 0, 0));
  add(g, box(1.5, 0.04, 0.4, mat(0x3a2a1e), 0, 0.42, 0));
  for (let i = 0; i < 5; i++) add(g, cylinder(0.14 + (i % 2) * 0.05, 0.26 + (i % 3) * 0.08, mat([0x3a6a32, 0x4a7a3a, 0x2e5a2a][i % 3]), 6, -0.6 + i * 0.3, 0.44, 0));
  for (let i = 0; i < 4; i++) add(g, box(0.06, 0.06, 0.06, mat([0xd84a6a, 0xe8c84a, 0xf0f0e8, 0xb04ad8][i]), -0.45 + i * 0.3, 0.72 + (i % 2) * 0.06, 0.06));
  return prop(parent, g);
}

/** A sandwich board: two chalkboards leaning together on a frame. */
export function aBoard(parent: Object3D): Group {
  const g = new Group();
  const wood = mat(0x6a4a2e);
  const slate = mat(0x22262a);
  for (const s of [-1, 1]) {
    const leaf = add(g, new Group());
    leaf.position.z = s * 0.12;
    leaf.rotation.x = s * 0.22;
    add(leaf, box(0.56, 0.82, 0.03, wood, 0, 0, 0));
    add(leaf, box(0.48, 0.66, 0.035, slate, 0, 0.08, 0));
    add(leaf, box(0.36, 0.03, 0.037, mat(0xe8e2d0), 0, 0.55, 0));
    add(leaf, box(0.28, 0.03, 0.037, mat(0xe8e2d0), 0, 0.42, 0));
  }
  return prop(parent, g);
}

/** A red pillar post box. */
export function postBox(parent: Object3D): Group {
  const g = new Group();
  const red = mat(0xb8282a);
  add(g, cylinder(0.24, 1.05, red, 10, 0, 0, 0));
  add(g, cylinder(0.27, 0.12, red, 10, 0, 1.05, 0));
  add(g, box(0.26, 0.04, 0.05, mat(0x1a1a1a), 0, 0.82, 0.23));
  return prop(parent, g);
}

/** A free newspaper box on a stand. */
export function newsBox(parent: Object3D): Group {
  const g = new Group();
  add(g, box(0.06, 0.5, 0.06, mat(0x3a3a3e), 0, 0, 0));
  add(g, box(0.5, 0.6, 0.4, mat(0x2a5aa0), 0, 0.5, 0));
  add(g, box(0.4, 0.3, 0.02, glowMat(0xc8d0d8, 0xe8f0ff, 0.25), 0, 0.68, 0.2));
  return prop(parent, g);
}

/** A short steel bollard. */
export function bollard(parent: Object3D): Group {
  const g = new Group();
  add(g, cylinder(0.09, 0.85, mat(0x3a3c40), 8, 0, 0, 0));
  add(g, cylinder(0.095, 0.06, mat(0xd8c84a), 8, 0, 0.68, 0));
  return prop(parent, g);
}
