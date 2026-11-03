import { AdditiveBlending, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Shape, SphereGeometry, type Material, type Object3D } from 'three';
import { inView } from '../render/viewEdge';
import type { Random } from '../sim/random';
import { add, box, cylinder } from './kit';
import { glowMat, vehicleMat } from './materials';
import { HELIPAD } from './cityBeyond';
import { dynamic, mergeStatic } from './mergeStatic';

/**
 * Now and then a helicopter answers a call: a police one after dark, its
 * searchlight on the street below, or by day an air ambulance. It flies in
 * from beyond the view and circles the scene for a while; the police one
 * then flies off out of view, the air ambulance on to the hospital, where it
 * lands on the rooftop pad, spools down, waits, and lifts off out of view
 * again. Day or night the air ambulance also comes in to the pad on its own now and
 * then. Hidden and skipped while it is not up, so it costs nothing between
 * flights.
 */
const HEIGHT = 48;
const SPEED = 26;
const CIRCLE = { radius: 24, seconds: 40, speed: 0.35 };
/** From the craft's middle down to its skids. */
const SKIDS = 1.05;
/** On the pad: seconds standing with the rotor slowed, and the climb and descent rates (m/s). */
const PAD = { wait: 45, descend: 3.2, climb: 4 };
/** Seconds between the air ambulance's own flights to the pad, by day. */
const FERRY: readonly [number, number] = [260, 620];
/** Rotor speed in flight and idling on the pad (radians a second). */
const RPM = { fly: 38, idle: 9 };

/** A light twin-engine helicopter: rounded cabin and glazing, engine hump, tapered boom, fin, skids, a four-blade rotor. */
function airframe(police: boolean): { g: Group; rotor: Object3D; tail: Object3D; disc: Mesh; beacon: Object3D } {
  const g = new Group();
  const frame = new Group();
  g.add(frame);
  const body = vehicleMat(police ? 0x1e2a4a : 0xc8282a);
  const band = vehicleMat(police ? 0xe8e2d8 : 0xf2f0ea);
  const glass = vehicleMat(0x18222c, 2);
  const dark = vehicleMat(0x2a2a2c, 0);
  const egg = (m: Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, part?: [number, number, number, number]) => {
    const geo = part ? new SphereGeometry(1, 16, 10, part[0], part[1], part[2], part[3]) : new SphereGeometry(1, 16, 10);
    const o = new Mesh(geo, m);
    o.scale.set(sx, sy, sz);
    o.position.set(x, y, z);
    frame.add(o);
    return o;
  };
  // The cabin, its glazing wrapping round the nose and the doors, the engine hump on top.
  egg(body, 0.88, 0.82, 2.0, 0, 0, 0.3);
  // The glazing: the front half of the cabin's upper part (phi round y from +x; the nose is +z, at phi = pi / 2).
  egg(glass, 0.9, 0.84, 2.02, 0, 0.02, 0.32, [Math.PI * 0.08, Math.PI * 0.84, 0.16 * Math.PI, 0.3 * Math.PI]);
  egg(body, 0.58, 0.36, 1.2, 0, 0.72, -0.45);
  add(frame, box(1.64, 0.2, 2.3, band, 0, -0.3, 0.2));
  // The tail boom, tapering to the fin; the fin with the tail rotor and the stabiliser with its end plates.
  const boom = new Mesh(new CylinderGeometry(0.17, 0.42, 4.6, 10).rotateX(Math.PI / 2), body);
  boom.position.set(0, 0.32, -3.6);
  frame.add(boom);
  const fin = new Shape();
  fin.moveTo(0, 0);
  fin.lineTo(0.95, 0);
  fin.lineTo(0.55, 1.35);
  fin.lineTo(0.1, 1.35);
  fin.lineTo(-0.3, 0.2);
  const finMesh = new Mesh(new ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: false }).rotateY(-Math.PI / 2), body);
  finMesh.position.set(0.04, 0.3, -6.3);
  frame.add(finMesh);
  add(frame, box(1.9, 0.06, 0.5, body, 0, 0.32, -5.2));
  for (const x of [-0.95, 0.95]) add(frame, box(0.05, 0.42, 0.45, band, x, 0.15, -5.2));
  // Skids on bent cross tubes.
  for (const x of [-0.82, 0.82]) {
    const skid = new Mesh(new CylinderGeometry(0.05, 0.05, 3.0, 6).rotateX(Math.PI / 2), dark);
    skid.position.set(x, -SKIDS + 0.05, 0.25);
    frame.add(skid);
    const toe = new Mesh(new CylinderGeometry(0.05, 0.05, 0.45, 6).rotateX(Math.PI / 2 - 0.6), dark);
    toe.position.set(x, -SKIDS + 0.16, 1.9);
    frame.add(toe);
    for (const z of [-0.5, 1.05]) {
      const leg = new Mesh(new CylinderGeometry(0.04, 0.04, 0.75, 6), dark);
      leg.position.set(x * 0.82, -SKIDS + 0.4, z);
      leg.rotation.z = x > 0 ? 0.45 : -0.45;
      frame.add(leg);
    }
  }
  // The mast and hub.
  add(frame, cylinder(0.1, 0.42, dark, 8, 0, 0.92, -0.1));
  mergeStatic(frame);
  const rotor = dynamic(add(g, new Group()));
  rotor.position.set(0, 1.36, -0.1);
  add(rotor, cylinder(0.26, 0.14, dark, 10, 0, -0.07, 0));
  const blade = vehicleMat(0x1a1a1a);
  for (let i = 0; i < 4; i++) {
    const b = add(rotor, box(4.9, 0.04, 0.3, blade, 2.55, 0, 0));
    const arm = add(rotor, new Group(), (i * Math.PI) / 2);
    arm.add(b);
  }
  // A faint disc where the blades blur at speed.
  const disc = new Mesh(new CircleGeometry(5.0, 28).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0.12, depthWrite: false }));
  rotor.add(disc);
  const tail = dynamic(add(g, new Group()));
  tail.position.set(0.16, 1.15, -6.0);
  for (const r of [0, Math.PI / 2]) add(tail, box(0.03, 1.1, 0.12, blade, 0, -0.55, 0)).rotation.x = r;
  const beacon = dynamic(add(g, box(0.18, 0.12, 0.18, glowMat(0x401010, 0xff3030, 2.4), 0, -0.86, -1.0)));
  return { g, rotor, tail, disc, beacon };
}

type Phase = 'idle' | 'in' | 'circling' | 'toPad' | 'down' | 'landed' | 'up' | 'out';

export class Helicopter {
  private readonly root: Group;
  private readonly kinds: Record<'police' | 'medical', ReturnType<typeof airframe>>;
  private readonly beam: Mesh;
  private craft: ReturnType<typeof airframe> | null = null;
  private kind: 'police' | 'medical' = 'police';
  private state: Phase = 'idle';
  private x = 0;
  private z = 0;
  private y = HEIGHT;
  private tx = 0;
  private tz = 0;
  private ox = 0;
  private oz = 0;
  private angle = 0;
  private left = 0;
  private time = 0;
  private night = 0;
  private rpm = RPM.fly;
  /** Seconds to the air ambulance's next flight of its own to the pad. */
  private ferryIn: number;

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
    this.beam = new Mesh(geo, new MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.09, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, forceSinglePass: true }));
    this.beam.visible = false;
    this.root.add(this.beam);
    this.ferryIn = FERRY[0] * (0.3 + random() * 0.7);
  }

  get busy(): boolean {
    return this.state !== 'idle';
  }

  /** Where it is on the ground plane while up, else null (for the sound). */
  airborne(out: { x: number; z: number }): { x: number; z: number } | null {
    if (this.state === 'idle') return null;
    out.x = this.x;
    out.z = this.z;
    return out;
  }

  setNight(night: number): void {
    this.night = night;
  }

  /** Sends it to circle (x, z); false when it is already up. */
  call(kind: 'police' | 'medical', x: number, z: number): boolean {
    if (this.busy) return false;
    this.launch(kind, x, z);
    this.state = 'in';
    this.beam.visible = kind === 'police' && this.night > 0.5;
    return true;
  }

  update(dt: number): void {
    if (this.state === 'idle') {
      // Now and then, day or night, the air ambulance brings someone straight in to the hospital's pad.
      if (HELIPAD.y > 0 && (this.ferryIn -= dt) <= 0) {
        this.ferryIn = FERRY[0] + this.random() * (FERRY[1] - FERRY[0]);
        this.launch('medical', HELIPAD.x, HELIPAD.z);
        this.state = 'toPad';
      }
      return;
    }
    if (!this.craft) return;
    this.time += dt;
    const g = this.craft.g;
    // Only a craft already flying out this step can reach the way out (`d` below is measured for this step's goal).
    const wasOut = this.state === 'out';
    let goX = this.tx;
    let goZ = this.tz;
    if (this.state === 'circling') {
      this.angle += CIRCLE.speed * dt;
      goX = this.tx + Math.sin(this.angle) * CIRCLE.radius;
      goZ = this.tz + Math.cos(this.angle) * CIRCLE.radius;
      this.left -= dt;
      if (this.left <= 0) {
        // The police fly off; the air ambulance takes its patient to the hospital.
        if (this.kind === 'medical' && HELIPAD.y > 0) {
          this.state = 'toPad';
          this.tx = HELIPAD.x;
          this.tz = HELIPAD.z;
        } else this.state = 'out';
      }
    }
    if (this.state === 'toPad' || this.state === 'down' || this.state === 'landed' || this.state === 'up') {
      goX = HELIPAD.x;
      goZ = HELIPAD.z;
    }
    if (this.state === 'out') {
      goX = this.ox;
      goZ = this.oz;
    }
    const dx = goX - this.x;
    const dz = goZ - this.z;
    const d = Math.hypot(dx, dz);
    // Slows over the pad to a hover; full speed elsewhere.
    const speed = this.state === 'toPad' ? Math.min(SPEED, 3 + d * 0.6) : SPEED;
    const step = Math.min(d, speed * dt);
    if (d > 1e-3 && this.state !== 'landed') {
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
      // Turns towards where it flies, nose a little down.
      if (d > 2) {
        const want = Math.atan2(dx, dz);
        let turn = want - g.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        g.rotation.y += turn * Math.min(1, dt * 2);
      }
    }
    if (this.state === 'in' && d < CIRCLE.radius + 2) {
      this.state = 'circling';
      this.left = CIRCLE.seconds;
      this.angle = Math.atan2(this.x - this.tx, this.z - this.tz);
    }
    const padY = HELIPAD.y + SKIDS;
    if (this.state === 'toPad' && d < 0.5) this.state = 'down';
    if (this.state === 'down') {
      this.y = Math.max(padY, this.y - PAD.descend * dt * Math.min(1, 0.3 + (this.y - padY) / 8));
      if (this.y <= padY) { this.state = 'landed'; this.left = PAD.wait; }
    } else if (this.state === 'landed') {
      this.left -= dt;
      // Spools down on the pad, back up before it lifts.
      const want = this.left > 8 ? RPM.idle : RPM.fly;
      this.rpm += (want - this.rpm) * Math.min(1, dt * 0.6);
      if (this.left <= 0 && this.rpm > RPM.fly * 0.9) {
        this.state = 'up';
        this.offView(this.random() * Math.PI * 2);
      }
    } else if (this.state === 'up') {
      this.y = Math.min(HEIGHT, this.y + PAD.climb * dt);
      if (this.y >= padY + 12) this.state = 'out';
    } else if (this.y < HEIGHT) this.y = Math.min(HEIGHT, this.y + PAD.climb * dt);
    if (wasOut && d < 1) {
      this.state = 'idle';
      this.root.visible = false;
      g.visible = false;
      this.beam.visible = false;
      return;
    }
    const onPad = this.state === 'landed';
    const hover = this.state === 'down' || this.state === 'up' || onPad ? 0 : Math.sin(this.time * 0.9) * 0.4;
    g.position.set(this.x, this.y + hover, this.z);
    // Nose down in forward flight, level in the hover and on the pad.
    g.rotation.x = this.state === 'down' || this.state === 'up' || onPad || (this.state === 'toPad' && d < 10) ? 0 : 0.08;
    this.craft.rotor.rotation.y += dt * this.rpm;
    this.craft.tail.rotation.x += dt * this.rpm * 4.5;
    (this.craft.disc.material as MeshBasicMaterial).opacity = 0.12 * Math.min(1, Math.max(0, (this.rpm - RPM.idle) / (RPM.fly - RPM.idle)));
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

  /** Puts the `kind` craft beyond the view, in towards (x, z), with a way out by another bearing. */
  private launch(kind: 'police' | 'medical', x: number, z: number): void {
    this.kind = kind;
    this.craft = this.kinds[kind];
    this.tx = x;
    this.tz = z;
    // In from a bearing well out of view, out by another.
    this.offView(this.random() * Math.PI * 2);
    this.x = this.ox;
    this.z = this.oz;
    this.y = HEIGHT;
    this.rpm = RPM.fly;
    this.offView(Math.atan2(this.x - x, this.z - z) + Math.PI * (0.6 + this.random() * 0.8));
    this.root.visible = true;
    this.craft.g.visible = true;
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
