import { CylinderGeometry, ExtrudeGeometry, Group, Mesh, Shape, type Material, type MeshLambertMaterial } from 'three';
import { add, box } from './kit';
import { glowMat, vehicleMat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import type { EmergencyVehicle } from './vehicles';

/**
 * The city's heavy vehicles, built like the team coach (world/teamBus.ts):
 * rounded extruded shells in vehicle paint, not boxes in wall colours (the
 * building shader paints those as brick). Each faces +z, sits on the ground
 * at y = 0, and its wheels turn with rollWheels (world/vehicles.ts).
 */

/** A side profile (x forward, y up) as a rounded shell `width` across, centred on x = 0 across. */
function shell(points: readonly (readonly [number, number])[], width: number, m: Material): Mesh {
  const s = new Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) s.lineTo(x, y);
  s.closePath();
  const geo = new ExtrudeGeometry(s, { depth: width - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 3 });
  geo.translate(0, 0, -(width - 0.16) / 2);
  return new Mesh(geo, m);
}

const tyreGeo = new CylinderGeometry(0.5, 0.5, 0.38, 14).rotateZ(Math.PI / 2);
const hubGeo = new CylinderGeometry(0.27, 0.27, 0.4, 6).rotateZ(Math.PI / 2);

/**
 * Wheels at `axles` (metres along the vehicle, forward +), `width` apart, on `g` itself (whose +z is
 * forward), so each turns about its axle (local x) as rollWheels expects; twin tyres at `twin`.
 */
function wheels(g: Group, axles: readonly number[], width: number, twin: readonly number[] = []): void {
  const tyre = vehicleMat(0x18191b, 0);
  const hub = vehicleMat(0x8a8a86, 1);
  const turning: Mesh[] = [];
  for (const z of axles) {
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 0.2);
      const t = dynamic(new Mesh(tyreGeo, tyre));
      t.position.set(x, 0.5, z);
      const h = dynamic(new Mesh(hubGeo, hub));
      h.position.set(x * 1.02, 0.5, z);
      g.add(t, h);
      turning.push(t, h);
      if (twin.includes(z)) {
        const t2 = dynamic(new Mesh(tyreGeo, tyre));
        t2.position.set(x - side * 0.4, 0.5, z);
        g.add(t2);
        turning.push(t2);
      }
    }
  }
  g.userData.wheels = { meshes: turning, r: 0.5 };
}

/** A body group whose +x is the vehicle's forward (+z), so profiles can be drawn front to the right. */
function forward(g: Group): Group {
  const body = add(g, new Group());
  body.rotation.y = -Math.PI / 2;
  return body;
}

/**
 * A fire engine, about 8.4 m long: a tall crew cab with a raked screen, a red
 * body with silver roller shutters along each side, a white and a
 * reflective yellow band, a ladder on the roof, and blue lamps on the cab
 * and at the back that flash in turn when it is on a call.
 */
export function fireEngine(): EmergencyVehicle {
  const g = new Group();
  const body = forward(g);
  const W = 2.5;
  const red = vehicleMat(0xb81e1e);
  const white = vehicleMat(0xf2f0ea);
  const yellow = vehicleMat(0xe8c830);
  const steel = vehicleMat(0xb8bcc0, 2);
  const dark = vehicleMat(0x1a1b1e, 0);
  const glass = vehicleMat(0x18222c, 2);
  // The body behind the cab, and the cab with its raked windscreen.
  body.add(shell([[-4.2, 0.55], [1.3, 0.55], [1.3, 3.05], [-4.2, 3.05]], W, red));
  body.add(shell([[1.4, 0.55], [4.15, 0.55], [4.2, 1.6], [3.75, 2.85], [1.4, 2.9]], W, red));
  for (const z of [-1, 1]) {
    const side = z * (W / 2 + 0.01);
    // Roller shutters: three silver panels with ribs.
    for (const [x0, x1] of [[-3.9, -2.3], [-2.15, -0.55], [-0.4, 1.1]]) {
      add(body, box(x1 - x0, 1.55, 0.02, steel, (x0 + x1) / 2, 1.15, side));
      for (let y = 1.25; y < 2.7; y += 0.18) add(body, box(x1 - x0, 0.025, 0.03, dark, (x0 + x1) / 2, y, side + z * 0.005));
    }
    // Bands: white along the top of the shutters, reflective yellow along the bottom.
    add(body, box(8.3, 0.12, 0.02, white, -0.05, 2.78, side + z * 0.003));
    add(body, box(8.3, 0.18, 0.02, yellow, -0.05, 0.86, side + z * 0.006));
    // Crew cab windows.
    add(body, box(2.2, 0.75, 0.02, glass, 2.6, 1.95, side + z * 0.004));
  }
  // Windscreen on the raked front, and a grille and bumper below it.
  const screen = add(body, box(0.05, 1.0, W - 0.25, glass, 3.98, 1.75, 0));
  screen.rotation.z = -0.32;
  add(body, box(0.08, 0.5, W - 0.5, dark, 4.25, 0.8, 0));
  add(body, box(0.25, 0.22, W, steel, 4.28, 0.45, 0));
  // The ladder on the roof: two rails with rungs, on two short posts.
  for (const z of [-0.45, 0.45]) {
    add(body, box(6.4, 0.08, 0.08, steel, -1.1, 3.22, z));
    for (const x of [-3.6, 1.0]) add(body, box(0.1, 0.17, 0.1, dark, x, 3.05, z));
  }
  for (let x = -4.1; x < 2.0; x += 0.4) add(body, box(0.05, 0.05, 0.9, steel, x, 3.22, 0));
  // Lamps: a bar on the cab roof (blue each side), and a blue lamp at each rear corner.
  const a = glowMat(0x1e2a6a, 0x3a6aff, 0);
  const b = glowMat(0x1e2a6a, 0x3a6aff, 0);
  add(body, box(0.3, 0.08, W - 0.3, dark, 2.6, 2.95, 0));
  add(body, box(0.26, 0.16, 0.7, a, 2.6, 3.03, -0.62));
  add(body, box(0.26, 0.16, 0.7, b, 2.6, 3.03, 0.62));
  for (const z of [-1, 1]) add(body, box(0.1, 0.2, 0.2, z < 0 ? b : a, -4.25, 2.8, z * 1.0));
  // Head and tail lamps.
  for (const z of [-0.85, 0.85]) {
    add(body, box(0.05, 0.16, 0.3, glowMat(0x4a4a3a, 0xfff2d0, 1.2), 4.27, 1.0, z));
    add(body, box(0.05, 0.2, 0.18, glowMat(0x3a0e0e, 0xff2a1a, 0.9), -4.27, 0.95, z));
  }
  wheels(g, [2.75, -2.6], W, [-2.6]);
  g.traverse((o) => { o.castShadow = false; });
  mergeStatic(g);
  let t = 0;
  const v: EmergencyVehicle = {
    group: g,
    flashing: false,
    tick(dt) {
      t += dt;
      const on = v.flashing ? 1 : 0;
      const phase = Math.floor(t * 5) % 2;
      a.emissiveIntensity = on * (phase ? 2.6 : 0.12);
      b.emissiveIntensity = on * (phase ? 0.12 : 2.6);
    },
  };
  return v;
}

/**
 * A refuse lorry, about 7.8 m long: a rounded low-entry cab in council white,
 * a ribbed compactor body in green with an orange band, the rear hopper with
 * its bin lifter, and an amber beacon on the cab (`beacon`, which the caller
 * pulses while it works).
 */
export function binLorry(beacon: MeshLambertMaterial, livery = 0x3a6a42): Group {
  const g = new Group();
  const body = forward(g);
  const W = 2.45;
  const white = vehicleMat(0xe8e6e0);
  const green = vehicleMat(livery);
  const orange = vehicleMat(0xd86a1e);
  const dark = vehicleMat(0x1a1b1e, 0);
  const steel = vehicleMat(0x9a9ea2, 1);
  const glass = vehicleMat(0x18222c, 2);
  // The cab: low and rounded, a big screen.
  body.add(shell([[2.0, 0.5], [3.85, 0.5], [3.9, 1.4], [3.6, 2.7], [2.0, 2.75]], W, white));
  const screen = add(body, box(0.05, 1.1, W - 0.3, glass, 3.72, 1.95, 0));
  screen.rotation.z = -0.22;
  for (const z of [-1, 1]) add(body, box(1.2, 0.85, 0.02, glass, 2.85, 1.95, z * (W / 2 + 0.01)));
  add(body, box(0.25, 0.22, W, steel, 3.95, 0.45, 0));
  // The compactor body: a rounded box with ribs down each side and an orange band.
  body.add(shell([[-3.0, 0.6], [1.9, 0.6], [1.9, 2.9], [-2.6, 3.0], [-3.0, 2.7]], W, green));
  for (const z of [-1, 1]) {
    const side = z * (W / 2 + 0.01);
    for (let x = -2.7; x < 1.8; x += 0.55) add(body, box(0.08, 2.1, 0.04, green, x, 0.75, side));
    add(body, box(4.9, 0.22, 0.02, orange, -0.55, 1.55, side + z * 0.02));
  }
  // The rear hopper, its mouth, and the bin lifter arms.
  body.add(shell([[-3.9, 0.55], [-3.0, 0.55], [-3.0, 2.6], [-3.55, 2.4], [-3.9, 1.4]], W - 0.1, steel));
  add(body, box(0.05, 0.7, W - 0.6, dark, -3.92, 1.2, 0));
  for (const z of [-0.6, 0.6]) add(body, box(0.12, 0.9, 0.12, dark, -4.0, 0.55, z));
  add(body, box(0.12, 0.12, 1.4, dark, -4.0, 1.4, 0));
  // Lamps, and the beacon on the cab roof.
  for (const z of [-0.85, 0.85]) {
    add(body, box(0.05, 0.16, 0.3, glowMat(0x4a4a3a, 0xfff2d0, 1.2), 3.92, 0.95, z));
    add(body, box(0.05, 0.2, 0.18, glowMat(0x3a0e0e, 0xff2a1a, 0.9), -3.95, 0.9, z));
  }
  add(body, box(0.3, 0.18, 0.3, beacon, 2.7, 2.8, 0));
  wheels(g, [2.9, -1.4, -2.4], W, [-1.4, -2.4]);
  g.traverse((o) => { o.castShadow = false; });
  mergeStatic(g);
  return g;
}
