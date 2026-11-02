import type { Camera } from 'three';
import { randomAppearance } from '../../agents/character';
import { HumanFigure, type PeopleLibrary } from '../../agents/humanFigure';
import { LINES } from '../../config/flavour/lines';
import { loadPacks, PACKS, type PackId, type PackSettings } from '../../config/flavour/packs';
import { QUALITY } from '../../render/quality';
import type { Season } from '../../sim/calendar';
import { createRandom } from '../../sim/random';
import type { Traffic } from '../traffic';
import type { ActorLook } from './actors';
import { FlavourPacks, type FlavourContext, type PackBuilder } from './index';
import { squatDoors } from './squatDoors';

/**
 * Wires the flavour packs to the game: each pack's code is its own chunk,
 * fetched the first time the pack is switched on; people get the same sculpted
 * figures as the rest of the city; the choice of packs is kept on this device.
 */
const BUILDERS: Record<PackId, () => Promise<PackBuilder>> = {
  street: () => import('./street').then((m) => m.buildStreet),
  guard: () => import('./guard').then((m) => m.buildGuard),
  crime: () => import('./crime').then((m) => m.buildCrime),
  vignettes: () => import('./vignettes').then((m) => m.buildVignettes),
  lines: () => import('./lines').then((m) => m.buildLines),
  service: () => import('./service').then((m) => m.buildService),
  weather: () => import('./rain').then((m) => m.buildWeather),
  chaos: () => import('./chaos').then((m) => m.buildChaos),
  campus: () => import('./campus').then((m) => m.buildCampus),
  users: () => import('./users').then((m) => m.buildUsers),
  thieves: () => import('./thieves').then((m) => m.buildThieves),
  visitors: () => import('./visitors').then((m) => m.buildVisitors),
  cycling: () => import('./cycling').then((m) => m.buildCycling),
  pets: () => import('./pets').then((m) => m.buildPets),
  decor: () => import('./decor').then((m) => m.buildDecor),
  sky: () => import('./sky').then((m) => m.buildSky),
  river: () => import('./river').then((m) => m.buildRiver),
  kids: () => import('./kids').then((m) => m.buildKids),
  pioneers: () => import('./pioneers').then((m) => m.buildPioneers),
};

export interface FlavourHost {
  scene: import('three').Object3D;
  camera: Camera;
  canvas: HTMLElement;
  overlay: HTMLElement;
  traffic: Traffic;
  toScreen: (x: number, y: number, z: number) => { x: number; y: number };
  setWetness: (w: number) => void;
  campusSite: import('three').Object3D;
  /** Crowd people near the middle of the view, by role. */
  forEachCrowd: (visit: (role: string, x: number, z: number, root: import('three').Object3D) => void) => void;
  season: () => Season;
  buses: () => readonly { x: number; z: number }[];
}

export interface Flavour {
  packs: FlavourPacks;
  settings: PackSettings;
  setPack(id: PackId, on: boolean): void;
  setMood(mood: PackSettings['weather']): void;
  setFigures(lib: PeopleLibrary): void;
  /** Squats now, by building id: their doors are worked out once per change. */
  setSquats(buildings: readonly number[]): void;
  /** The context object the caller fills each frame (one, reused). */
  context: FlavourContext;
}

export function startFlavour(host: FlavourHost): Flavour {
  const settings = loadPacks();
  const packs = new FlavourPacks({
    scene: host.scene,
    traffic: host.traffic,
    camera: host.camera,
    canvas: host.canvas,
    overlay: host.overlay,
    toScreen: host.toScreen,
    setWetness: host.setWetness,
    setCampusSite: (campus) => { host.campusSite.visible = !campus; },
    buses: host.buses,
    crowdVoices: () => {
      const out: { voice: string; at: () => { x: number; y: number; z: number } }[] = [];
      host.forEachCrowd((role, _x, _z, root) => {
        if (LINES[role]) out.push({ voice: role, at: () => ({ x: root.position.x, y: 2.2, z: root.position.z }) });
      });
      return out;
    },
  }, BUILDERS, Math.max(6, Math.round(QUALITY.figures * 0.5)));
  packs.setMood(settings.weather);
  for (const p of PACKS) if (settings.on[p.id]) void packs.set(p.id, true);
  const context: FlavourContext = { clock: 1080, night: 0, day: 0, season: host.season(), snowy: false, patrol: 0, market: 0, squat: 0, squatDoors: [], still: false, street: 0, thefts: [], shopGuard: [], shopShut: [], visit: null };
  let squatKey = '';
  return {
    packs,
    settings,
    context,
    setPack(id, on) {
      settings.on[id] = on;
      void packs.set(id, on);
    },
    setMood(mood) {
      settings.weather = mood;
      packs.setMood(mood);
    },
    setFigures(lib) {
      const r = createRandom(211);
      packs.setFigureMaker((look: ActorLook) => {
        const base = randomAppearance(r, !!look.vest, look.style, host.season());
        return new HumanFigure(lib, {
          ...base,
          ...look.dress,
          style: look.style,
          extra: look.extra ?? base.extra,
          kit: { ...base.kit, ...look.kit },
          police: look.police,
          staff: !!look.vest,
          vestColour: look.vest,
          dog: false,
          placard: false,
        });
      });
    },
    setSquats(buildings) {
      const key = buildings.join(',');
      if (key === squatKey) return;
      squatKey = key;
      context.squatDoors = squatDoors(buildings);
    },
  };
}
