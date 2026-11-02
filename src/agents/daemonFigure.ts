import { AdditiveBlending, Mesh, MeshBasicMaterial, RingGeometry, type Object3D } from 'three';
import { EDGES, NODES, type NodeId } from '../world/layout';
import type { Season } from '../sim/calendar';
import { createRandom } from '../sim/random';
import { CharacterRig, randomAppearance, type Figure } from './character';
import { HumanFigure, peopleLibrary } from './humanFigure';

/**
 * The person in acute crisis (sim/chaosDaemon.ts), on the map: they stride the
 * pavements fast and jittery, change their mind at every corner, stop now and
 * then to shout and flail, and a red ring pulses round their feet so they can
 * be found and tapped. Built when they first turn up, a new face each time;
 * gone again when it is over. Under reduced motion the ring holds still.
 */
const FAST = 2.4;
const neighbours = new Map<NodeId, NodeId[]>();
for (const [a, b] of EDGES) {
  neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
}
const NODE_IDS = Object.keys(NODES) as NodeId[];

export class DaemonFigure {
  private figure: Figure | null = null;
  private readonly ring: Mesh;
  private readonly ringMat: MeshBasicMaterial;
  private readonly random = createRandom(4242);
  private from: NodeId = NODE_IDS[0];
  private to: NodeId = NODE_IDS[0];
  private t = 0;
  /** Seconds left standing to shout and flail, and until the next such fit. */
  private fit = 0;
  private nextFit = 6;
  private time = 0;
  x = 0;
  z = 0;
  /** True while shouting: the tag above them says a line. */
  shouting = false;

  constructor(private readonly scene: Object3D, private readonly season: () => Season) {
    this.ringMat = new MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false });
    this.ring = new Mesh(new RingGeometry(0.55, 0.75, 28).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.position.y = 0.05;
    this.ring.visible = false;
    this.ring.raycast = () => {};
    scene.add(this.ring);
  }

  get shown(): boolean {
    return this.figure !== null;
  }

  /** Turns up (a new face, somewhere on the inner streets) or is gone. */
  setActive(on: boolean): void {
    if (on === this.shown) return;
    if (!on) {
      this.figure!.root.removeFromParent();
      this.figure!.dispose();
      this.figure = null;
      this.ring.visible = false;
      return;
    }
    const look = { ...randomAppearance(this.random, false, this.random() < 0.5 ? 'everyday' : 'hiphop', this.season()), dog: false };
    const lib = peopleLibrary();
    this.figure = lib ? new HumanFigure(lib, look) : new CharacterRig(look);
    this.figure.setBodyState('wired');
    this.scene.add(this.figure.root);
    this.from = NODE_IDS[Math.floor(this.random() * NODE_IDS.length)];
    this.to = this.pickNext(this.from);
    this.t = 0;
    this.fit = 0;
    this.nextFit = 4 + this.random() * 4;
    this.ring.visible = true;
  }

  private pickNext(at: NodeId): NodeId {
    const n = neighbours.get(at) ?? NODE_IDS;
    return n[Math.floor(this.random() * n.length)];
  }

  update(dt: number, still: boolean): void {
    const f = this.figure;
    if (!f) return;
    this.time += dt;
    const a = NODES[this.from];
    const b = NODES[this.to];
    if (this.fit > 0) {
      // Stopped: shouting at nobody, arms going.
      this.fit -= dt;
      this.shouting = true;
      f.update(dt, 'dance', 0);
      if (this.fit <= 0) this.nextFit = 5 + this.random() * 7;
    } else {
      this.shouting = false;
      const len = Math.max(0.01, Math.hypot(b.x - a.x, b.z - a.z));
      // A jittery stride: the pace surges and drops.
      const speed = FAST * (0.8 + 0.35 * Math.sin(this.time * 3.1) + 0.15 * Math.sin(this.time * 7.3));
      this.t += (speed * dt) / len;
      if (this.t >= 1) {
        this.from = this.to;
        this.to = this.pickNext(this.from);
        this.t = 0;
      }
      f.update(dt, 'walk', speed);
      if ((this.nextFit -= dt) <= 0) this.fit = 2 + this.random() * 2;
    }
    const p = NODES[this.from];
    const q = NODES[this.to];
    this.x = p.x + (q.x - p.x) * this.t;
    this.z = p.z + (q.z - p.z) * this.t;
    f.root.position.set(this.x, 0, this.z);
    if (this.fit <= 0) f.root.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
    else f.root.rotation.y += dt * (still ? 0 : 2.5) * Math.sin(this.time * 2);
    this.ring.position.set(this.x, 0.05, this.z);
    const pulse = still ? 1 : 1 + 0.18 * Math.sin(this.time * 5);
    this.ring.scale.set(pulse, 1, pulse);
    this.ringMat.opacity = still ? 0.55 : 0.4 + 0.25 * (0.5 + 0.5 * Math.sin(this.time * 5));
  }
}
