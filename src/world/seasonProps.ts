import { Group, type MeshLambertMaterial, type Scene } from 'three';
import type { CalendarDate } from '../sim/calendar';
import { add, box } from './kit';
import { glowMat } from './materials';

/** Snow falls on some winter nights: decided by the date, so a night is snowy or not as a whole. */
export function snowyNight(d: CalendarDate): boolean {
  if (d.season !== 'winter') return false;
  const h = Math.sin(d.dayOfYear * 12.9898 + d.year * 78.233) * 43758.5453;
  return h - Math.floor(h) < 0.4;
}

/** December lights go up on 1 December and come down after 6 January. */
export function lightsUp(d: CalendarDate): boolean {
  return d.month === 11 || (d.month === 0 && d.day <= 6);
}

/**
 * Seasonal set dressing: strings of coloured lights on the corner shop and
 * cafe in December. Falling and settled snow belong to the world's weather
 * (see World.setSeason), which uses `snowyNight` to pick the nights.
 */
export class SeasonProps {
  private readonly lights = new Group();
  private readonly bulbs: MeshLambertMaterial[] = [];
  private time = 0;

  constructor(scene: Scene, private readonly reducedMotion: () => boolean) {
    const colours = [0xff5a5a, 0x5aff8a, 0xffd84a, 0x5ab8ff];
    const string = (x0: number, z0: number, x1: number, z1: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const m = glowMat(0x444444, colours[i % 4], 1.6);
        this.bulbs.push(m);
        add(this.lights, box(0.12, 0.12, 0.12, m, x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI * 3) * 0.08, z0 + (z1 - z0) * t));
      }
    };
    string(-10.5, 10.4, -10.5, 14.4, 3.2, 12);
    string(12.8, 6.75, 14.8, 6.75, 2.95, 7);
    string(12.55, 2.9, 12.55, 6.4, 2.95, 9);
    this.lights.visible = false;
    scene.add(this.lights);
  }

  set(d: CalendarDate): void {
    this.lights.visible = lightsUp(d);
  }

  /** Snow drifts down; lights twinkle. Returns true while anything moves. */
  update(dt: number): boolean {
    this.time += dt;
    let changed = false;
    if (this.lights.visible && !this.reducedMotion()) {
      this.bulbs.forEach((m, i) => { m.emissiveIntensity = 0.8 + 0.9 * (0.5 + 0.5 * Math.sin(this.time * 2.2 + i * 0.9)); });
      changed = true;
    }
    return changed;
  }
}
