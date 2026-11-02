import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  type Object3D,
} from 'three';
import { bike } from './details';
import { CharacterRig, randomAppearance, type Figure } from '../agents/character';
import { HumanFigure, peopleLibrary } from '../agents/humanFigure';
import { createRandom } from '../sim/random';
import { add, box, cylinder, pixelTextTexture } from './kit';
import { glowMat, mat } from './materials';

/** Where the park's pop-up party sets up (matches CityProps' pop-up set). */
export const PARTY_AT = { x: 8.0, z: 9.9 } as const;
/** The middle of the park camp's tents. */
export const CAMP_AT = { x: -22, z: 59 } as const;

export type RaveTheme = 'wixapol' | 'hazel';
/** A place's ground footprint: centre and half-sizes. */
interface Footprint { x: number; z: number; rx: number; rz: number }

const glow = (color: number, opacity = 0.5) =>
  new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
/** A flat disc on the ground, for light falling on it. */
const pool = (r: number, m: MeshBasicMaterial) => {
  const d = new Mesh(new CircleGeometry(r, 24).rotateX(-Math.PI / 2), m);
  d.position.y = 0.16;
  d.renderOrder = 2;
  return d;
};
/** A beam of light: a cone with its tip at the group's origin, opening upwards. */
const beam = (len: number, r: number, m: MeshBasicMaterial) => {
  const g = new Group();
  const c = add(g, new Mesh(new ConeGeometry(r, len, 14, 1, true).rotateX(Math.PI).translate(0, len / 2, 0), m));
  c.renderOrder = 2;
  return g;
};

/**
 * Scenery for the big pop-up events, so they show on the street as well as
 * in text: a rave in the park (light beams and spots sweeping over the
 * dancers, speaker bikes or a memorial), a police raid (blue and red light
 * washing a place, tape round it, torches), the council clearing the camp (a
 * truck with an amber beacon), a bad batch (red warning rings), and the press
 * at the door (a TV van, camera flashes). Each set is built the first time it
 * is needed, then only shown and hidden; nothing casts light or shadow, so
 * the cost is a few draw calls while an event is on. With reduced motion the
 * lights hold still.
 */
export class EventFx {
  private readonly root = new Group();
  private time = 0;
  /** Bumps whenever an event appears, ends or changes look: name tags re-place only then. */
  version = 0;
  private rave: { g: Group; beams: Group[]; spots: Mesh[]; themes: Record<RaveTheme, Group>; candles: MeshLambertMaterial[]; theme: RaveTheme | null } | null = null;
  private raid: { g: Group; washes: MeshBasicMaterial[]; torches: Group[]; until: number } | null = null;
  private sweep: { g: Group; beacon: MeshLambertMaterial; wash: MeshBasicMaterial; until: number } | null = null;
  private alert: { g: Group; rings: Mesh[]; until: number } | null = null;
  private press: { g: Group; flashes: MeshBasicMaterial[]; crew: Figure[]; until: number } | null = null;

  constructor(scene: Object3D, private readonly reducedMotion: () => boolean) {
    scene.add(this.root);
  }

  /** Styles the park's pop-up party for whoever threw it (null: no one in particular); it shows while the party is on. */
  setRave(theme: RaveTheme | null): void {
    const r = this.rave ?? (this.rave = this.buildRave());
    if (r.theme !== theme) this.version++;
    r.theme = theme;
    for (const k of Object.keys(r.themes) as RaveTheme[]) r.themes[k].visible = k === theme;
    const colours = theme === 'hazel' ? [0xb070ff, 0xffffff, 0x8a5aff, 0xe0c0ff] : [0xff4aa8, 0x4ad8ff, 0xffe040, 0x6aff8a];
    r.beams.forEach((b, i) => ((b.children[0] as Mesh).material as MeshBasicMaterial).color.setHex(colours[i % 4]));
    r.spots.forEach((s, i) => (s.material as MeshBasicMaterial).color.setHex(colours[(i + 1) % 4]));
  }

  /** Police raid round the place on `at` until clock minute `until`: tape round the building, light spilling past it. */
  setRaid(at: Footprint, until: number): void {
    const r = this.raid ?? (this.raid = this.buildRaid());
    const k = (Math.max(at.rx, at.rz) + 2.5) / 5.5;
    r.g.position.set(at.x, 0, at.z);
    r.g.scale.set(k, 1, k);
    r.until = until;
  }

  /** The council clearing the camp until `until`. */
  setSweep(until: number): void {
    const s = this.sweep ?? (this.sweep = this.buildSweep());
    s.until = until;
  }

  /** A bad batch: warning rings spreading from the place on `at` until `until`. */
  setAlert(at: Footprint, until: number): void {
    const a = this.alert ?? (this.alert = this.buildAlert());
    a.g.position.set(at.x, 0, at.z);
    a.until = until;
  }

  /** The press outside the place on `at` until `until`, on the corner facing the viewer. */
  setPress(at: Footprint, until: number): void {
    const p = this.press ?? (this.press = this.buildPress());
    p.g.position.set(at.x + at.rx + 2.5, 0, at.z + at.rz + 2.5);
    p.until = until;
  }

  /** What is on now and where, for name tags over the scene (world coordinates, at head height). */
  active(): { kind: 'rave' | 'raid' | 'sweep' | 'alert' | 'press'; theme: RaveTheme | null; x: number; y: number; z: number }[] {
    const out: ReturnType<EventFx['active']> = [];
    const at = (kind: (typeof out)[number]['kind'], g: Group, y: number, theme: RaveTheme | null = null) => out.push({ kind, theme, x: g.position.x, y, z: g.position.z });
    if (this.rave?.g.visible) at('rave', this.rave.g, 5, this.rave.theme);
    if (this.raid?.g.visible) at('raid', this.raid.g, 4);
    if (this.sweep?.g.visible) at('sweep', this.sweep.g, 4);
    if (this.alert?.g.visible) at('alert', this.alert.g, 3);
    if (this.press?.g.visible) at('press', this.press.g, 4.5);
    return out;
  }

  /**
   * Animates whatever is on. `now` is the clock in minutes; `party` whether the
   * pop-up party is on. Returns true when anything on screen changed.
   */
  update(dt: number, now: number, party: boolean): boolean {
    this.time += dt;
    const t = this.time;
    const still = this.reducedMotion();
    let changed = false;

    // Any pop-up party gets the beams and spots; a themed rave adds its own set.
    if (party && !this.rave) this.rave = this.buildRave();
    if (this.rave) {
      if (!party && this.rave.theme) this.setRave(null);
      if (this.rave.g.visible !== party) { this.rave.g.visible = party; changed = true; this.version++; }
      if (party && !still) {
        this.rave.beams.forEach((b, i) => {
          b.rotation.y = t * (0.7 + i * 0.15) + i * 1.6;
          b.rotation.z = 0.45 + 0.3 * Math.sin(t * 1.3 + i);
        });
        this.rave.spots.forEach((s, i) => {
          const a = t * (0.6 + i * 0.07) + i * 2.1;
          s.position.set(Math.sin(a) * (2.5 + (i % 3)), 0.16, 3 + Math.cos(a * 1.3) * (2 + (i % 2)));
        });
        this.rave.candles.forEach((m, i) => { m.emissiveIntensity = 1.4 + 0.5 * Math.sin(t * 9 + i * 2.7) * Math.sin(t * 3.1 + i); });
        changed = true;
      }
    }

    if (this.raid) {
      const on = now < this.raid.until;
      if (this.raid.g.visible !== on) { this.raid.g.visible = on; changed = true; this.version++; }
      if (on) {
        // Blue and red take turns, two quick flashes each, as on a light bar.
        const phase = still ? 0.5 : (t * 2.2) % 1;
        const blue = still ? 0.35 : phase < 0.5 && (phase * 8) % 1 < 0.6 ? 0.55 : 0.05;
        const red = still ? 0.35 : phase >= 0.5 && (phase * 8) % 1 < 0.6 ? 0.55 : 0.05;
        this.raid.washes.forEach((m, i) => { m.opacity = i % 2 ? red : blue; });
        if (!still) this.raid.torches.forEach((b, i) => { b.rotation.y = Math.sin(t * 0.9 + i * 2) * 1.2 + i * Math.PI; });
        changed = true;
      }
    }

    if (this.sweep) {
      const on = now < this.sweep.until;
      if (this.sweep.g.visible !== on) { this.sweep.g.visible = on; changed = true; this.version++; }
      if (on) {
        const k = still ? 0.6 : Math.max(0, Math.sin(t * 6));
        this.sweep.beacon.emissiveIntensity = 0.3 + 2 * k;
        this.sweep.wash.opacity = 0.05 + 0.25 * k;
        changed = true;
      }
    }

    if (this.alert) {
      const on = now < this.alert.until;
      if (this.alert.g.visible !== on) { this.alert.g.visible = on; changed = true; this.version++; }
      if (on) {
        this.alert.rings.forEach((r, i) => {
          const k = still ? 0.3 + i * 0.3 : (t * 0.5 + i / 3) % 1;
          r.scale.setScalar(1 + k * 4);
          (r.material as MeshBasicMaterial).opacity = 0.6 * (1 - k);
        });
        changed = true;
      }
    }

    if (this.press) {
      const on = now < this.press.until;
      if (this.press.g.visible !== on) { this.press.g.visible = on; changed = true; this.version++; }
      if (on) {
        // Camera flashes: short, at random, from a few places in the crowd of reporters.
        this.press.flashes.forEach((m, i) => {
          m.opacity = still ? 0 : Math.sin(t * (7.3 + i * 1.7) + i * 11) > 0.97 ? 0.9 : Math.max(0, m.opacity - dt * 6);
        });
        // The crew stand and talk (the reporter) at the door; under reduced motion they hold still.
        this.press.crew.forEach((f, i) => f.update(still ? 0 : dt, i === 0 ? 'talk' : 'stand', 0));
        changed = true;
      }
    }
    return changed;
  }

  private buildRave() {
    const g = add(this.root, new Group());
    g.position.set(PARTY_AT.x, 0.1, PARTY_AT.z);
    g.rotation.y = Math.PI * 0.1;
    g.visible = false;
    // Four beams from the DJ table, sweeping over the crowd.
    const beams: Group[] = [];
    for (let i = 0; i < 4; i++) {
      const b = add(g, beam(9, 1.1, glow([0xff4aa8, 0x4ad8ff, 0xffe040, 0x6aff8a][i], 0.16)));
      b.position.set(-0.6 + i * 0.4, 1.0, 0.2);
      beams.push(b);
    }
    // Coloured spots running over the ground where people dance.
    const spots: Mesh[] = [];
    for (let i = 0; i < 9; i++) spots.push(add(g, pool(0.9 + (i % 3) * 0.3, glow([0xff4aa8, 0x4ad8ff, 0xffe040, 0x6aff8a][i % 4], 0.35))));

    // Wixapol: speaker bikes parked round the edge, and a sprayed bedsheet sign.
    const wixapol = add(g, new Group());
    for (const [x, z, r] of [[-3.6, 2.2, 0.6], [3.8, 2.6, -0.5], [0.4, 6.4, 1.4]] as const) {
      const b = add(wixapol, bike(0x3a3a48), r);
      b.position.set(x, 0, z);
      add(b, box(0.5, 0.55, 0.45, mat(0x1e1c24), 0, 0.75, -0.55));
      add(b, box(0.36, 0.36, 0.04, glowMat(0x202028, 0xff4aa8, 0.8), 0, 0.85, -0.32));
    }
    const sign = new MeshLambertMaterial({ map: pixelTextTexture('WIXAPOL', '#ff4aa8', '#f2ead8'), emissive: 0xffffff, emissiveIntensity: 0.35, emissiveMap: pixelTextTexture('WIXAPOL', '#ff4aa8', '#f2ead8') });
    add(wixapol, box(3.0, 0.75, 0.04, sign, 0, 2.9, -0.45));

    // DJ Hazel: her name over the decks and candles along the front.
    const hazel = add(g, new Group());
    const banner = new MeshLambertMaterial({ map: pixelTextTexture('DJ HAZEL', '#f4e8ff', '#3a1a5a'), emissive: 0xffffff, emissiveIntensity: 0.6, emissiveMap: pixelTextTexture('DJ HAZEL', '#f4e8ff', '#3a1a5a') });
    add(hazel, box(3.2, 0.7, 0.04, banner, 0, 2.95, -0.45));
    const candles: MeshLambertMaterial[] = [];
    for (let i = 0; i < 9; i++) {
      add(hazel, cylinder(0.06, 0.22, mat(0xf2ead8), 6, -2 + i * 0.5, 0, 1.2 + (i % 2) * 0.25));
      const flame = glowMat(0xffc060, 0xffa030, 1.6);
      candles.push(flame);
      add(hazel, box(0.05, 0.09, 0.05, flame, -2 + i * 0.5, 0.26, 1.2 + (i % 2) * 0.25));
    }
    wixapol.visible = false;
    hazel.visible = false;
    return { g, beams, spots, themes: { wixapol, hazel }, candles, theme: null as RaveTheme | null };
  }

  private buildRaid() {
    const g = add(this.root, new Group());
    g.visible = false;
    // Blue and red light washing the ground, as from several light bars.
    const washes: MeshBasicMaterial[] = [];
    for (const [x, z, c] of [[-2.5, 1, 0x3a6aff], [2.5, -1, 0xff2a2a], [0, 3, 0x3a6aff], [1, -3.5, 0xff2a2a]] as const) {
      const m = glow(c, 0.3);
      washes.push(m);
      add(g, pool(4.5, m)).position.set(x, 0.17, z);
    }
    // Police tape round the place, on posts.
    const tape = mat(0xf2d020);
    const R = 5.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      add(g, cylinder(0.04, 0.95, mat(0x2a2a30), 5, x, 0.1, z));
      const n = (i + 1) / 8 * Math.PI * 2;
      const nx = Math.cos(n) * R;
      const nz = Math.sin(n) * R;
      const len = Math.hypot(nx - x, nz - z);
      const seg = add(g, box(len, 0.07, 0.02, tape, (x + nx) / 2, 0.92, (z + nz) / 2));
      seg.rotation.y = -Math.atan2(nz - z, nx - x);
    }
    // Torches sweeping the ground.
    const torches: Group[] = [];
    for (const [x, z] of [[-3, 3], [3, -2.5]] as const) {
      const holder = add(g, new Group());
      holder.position.set(x, 1.3, z);
      const b = add(holder, beam(4.2, 0.55, glow(0xfff4d0, 0.22)));
      b.rotation.z = Math.PI * 0.62;
      torches.push(holder);
    }
    return { g, washes, torches, until: 0 };
  }

  private buildSweep() {
    const g = add(this.root, new Group());
    g.position.set(CAMP_AT.x + 9, 0.1, CAMP_AT.z - 6);
    g.rotation.y = Math.PI * 0.15;
    g.visible = false;
    // A council tipper truck: cab, bed of bags and broken tarps, an amber beacon on top.
    add(g, box(2.2, 2.0, 2.0, mat(0xe07a20), 1.9, 0.35, 0));
    add(g, box(3.6, 1.3, 2.1, mat(0x5a5a58), -1.0, 0.35, 0));
    for (let i = 0; i < 5; i++) add(g, box(0.6, 0.45, 0.6, mat([0x2a2a2a, 0x3a5a7a, 0x6a7a3a][i % 3]), -2.2 + i * 0.55, 1.7, (i % 2) * 0.6 - 0.3));
    for (const x of [-2, 1.9]) for (const z of [-1.05, 1.05]) add(g, cylinder(0.42, 0.3, mat(0x141414), 10, x, 0, z)).rotation.x = Math.PI / 2;
    const beacon = glowMat(0x7a4a10, 0xffa020, 2);
    add(g, box(0.3, 0.22, 0.3, beacon, 1.9, 2.4, 0));
    const wash = glow(0xffa020, 0.2);
    add(g, pool(6, wash));
    // Workers with bin bags.
    for (const [x, z] of [[-4, 2.5], [-6, -1.5], [-3.2, -3]] as const) {
      add(g, box(0.4, 1.2, 0.3, mat(0xf2a020), x, 0.4, z));
      add(g, box(0.28, 0.28, 0.28, mat(0xe8c8a0), x, 1.6, z));
      add(g, box(0.5, 0.5, 0.45, mat(0x1a1a1a), x + 0.45, 0, z));
    }
    return { g, beacon, wash, until: 0 };
  }

  private buildAlert() {
    const g = add(this.root, new Group());
    g.visible = false;
    const rings: Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const r = add(g, new Mesh(new RingGeometry(1.8, 2, 40).rotateX(-Math.PI / 2), glow(0xff3a2a, 0.5)));
      r.position.y = 0.18;
      r.renderOrder = 2;
      rings.push(r);
    }
    return { g, rings, until: 0 };
  }

  private buildPress() {
    const g = add(this.root, new Group());
    g.visible = false;
    // An outside-broadcast van with a dish, its side lit by the TV logo.
    add(g, box(3.4, 2.0, 1.8, mat(0xe8e6e0), 0, 0.3, 0));
    add(g, box(1.0, 1.4, 1.75, mat(0x2a3440), 1.75, 0.3, 0));
    const logo = new MeshLambertMaterial({ map: pixelTextTexture('TV', '#ffffff', '#c0282a'), emissive: new Color(0xffffff), emissiveIntensity: 0.5, emissiveMap: pixelTextTexture('TV', '#ffffff', '#c0282a') });
    add(g, box(0.9, 0.6, 0.02, logo, -0.6, 1.4, 0.91));
    add(g, cylinder(0.06, 0.9, mat(0x8a8a8a), 5, -0.6, 2.3, 0));
    const dish = add(g, new Mesh(new CircleGeometry(0.6, 16), mat(0xf0f0f0)));
    dish.position.set(-0.6, 3.3, 0);
    dish.rotation.set(-0.6, 0.5, 0);
    for (const x of [-1.2, 1.2]) for (const z of [-0.9, 0.9]) add(g, cylinder(0.35, 0.25, mat(0x141414), 10, x, 0, z)).rotation.x = Math.PI / 2;
    // A reporter with a microphone and three camera operators, the crowd's own figures (sculpted once
    // their assets have loaded), facing the door; each camera has a flash.
    const flashes: MeshBasicMaterial[] = [];
    const crew: Figure[] = [];
    const random = createRandom(7331);
    const lib = peopleLibrary();
    const kit = mat(0x18181c);
    [[-2.6, 2.2], [-1.4, 2.8], [0.2, 2.6], [1.4, 2.2]].forEach(([x, z], i) => {
      const look = { ...randomAppearance(random, false, i === 0 ? 'office' : 'everyday'), dog: false };
      const f: Figure = lib ? new HumanFigure(lib, look) : new CharacterRig(look);
      f.root.position.set(x, 0.12, z);
      // People face +z; the door is towards -z.
      f.root.rotation.y = Math.PI;
      f.update(0, i === 0 ? 'talk' : 'stand', 0);
      g.add(f.root);
      crew.push(f);
      const m = glow(0xffffff, 0);
      flashes.push(m);
      add(g, pool(1.6, m)).position.set(x, 0.17, z - 1.4);
      if (i === 0) {
        // The reporter's microphone, held up in front.
        add(f.root, cylinder(0.025, 0.28, kit, 5, 0.18, 1.18, 0.28)).rotation.x = 0.5;
        add(f.root, box(0.07, 0.07, 0.07, mat(0xc0282a), 0.18, 1.42, 0.4));
      } else {
        // A camera on the shoulder, its light at the front.
        add(f.root, box(0.18, 0.2, 0.42, kit, 0.2, 1.42, 0.12));
        add(f.root, box(0.12, 0.12, 0.04, m, 0.2, 1.46, 0.34));
      }
    });
    return { g, flashes, crew, until: 0 };
  }
}
