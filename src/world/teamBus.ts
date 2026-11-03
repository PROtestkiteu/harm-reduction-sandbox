import { CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshLambertMaterial, Shape, Vector3, type Object3D } from 'three';
import { inView } from '../render/viewEdge';
import { FAR } from './ambient';
import { bridgeY, BRIDGE_SPAN } from './bridges';
import { add, box, pixelTextTexture } from './kit';
import { STADIUM_GATE, STREETS } from './layout';
import { glowMat, vehicleMat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import type { Traffic, TrafficCar } from './traffic';

/**
 * The home team's coach on match days. Before kick-off it comes in with the
 * north street's eastbound traffic from beyond the view, over the bridge,
 * indicates and pulls in to the parking kerb opposite the stadium gate,
 * clear of the through lane, and waits there through the match; after the
 * final whistle it pulls out and drives off east, out of view. A club-liveried coach (rounded body, raked windscreen,
 * glazing, a lit destination board, mirrors) whose wheels turn as it rolls.
 * It keeps its place in the traffic (world/traffic.ts) while it drives.
 */

const LENGTH = 12;
const WIDTH = 2.55;
const HEIGHT = 3.5;
const SPEED = 8.5;
const RED = 0xc8202a;
const BLUE = 0x2a5ab8;

function coach(): { g: Group; wheels: Object3D[]; blink: MeshLambertMaterial[]; lamps: MeshLambertMaterial } {
  const g = new Group();
  const body = new Group();
  g.add(body);
  // Side profile along x (front at +x), rounded at the roof and the nose, raked screen; extruded across.
  const half = LENGTH / 2;
  const s = new Shape();
  s.moveTo(-half, 0.35);
  s.lineTo(half - 0.25, 0.35);
  s.quadraticCurveTo(half, 0.35, half, 0.7);
  s.lineTo(half - 0.08, 2.2);
  s.quadraticCurveTo(half - 0.25, HEIGHT - 0.05, half - 0.9, HEIGHT);
  s.lineTo(-half + 0.5, HEIGHT);
  s.quadraticCurveTo(-half, HEIGHT, -half, HEIGHT - 0.5);
  s.lineTo(-half, 0.35);
  const shell = new ExtrudeGeometry(s, { depth: WIDTH - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 5 });
  shell.translate(0, 0, -(WIDTH - 0.16) / 2);
  const paint = vehicleMat(RED);
  const m = new Mesh(shell, paint);
  body.add(m);
  const glass = vehicleMat(0x18222c, 2);
  const blue = vehicleMat(BLUE);
  const white = vehicleMat(0xf2f0ea);
  const dark = vehicleMat(0x1a1b1e, 0);
  // The glazing: a band down each side, the windscreen and the rear window.
  for (const z of [-1, 1]) {
    add(body, box(LENGTH - 2.4, 1.05, 0.02, glass, -0.5, 1.95, z * (WIDTH / 2 + 0.005)));
    // The driver's window and the door, at the front.
    add(body, box(0.9, 1.3, 0.02, glass, half - 1.1, 1.7, z * (WIDTH / 2 + 0.005)));
    // The club's colours: a blue sweep and a white pinstripe under the windows, the name on the side.
    add(body, box(LENGTH - 0.6, 0.38, 0.02, blue, 0, 1.0, z * (WIDTH / 2 + 0.01)));
    add(body, box(LENGTH - 0.6, 0.07, 0.02, white, 0, 1.43, z * (WIDTH / 2 + 0.012)));
  }
  const screen = add(body, box(0.02, 1.35, WIDTH - 0.3, glass, half - 0.1, 1.95, 0));
  screen.rotation.z = 0.12;
  add(body, box(0.02, 0.9, WIDTH - 0.5, glass, -half - 0.03, 2.1, 0));
  const name = new MeshLambertMaterial({ map: pixelTextTexture('FC CITY', '#ffffff', '#2a5ab8'), emissive: 0xffffff, emissiveIntensity: 0.15, emissiveMap: pixelTextTexture('FC CITY', '#ffffff', '#2a5ab8') });
  for (const z of [-1, 1]) {
    const n = add(body, box(2.6, 0.55, 0.02, name, -1.6, 2.95, z * (WIDTH / 2 + 0.01)));
    if (z < 0) n.rotation.y = Math.PI;
  }
  // The destination board over the screen, lit; the bumpers, the grille, the mirrors on their arms.
  const board = new MeshLambertMaterial({ map: pixelTextTexture('FC CITY', '#ffb020', '#101010'), emissive: 0xffffff, emissiveIntensity: 0.9, emissiveMap: pixelTextTexture('FC CITY', '#ffb020', '#101010') });
  add(body, box(0.03, 0.32, 1.8, board, half - 0.2, 3.02, 0));
  add(body, box(0.25, 0.35, WIDTH + 0.04, dark, half - 0.05, 0.3, 0));
  add(body, box(0.25, 0.35, WIDTH + 0.04, dark, -half + 0.05, 0.3, 0));
  add(body, box(0.04, 0.3, 1.4, dark, half + 0.02, 0.75, 0));
  for (const z of [-1, 1]) {
    add(body, box(0.5, 0.05, 0.05, dark, half + 0.1, 2.9, z * (WIDTH / 2 - 0.1)));
    add(body, box(0.06, 0.5, 0.14, dark, half + 0.35, 2.4, z * (WIDTH / 2 + 0.05)));
  }
  // Lamps: headlights and tail lights (brighter after dark), and the indicators that blink.
  const lamps = glowMat(0xf0ecd8, 0xfff2d0, 0.6);
  for (const z of [-0.95, 0.95]) {
    add(body, box(0.03, 0.18, 0.4, lamps, half + 0.02, 0.62, z));
    add(body, box(0.03, 0.3, 0.16, glowMat(0x5a1010, 0xff2a20, 0.8), -half - 0.02, 0.8, z * 1.05));
  }
  const blink = [glowMat(0x5a3a10, 0xffa020, 0), glowMat(0x5a3a10, 0xffa020, 0)];
  for (const [i, z] of [[0, -1.18], [1, 1.18]] as const) {
    add(body, box(0.05, 0.12, 0.08, blink[i], half - 0.02, 0.62, z));
    add(body, box(0.05, 0.12, 0.08, blink[i], -half + 0.02, 0.62, z));
  }
  mergeStatic(body);
  // Wheels, turning: two axles at the front and back, tyres with silver hubs, under the arches.
  const tyre = new CylinderGeometry(0.52, 0.52, 0.34, 14).rotateX(Math.PI / 2);
  const hub = new CylinderGeometry(0.28, 0.28, 0.36, 8).rotateX(Math.PI / 2);
  const wheels: Object3D[] = [];
  for (const x of [half - 2.4, -half + 2.7, -half + 1.4]) {
    for (const z of [-1, 1]) {
      const w = dynamic(new Group());
      w.position.set(x, 0.52, z * (WIDTH / 2 - 0.2));
      w.add(new Mesh(tyre, vehicleMat(0x141414, 0)), new Mesh(hub, vehicleMat(0xb8bcc0)));
      // A spoke on the hub, so the turning shows.
      w.add(new Mesh(new CylinderGeometry(0.04, 0.04, 0.37, 4).rotateX(Math.PI / 2).translate(0.18, 0, 0), dark));
      g.add(w);
      wheels.push(w);
    }
  }
  return { g, wheels, blink, lamps };
}

type State = 'away' | 'arriving' | 'parked' | 'leaving';

export class TeamBus {
  private readonly bus = coach();
  private readonly car: TrafficCar;
  private state: State = 'away';
  private want = false;
  private curve: CatmullRomCurve3 | null = null;
  private length = 1;
  /** Distance along the current curve, and the speed now. */
  private s = 0;
  private v = 0;
  private time = 0;
  private night = 0;
  /** Where it parks, and the lane along the north street (eastbound). */
  private readonly park: Vector3;
  private readonly lane: number;

  constructor(scene: Object3D, private readonly traffic: Traffic) {
    const root = dynamic(new Group());
    root.add(this.bus.g);
    root.visible = false;
    this.bus.g.userData.mover = 'teamBus';
    this.bus.g.traverse((o) => { o.castShadow = false; });
    scene.add(root);
    this.car = traffic.add(LENGTH / 2);
    const north = STREETS.north.road;
    this.lane = north.z0 + 1.4;
    // At the parking kerb opposite the gate (the south side; the through lane runs along the north side), facing east.
    this.park = new Vector3(STADIUM_GATE.x + 2, 0.02, north.z1 - 1.1);
  }

  /** Is the team in town: before the match and through it (the coach comes, then waits); false sends it home. */
  setMatch(on: boolean): void {
    this.want = on;
  }

  setNight(n: number): void {
    this.night = n;
  }

  update(dt: number): void {
    if (this.state === 'away' && !this.want) return;
    this.time += dt;
    const g = this.bus.g;
    if (this.state === 'away') {
      // In from the horizon, along the lane, over the bridge, across to the kerb.
      this.setCurve([[-FAR, this.lane], [this.park.x - 40, this.lane], [this.park.x - 22, this.lane], [this.park.x - 9, this.park.z], [this.park.x, this.park.z]]);
      this.state = 'arriving';
      this.v = SPEED;
      (g.parent as Object3D).visible = true;
    } else if (this.state === 'parked') {
      this.car.active = false;
      this.blinkers(0, 0);
      if (this.want) return;
      // Out to the road once the lane behind is clear, then east, out of view.
      if (!this.traffic.laneClear(this.car, 16, 10)) return;
      this.setCurve([[this.park.x, this.park.z], [this.park.x + 8, this.park.z], [this.park.x + 20, this.lane], [this.park.x + 40, this.lane], [FAR, this.lane]]);
      this.state = 'leaving';
      this.v = 0;
    }
    // Drive along the curve, keeping to the traffic: slow for a car ahead, stop short of it.
    this.car.active = true;
    const gap = this.traffic.gapAhead(this.car);
    const want = gap < 5 ? 0 : Math.min(SPEED, (gap - 4) * 0.8);
    const turning = this.turningAt(this.s);
    const target = turning ? Math.min(want, 4) : want;
    this.v += Math.max(-6 * dt, Math.min(2 * dt, target - this.v));
    this.s = Math.min(this.length, this.s + this.v * dt);
    const c = this.curve as CatmullRomCurve3;
    const u = this.s / this.length;
    const p = c.getPointAt(u);
    const t = c.getTangentAt(u);
    const y = Math.abs(p.z - this.lane) < 3 && p.x > BRIDGE_SPAN.x0 && p.x < BRIDGE_SPAN.x1 ? bridgeY(p.x) : 0.02;
    g.position.set(p.x, y, p.z);
    g.rotation.y = Math.atan2(t.x, t.z) - Math.PI / 2;
    Object.assign(this.car, { x: p.x, z: p.z, dx: t.x, dz: t.z });
    for (const w of this.bus.wheels) w.rotation.z -= (this.v * dt) / 0.52;
    // Indicating in to the kerb (right, heading east) and out of it (left), as it turns.
    const on = turning && Math.sin(this.time * 9) > 0;
    this.blinkers(on && this.state === 'leaving' ? 1 : 0, on && this.state === 'arriving' ? 1 : 0);
    this.bus.lamps.emissiveIntensity = 0.4 + this.night * 1.4;
    if (this.s >= this.length - 0.01) {
      if (this.state === 'arriving') { this.state = 'parked'; this.v = 0; }
      else if (!inView(p.x, p.z, t.x, t.z, LENGTH / 2, HEIGHT)) {
        this.state = 'away';
        this.car.active = false;
        (g.parent as Object3D).visible = false;
      }
    }
  }

  private setCurve(points: readonly (readonly [number, number])[]): void {
    this.curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal');
    this.curve.arcLengthDivisions = 400;
    this.length = this.curve.getLength();
    this.s = 0;
  }

  /** In a bend: the heading changing within a few metres ahead. */
  private turningAt(s: number): boolean {
    const c = this.curve as CatmullRomCurve3;
    const a = c.getTangentAt(Math.min(1, s / this.length));
    const b = c.getTangentAt(Math.min(1, (s + 6) / this.length));
    return a.x * b.x + a.z * b.z < 0.995;
  }

  private blinkers(left: number, right: number): void {
    // Heading +x, the left side is -z.
    this.bus.blink[0].emissiveIntensity = left * 2.2;
    this.bus.blink[1].emissiveIntensity = right * 2.2;
  }
}
