import { Group, MeshLambertMaterial, type Scene } from 'three';
import { PALETTE } from '../config/palette';
import { bike } from './details';
import { add, box, cylinder, pixelTextTexture } from './kit';
import { ROAD } from './layout';
import { glowMat, mat } from './materials';

/** What city life makes visible. Derived from the simulation. */
export interface CityView {
  party: 'popUp' | 'festival' | null;
  bikes: number;
  graffiti: number;
}

/** Parked-car spots (lane z) where an alarm can go off. */
const PARKED_Z = [-14.4, -10.4, 10.1, 14.5];

/**
 * City-life props: the pop-up party set and festival stage in the park, two
 * bikes on a rack that thieves can take, car alarms, and graffiti tags that
 * stay until the cleaners come.
 */
export class CityProps {
  private readonly popUp: Group;
  private readonly festival: Group;
  private readonly partyLights: MeshLambertMaterial[] = [];
  private readonly bikes: Group[] = [];
  private readonly tags: Group[] = [];
  private readonly alarm: Group;
  private readonly alarmMat: MeshLambertMaterial;
  private alarmLeft = 0;
  private time = 0;

  constructor(scene: Scene, private readonly reducedMotion: () => boolean) {
    const root = add(scene, new Group());
    const lightColours = [0xff5aa8, 0x5ad8ff, 0xffd84a, 0x9a6aff];

    // Pop-up: two speaker stacks, a folding DJ table and a line of coloured lights.
    this.popUp = add(root, new Group());
    for (const x of [-1.4, 1.4]) add(this.popUp, box(0.7, 1.4, 0.6, mat(0x26222e), x, 0, 0));
    add(this.popUp, box(1.6, 0.8, 0.6, mat(PALETTE.metal), 0, 0, 0.2));
    add(this.popUp, box(0.9, 0.08, 0.4, glowMat(0x3a3a50, 0x8af0ff, 1.2), 0, 0.8, 0.2));
    for (let i = 0; i < 6; i++) {
      const m = glowMat(0x444444, lightColours[i % 4], 1.6);
      this.partyLights.push(m);
      add(this.popUp, box(0.18, 0.18, 0.18, m, -2.2 + i * 0.88, 2.3, -0.4));
    }
    for (const x of [-2.4, 2.4]) add(this.popUp, cylinder(0.04, 2.4, mat(PALETTE.metal), 4, x, 0, -0.4));
    this.popUp.position.set(8.0, 0.1, 9.9);
    this.popUp.rotation.y = Math.PI * 0.1;

    // Festival: a stage with truss, lights and a screen, facing the park.
    this.festival = add(root, new Group());
    add(this.festival, box(5.2, 0.8, 3.0, mat(0x2a2632), 0, 0, 0));
    for (const x of [-2.5, 2.5]) add(this.festival, cylinder(0.08, 4.2, mat(PALETTE.metal), 4, x, 0.8, -1.3));
    add(this.festival, box(5.2, 0.16, 0.16, mat(PALETTE.metal), 0, 5.0, -1.3));
    const screen = new MeshLambertMaterial({ map: pixelTextTexture('LIVE', '#ffffff', '#5a2a8a'), emissive: 0xffffff, emissiveMap: pixelTextTexture('LIVE', '#ffffff', '#5a2a8a'), emissiveIntensity: 1 });
    add(this.festival, box(3.2, 1.6, 0.08, screen, 0, 2.6, -1.35));
    for (let i = 0; i < 8; i++) {
      const m = glowMat(0x444444, lightColours[i % 4], 2);
      this.partyLights.push(m);
      add(this.festival, box(0.22, 0.22, 0.22, m, -2.2 + i * 0.63, 4.75, -1.1));
    }
    this.festival.position.set(11.0, 0.1, 12.6);
    this.festival.rotation.y = -Math.PI / 4;

    // Bike rack by the corner shop.
    for (const z of [10.6, 11.4]) {
      const b = add(root, bike(z < 11 ? 0x5a7aa8 : 0xa85a6a), Math.PI / 2);
      b.position.set(-8.9, 0.12, z);
      this.bikes.push(b);
    }

    // Graffiti tags on the club's side wall, away from the stand.
    const tagColours = ['#ff5aa8', '#5ad8ff', '#ffd84a'];
    ['ACE', 'NOT', 'HI'].forEach((word, i) => {
      const t = add(root, new Group());
      const tex = pixelTextTexture(word, tagColours[i], '#00000000');
      const m = new MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
      add(t, box(1.0, 0.4, 0.02, m, 0, 0, 0));
      t.position.set(-14.1 + i * 0.6, 0.7 + (i % 2) * 0.5, 3.03);
      t.visible = false;
      this.tags.push(t);
    });

    // Car alarm: flashing indicators that appear over a parked car.
    this.alarm = add(root, new Group());
    this.alarmMat = glowMat(0x6a4a1a, 0xffb040, 2);
    for (const z of [-1.9, 1.9]) for (const x of [-0.8, 0.8]) add(this.alarm, box(0.2, 0.12, 0.08, this.alarmMat, x, 0.7, z));
    this.alarm.visible = false;
    this.set({ party: null, bikes: 2, graffiti: 0 });
  }

  set(v: CityView): void {
    this.popUp.visible = v.party === 'popUp';
    this.festival.visible = v.party === 'festival';
    this.bikes.forEach((b, i) => { b.visible = i < v.bikes; });
    this.tags.forEach((t, i) => { t.visible = i < v.graffiti; });
  }

  /** A car alarm goes off on one of the parked cars for a few seconds. */
  carAlarm(seed: number): void {
    this.alarm.position.set(ROAD.parkX, 0.02, PARKED_Z[seed % PARKED_Z.length]);
    this.alarm.visible = true;
    this.alarmLeft = 8;
  }

  /** Animates party lights and the alarm; returns true when anything changed. */
  update(dt: number): boolean {
    this.time += dt;
    let changed = false;
    if ((this.popUp.visible || this.festival.visible) && !this.reducedMotion()) {
      this.partyLights.forEach((m, i) => { m.emissiveIntensity = 0.6 + 1.4 * (0.5 + 0.5 * Math.sin(this.time * 4 + i * 1.3)); });
      changed = true;
    }
    if (this.alarmLeft > 0) {
      this.alarmLeft -= dt;
      this.alarmMat.emissiveIntensity = this.reducedMotion() || Math.floor(this.time * 3) % 2 ? 2 : 0.2;
      if (this.alarmLeft <= 0) this.alarm.visible = false;
      changed = true;
    }
    return changed;
  }
}
