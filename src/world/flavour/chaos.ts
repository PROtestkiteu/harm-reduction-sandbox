import { AdditiveBlending, CanvasTexture, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, NearestFilter, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import { t } from '../../i18n';
import { allBuildings } from '../cityBuildings';
import { add, box, cylinder } from '../kit';
import { glowMat, mat } from '../materials';
import { dynamic } from '../mergeStatic';
import { fade, type Actor } from './actors';
import type { Pack, PackDeps } from './index';
import type { SquatDoor } from './index';
import { seatClear, squatDoors } from './squatDoors';

/**
 * The street scene spiralling, drawn: as the simulation's street scene grows
 * (sim/growth.ts, 0 to 1) shop fronts are boarded up and tagged, bins burn
 * with people warming their hands at them, more people sit slumped against
 * walls, arguments flare, and ambulance scenes come more often, beacons
 * flashing. Each piece has its own threshold, so the district tips over bit by
 * bit and recovers the same way. Reads the city; never feeds it.
 */

/** Street scene at which each kind of piece starts to show, and at which all of its kind are out. */
const SHOW = {
  fronts: [0.15, 0.9],
  slumped: [0.2, 0.8],
  barrels: [0.3, 0.85],
  fights: [0.45, 0.9],
  emergencies: [0.35, 1],
} as const;
const share = (k: keyof typeof SHOW, street: number) => Math.max(0, Math.min(1, (street - SHOW[k][0]) / (SHOW[k][1] - SHOW[k][0])));

/** Shop fronts on the inner streets facing the usual view, away from the centre's lettings and the law's shops. */
function frontsOf(random: () => number, count: number): SquatDoor[] {
  const ranked = allBuildings()
    .filter((b) => b.use === 'shopfront' || b.use === 'flats over shops')
    .map((b) => ({ id: b.id, d: Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) }))
    .sort((a, b) => a.d - b.d)
    // The nearest are the rentable units and the law's shops: a board over one would read as the player's.
    .slice(14)
    .filter((b) => b.d < 85);
  for (let i = ranked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
  }
  // Fronts facing the opening view (the camera starts towards +x, +z) first; the camera turns, so the others follow.
  const fronts = squatDoors(ranked.map((b) => b.id));
  return [...fronts.filter((f) => f.nx + f.nz > 0), ...fronts.filter((f) => f.nx + f.nz <= 0)].slice(0, count);
}

/** Spray tags on a small pixel canvas: a few bubble strokes in two colours with a dark outline. */
function tagTexture(random: () => number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 40;
  const g = c.getContext('2d')!;
  const colours = ['#e0503c', '#3cc0e0', '#f0d040', '#b060e0', '#60d080', '#f0f0f0'];
  for (let k = 0; k < 2; k++) {
    const col = colours[Math.floor(random() * colours.length)];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const pts = Array.from({ length: 4 + Math.floor(random() * 3) }, (_, i) => [10 + i * 15 + random() * 6, 8 + random() * 24]);
    for (const [w, s] of [[9, '#141214'], [5, col]] as const) {
      g.lineWidth = w;
      g.strokeStyle = s;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.quadraticCurveTo(pts[i - 1][0] + 6, pts[i][1] - 10 + random() * 20, pts[i][0], pts[i][1]);
      g.stroke();
    }
  }
  const tex = new CanvasTexture(c);
  tex.magFilter = NearestFilter;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Plywood over a shop window, battens across it, and a tag beside it, flat on the wall facing `n`. */
function boardedFront(parent: Object3D, front: SquatDoor, tag: CanvasTexture): Group {
  const g = new Group();
  const ply = mat(0x9a7a50);
  const batten = mat(0x6a5236);
  add(g, box(1.9, 2.0, 0.05, ply, 0, 0.2, 0));
  add(g, box(2.1, 0.12, 0.06, batten, 0, 0.75, 0.03)).rotation.z = 0.7;
  add(g, box(2.1, 0.12, 0.06, batten, 0, 0.75, 0.03)).rotation.z = -0.7;
  // The tag above the board, on the wall over the shop window.
  const spray = new Mesh(new PlaneGeometry(2.2, 0.92), new MeshBasicMaterial({ map: tag, transparent: true, side: DoubleSide, forceSinglePass: true, depthWrite: false }));
  spray.position.set(0, 2.75, 0.04);
  g.add(spray);
  // On the wall: the door spot is 0.6 m out from it.
  g.position.set(front.x - front.nx * 0.58, 0, front.z - front.nz * 0.58);
  g.rotation.y = Math.atan2(front.nx, front.nz);
  g.traverse((o) => { o.castShadow = false; });
  parent.add(dynamic(g));
  return g;
}

/** A burning oil drum: the drum, and a flame that flickers on its own, additive so it glows at night. */
function barrel(parent: Object3D): { g: Group; flame: Mesh; flameMat: MeshBasicMaterial } {
  const g = new Group();
  add(g, cylinder(0.32, 0.85, mat(0x3a3430), 8, 0, 0, 0));
  add(g, cylinder(0.33, 0.05, glowMat(0x5a2a10, 0xff6a20, 0.8), 8, 0, 0.85, 0));
  const flameMat = new MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
  const flame = new Mesh(new ConeGeometry(0.26, 0.7, 6).translate(0, 0.35, 0), flameMat);
  flame.position.y = 0.88;
  g.add(flame);
  g.traverse((o) => { o.castShadow = false; });
  parent.add(dynamic(g));
  return { g, flame, flameMat };
}

/** An ambulance beacon on the kerb: two lamps that take turns, blue and red. */
function beacon(parent: Object3D): { g: Group; blue: MeshBasicMaterial; red: MeshBasicMaterial } {
  const g = new Group();
  add(g, cylinder(0.05, 1.1, mat(0x2a2a2e), 5, 0, 0, 0));
  const blue = new MeshBasicMaterial({ color: 0x3a7aff, transparent: true, blending: AdditiveBlending, depthWrite: false });
  const red = new MeshBasicMaterial({ color: 0xff3a3a, transparent: true, blending: AdditiveBlending, depthWrite: false });
  add(g, box(0.22, 0.16, 0.22, blue, -0.14, 1.1, 0));
  add(g, box(0.22, 0.16, 0.22, red, 0.14, 1.1, 0));
  g.traverse((o) => { o.castShadow = false; });
  parent.add(dynamic(g));
  return { g, blue, red };
}

/** Grows in from nothing (or at once, with reduced motion), and back out. */
function grow(o: Object3D, on: boolean, dt: number, still: boolean): void {
  const target = on ? 1 : 0;
  const s = still ? target : o.scale.y + (target - o.scale.y) * Math.min(1, dt * 2.5);
  o.scale.setScalar(Math.max(0.001, s));
  o.visible = s > 0.01;
}

export function buildChaos({ scene, pool, board, random, dispatch }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const fronts = frontsOf(random, 10);
  // Named, with its fronts, for the dev page's checks (scripts/bots): which walls it boards.
  root.name = 'chaos';
  root.userData.fronts = fronts;
  const boards = fronts.map((f) => boardedFront(root, f, tagTexture(random)));
  for (const b of boards) { b.scale.setScalar(0.001); b.visible = false; }

  // Pavement spots just out from each front, clear of the walkers and the walls.
  const kerb = fronts
    .map((f) => ({ f, x: f.x + f.nx * 1.0 + f.ax * 1.4, z: f.z + f.nz * 1.0 + f.az * 1.4 }))
    .filter((p) => seatClear(p.x, p.z, 0.5));

  // Burning drums, each with up to two people at it.
  const barrels = kerb.slice(0, 4).map((p, i) => {
    const b = barrel(root);
    b.g.position.set(p.x, 0, p.z);
    b.g.scale.setScalar(0.001);
    b.g.visible = false;
    const warm = [0, 1].map((k) => {
      const a = pool.add({ style: i % 2 ? 'everyday' : 'hiphop', kit: { hood: 'up' }, extra: k ? 'scarf' : 'none' });
      const ang = (k ? 2.4 : -0.6) + i;
      a.x = p.x + Math.cos(ang) * 0.85;
      a.z = p.z + Math.sin(ang) * 0.85;
      a.heading = Math.atan2(p.x - a.x, p.z - a.z);
      a.shown = 0;
      return a;
    });
    // `lit`: burning now; `outFor`: seconds it stays out after the fire brigade has been (it may light again later).
    return { ...b, warm, phase: random() * 10, at: p, lit: false, callIn: -1, outFor: 0 };
  });

  // People slumped against the wall, nodding.
  const slumped = fronts.slice(4, 9).map((f, i) => {
    const a = pool.add({ style: i % 2 ? 'everyday' : 'hiphop', kit: { hood: i % 3 ? 'up' : undefined }, extra: 'bag' });
    a.x = f.x - f.nx * 0.2 - f.ax * 1.6;
    a.z = f.z - f.nz * 0.2 - f.az * 1.6;
    a.heading = Math.atan2(f.nx, f.nz);
    a.pose = 'sit';
    a.body = 'nod';
    a.shown = 0;
    return { a, clear: seatClear(a.x, a.z, 0.35) };
  }).filter((s) => s.clear).map((s) => s.a);

  // A shouting match: two people squaring up, stepping in and back.
  const fightSpots = kerb.slice(4, 7);
  const fighters = [0, 1].map((k) => pool.add({ style: k ? 'hiphop' : 'everyday', kit: { hood: k ? 'up' : undefined } }));
  for (const a of fighters) { a.pose = 'talk'; a.shown = 0; }
  const fight = { on: false, spot: 0, t: 0, next: 8 + random() * 10, said: 0 };
  const SHOUTS = [t('Back off!'), t('Leave it, it is not worth it.'), t('What are you looking at?'), t('Give it back!')];

  // An emergency: someone down, a medic kneeling, a beacon flashing.
  const down = pool.add({ style: 'everyday', extra: 'bag' });
  const medic = pool.add({ style: 'worker', vest: 0x3a9a5a, extra: 'none' });
  down.lying = true;
  down.shown = 0;
  medic.pose = 'crouch';
  medic.shown = 0;
  const lamp = beacon(root);
  lamp.g.visible = false;
  const emergency = { on: false, spot: 0, t: 0, next: 20 + random() * 20 };
  const LINES = [t('Stay with me, can you hear me?'), t('Somebody call an ambulance!')];

  let enabled = false;
  let time = 0;

  const showActor = (a: Actor, on: boolean, dt: number) => fade(a, on && enabled, dt);

  return {
    setEnabled(on) {
      enabled = on;
      root.visible = on;
      if (!on) {
        for (const a of [...fighters, down, medic, ...slumped, ...barrels.flatMap((b) => b.warm)]) a.shown = 0;
        fight.on = emergency.on = false;
      }
    },
    update(dt, ctx) {
      if (!enabled) return;
      time += dt;
      const street = ctx.street;
      const still = ctx.still;
      // Boarded fronts and their tags, one by one as the street scene deepens.
      const nFronts = Math.round(share('fronts', street) * boards.length);
      boards.forEach((b, i) => grow(b, i < nFronts, dt, still));
      // Burning drums after dark, and people round them as it gets worse.
      const dark = ctx.night > 0.3;
      const nBarrels = dark ? Math.round(share('barrels', street) * barrels.length) : 0;
      barrels.forEach((b, i) => {
        if (b.outFor > 0) b.outFor -= dt;
        const there = i < nBarrels;
        const on = there && b.outFor <= 0;
        // Newly alight: now and then someone calls the fire brigade, who put it out a minute after they are called.
        if (on && !b.lit && dispatch && random() < 0.35 && dispatch('fire', b.at.x, b.at.z, t('A drum fire on the pavement. Someone called the fire brigade.'))) b.callIn = 70;
        b.lit = on;
        if (b.callIn > 0 && (b.callIn -= dt) <= 0) { b.callIn = -1; b.outFor = 600; }
        // A doused drum stays where it is, cold, its people gone.
        grow(b.g, there, dt, still);
        b.flame.visible = on;
        if (b.g.visible && on) {
          const f = still ? 1 : 0.8 + 0.2 * Math.sin(time * 13 + b.phase) + 0.1 * Math.sin(time * 29 + b.phase * 2);
          b.flame.scale.set(1, f, 1);
          b.flameMat.opacity = 0.6 + 0.3 * f;
        }
        b.warm.forEach((a, k) => showActor(a, on && street > 0.45 + k * 0.15, dt));
      });
      const nSlumped = Math.round(share('slumped', street) * slumped.length);
      slumped.forEach((a, i) => showActor(a, i < nSlumped, dt));

      // Arguments flare now and then, more often the worse it gets.
      const fightOdds = share('fights', street);
      if (!fight.on && fightOdds > 0 && fightSpots.length && (fight.next -= dt * fightOdds) <= 0) {
        fight.on = true;
        fight.t = 0;
        fight.said = 0;
        fight.spot = Math.floor(random() * fightSpots.length);
      }
      if (fight.on) {
        fight.t += dt;
        const p = fightSpots[fight.spot];
        // Squaring up along the wall: a step in, a step back.
        const gap = 0.9 + (still ? 0 : 0.25 * Math.sin(fight.t * 4));
        fighters.forEach((a, k) => {
          const side = k ? 1 : -1;
          a.x = p.x + p.f.ax * side * gap * 0.5;
          a.z = p.z + p.f.az * side * gap * 0.5;
          a.heading = Math.atan2(-p.f.ax * side, -p.f.az * side);
          showActor(a, fight.t < 14, dt);
        });
        if (fight.t > fight.said) {
          fight.said += 4 + random() * 3;
          board.say(p.x, p.z, SHOUTS[Math.floor(random() * SHOUTS.length)]);
        }
        if (fight.t > 16) { fight.on = false; fight.next = 10 + random() * 20; }
      } else for (const a of fighters) showActor(a, false, dt);

      // Ambulance scenes, more often as the street scene grows.
      const emOdds = share('emergencies', street);
      if (!emergency.on && emOdds > 0 && kerb.length && (emergency.next -= dt * emOdds) <= 0) {
        emergency.on = true;
        emergency.t = 0;
        emergency.spot = Math.floor(random() * kerb.length);
        const p = kerb[emergency.spot];
        down.x = p.x; down.z = p.z; down.heading = Math.atan2(p.f.ax, p.f.az);
        medic.x = p.x + p.f.nx * 0.7; medic.z = p.z + p.f.nz * 0.7; medic.heading = Math.atan2(-p.f.nx, -p.f.nz);
        lamp.g.position.set(p.x + p.f.ax * 1.4, 0, p.z + p.f.az * 1.4);
        board.say(medic.x, medic.z, LINES[Math.floor(random() * LINES.length)]);
      }
      if (emergency.on) {
        emergency.t += dt;
        const live = emergency.t < 22;
        showActor(down, live, dt);
        showActor(medic, live, dt);
        lamp.g.visible = live;
        // Blue and red take turns; with reduced motion both stay softly lit.
        const phase = still ? 0.5 : (Math.floor(emergency.t * 6) % 2);
        lamp.blue.opacity = still ? 0.6 : phase ? 1 : 0.1;
        lamp.red.opacity = still ? 0.6 : phase ? 0.1 : 1;
        if (emergency.t > 24) { emergency.on = false; emergency.next = 25 + random() * 40; }
      } else {
        showActor(down, false, dt);
        showActor(medic, false, dt);
        lamp.g.visible = false;
      }
    },
  };
}
