import type { CityPeople } from '../agents/cityPeople';
import { randomAppearance } from '../agents/character';
import { createRandom } from '../sim/random';
import { Group, type Object3D } from 'three';
import { add, box } from './kit';
import { mat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';

const SKIN = [0xe8c4a0, 0xc8986a, 0x8a5a3a, 0xd8b090];
const CLOTHES = [0x3a6a9a, 0xc85a5a, 0x5a9a6a, 0xd8b040, 0x8a5aa8, 0x2a2a30];

/** A low-poly person sitting cross-legged (or standing, arms up, for the teacher), `s` the size (children smaller). */
function person(seated: boolean, k: number, s = 1): Group {
  const g = new Group();
  const cloth = mat(CLOTHES[k % CLOTHES.length]);
  const skin = mat(SKIN[k % SKIN.length]);
  if (seated) {
    add(g, box(0.62 * s, 0.16 * s, 0.5 * s, cloth, 0, 0, 0));
    add(g, box(0.38 * s, 0.55 * s, 0.24 * s, cloth, 0, 0.16 * s, 0));
    add(g, box(0.22 * s, 0.24 * s, 0.22 * s, skin, 0, 0.73 * s, 0));
  } else {
    add(g, box(0.3, 0.8, 0.2, mat(0x2a2a30), 0, 0, 0));
    add(g, box(0.38, 0.6, 0.24, cloth, 0, 0.8, 0));
    add(g, box(0.22, 0.24, 0.22, skin, 0, 1.42, 0));
    for (const x of [-0.16, 0.16]) add(g, box(0.08, 0.55, 0.08, skin, x, 1.4, 0));
  }
  return g;
}

/**
 * What goes on in the big park on an early evening, when it feels safe: a
 * yoga class on mats, a family picnic on blankets. Each is a small static
 * set, merged into one mesh per material and shown or hidden as a whole.
 * (Joggers run with the park's other people; the festival has its stage.)
 */
export class ParkActivities {
  private readonly yoga: Group;
  private readonly picnic: Group;

  constructor(scene: Object3D, private readonly people: CityPeople) {
    this.yoga = add(scene, dynamic(new Group()));
    this.yoga.position.set(18, 0.1, 76);
    const mats = [0x6a3a8a, 0x2a8a8a, 0xc85a3a, 0x3a6aa8, 0x8aa83a, 0xa83a6a];
    for (let i = 0; i < 8; i++) {
      const x = (i % 4) * 1.6 - 2.4;
      const z = Math.floor(i / 4) * 2.4;
      add(this.yoga, box(0.7, 0.03, 1.8, mat(mats[i % mats.length]), x, 0, z));
      add(this.yoga, person(true, i)).position.set(x, 0.03, z + 0.2);
    }
    add(this.yoga, person(false, 9)).position.set(0, 0, -2.2);
    mergeStatic(this.yoga);

    this.picnic = add(scene, dynamic(new Group()));
    this.picnic.position.set(-2, 0.1, 70);
    add(this.picnic, box(2.6, 0.03, 2.0, mat(0xc83a3a), 0, 0, 0));
    for (let i = 0; i < 4; i++) add(this.picnic, box(0.6, 0.032, 0.5, mat(0xf2ece0), -0.9 + (i % 2) * 1.2 + (Math.floor(i / 2) % 2) * 0.6, 0, -0.6 + Math.floor(i / 2) * 1.0));
    add(this.picnic, box(0.5, 0.35, 0.35, mat(0x9a6a3a), 0.2, 0.03, 0.1));
    for (const [x, z, s, k] of [[-1.3, -0.6, 1, 0], [1.2, -0.5, 1, 3], [-0.9, 1.1, 0.7, 1], [0.8, 1.0, 0.65, 4], [1.6, 0.6, 1, 2]] as const) add(this.picnic, person(true, k, s)).position.set(x, 0.03, z);
    // A ball and a kite on the grass beside them.
    add(this.picnic, box(0.3, 0.3, 0.3, mat(0xf2c400), 3.2, 0, 0.8));
    mergeStatic(this.picnic);
    for (let i = 0; i < 14; i++) this.people.add(-2000 - i, randomAppearance(createRandom(2000 + i)), 'passerby', i !== 8, false);
    this.set({ yoga: false, picnic: false });
  }

  set(v: { yoga: boolean; picnic: boolean }): void {
    this.yoga.visible = v.yoga;
    this.picnic.visible = v.picnic;
    for (let i = 0; i < 9; i++) {
      const x = i === 8 ? 18 : 18 + (i % 4) * 1.6 - 2.4;
      const z = i === 8 ? 73.8 : 76.2 + Math.floor(i / 4) * 2.4;
      this.people.update(-2000 - i, x, 0.1, z, v.yoga, false);
    }
    const picnic = [[-1.3, -0.6], [1.2, -0.5], [-0.9, 1.1], [0.8, 1.0], [1.6, 0.6]];
    picnic.forEach(([x, z], i) => this.people.update(-2009 - i, x - 2, 0.1, z + 70, v.picnic, false));
  }
}
