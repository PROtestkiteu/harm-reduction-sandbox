import { Group, type MeshLambertMaterial, type Object3D } from 'three';
import { STREETS, type Rect } from './layout';
import { add, box, cylinder } from './kit';
import { glowMat, mat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import type { Light, Signal, Traffic } from './traffic';

/** Seconds of green, amber and all-red in each half of a cycle. */
const GREEN = 11;
const AMBER = 2.5;
const ALL_RED = 1.2;
const HALF = GREEN + AMBER + ALL_RED;

interface Lamps { red: MeshLambertMaterial; amber: MeshLambertMaterial; green: MeshLambertMaterial; top: MeshLambertMaterial; shown: Light | null }
interface Junction { signal: Signal; offset: number; x: Lamps; z: Lamps }

const LIT = { red: 2.2, amber: 2.2, green: 2.0 } as const;
const DIM = 0.08;

function lamps(): Lamps {
  return { red: glowMat(0x3a0e0e, 0xff2a1a, DIM), amber: glowMat(0x3a2a0a, 0xffa020, DIM), green: glowMat(0x0e2a14, 0x3aff7a, DIM), top: glowMat(0x1c1e20, 0xff2a1a, DIM), shown: null };
}

/** A light head: three lamps in a dark case, facing along +z of the head's group. */
function head(l: Lamps): Group {
  const g = new Group();
  add(g, box(0.34, 0.95, 0.24, mat(0x1c1e20), 0, 0, 0));
  ([['red', 0.68], ['amber', 0.4], ['green', 0.12]] as const).forEach(([k, y]) => add(g, box(0.2, 0.2, 0.04, l[k], 0, y, 0.13)));
  // A lit cap in the colour that is showing, so the light reads from above too (the usual view).
  add(g, box(0.3, 0.06, 0.2, l.top, 0, 0.95, 0));
  // Larger than life: at the city's scale a true-size head is a speck.
  g.scale.setScalar(1.35);
  return g;
}

/**
 * Traffic lights where the through streets cross: one direction gets green,
 * then amber, a moment of red both ways, then the other direction. Each
 * junction starts at its own point in the cycle. The lights feed the shared
 * traffic (cars stop at red), and their lamps change brightness only when
 * the light changes; the poles and cases merge into a few draw calls.
 */
export class TrafficLights {
  private readonly junctions: Junction[] = [];
  private time = 0;

  constructor(scene: Object3D, traffic: Traffic) {
    const g = dynamic(new Group());
    scene.add(g);
    const pole = mat(0x2a2c2e);
    const crossings: [Rect, Rect][] = [
      [STREETS.main.road, STREETS.north.road],
      [STREETS.main.road, STREETS.south.road],
      [STREETS.east.road, STREETS.north.road],
      [STREETS.east.road, STREETS.south.road],
    ];
    crossings.forEach(([v, h], i) => {
      const signal: Signal = { x0: v.x0, x1: v.x1, z0: h.z0, z1: h.z1, x: 'red', z: 'red' };
      traffic.addSignal(signal);
      const j: Junction = { signal, offset: i * 4.3, x: lamps(), z: lamps() };
      this.junctions.push(j);
      // Poles on two opposite corners, each with a head for each direction of traffic.
      for (const [cx, cz, turn] of [[signal.x1 + 0.5, signal.z1 + 0.5, 0], [signal.x0 - 0.5, signal.z0 - 0.5, Math.PI]] as const) {
        const post = add(g, new Group());
        post.position.set(cx, 0.12, cz);
        add(post, cylinder(0.07, 3.0, pole, 6, 0, 0, 0));
        // Traffic along x sees the head facing x; along z, the one facing z.
        const hx = add(post, head(j.x));
        hx.position.set(0, 2.6, 0);
        hx.rotation.y = turn + Math.PI / 2;
        const hz = add(post, head(j.z));
        hz.position.set(0, 2.6, 0);
        hz.rotation.y = turn;
      }
    });
    mergeStatic(g);
    this.update(0);
  }

  /** Steps the light cycle; returns true when any light changed. */
  update(dt: number): boolean {
    this.time += dt;
    let changed = false;
    for (const j of this.junctions) {
      const t = (this.time + j.offset) % (HALF * 2);
      const first = t < HALF;
      const k = first ? t : t - HALF;
      const go: Light = k < GREEN ? 'green' : k < GREEN + AMBER ? 'amber' : 'red';
      j.signal.x = first ? go : 'red';
      j.signal.z = first ? 'red' : go;
      changed = show(j.x, j.signal.x) || changed;
      changed = show(j.z, j.signal.z) || changed;
    }
    return changed;
  }
}

function show(l: Lamps, light: Light): boolean {
  if (l.shown === light) return false;
  l.shown = light;
  l.red.emissiveIntensity = light === 'red' ? LIT.red : DIM;
  l.amber.emissiveIntensity = light === 'amber' ? LIT.amber : DIM;
  l.green.emissiveIntensity = light === 'green' ? LIT.green : DIM;
  l.top.emissive.setHex(light === 'red' ? 0xff2a1a : light === 'amber' ? 0xffa020 : 0x3aff7a);
  l.top.emissiveIntensity = 1.8;
  return true;
}
