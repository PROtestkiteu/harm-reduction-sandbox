import { ConeGeometry, Group, IcosahedronGeometry, Mesh, type Object3D } from 'three';
import type { Random } from '../sim/random';
import type { CityBuilding } from './cityBuildings';
import { add, box } from './kit';
import { mat } from './materials';

/**
 * Green on the streets that stays green: ivy climbing some walls (the two
 * faces the camera sees), and evergreens, a slim conifer in a tub or a pair
 * of clipped box balls, standing close against a wall. ILLUSTRATIVE density.
 * Static; the caller merges it with the rest of the city.
 */
const IVY = [0x2e5a2a, 0x3a6a32, 0x24502a, 0x46743a];
const cone = new ConeGeometry(0.42, 1.0, 7);
const ball = new IcosahedronGeometry(0.32, 1);

function ivy(g: Object3D, random: Random, along: 'x' | 'z', x: number, z: number, out: number, height: number): void {
  // A patch a metre or three wide, climbing in uneven columns.
  const cols = 3 + Math.floor(random() * 6);
  for (let i = 0; i < cols; i++) {
    const top = height * (0.25 + random() * 0.55);
    for (let y = 0.1; y < top; y += 0.32) {
      const w = 0.28 + random() * 0.22;
      const s = i * 0.3 + (random() - 0.5) * 0.12;
      const leaf = mat(IVY[Math.floor(random() * IVY.length)]);
      if (along === 'x') add(g, box(w, 0.34, 0.06, leaf, x + s, y, z + out));
      else add(g, box(0.06, 0.34, w, leaf, x + out, y, z + s));
    }
  }
}

function conifer(g: Object3D, x: number, z: number): void {
  add(g, box(0.6, 0.45, 0.6, mat(0x6a5e52), x, 0.12, z));
  for (const [y, k] of [[0.95, 1], [1.5, 0.78], [2.0, 0.55]] as const) {
    const m = add(g, new Mesh(cone, mat(0x24482c)));
    m.position.set(x, 0.57 + y - 0.5, z);
    m.scale.setScalar(k);
  }
}

function boxBalls(g: Object3D, along: 'x' | 'z', x: number, z: number): void {
  for (const s of [-0.8, 0.8]) {
    const [bx, bz] = along === 'x' ? [x + s, z] : [x, z + s];
    add(g, box(0.5, 0.4, 0.5, mat(0x8a867e), bx, 0.12, bz));
    const m = add(g, new Mesh(ball, mat(0x2e5a30)));
    m.position.set(bx, 0.82, bz);
  }
}

export function buildGreenery(parent: Object3D, buildings: readonly CityBuilding[], random: Random): void {
  const g = add(parent, new Group());
  for (const b of buildings) {
    const h = b.height;
    const r = random();
    // South face (z1) and east face (x1): the ones the camera sees.
    if (r < 0.22) ivy(g, random, 'x', b.x0 + 0.6 + random() * Math.max(0.1, b.x1 - b.x0 - 3), b.z1, 0.04, h);
    else if (r < 0.34) ivy(g, random, 'z', b.x1, b.z0 + 0.6 + random() * Math.max(0.1, b.z1 - b.z0 - 3), 0.04, h);
    const e = random();
    if (e < 0.1) conifer(g, b.x1 - 0.6, b.z1 + 0.42);
    else if (e < 0.18) boxBalls(g, 'x', (b.x0 + b.x1) / 2 + (random() - 0.5) * 2, b.z1 + 0.32);
  }
}
