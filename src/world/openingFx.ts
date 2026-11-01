import { Group, IcosahedronGeometry, Mesh, MeshLambertMaterial, type Object3D } from 'three';

/**
 * The city's own changes, shown as they happen (the player's building work has its crane):
 * a business opening sends a handful of balloons up from its roof; one closing gives a grey
 * puff of dust. A small fixed pool of meshes, reused, so it costs nothing while idle and
 * stays cheap on weak phones. With reduced motion nothing is shown (the sign change says it).
 */
const BALLOON_COLOURS = [0xe24a4a, 0xedb300, 0x3a8ae0, 0x4ab86a, 0xd05ab0];
const POOL = 18;
const BALLOONS = 6;
const PUFFS = 5;
/** Seconds a balloon rises, and a puff spreads, before it is gone. */
const RISE = 6;
const SPREAD = 1.6;

interface Bit { mesh: Mesh; mat: MeshLambertMaterial; age: number; life: number; kind: 'balloon' | 'puff'; x: number; y: number; z: number; sway: number }

const balloonGeo = new IcosahedronGeometry(0.48, 1).scale(1, 1.2, 1);
const puffGeo = new IcosahedronGeometry(0.5, 1);

export class OpeningFx {
  private readonly bits: Bit[] = [];
  private readonly root = new Group();

  constructor(parent: Object3D, private readonly still: () => boolean, private readonly random: () => number) {
    parent.add(this.root);
    for (let i = 0; i < POOL; i++) {
      const mat = new MeshLambertMaterial({ transparent: true, depthWrite: false });
      const mesh = new Mesh(balloonGeo, mat);
      mesh.visible = false;
      mesh.castShadow = false;
      this.root.add(mesh);
      this.bits.push({ mesh, mat, age: 0, life: 0, kind: 'balloon', x: 0, y: 0, z: 0, sway: 0 });
    }
  }

  /** A business opened at the roof point (x, y, z). */
  opened(x: number, y: number, z: number): void {
    if (this.still()) return;
    for (let i = 0; i < BALLOONS; i++) {
      const b = this.take();
      if (!b) return;
      b.kind = 'balloon';
      b.mesh.geometry = balloonGeo;
      b.mat.color.setHex(BALLOON_COLOURS[i % BALLOON_COLOURS.length]);
      b.mat.opacity = 1;
      b.life = RISE * (0.8 + this.random() * 0.4);
      b.x = x + (this.random() - 0.5) * 2.4;
      b.y = y + 0.4 + this.random() * 0.6;
      b.z = z + (this.random() - 0.5) * 2.4;
      b.sway = this.random() * Math.PI * 2;
    }
  }

  /** A business closed at the roof point (x, y, z). */
  closed(x: number, y: number, z: number): void {
    if (this.still()) return;
    for (let i = 0; i < PUFFS; i++) {
      const b = this.take();
      if (!b) return;
      b.kind = 'puff';
      b.mesh.geometry = puffGeo;
      b.mat.color.setHex(0x8a857c);
      b.life = SPREAD * (0.8 + this.random() * 0.4);
      const a = (i / PUFFS) * Math.PI * 2;
      b.x = x + Math.cos(a) * 0.8;
      b.y = y + 0.2;
      b.z = z + Math.sin(a) * 0.8;
      b.sway = a;
    }
  }

  /** Advances the bits in flight; returns true while any is showing. */
  update(dt: number): boolean {
    let any = false;
    for (const b of this.bits) {
      if (!b.mesh.visible) continue;
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) { b.mesh.visible = false; continue; }
      any = true;
      if (b.kind === 'balloon') {
        // Up at a walking pace, swaying, fading out at the top.
        b.mesh.position.set(b.x + Math.sin(b.sway + b.age * 1.6) * 0.35, b.y + b.age * 1.4, b.z + Math.cos(b.sway + b.age * 1.3) * 0.25);
        b.mat.opacity = Math.min(1, (1 - t) * 3);
      } else {
        // Outwards and up a little, growing and thinning.
        const s = 0.6 + t * 1.6;
        b.mesh.scale.setScalar(s);
        b.mesh.position.set(b.x + Math.cos(b.sway) * t * 1.2, b.y + t * 0.8, b.z + Math.sin(b.sway) * t * 1.2);
        b.mat.opacity = 0.55 * (1 - t);
      }
    }
    return any;
  }

  private take(): Bit | null {
    const b = this.bits.find((q) => !q.mesh.visible);
    if (!b) return null;
    b.age = 0;
    b.mesh.visible = true;
    b.mesh.scale.setScalar(1);
    return b;
  }
}
