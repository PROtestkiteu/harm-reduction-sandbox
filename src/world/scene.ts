import {
  PCFSoftShadowMap,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { PALETTE } from '../config/palette';
import type { LocationId } from '../sim/types';
import type { Random } from '../sim/random';
import { WindowBank, setWindowDaylight } from './animated';
import { buildCafeBlock, buildCornerBlock } from './blocks';
import { buildCamper, buildClub, buildDropIn, type LocationVisual } from './buildings';
import {
  acUnit, antenna, beacon, bike, busShelter, drainGrate, drainpipe, fence, flowerBed, flowerBox, hedge, hydrant,
  manhole, pedestrianSignal, picnicTable, postBox, roofVent, satelliteDish, scooter, signPost, stringLights,
  advertPillar, waterTank, windowTrim,
} from './details';
import { add, bench, bin, bollard, box, planter, setFoliageSeason, setLampNight, streetLight, tree } from './kit';
import { CAMPER, CENTER, CLUB, CROSSING, DISTRICT, HALF, NODES, PAVE_E, PAVE_W, ROAD, type P2 } from './layout';
import { buildBlockGround, buildOutskirts, buildStreets } from './district';
import { lightPool, setPoolDaylight } from './dressing';
import { buildInfill } from './infill';
import { roofClutter, updateNeon, wallClutter } from './grit';
import { buildStreetscape } from './streetscape';
import { buildClinic, buildDrugChecking, buildPharmacy, buildShelter } from './places';
import { glowMat, mat, SNOW } from './materials';
import { Weather } from './weather';
import { collectSolids, type Solids } from './solids';
import type { SeasonProfile, Season } from '../config/seasons';
import { dynamic, mergeStatic } from './mergeStatic';
import { car, CAR_COLOURS } from './vehicles';

export interface World {
  scene: Scene;
  locations: Record<LocationId, LocationVisual>;
  club: ReturnType<typeof buildClub>;
  frame: {
    /** The original street: its fit sets the camera's base scale (zoom 1). */
    full: Box3;
    /** Everything the camera may show, for depth range and pan limits. */
    bounds: Box3;
  };
  /** Moves the sun's shadow frustum to cover the area in view. */
  setViewFocus(x: number, z: number, radius: number): void;
  update(dt: number, time: number): void;
  /** 0 at dusk, 1 in deep night: dims the low sun and cools the ambient light. */
  setNight(night: number, day?: number): void;
  /** Trees, snow, light and what drifts in the air for the time of year. */
  setSeason(season: Season, profile: SeasonProfile): void;
  /** Drifting snow and leaves hold still when reduced motion is preferred. */
  setStill(still: boolean): void;
  /** Ground footprints of benches, bins, posts, trees, parked cars and shelters. */
  solids: Solids;
}

/** Renderer state the world relies on: soft shadows. */
export function configureRenderer(renderer: WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
}

export function buildWorld(random: Random): World {
  const scene = new Scene();
  scene.background = new Color(PALETTE.skyTop);
  const outskirts = buildOutskirts(scene, mulberry(23));
  buildStreets(scene, mulberry(29));
  buildBlockGround(scene, mulberry(31));
  const ground = add(scene, new Group());
  buildGround(ground, random);
  mergeStatic(ground);

  const dropIn = buildDropIn(random);
  const club = buildClub(random);
  const outreach = buildCamper();
  scene.add(dropIn.root, club.root, outreach.root);
  const pharmacy = buildPharmacy(mulberry(41));
  const drugChecking = buildDrugChecking(mulberry(43));
  const shelter = buildShelter(mulberry(47));
  const clinic = buildClinic(mulberry(53));
  const places = [pharmacy, drugChecking, shelter, clinic];
  for (const p of places) scene.add(p.root);
  const infill = buildInfill(scene, mulberry(59));
  const steam = buildStreetscape(scene, mulberry(61));
  // The original centre-block buildings get the same roof and wall clutter as the rest.
  const clutter = add(scene, new Group());
  const cr = mulberry(67);
  roofClutter(clutter, (CENTER.x0 + CENTER.x1) / 2, (CENTER.z0 + CENTER.z1) / 2, CENTER.x1 - CENTER.x0 - 3, CENTER.z1 - CENTER.z0 - 3, 7.22, cr);
  add(clutter, wallClutter(CENTER.z1 - CENTER.z0, 6.8, cr), Math.PI / 2).position.set(CENTER.x1, 0.12, (CENTER.z0 + CENTER.z1) / 2);
  roofClutter(clutter, (CLUB.x0 + CLUB.x1) / 2, (CLUB.z0 + CLUB.z1) / 2, CLUB.x1 - CLUB.x0 - 2, CLUB.z1 - CLUB.z0 - 3, CLUB.height + 0.3, cr);
  add(clutter, wallClutter(CLUB.x1 - CLUB.x0, CLUB.height, cr)).position.set((CLUB.x0 + CLUB.x1) / 2, 0.12, CLUB.z1);
  add(clutter, wallClutter(5.8, 9.2, cr)).position.set(-11.85, 0.12, -9.0);
  let neonLevel = 0.8;

  const residentialWindows = buildResidential(scene, random);
  const blocks = [buildCornerBlock(random), buildCafeBlock(random)];
  for (const b of blocks) scene.add(b.root);
  buildProps(scene);
  buildParkedCars(scene);
  const lighting = buildLighting(scene);
  const weather = new Weather(scene);
  let still = false;
  const sun = lighting.sun;

  const locations: Record<LocationId, LocationVisual> = { dropIn, outreach, club, pharmacy, drugChecking, shelter, clinic };
  // Every static thing in the district merges into one mesh per material: a
  // few hundred draw calls fewer, which phones and VR headsets need. Places
  // stay separate so they can be picked and highlighted.
  for (const loc of Object.values(locations)) dynamic(loc.root);
  mergeStatic(scene);
  // Footprints tagged by the builders survive the merge on their (now empty) groups.
  const solids = collectSolids(scene);
  return {
    solids,
    scene,
    locations,
    club,
    frame: {
      full: new Box3(new Vector3(-HALF, -1.6, -HALF), new Vector3(HALF, 7.5, HALF)),
      bounds: new Box3(new Vector3(-DISTRICT - 36, -0.5, -DISTRICT - 36), new Vector3(DISTRICT + 36, 32, DISTRICT + 36)),
    },
    setViewFocus(x, z, radius) {
      // Shadow texels stay roughly square to world pixels: the frustum only grows when zoomed out.
      const half = Math.max(26, radius);
      const cam = sun.shadow.camera;
      if (cam.right !== half) {
        cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
        cam.updateProjectionMatrix();
      }
      sun.target.position.set(x, 0, z);
      weather.follow(x, z);
      sun.position.set(x - 12, 16, z + 20);
      sun.target.updateMatrixWorld();
    },
    update(dt, time) {
      dropIn.update(dt, time);
      club.update(dt, time);
      outreach.update(dt, time);
      for (const p of places) p.update(dt, time);
      residentialWindows.update(dt, 0.55);
      outskirts.update(dt, 0.35);
      for (const w of infill) w.update(dt, 0.45);
      updateNeon(time, neonLevel);
      for (const s of steam) s.update(dt);
      for (const b of blocks) b.update(dt);
      weather.update(dt, still);
    },
    setSeason(season, profile) {
      setFoliageSeason(season);
      SNOW.value = profile.look.snow;
      weather.set(profile.look.drift);
      lighting.setSeason(profile.look.light, profile.look.lightStrength);
    },
    setStill(value) {
      still = value;
    },
    setNight(night, day = 0) {
      lighting.setNight(night, day);
      setLampNight(night, day);
      setWindowDaylight(day);
      setPoolDaylight(day);
      // Neon reads brighter as the night deepens and fades out in daylight.
      neonLevel = (0.8 + 0.35 * night) * (1 - 0.75 * day);
    },
  };
}

function buildGround(g: Group, random: Random): void {
  const S = HALF * 2;
  // Ground between the centre block's buildings (the road and its markings
  // come from the district street network).
  add(g, box(S, 0.02, S, mat(PALETTE.soil), 0, -0.01, 0));
  const line = mat(PALETTE.asphaltLine);
  for (let x = ROAD.x0 + 0.45; x < ROAD.x1 - 0.2; x += 0.85) {
    add(g, box(0.45, 0.008, CROSSING.z1 - CROSSING.z0, line, x, 0.02, (CROSSING.z0 + CROSSING.z1) / 2));
  }
  add(g, box(2.8, 0.008, 0.22, line, -4.5, 0.02, CROSSING.z0 - 0.9));

  // Pavements laid as alternating slab rows for a restrained texture.
  const slab = (x0: number, x1: number, z0: number, z1: number, step = 1.5) => {
    for (let z = z0, i = 0; z < z1 - 0.01; z += step, i++) {
      const len = Math.min(step, z1 - z);
      add(g, box(x1 - x0, 0.12, len, mat(i % 2 ? PALETTE.pavement : PALETTE.pavementAlt), (x0 + x1) / 2, 0, z + len / 2));
    }
  };
  slab(PAVE_W.x0, PAVE_W.x1 - 0.1, -HALF, HALF);
  slab(PAVE_E.x0 + 0.1, PAVE_E.x1, -HALF, HALF);

  // Courtyard behind the residential block, drop-in forecourt and path, club terrace.
  add(g, box(6.5, 0.12, 7.0, mat(PALETTE.pavementAlt), -11.75, 0, -11.5));
  add(g, box(HALF - PAVE_E.x1, 0.12, 4.5, mat(PALETTE.pavementAlt), (PAVE_E.x1 + HALF) / 2, 0, -5.25));
  add(g, box(HALF - PAVE_E.x1, 0.121, 1.8, mat(PALETTE.pavement), (PAVE_E.x1 + HALF) / 2, 0, -4.0));
  add(g, box(HALF + PAVE_W.x0, 0.12, 5.0, mat(PALETTE.pavementAlt), (-HALF + PAVE_W.x0) / 2, 0, 5.5));

  // Green areas.
  add(g, box(HALF - PAVE_E.x1, 0.1, HALF + 3, mat(PALETTE.grass), (PAVE_E.x1 + HALF) / 2, 0, (HALF - 3) / 2));
  add(g, box(HALF + PAVE_W.x0, 0.1, HALF - 8, mat(PALETTE.grass), (-HALF + PAVE_W.x0) / 2, 0, (HALF + 8) / 2));
  add(g, box(HALF - 13.2, 0.1, 7.5, mat(PALETTE.grass), 14.1, 0, -11.25));
  add(g, box(10.4, 0.1, 0.4, mat(PALETTE.grassDark), 8, 0, -14.8));
  // The lawn's patches, clumps and wear come from the ground shader (materials.ts).

  // Gravel park paths along the walk graph.
  const path = (a: P2, b: P2, w = 1.4) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const piece = box(w, 0.11, Math.hypot(dx, dz) + w * 0.5, mat(PALETTE.gravel), (a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    add(g, piece, Math.atan2(dx, dz));
  };
  // Road furniture: manholes and kerb drains.
  for (const [x, z] of [[-3.8, -11.2], [-4.6, 7.8], [-4.0, 12.6]] as const) add(g, manhole()).position.set(x, 0.02, z);
  for (const z of [-12.5, -7.2, 1.0, 9.0, 13.5]) {
    add(g, drainGrate(), Math.PI / 2).position.set(ROAD.x0 + 0.3, 0.02, z);
    add(g, drainGrate(), Math.PI / 2).position.set(ROAD.x1 - 0.3, 0.02, z + 1.4);
  }
  // Wildflower clumps around tree bases and lawn edges.
  for (const [cx, cz] of [[11.6, 2.6], [10.2, 4.8], [10.6, 12.6], [9.4, 2.4], [12.2, 7.6], [6.4, 6.0]] as const) {
    for (let i = 0; i < 7; i++) {
      const x = cx + (random() - 0.5) * 0.9;
      const z = cz + (random() - 0.5) * 0.9;
      add(g, box(0.07, 0.16, 0.07, mat(PALETTE.foliageLight), x, 0.1, z));
      if (i % 2 === 0) add(g, box(0.12, 0.08, 0.12, mat([0xe8e0f0, 0xf0d070, 0xe0a0b8][i % 3]), x, 0.26, z));
    }
  }

  path(NODES.eJunction, NODES.park);
  path(NODES.park, { x: HALF, z: NODES.parkEast.z });
  path(NODES.park, { x: NODES.parkFront.x, z: HALF });
}

function buildResidential(scene: Scene, random: Random): WindowBank {
  const g = add(scene, new Group());
  const x0 = -14.8;
  const x1 = -8.9;
  const z0 = -14.8;
  const z1 = -9.0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const h = 9.2;
  add(g, box(x1 - x0, h, z1 - z0, mat(PALETTE.brick), cx, 0, cz));
  add(g, box(x1 - x0 + 0.2, 0.35, z1 - z0 + 0.2, mat(PALETTE.roofTrim), cx, h, cz));
  add(g, box(x1 - x0 + 0.1, 0.6, z1 - z0 + 0.1, mat(PALETTE.brickDark), cx, 0, cz));
  add(g, box(0.8, 1.4, 0.8, mat(PALETTE.brickDark), cx + 1.5, h + 0.35, cz - 1));

  const mats = Array.from({ length: 7 }, () => glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.2));
  const cool = glowMat(PALETTE.glassDark, PALETTE.coolWindow, 0.2);
  mats.push(cool);
  let k = 0;
  for (let floor = 1; floor < 3; floor++) {
    const y = floor * 3 + 0.7;
    for (const z of [-13.6, -11.9, -10.2]) {
      add(g, box(0.08, 1.4, 0.9, mats[k++ % mats.length], x1 + 0.02, y, z));
    }
    for (const x of [-13.6, -11.9, -10.2]) {
      add(g, box(0.9, 1.4, 0.08, mats[k++ % mats.length], x, y, z1 + 0.02));
      add(g, box(1.3, 0.12, 0.6, mat(PALETTE.concrete), x, y - 0.25, z1 + 0.3));
      add(g, box(1.3, 0.5, 0.05, mat(PALETTE.metal), x, y - 0.13, z1 + 0.58));
    }
  }
  // Closed ground-floor shop with roller shutter and awning.
  add(g, box(0.06, 2.0, 3.6, mat(PALETTE.concrete), x1 + 0.03, 0.6, -11.9));
  add(g, box(0.9, 0.12, 3.8, mat(PALETTE.brickDark), x1 + 0.45, 2.75, -11.9));
  add(g, box(1.0, 1.6, 0.06, glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.25), -11.9, 0.7, z1 + 0.03));

  // Brick detail: string courses, window trim, flower boxes, services.
  for (const y of [3.0, 6.0]) add(g, box(x1 - x0 + 0.08, 0.14, z1 - z0 + 0.08, mat(PALETTE.brickDark), cx, y, cz));
  for (let floor = 1; floor < 3; floor++) {
    const y = floor * 3 + 0.7;
    for (const z of [-13.6, -11.9, -10.2]) {
      add(g, windowTrim(0.9, 1.4, mat(PALETTE.frame), mat(PALETTE.concrete)), Math.PI / 2).position.set(x1 + 0.02, y, z);
      if ((floor + Math.round(z)) % 2 === 0) add(g, flowerBox(0.9, random), Math.PI / 2).position.set(x1 + 0.2, y - 0.08, z);
    }
    for (const x of [-13.6, -11.9, -10.2]) {
      add(g, windowTrim(0.9, 1.4)).position.set(x, y, z1 + 0.02);
      add(g, flowerBox(0.5, random)).position.set(x + 0.35, y - 0.13, z1 + 0.45);
    }
  }
  add(g, drainpipe(h + 0.2)).position.set(x1 - 0.12, 0, z1 + 0.08);
  // Rear walls at the diorama edge, seen when the camera orbits.
  for (let floor = 0; floor < 3; floor++) {
    const y = floor * 3 + 0.7;
    for (const v of [-13.6, -11.9, -10.2]) {
      add(g, box(0.08, 1.4, 0.9, mats[k++ % mats.length], x0 - 0.02, y, v));
      add(g, windowTrim(0.9, 1.4), -Math.PI / 2).position.set(x0 - 0.02, y, v);
      add(g, box(0.9, 1.4, 0.08, mats[k++ % mats.length], v, y, z0 - 0.02));
      add(g, windowTrim(0.9, 1.4), Math.PI).position.set(v, y, z0 - 0.02);
    }
  }
  add(g, acUnit(), Math.PI / 2).position.set(x1 + 0.3, 5.0, -12.75);
  add(g, satelliteDish(), Math.PI / 3).position.set(x1 + 0.12, 8.2, -13.0);
  add(g, waterTank()).position.set(cx - 1.4, h + 0.35, cz + 1.2);
  add(g, antenna(2.4)).position.set(cx + 0.4, h + 0.35, cz - 1.8);
  add(g, roofVent()).position.set(cx + 2.0, h + 0.35, cz + 1.8);
  for (const dz of [-0.25, 0.25]) add(g, box(0.18, 0.4, 0.18, mat(PALETTE.brick), cx + 1.5 + dz, h + 1.75, cz - 1));
  add(g, box(1.0, 0.28, 0.08, mat(PALETTE.canvasCream), -11.9, 2.45, z1 + 0.05));
  mergeStatic(g);
  return new WindowBank(mats, 1.15, 0.06, random);
}

function buildProps(scene: Scene): void {
  const g = add(scene, new Group());
  const lamps: [number, number, number][] = [
    [PAVE_W.x0 + 0.3, -9.5, 1],
    [PAVE_W.x0 + 0.3, 9.0, 1],
    [PAVE_E.x1 - 0.3, -2.2, -1],
    [PAVE_E.x1 - 0.3, 10.8, -1],
  ];
  for (const [x, z, dir] of lamps) {
    add(g, streetLight(dir).group).position.set(x, 0.12, z);
    lightPool(g, x + dir * 0.82, z, 6, 6);
  }

  // Trees kept to the edges so they never hide entrances or queues.
  const trees: [number, number, 0 | 1 | 2, number][] = [
    [10.9, 1.4, 0, 1], [7.6, 4.6, 1, 0.9], [11.3, 13.4, 0, 1.05], [14.0, 12.4, 2, 0.9],
    [-9.1, 14.2, 2, 0.8], [14.2, -10.2, 1, 0.9],
  ];
  for (const [x, z, v, s] of trees) add(g, tree(v, s)).position.set(x, 0.1, z);

  const benches: [number, number, number][] = [[10.2, 6.9, 0], [4.6, 11.4, Math.PI / 2], [-12.4, 9.2, 0]];
  for (const [x, z, r] of benches) add(g, bench(), r).position.set(x, 0.1, z);
  const bins: [number, number][] = [[2.15, 0.6], [PAVE_W.x0 + 0.35, 1.0], [8.8, 7.0], [2.1, -6.6]];
  for (const [x, z] of bins) add(g, bin()).position.set(x, 0.12, z);
  add(g, planter(2.0, 0.6), Math.PI / 2).position.set(14.2, 0.12, -5.6);

  // Bollards protect the crossing kerbs.
  for (const z of [CROSSING.z0 - 0.3, CROSSING.z1 + 0.3]) {
    add(g, bollard()).position.set(PAVE_W.x1 - 0.35, 0.12, z);
    add(g, bollard()).position.set(PAVE_E.x0 + 0.3, 0.12, z);
  }
  // Bike stands by the drop-in path, two in use.
  for (const x of [12.0, 12.8, 13.6]) add(g, box(0.06, 0.7, 0.6, mat(PALETTE.metal), x, 0.12, -3.0));
  add(g, bike(0x4f6a8a), Math.PI / 2).position.set(12.1, 0.12, -3.0);
  add(g, bike(0xa05a5a), Math.PI / 2).position.set(13.5, 0.12, -3.0);

  // Street furniture: hydrant, post box, signs, scooters, advertising pillar.
  add(g, hydrant()).position.set(2.25, 0.12, -9.6);
  add(g, postBox()).position.set(2.35, 0.12, -1.9);
  add(g, signPost(0x3f5f9a), -Math.PI / 2).position.set(PAVE_W.x1 - 0.25, 0.12, 11.5);
  add(g, signPost(0xd0d0c8)).position.set(PAVE_E.x0 + 0.25, 0.12, 9.6);
  add(g, scooter(0x5fb3a3), Math.PI / 2 + 0.2).position.set(14.5, 0.12, -2.5);
  add(g, scooter(0xd2b36a), Math.PI / 2 + 0.1).position.set(14.0, 0.12, -2.3);
  add(g, advertPillar(glowMat(0xe0d2b4, 0xffe0b0, 0.35))).position.set(-9.0, 0.1, 12.4);
  add(g, busShelter(glowMat(0xd8e4f0, 0xc8dcff, 0.6)), Math.PI / 2).position.set(-8.28, 0.12, -12.4);

  // Pedestrian signals at both kerbs of the crossing.
  const red = glowMat(0x5a2a2a, 0xff5040, 0.15);
  const green = glowMat(0x2a4a3a, 0x50e090, 1.4);
  add(g, pedestrianSignal(red, green), Math.PI / 2).position.set(PAVE_W.x1 - 0.3, 0.12, CROSSING.z1 + 0.6);
  add(g, pedestrianSignal(red, green), -Math.PI / 2).position.set(PAVE_E.x0 + 0.3, 0.12, CROSSING.z0 - 0.6);
  add(g, beacon(glowMat(0xe0a050, 0xffb040, 1.0))).position.set(PAVE_W.x1 - 0.3, 0.12, CROSSING.z0 - 0.6);
  add(g, beacon(glowMat(0xe0a050, 0xffb040, 1.0))).position.set(PAVE_E.x0 + 0.3, 0.12, CROSSING.z1 + 0.6);

  // Park: hedge, fence, flower beds, picnic table.
  add(g, hedge(5.0, () => 0.5), Math.PI / 2).position.set(3.0, 0.1, 11.9);
  add(g, fence(3.6)).position.set(5.1, 0.1, 14.75);
  add(g, fence(5.2)).position.set(12.2, 0.1, 14.75);
  add(g, flowerBed(1.8, 0.8, mulberry(7))).position.set(11.6, 0.1, 10.7);
  add(g, flowerBed(2.2, 1.0, mulberry(11))).position.set(5.4, 0.1, 2.6);
  add(g, flowerBed(1.4, 0.7, mulberry(13))).position.set(8.6, 0.1, -1.4);
  add(g, picnicTable()).position.set(5.8, 0.1, 13.5);

  // Utility cables strung across the street between rooftops.
  add(g, stringLights([
    [-8.5, 5.2, -6.8, 2.8, 6.1, -9.4],
    [-8.5, 5.0, -6.4, 2.8, 5.8, -8.6],
    [-8.9, 7.8, -9.3, 2.8, 6.5, -13.8],
  ], []));
  mergeStatic(g);
}

function buildParkedCars(scene: Scene): void {
  const g = add(scene, new Group());
  const parked: [number, number][] = [[-14.4, 3], [-10.4, 0], [CAMPER.z1 + 2.5, 1], [CAMPER.z1 + 6.9, 2]];
  for (const [z, c] of parked) add(g, car(CAR_COLOURS[c], false)).position.set(ROAD.parkX, 0.02, z);
  mergeStatic(g);
}

const DUSK = { sky: new Color(0x8fa4b4), ground: new Color(0x5a4a3c), hemi: 1.8, sun: new Color(0xffb07a), sunIntensity: 2.4 };
const NIGHT = { sky: new Color(0x50607a), ground: new Color(0x2a2420), hemi: 0.9, sun: new Color(0xa0b4d8), sunIntensity: 0.6 };
/** Overcast city daylight: bright, a little grey, the sun high and white. */
const DAY = { sky: new Color(0xc4d0dc), ground: new Color(0x7a6c5c), hemi: 3.1, sun: new Color(0xfff4e6), sunIntensity: 3.8 };

function buildLighting(scene: Scene): { sun: DirectionalLight; setNight(night: number, day?: number): void; setSeason(tint: number, strength: number): void } {
  const hemi = new HemisphereLight(DUSK.sky, DUSK.ground, DUSK.hemi);
  scene.add(hemi);
  const sun = new DirectionalLight(DUSK.sun, DUSK.sunIntensity);
  sun.position.set(-12, 16, 20);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -26; cam.right = 26; cam.top = 26; cam.bottom = -26; cam.near = 1; cam.far = 80;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const duskBg = new Color(PALETTE.skyTop);
  const nightBg = new Color(PALETTE.skyTopNight);
  const background = scene.background as Color;
  const tint = new Color(0xffffff);
  let strength = 1;
  let lastNight = 0;
  let lastDay = 0;
  const dayBg = new Color(0x9fb0c0);
  const scratch = new Color();
  return {
    sun,
    setSeason(hex, k) {
      tint.setHex(hex);
      strength = k;
      this.setNight(lastNight, lastDay);
    },
    // Same lights, shifted: emissive windows, lamps and signs carry the scene at night.
    setNight(night, day = 0) {
      // Day to dusk first, then dusk to night.
      hemi.color.lerpColors(DUSK.sky, DAY.sky, day).lerp(NIGHT.sky, night);
      hemi.groundColor.lerpColors(DUSK.ground, DAY.ground, day).lerp(NIGHT.ground, night);
      hemi.intensity = DUSK.hemi + (DAY.hemi - DUSK.hemi) * day + (NIGHT.hemi - DUSK.hemi) * night;
      sun.color.lerpColors(DUSK.sun, DAY.sun, day).lerp(NIGHT.sun, night);
      sun.intensity = DUSK.sunIntensity + (DAY.sunIntensity - DUSK.sunIntensity) * day + (NIGHT.sunIntensity - DUSK.sunIntensity) * night;
      background.lerpColors(duskBg, scratch.copy(dayBg), day).lerp(nightBg, night);
      lastDay = day;
      // The season tints and scales the light: warm long summer evenings, cold blue winter.
      lastNight = night;
      hemi.color.multiply(tint);
      sun.color.multiply(tint);
      hemi.intensity *= strength;
      sun.intensity *= strength;
    },
  };
}

/** Seeded stream for static set dressing, so detail never shifts the sim's random sequence. */
function mulberry(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
