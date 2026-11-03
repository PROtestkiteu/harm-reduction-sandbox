import { AdditiveBlending, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, SphereGeometry, type Object3D } from 'three';
import { inView, onScreen } from '../render/viewEdge';
import type { Random } from '../sim/random';
import { add, box } from './kit';
import { glowMat, vehicleMat } from './materials';
import { dynamic } from './mergeStatic';

/**
 * An easter egg: very rarely, deep in the night, a flying saucer drifts in
 * from beyond the view, stops over the street near the middle of the screen,
 * shines a pale beam down for a few seconds, then shoots up and away out of
 * sight. Nothing in the simulation notices. Hidden and skipped between visits,
 * so it costs nothing per frame while it is away.
 */
const RARE = {
  /** Seconds between chances of a visit, and the chance one comes when it is dark enough. */
  every: [1200, 2700] as const,
  chance: 0.5,
  /** How dark it must be (0 day, 1 night). */
  night: 0.7,
};
const HOVER = { height: 24, seconds: 7, speed: 18 };

function saucer(): { g: Group; ring: Group; beam: Mesh } {
  const g = new Group();
  const hull = vehicleMat(0x9aa4ac, 2);
  const disc = new Mesh(new SphereGeometry(4, 20, 8), hull);
  disc.scale.y = 0.22;
  g.add(disc);
  add(g, new Mesh(new CylinderGeometry(2.2, 3.2, 0.5, 20), vehicleMat(0x5a6470, 1))).position.y = -0.7;
  const dome = add(g, new Mesh(new SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowMat(0x20343a, 0x8affd0, 0.6)));
  dome.position.y = 0.6;
  // A ring of lights round the rim, turning: one material, so it is one more draw call.
  const ring = add(g, new Group());
  const lamp = glowMat(0x2a3a2a, 0xb8ff9a, 2.4);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    add(ring, box(0.32, 0.18, 0.32, lamp, Math.sin(a) * 3.85, -0.05, Math.cos(a) * 3.85));
  }
  // The beam: a pale cone from the belly to the street.
  const beam = new Mesh(
    new ConeGeometry(3.4, HOVER.height, 20, 1, true).translate(0, -HOVER.height / 2, 0),
    new MeshBasicMaterial({ color: 0xc8ffe0, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, forceSinglePass: true }),
  );
  beam.position.y = -0.8;
  g.add(beam);
  g.traverse((o) => { o.castShadow = false; });
  return { g, ring, beam };
}

export class Ufo {
  private readonly craft = saucer();
  private state: 'away' | 'in' | 'hover' | 'out' = 'away';
  private next: number;
  private night = 0;
  private time = 0;
  private hold = 0;
  private x = 0;
  private y = 0;
  private z = 0;
  private tx = 0;
  private tz = 0;
  private ox = 0;
  private oz = 0;
  private climb = 0;
  private viewX = 0;
  private viewZ = 0;

  constructor(scene: Object3D, private readonly random: Random) {
    this.craft.g.visible = false;
    // Tagged for the dev edge check (scripts/bots/edges.js).
    this.craft.g.userData.mover = 'ufo';
    scene.add(dynamic(this.craft.g));
    this.next = this.wait();
  }

  setNight(night: number): void {
    this.night = night;
  }

  /** Where the camera looks: the saucer stops near there. */
  setView(x: number, z: number): void {
    this.viewX = x;
    this.viewZ = z;
  }

  /** Brings it now (the dev checks use this); false while it is already here. */
  summon(): boolean {
    if (this.state !== 'away') return false;
    // A stop where the saucer and the foot of its beam both show well inside the screen
    // (seen from above at an angle, something high up shows further up the screen than its ground spot).
    const ndc = { x: 0, y: 0 };
    const fits = (x: number, z: number) =>
      onScreen(x, HOVER.height, z, ndc) && Math.abs(ndc.x) < 0.55 && Math.abs(ndc.y) < 0.55
      && onScreen(x, 0, z, ndc) && Math.abs(ndc.x) < 0.8 && Math.abs(ndc.y) < 0.8;
    this.tx = this.viewX;
    this.tz = this.viewZ;
    for (let i = 0; i < 24; i++) {
      const a = this.random() * Math.PI * 2;
      const r = this.random() * 40;
      const x = this.viewX + Math.sin(a) * r;
      const z = this.viewZ + Math.cos(a) * r;
      if (fits(x, z)) { this.tx = x; this.tz = z; break; }
    }
    // In from one side of the view, unseen; out by another.
    this.offView(this.random() * Math.PI * 2);
    this.x = this.ox;
    this.z = this.oz;
    this.y = HOVER.height + 6;
    this.offView(Math.atan2(this.x - this.tx, this.z - this.tz) + Math.PI * (0.5 + this.random()));
    this.state = 'in';
    this.climb = 0;
    this.craft.g.visible = true;
    return true;
  }

  update(dt: number): void {
    if (this.state === 'away') {
      this.next -= dt;
      if (this.next > 0) return;
      this.next = this.wait();
      if (this.night >= RARE.night && this.random() < RARE.chance) this.summon();
      return;
    }
    this.time += dt;
    const { g, ring, beam } = this.craft;
    const glow = beam.material as MeshBasicMaterial;
    if (this.state === 'in') {
      // Glides in and settles, slowing as it arrives.
      const dx = this.tx - this.x;
      const dz = this.tz - this.z;
      const d = Math.hypot(dx, dz);
      const step = Math.min(d, Math.max(2, Math.min(HOVER.speed, d * 0.8)) * dt);
      if (d > 1e-3) { this.x += (dx / d) * step; this.z += (dz / d) * step; }
      this.y += (HOVER.height - this.y) * Math.min(1, dt * 0.8);
      if (d < 0.3) { this.state = 'hover'; this.hold = HOVER.seconds; }
    } else if (this.state === 'hover') {
      this.hold -= dt;
      glow.opacity = Math.min(0.16, glow.opacity + dt * 0.12) * (0.85 + 0.15 * Math.sin(this.time * 9));
      if (this.hold <= 0) this.state = 'out';
    } else {
      // Beam off, then up and away, faster and faster, out of sight.
      glow.opacity = Math.max(0, glow.opacity - dt * 0.5);
      this.climb = Math.min(120, this.climb + dt * 60);
      const dx = this.ox - this.x;
      const dz = this.oz - this.z;
      const d = Math.hypot(dx, dz);
      const step = Math.min(d, this.climb * dt);
      if (d > 1e-3) { this.x += (dx / d) * step; this.z += (dz / d) * step; }
      this.y += this.climb * dt * 0.35;
      if (d < 1 || !inView(this.x, this.z, 0, 0, 5, 3, this.y - 1) && glow.opacity === 0 && this.climb > 60) {
        this.state = 'away';
        g.visible = false;
        glow.opacity = 0;
        return;
      }
    }
    beam.visible = glow.opacity > 0.005;
    g.position.set(this.x, this.y + Math.sin(this.time * 1.7) * 0.25, this.z);
    g.rotation.z = Math.sin(this.time * 1.1) * 0.05;
    ring.rotation.y += dt * 2.4;
  }

  private wait(): number {
    return RARE.every[0] + this.random() * (RARE.every[1] - RARE.every[0]);
  }

  /** Sets (ox, oz) to the first point out along `bearing` from the stop that the camera cannot see. */
  private offView(bearing: number): void {
    const sx = Math.sin(bearing);
    const sz = Math.cos(bearing);
    let r = 60;
    while (r < 900 && inView(this.tx + sx * r, this.tz + sz * r, 0, 0, 5, 3, HOVER.height + 4)) r += 30;
    this.ox = this.tx + sx * (r + 30);
    this.oz = this.tz + sz * (r + 30);
  }
}
