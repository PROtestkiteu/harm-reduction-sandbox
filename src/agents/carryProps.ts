import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Camera,
  Quaternion,
  type Material,
  type Vector3,
} from 'three';
import type { ServiceId } from '../sim/types';

/**
 * Small things people carry or show that tell how a service is doing, read at
 * a glance without a label: someone leaving the drop-in with a hot drink, a
 * result card from drug checking, a kit bag from the patrol or the camper.
 * People turned away show a short sigh; people crowding outside a full service
 * check their phones while they wait.
 */
export type CarryKind = 'cup' | 'card' | 'kit' | 'blanket' | 'water' | 'plaster' | 'phone' | 'sigh';

/** What someone takes away from each service once served. */
export const SERVED_CARRY: Record<ServiceId, CarryKind> = {
  dropIn: 'cup',
  outreach: 'kit',
  clubHr: 'water',
  footPatrol: 'kit',
  drugChecking: 'card',
  shelter: 'blanket',
  clinic: 'plaster',
};

const lambert = (color: number) => new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.55 });
const glow = (color: number) => new MeshBasicMaterial({ color, toneMapped: false });

/** A soft white puff for steam, and a small speech bubble with three dots. */
function puffTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,0.7)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function bubbleTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(236,232,224,0.92)';
  g.beginPath();
  g.roundRect(4, 4, 56, 30, 12);
  g.moveTo(18, 32);
  g.lineTo(14, 44);
  g.lineTo(28, 33);
  g.fill();
  g.fillStyle = '#3a3a44';
  for (const x of [20, 32, 44]) {
    g.beginPath();
    g.arc(x, 19, 4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Seen from the game's camera a person is about twenty pixels tall, so real
 * sizes would vanish: held things are drawn about two and a half times life
 * size and in bright, unlit colours, like the mood glows.
 */
const HELD_SCALE = 2.5;
const BUBBLE_SCALE = 2.2;

interface Item {
  group: Group;
  /** Parts that move: steam puffs or the bubble. */
  moving: Mesh[];
  /** Held in the hand, or floating over the head. */
  overHead: boolean;
}

/**
 * Pooled per kind, shared geometry and materials, no shadows; updating one is
 * a few transforms. With reduced motion nothing drifts or swings.
 */
export class CarryProps {
  private readonly active = new Map<number, { kind: CarryKind; item: Item }>();
  private readonly spare = new Map<CarryKind, Item[]>();
  private camera: Camera | null = null;
  private still = false;
  private readonly undo = new Quaternion();
  private readonly puffMat = new MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, toneMapped: false });
  private readonly bubbleMat = new MeshBasicMaterial({ map: bubbleTexture(), transparent: true, depthWrite: false, toneMapped: false });
  private readonly geo = {
    cup: new CylinderGeometry(0.045, 0.035, 0.11, 8),
    lid: new CylinderGeometry(0.047, 0.047, 0.015, 8),
    card: new BoxGeometry(0.1, 0.07, 0.005),
    bag: new BoxGeometry(0.2, 0.16, 0.08),
    strap: new BoxGeometry(0.015, 0.14, 0.015),
    roll: new CylinderGeometry(0.08, 0.08, 0.36, 8),
    bottle: new CylinderGeometry(0.03, 0.03, 0.18, 8),
    cap: new CylinderGeometry(0.018, 0.018, 0.03, 6),
    pad: new BoxGeometry(0.08, 0.05, 0.005),
    phone: new BoxGeometry(0.07, 0.13, 0.01),
    screen: new PlaneGeometry(0.06, 0.11),
    puff: new PlaneGeometry(0.09, 0.09),
    bubble: new PlaneGeometry(0.42, 0.32),
  };
  private readonly mats = {
    paper: lambert(0xf2ece0),
    sleeve: lambert(0x2e7d6b),
    lid: lambert(0x3a3a3a),
    result: lambert(0xfafaf6),
    stripe: lambert(0x3a6ea8),
    kitBag: lambert(0x3a7ac8),
    blanket: lambert(0x8a5a3a),
    water: glow(0x8ad0ff),
    cap: lambert(0x2a6ad8),
    plaster: lambert(0xe8c8a8),
    phoneBody: lambert(0x1a1a1e),
    screen: glow(0xbfe0ff),
  };

  constructor(private readonly parent: Group) {}

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /** With reduced motion steam, swing and drift stop; the items stay. */
  setStill(still: boolean): void {
    this.still = still;
  }

  /**
   * Places `kind` for person `id` standing at `at` facing `heading`; `age` is
   * seconds since it appeared (drives steam and the bubble's rise and fade).
   */
  show(id: number, kind: CarryKind, at: Vector3, heading: number, clock: number, age: number): void {
    let entry = this.active.get(id);
    if (entry && entry.kind !== kind) {
      this.release(id);
      entry = undefined;
    }
    if (!entry) {
      const item = this.spare.get(kind)?.pop() ?? this.make(kind);
      this.parent.add(item.group);
      entry = { kind, item };
      this.active.set(id, entry);
    }
    const { group, moving, overHead } = entry.item;
    const s = Math.sin(heading);
    const c = Math.cos(heading);
    if (overHead) {
      // A sigh rises a little over the head and fades out.
      const rise = this.still ? 0 : Math.min(1, age / 3) * 0.45;
      group.position.set(at.x, at.y + 2.5 + rise, at.z);
      if (this.camera) group.quaternion.copy(this.camera.quaternion);
      const fade = this.still ? 1 : Math.max(0, Math.min(1, (3.5 - age) / 0.8));
      (moving[0].material as MeshBasicMaterial).opacity = fade;
      return;
    }
    // In the right hand, slightly forward; a phone is held up in front at chest height.
    const phone = kind === 'phone';
    const side = phone ? 0.08 : 0.3;
    const fwd = phone ? 0.38 : 0.1;
    const swing = this.still || phone ? 0 : Math.sin(clock * 6 + id) * 0.03;
    group.position.set(at.x + c * side + s * (fwd + swing), at.y + (phone ? 1.3 : 0.8), at.z - s * side + c * (fwd + swing));
    group.rotation.set(phone ? -0.5 : 0, heading, 0);
    // Steam from a hot drink: two puffs rising in turn, facing the camera.
    if (moving.length && this.camera) this.undo.copy(group.quaternion).invert().multiply(this.camera.quaternion);
    moving.forEach((m, i) => {
      const t = this.still ? 0.4 : ((clock * 0.6 + i * 0.5 + id * 0.13) % 1);
      m.position.set(0.01 * i, 0.1 + t * 0.22, 0);
      m.quaternion.copy(this.undo);
      m.scale.setScalar(0.6 + t);
    });
  }

  release(id: number): void {
    const entry = this.active.get(id);
    if (!entry) return;
    this.active.delete(id);
    this.parent.remove(entry.item.group);
    const pool = this.spare.get(entry.kind) ?? [];
    pool.push(entry.item);
    this.spare.set(entry.kind, pool);
  }

  private make(kind: CarryKind): Item {
    const group = new Group();
    const moving: Mesh[] = [];
    const part = (geo: BoxGeometry | CylinderGeometry | PlaneGeometry, mat: Material, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
      const m = new Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = false;
      m.receiveShadow = false;
      group.add(m);
      return m;
    };
    const { geo, mats } = this;
    switch (kind) {
      case 'cup':
        part(geo.cup, mats.paper);
        part(geo.cup, mats.sleeve).scale.set(1.05, 0.35, 1.05);
        part(geo.lid, mats.lid, 0, 0.06);
        for (let i = 0; i < 2; i++) moving.push(part(geo.puff, this.puffMat));
        break;
      case 'card':
        part(geo.card, mats.result, 0, 0.02, 0, -0.3);
        part(geo.card, mats.stripe, 0, 0.042, -0.006, -0.3).scale.set(1, 0.25, 1.2);
        break;
      case 'kit':
        part(geo.bag, mats.kitBag, 0, -0.1);
        part(geo.strap, mats.lid, 0, 0.0);
        break;
      case 'blanket':
        part(geo.roll, mats.blanket, -0.12, 0.05, 0.05, 0, Math.PI / 2);
        break;
      case 'water':
        part(geo.bottle, mats.water);
        part(geo.cap, mats.cap, 0, 0.1);
        break;
      case 'plaster':
        // A dressing on the forearm.
        part(geo.pad, mats.plaster, 0, 0.12, 0.02);
        break;
      case 'phone':
        part(geo.phone, mats.phoneBody);
        part(geo.screen, mats.screen, 0, 0, 0.006);
        break;
      case 'sigh': {
        const mat = this.bubbleMat.clone();
        const b = part(geo.bubble, mat);
        moving.push(b);
        b.renderOrder = 4;
        group.scale.setScalar(BUBBLE_SCALE);
        return { group, moving, overHead: true };
      }
    }
    group.scale.setScalar(HELD_SCALE);
    return { group, moving, overHead: false };
  }
}
