import { AdditiveBlending, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { inView } from '../render/viewEdge';
import type { Random } from '../sim/random';
import { add, box, cylinder } from './kit';
import { glowMat, vehicleMat } from './materials';
import { dynamic } from './mergeStatic';

/**
 * Now and then a helicopter answers a call: a police one after dark, its
 * searchlight on the street below, or by day an air ambulance. It flies in
 * from beyond the view, circles the scene for a while and flies off out of
 * view again. Hidden and skipped while it is not up, so it costs nothing
 * between calls.
 */
const HEIGHT = 48;
const SPEED = 26;
const CIRCLE = { radius: 24, seconds: 40, speed: 0.35 };

function airframe(police: boolean): { g: Group; rotor: Object3D; beacon: Object3D } {
  const g = new Group();
  const body = vehicleMat(police ? 0x1e2a4a : 0xe8e2d8);
  const band = vehicleMat(police ? 0xe8e2d8 : 0xc8382a);
  add(g, box(1.6, 1.4, 3.6, body, 0, 0, 0.2));
  add(g, box(1.62, 0.3, 3.0, band, 0, 0.3, 0.2));
  add(g, box(1.3, 0.7, 1.0, glowMat(0x203040, 0xbfe0ff, 0.25), 0, 0.35, 1.8));
  add(g, box(0.35, 0.4, 4.2, body, 0, 0.4, -3.4));
  add(g, box(0.08, 1.0, 0.7, band, 0, 0.6, -5.4));
  for (const x of [-0.75, 0.75]) add(g, box(0.08, 0.08, 2.8, vehicleMat(0x2a2a2a), x, -0.9, 0.2));
  add(g, cylinder(0.12, 0.4, vehicleMat(0x2a2a2a), 6, 0, 0.7, 0.2));
  const rotor = add(g, new Group());
  rotor.position.set(0, 1.12, 0.2);
  add(rotor, box(9.5, 0.05, 0.28, vehicleMat(0x1a1a1a), 0, 0, 0));
  add(rotor, box(0.28, 0.05, 9.5, vehicleMat(0x1a1a1a), 0, 0, 0));
  const beacon = add(g, box(0.18, 0.12, 0.18, glowMat(0x401010, 0xff3030, 2.4), 0, -0.75, -1.0));
  return { g, rotor, beacon };
}

export class Helicopter {
  private readonly root: Group;
  private readonly kinds: Record<'police' | 'medical', ReturnType<typeof airframe>>;
  private readonly beam: Mesh;
  private craft: ReturnType<typeof airframe> | null = null;
  private state: 'idle' | 'in' | 'circling' | 'out' = 'idle';
  private x = 0;
  private z = 0;
  private tx = 0;
  private tz = 0;
  private ox = 0;
  private oz = 0;
  private angle = 0;
  private left = 0;
  private time = 0;
  private night = 0;

  constructor(scene: Object3D, private readonly random: Random) {
    this.root = dynamic(new Group());
    this.root.visible = false;
    scene.add(this.root);
    this.kinds = { police: airframe(true), medical: airframe(false) };
    for (const k of Object.values(this.kinds)) {
      k.g.visible = false;
      k.g.userData.mover = 'helicopter';
      k.g.traverse((o) => { o.castShadow = false; });
      this.root.add(k.g);
    }
    // The searchlight: a faint cone from the nose to the street, only after dark.
    const geo = new ConeGeometry(4, HEIGHT, 16, 1, true).translate(0, -HEIGHT / 2, 0);
    this.beam = new Mesh(geo, new MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.09, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    this.beam.visible = false;
    this.root.add(this.beam);
  }

  get busy(): boolean {
    return this.state !== 'idle';
  }

  setNight(night: number): void {
    this.night = night;
  }

  /** Sends it to circle (x, z); false when it is already up. */
  call(kind: 'police' | 'medical', x: number, z: number): boolean {
    if (this.busy) return false;
    this.craft = this.kinds[kind];
    this.tx = x;
    this.tz = z;
    // In from a bearing well out of view, out by another.
    this.offView(this.random() * Math.PI * 2);
    this.x = this.ox;
    this.z = this.oz;
    this.offView(Math.atan2(this.x - x, this.z - z) + Math.PI * (0.6 + this.random() * 0.8));
    this.state = 'in';
    this.root.visible = true;
    this.craft.g.visible = true;
    this.beam.visible = kind === 'police' && this.night > 0.5;
    return true;
  }

  update(dt: number): void {
    if (this.state === 'idle' || !this.craft) return;
    this.time += dt;
    const g = this.craft.g;
    let goX = this.tx;
    let goZ = this.tz;
    if (this.state === 'circling') {
      this.angle += CIRCLE.speed * dt;
      goX = this.tx + Math.sin(this.angle) * CIRCLE.radius;
      goZ = this.tz + Math.cos(this.angle) * CIRCLE.radius;
      this.left -= dt;
      if (this.left <= 0) this.state = 'out';
    }
    if (this.state === 'out') {
      goX = this.ox;
      goZ = this.oz;
    }
    const dx = goX - this.x;
    const dz = goZ - this.z;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, SPEED * dt);
    if (d > 1e-3) {
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
      // Turns towards where it flies, nose a little down.
      const want = Math.atan2(dx, dz);
      let turn = want - g.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      g.rotation.y += turn * Math.min(1, dt * 2);
    }
    if (this.state === 'in' && d < CIRCLE.radius + 2) {
      this.state = 'circling';
      this.left = CIRCLE.seconds;
      this.angle = Math.atan2(this.x - this.tx, this.z - this.tz);
    }
    if (this.state === 'out' && d < 1) {
      this.state = 'idle';
      this.root.visible = false;
      g.visible = false;
      this.beam.visible = false;
      return;
    }
    g.position.set(this.x, HEIGHT + Math.sin(this.time * 0.9) * 0.4, this.z);
    g.rotation.x = 0.08;
    this.craft.rotor.rotation.y += dt * 38;
    this.craft.beacon.visible = Math.sin(this.time * 7) > 0.3;
    // The beam hangs from the craft and points at the scene.
    if (this.beam.visible) {
      this.beam.position.set(this.x, HEIGHT - 0.8, this.z);
      // Its axis (local -y) turned onto the scene, stretched to reach the street.
      this.beam.lookAt(this.tx, 0, this.tz);
      this.beam.rotateX(-Math.PI / 2);
      this.beam.scale.set(1, Math.hypot(this.tx - this.x, HEIGHT, this.tz - this.z) / HEIGHT, 1);
    }
  }

  /** Sets (ox, oz) to the first point out along `bearing` from the target that the camera cannot see. */
  private offView(bearing: number): void {
    const sx = Math.sin(bearing);
    const sz = Math.cos(bearing);
    let r = 120;
    while (r < 900 && inView(this.tx + sx * r, this.tz + sz * r, 0, 0, 6, 3, HEIGHT - 1)) r += 40;
    this.ox = this.tx + sx * (r + 40);
    this.oz = this.tz + sz * (r + 40);
  }
}
