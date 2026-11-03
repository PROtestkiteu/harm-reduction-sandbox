import { AdditiveBlending, BufferGeometry, CanvasTexture, CircleGeometry, Color, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, SRGBColorSpace, type Object3D } from 'three';
import { allBuildings, flatRoofTop, roofClaimed, type CityBuilding } from '../cityBuildings';
import { add, box, cylinder, signBoard } from '../kit';
import { DISTRICT, FESTIVAL, PAVEMENT_TOP, STREETS, clearOfWalks, groundY, type P2 } from '../layout';
import { clothMat, glowMat, mat, vehicleMat } from '../materials';
import { mergeStatic } from '../mergeStatic';
import { fade, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * Harm reduction where people are, after Échele Cabeza's pixel-art city (the
 * Colombian drug checking project; art by Mierdinsky): at the festival
 * grounds a black stretch tent where a crew tests what people bring
 * (reagents, a spectrometer, results on a board), with free water and
 * earplugs and a chill-out lawn of chairs and beanbags under it; a rooftop
 * party with a turning disco ball, string lights and a DJ, and a drug-policy
 * banner hung down the building; planter boxes of a street garden along the
 * kerb; a pile of traffic cones at road works; a fruit seller under a striped
 * umbrella; and green parrots that perch on the umbrella and the rooftop
 * rail and fly between them. The tent's crew and visitors come with a
 * festival; the party is on from ten till four.
 */

const TENT = { x: (FESTIVAL.x1 - 4) as number, z: (FESTIVAL.z0 + FESTIVAL.z1) / 2 + 1.7, w: 6.6, d: 5.4 };
const PARTY_HOURS: readonly [number, number] = [1320, 1680];

/** A stretch tent's membrane over (−w/2…w/2, −d/2…d/2): low at the corners, lifted mid-edge, peaked over two masts. */
function membrane(w: number, d: number, masts: readonly P2[], peak: number, open: number): BufferGeometry {
  const nx = 22, nz = 18;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / nz;
      const x = (u - 0.5) * w, z = (v - 0.5) * d;
      // Edges hang at 1.25 m, scalloped up between the corner pegs; the masts push the cloth up in smooth cones.
      const edge = 1.25 + 0.55 * Math.sin(u * Math.PI) * Math.min(1, Math.min(v, 1 - v) * 6) + 0.55 * Math.sin(v * Math.PI) * Math.min(1, Math.min(u, 1 - u) * 6);
      // The open side (−x) lifted high, so people walk in and you see under it.
      let y = edge + open * Math.max(0, 1 - u * 2.5);
      for (const m of masts) y = Math.max(y, peak - Math.hypot(x - m.x, z - m.z) * 0.95);
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A banner's face: big words over a stylised leaf, for the side of the party's building. */
function bannerTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#f2ead6'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#1e5a2a'; g.lineWidth = 4; g.strokeRect(4, 4, 120, 248);
  // A leaf: a midrib and pairs of leaflets.
  g.fillStyle = '#2e7a3a';
  g.save(); g.translate(64, 150);
  for (const [a, l] of [[0, 62], [0.5, 48], [-0.5, 48], [1.0, 34], [-1.0, 34]] as const) {
    g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, -l / 2, 9, l / 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.fillStyle = '#1e4a24'; g.fillRect(-2, -4, 4, 40);
  g.restore();
  g.fillStyle = '#1a1a1a'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
  g.fillText('SUPPORT.', 64, 36); g.fillText("DON'T", 64, 62); g.fillText('PUNISH.', 64, 88);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A parrot facing +z: body, head and beak, tail, and two wings that flap (`wings`). */
function parrot(root: Object3D): { g: Group; wings: Object3D[] } {
  const g = new Group();
  root.add(g);
  const green = mat(0x2aa04a);
  const body = new Mesh(new SphereGeometry(0.09, 6, 5), green);
  body.scale.set(1, 1.1, 1.5);
  body.position.y = 0.1;
  g.add(body);
  add(g, new Mesh(new SphereGeometry(0.06, 6, 5), mat(0x3ac05a))).position.set(0, 0.2, 0.09);
  add(g, box(0.03, 0.03, 0.05, mat(0xe8c040), 0, 0.18, 0.16));
  add(g, box(0.05, 0.02, 0.18, mat(0x1e6ab0), 0, 0.07, -0.18)).rotation.x = 0.4;
  const wings = [-1, 1].map((s) => {
    const w = add(g, new Group());
    w.position.set(s * 0.07, 0.13, 0);
    add(w, box(0.16, 0.015, 0.12, mat(s < 0 ? 0x1e8a3a : 0x1e8a3a), s * 0.08, 0, 0));
    return w;
  });
  return { g, wings };
}

export function buildCareStreet({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const moving = new Group();
  root.add(moving);
  const people: { a: Actor; when: 'festival' | 'party' | 'day'; seat?: boolean; i: number }[] = [];
  const person = (style: Parameters<typeof pool.add>[0], x: number, z: number, face: number, when: 'festival' | 'party' | 'day', pose: Actor['pose'], voice?: string, lift = 0) => {
    const a = pool.add(style, x, z);
    a.heading = face;
    a.pose = pose;
    a.lift = lift;
    if (voice) a.voice = voice;
    people.push({ a, when, seat: pose === 'sit', i: people.length });
    return a;
  };

  // ------------------------------------------------ the festival's drug checking tent
  {
    // Open to the south (towards the camera and the food trucks): its local −x side turned to +z.
    const g = add(root, new Group(), Math.PI / 2);
    g.position.set(TENT.x, 0.02, TENT.z);
    const masts = [{ x: -1.4, z: 0 }, { x: 1.5, z: 0.2 }];
    const cloth = new MeshLambertMaterial({ color: 0x24242a, side: DoubleSide });
    g.add(new Mesh(membrane(TENT.w, TENT.d, masts, 3.7, 1.1), cloth));
    const pole = mat(0x8a8c8e);
    for (const m of masts) add(g, cylinder(0.05, 3.7, pole, 6, m.x, 0, m.z));
    // Edge poles, guy lines to pegs.
    const rope = mat(0xb8b8b0);
    for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]] as const) {
      const x = (ex * TENT.w) / 2, z = (ez * TENT.d) / 2;
      add(g, cylinder(0.03, 1.3, pole, 5, x, 0, z));
      const r = add(g, box(0.015, 1.6, 0.015, rope, x + ex * 0.45, 0, z + ez * 0.6));
      r.rotation.set(ez * 0.55, 0, -ex * 0.55);
    }
    // The name along the front edge (facing the arena, west), in the project's purple and green.
    const sign = signBoard('DRUG CHECKING', 3.2, 0.5, '#ffffff', '#4a1a5a', 0.7);
    add(g, sign.mesh, -Math.PI / 2).position.set(-TENT.w / 2 - 0.05, 1.55, 0);
    add(g, box(0.04, 0.12, 3.2, mat(0x3ac05a), -TENT.w / 2 - 0.06, 1.25, 0));
    // The testing table: cloth, reagent bottles, spot plates, a spectrometer and a laptop, a waste bin.
    const tx = -0.6, tz = -1.5;
    add(g, box(2.4, 0.04, 0.8, clothMat(0xe8e4d8), tx, 0.74, tz));
    for (const lx of [-1.1, 1.1]) add(g, box(0.05, 0.74, 0.7, mat(0x3a3a3c), tx + lx, 0, tz));
    [0xc83a2a, 0x2a6ab0, 0xd0a020, 0x3a8a3a, 0x8a3ab0].forEach((c, k) => {
      add(g, cylinder(0.03, 0.09, mat(0x8a5a2a), 6, tx - 0.9 + k * 0.1, 0.78, tz - 0.25));
      add(g, cylinder(0.032, 0.025, mat(c), 6, tx - 0.9 + k * 0.1, 0.87, tz - 0.25));
    });
    for (let k = 0; k < 3; k++) add(g, box(0.16, 0.015, 0.1, mat(0xf2f0ea), tx - 0.3 + k * 0.2, 0.78, tz));
    add(g, box(0.42, 0.18, 0.3, mat(0x6a6c70), tx + 0.55, 0.78, tz - 0.1));
    add(g, box(0.1, 0.06, 0.02, glowMat(0x204030, 0x6affa0, 0.9), tx + 0.55, 0.88, tz + 0.06));
    add(g, box(0.34, 0.02, 0.24, mat(0x2a2a2c), tx + 0.95, 0.78, tz + 0.05));
    const screen = add(g, box(0.34, 0.22, 0.015, glowMat(0x1a2a3a, 0x8ac0ff, 0.6), tx + 0.95, 0.8, tz - 0.07));
    screen.rotation.x = -0.25;
    add(g, cylinder(0.15, 0.4, mat(0xd8c020), 8, tx - 1.45, 0, tz));
    // Results on a board: green, amber, red cards.
    add(g, box(0.9, 0.7, 0.04, mat(0xf2f0ea), tx + 1.6, 1.0, tz - 0.38));
    for (let k = 0; k < 6; k++) add(g, box(0.18, 0.12, 0.02, mat([0x3a9a4a, 0xd0a020, 0xc83a2a][k % 3]), tx + 1.35 + (k % 3) * 0.25, 1.15 + Math.floor(k / 3) * -0.25, tz - 0.35));
    add(g, box(0.05, 1.0, 0.05, mat(0x3a3a3c), tx + 1.6, 0, tz - 0.4));
    // Free water and earplugs.
    add(g, box(0.4, 0.9, 0.4, mat(0x3a3a3c), 1.9, 0, -1.6));
    add(g, cylinder(0.15, 0.4, glowMat(0x4a8ac0, 0x6ab0e0, 0.35), 8, 1.9, 0.9, -1.6));
    add(g, box(0.3, 0.12, 0.2, mat(0xe07a20), 1.4, 0.78, -1.55));
    // The chill-out: a rug, beanbags and plastic chairs, a pair of speakers.
    add(g, box(3.2, 0.02, 2.0, clothMat(0x6a2a5a), 0.4, 0.01, 1.1));
    const seats: [number, number, number][] = [[-0.8, 0.6, 0x2a8ac0], [0.2, 1.5, 0xe0a020], [1.2, 0.7, 0xc83a7a], [1.8, 1.6, 0x3ab05a], [-0.4, 1.8, 0xe8e2d8]];
    seats.forEach(([x, z, c], k) => {
      if (k % 2) {
        const bag = add(g, new Mesh(new SphereGeometry(0.42, 8, 6), clothMat(c)));
        bag.position.set(x, 0.22, z);
        bag.scale.set(1, 0.55, 1);
      } else {
        add(g, box(0.45, 0.04, 0.45, mat(c), x, 0.42, z));
        add(g, box(0.45, 0.45, 0.04, mat(c), x, 0.44, z + 0.22));
        for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) add(g, box(0.03, 0.42, 0.03, mat(c), x + lx, 0, z + lz));
      }
    });
    for (const x of [-2.6, 2.6]) add(g, box(0.4, 0.7, 0.35, mat(0x1a1a1c), x, 0, 2.3));
    // Its people: a crew of three in the project's vests, a queue at the table, people resting.
    // The tent's local (x, z) in the world, turned as the tent is (a quarter turn: local −x looks south).
    const at = (lx: number, lz: number): P2 => ({ x: TENT.x + lz, z: TENT.z - lx });
    for (const [lx, lz] of [[tx - 0.5, tz - 0.7], [tx + 0.5, tz - 0.7], [1.9, -1.0]] as const) {
      const p = at(lx, lz);
      person({ style: 'everyday', vest: 0x7a3a9a }, p.x, p.z, lz < -1.9 ? Math.PI / 2 : 0, 'festival', 'talk', 'checker');
    }
    for (let k = 0; k < 4; k++) {
      const p = at(tx - 0.4 + k * 0.05, tz + 0.7 + k * 0.65);
      person({ style: k % 2 ? 'raver' : 'queerRave' }, p.x, p.z, -Math.PI / 2, 'festival', 'stand', 'festival');
    }
    seats.forEach(([x, z], k) => {
      const p = at(x, z - (k % 2 ? 0 : 0.05));
      person({ style: k % 3 ? 'raver' : 'student' }, p.x, p.z, k % 2 ? 0 : -Math.PI / 2, 'festival', 'sit', 'festival', k % 2 ? 0.12 : 0);
    });
  }

  // ------------------------------------------------ the rooftop party and its banner
  // A flat roof whose top nobody else uses (a ground floor dressed below is fine: a party over a shop), nearest the south ring.
  const decks = allBuildings()
    .map((b) => ({ b, deck: b.deck ?? { x0: b.x0 + 1, x1: b.x1 - 1, z0: b.z0 + 1, z1: b.z1 - 1 } }))
    .filter(({ b, deck }) => flatRoofTop(b) !== null && !roofClaimed(b.id) && deck.x1 - deck.x0 > 6 && deck.z1 - deck.z0 > 5 && Math.abs((b.x0 + b.x1) / 2) < DISTRICT - 10 && Math.abs((b.z0 + b.z1) / 2) < DISTRICT - 8)
    .sort((a, b) => Math.hypot((a.b.x0 + a.b.x1) / 2 - 15, (a.b.z0 + a.b.z1) / 2 - 38) - Math.hypot((b.b.x0 + b.b.x1) / 2 - 15, (b.b.z0 + b.b.z1) / 2 - 38));
  const host: CityBuilding | undefined = decks[0]?.b;
  let ball: Mesh | null = null;
  let spots: { m: Mesh; mat: MeshBasicMaterial; a: number }[] = [];
  let rail: P2 | null = null;
  let roofY = 0;
  if (host) {
    const d = decks[0].deck;
    roofY = flatRoofTop(host) as number;
    const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
    const w = d.x1 - d.x0, dd = d.z1 - d.z0;
    const g = add(root, new Group());
    g.position.set(cx, roofY, cz);
    // String lights round the deck, a DJ table and its speakers, a crate bar, a few plants.
    const bulb = glowMat(0x5a4a20, 0xffd070, 1.2);
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]] as const) {
      for (let k = 0; k < 7; k++) {
        const t = k / 7;
        const x = (ax + (bx - ax) * t) * (w / 2 - 0.3), z = (az + (bz - az) * t) * (dd / 2 - 0.3);
        add(g, box(0.1, 0.1, 0.1, bulb, x, 1.9 - Math.sin(t * Math.PI) * 0.35, z));
      }
      add(g, cylinder(0.03, 2.0, mat(0x3a3a3c), 5, ax * (w / 2 - 0.3), 0, az * (dd / 2 - 0.3)));
    }
    add(g, box(1.6, 0.85, 0.6, mat(0x1a1a1c), 0, 0, -dd / 2 + 0.9));
    add(g, box(0.5, 0.05, 0.35, glowMat(0x202a3a, 0x8ac0ff, 0.7), -0.3, 0.86, -dd / 2 + 0.9));
    for (const sx of [-1.2, 1.2]) add(g, box(0.45, 1.1, 0.4, mat(0x141416), sx, 0, -dd / 2 + 0.8));
    add(g, box(0.9, 0.6, 0.5, mat(0x6a4426), w / 2 - 1.0, 0, dd / 2 - 0.9));
    for (const [px, pz] of [[-w / 2 + 0.6, dd / 2 - 0.6], [w / 2 - 0.6, -dd / 2 + 0.6]] as const) {
      add(g, cylinder(0.25, 0.4, mat(0x8a4a30), 8, px, 0, pz));
      add(g, new Mesh(new SphereGeometry(0.45, 7, 5), mat(0x3a7a32))).position.set(px, 0.7, pz);
    }
    // The disco ball on a pole, turning, throwing coloured spots on the deck.
    add(g, cylinder(0.03, 2.6, mat(0x8a8c8e), 5, 0.2, 0, -0.2));
    ball = new Mesh(new IcosahedronGeometry(0.32, 1), vehicleMat(0xd8dadc, 2));
    ball.position.set(cx + 0.2, roofY + 2.75, cz - 0.2);
    moving.add(ball);
    spots = [0xff4fa8, 0x4ff0ff, 0xb8ff4a, 0xf0e040].map((c, k) => {
      const m2 = new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false });
      const m = new Mesh(new CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), m2);
      m.position.y = roofY + 0.03;
      moving.add(m);
      return { m, mat: m2, a: (k * Math.PI) / 2 };
    });
    rail = { x: cx + w / 2 - 0.3, z: cz + dd / 2 - 0.3 };
    // Dancers and a couple sitting on the crates, up on the roof.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = Math.min(w, dd) * 0.28;
      person({ style: k % 3 ? 'raver' : k % 2 ? 'hiphop' : 'queerRave' }, cx + Math.cos(a) * r, cz + Math.sin(a) * r * 0.7, Math.atan2(-Math.cos(a), -Math.sin(a)), 'party', 'dance', 'party', roofY);
    }
    person({ style: 'technoBlack' }, cx, cz - dd / 2 + 1.4, Math.PI, 'party', 'talk', 'party', roofY);
    // The banner down the building's face the camera sees (south, else east).
    const tex = bannerTexture();
    const banner = new MeshLambertMaterial({ map: tex, emissive: new Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.25 });
    const south = host.front === '+z' || host.front === undefined;
    const bh = Math.min(roofY - 1.5, 6);
    const b2 = add(root, box(1.6, bh, 0.02, banner));
    if (south) b2.position.set((host.x0 + host.x1) / 2 + 2, roofY - bh - 0.3, host.z1 + 0.06);
    else { b2.position.set(host.x1 + 0.06, roofY - bh - 0.3, (host.z0 + host.z1) / 2 + 2); b2.rotation.y = Math.PI / 2; }
  }

  // ------------------------------------------------ the street: garden planters, works cones, fruit seller
  // On the ring's inner south pavement, at the kerb (the walking lines and the skaters keep to the middle).
  const pave = STREETS.ringSouth.pavements[0];
  const kerbZ = pave.z1 - 0.55;
  const room = (x: number, z: number, w: number, d: number) => groundY(x, z) >= PAVEMENT_TOP && clearOfWalks(x, z, 0, w, d) && !pool.blocked(x, z, Math.max(w, d) / 2);
  const along = (from: number, len: number, w: number, d: number): number | null => {
    for (let x = from; x < from + 80; x += 1) {
      let ok = true;
      for (let t = -len / 2; t <= len / 2 && ok; t += 1) ok = room(x + t, kerbZ, w, d);
      if (ok) return x;
    }
    return null;
  };
  const gardenX = along(-40, 5, 1.3, 0.6);
  if (gardenX !== null) {
    const g = add(root, new Group());
    g.position.set(gardenX, PAVEMENT_TOP, kerbZ);
    const leaf = [0x3a7a32, 0x2e6a2a, 0x4a8a3a];
    for (let k = 0; k < 3; k++) {
      const x = -2 + k * 2;
      add(g, box(1.6, 0.5, 0.6, mat(0x6a4a2a), x, 0, 0));
      add(g, box(1.5, 0.04, 0.5, mat(0x2e2418), x, 0.5, 0));
      for (let p = 0; p < 4; p++) {
        const h = 0.4 + random() * 0.5;
        add(g, cylinder(0.02, h, mat(0x3a5a2a), 4, x - 0.55 + p * 0.37, 0.5, 0));
        const bush = add(g, new Mesh(new SphereGeometry(0.2 + random() * 0.1, 6, 4), mat(leaf[p % 3])));
        bush.position.set(x - 0.55 + p * 0.37, 0.5 + h, 0);
        bush.scale.y = 1.3;
      }
    }
    for (let k = 0; k < 3; k++) pool.addSolid(gardenX - 2 + k * 2, kerbZ, 0, 1.6, 0.6);
  }
  const conesX = gardenX === null ? along(-10, 3, 1.2, 0.8) : along(gardenX + 8, 3, 1.2, 0.8);
  if (conesX !== null) {
    const g = add(root, new Group());
    g.position.set(conesX, PAVEMENT_TOP, kerbZ);
    const orange = mat(0xe8641e);
    const white = mat(0xf2f0ea);
    const cone = (x: number, z: number, lying: boolean) => {
      const c = add(g, new Group());
      c.position.set(x, lying ? 0.12 : 0, z);
      if (lying) c.rotation.set(0, random() * 6, Math.PI / 2);
      add(c, box(0.32, 0.04, 0.32, mat(0x1a1a1a), 0, 0, 0));
      add(c, cylinder(0.12, 0.62, orange, 8, 0, 0.04, 0));
      add(c, cylinder(0.125, 0.08, white, 8, 0, 0.36, 0));
    };
    for (const [x, z, l] of [[-0.9, 0, false], [-0.4, 0.15, false], [0.1, -0.1, false], [0.6, 0.1, false], [-0.2, -0.1, true], [0.35, 0.2, true], [1.0, -0.05, false]] as const) cone(x, z, l);
    add(g, box(1.4, 0.2, 0.05, mat(0xe8641e), 0, 0.75, 0.3));
    add(g, box(0.05, 0.75, 0.05, white, -0.65, 0, 0.3));
    add(g, box(0.05, 0.75, 0.05, white, 0.65, 0, 0.3));
    pool.addSolid(conesX, kerbZ, 0, 2.2, 0.8);
  }
  const cartX = conesX === null ? along(0, 2, 1.4, 0.9) : along(conesX + 5, 2, 1.4, 0.9);
  let umbrella: P2 | null = null;
  if (cartX !== null) {
    const g = add(root, new Group());
    g.position.set(cartX, PAVEMENT_TOP, kerbZ);
    // A fruit cart: a wooden box on bicycle wheels, trays of mango, papaya, pineapple, a striped umbrella.
    add(g, box(1.3, 0.55, 0.7, mat(0x7a5a3a), 0, 0.35, 0));
    for (const x of [-0.45, 0.45]) add(g, cylinder(0.3, 0.04, mat(0x1a1a1a), 12, x, 0.3, -0.36)).rotation.x = Math.PI / 2;
    for (let k = 0; k < 9; k++) add(g, new Mesh(new SphereGeometry(0.07, 5, 4), mat([0xe8a020, 0xe8642a, 0xd8c040, 0x6aa03a][k % 4]))).position.set(-0.5 + (k % 5) * 0.25, 0.97, -0.15 + Math.floor(k / 5) * 0.3);
    add(g, cylinder(0.025, 2.0, mat(0x8a8c8e), 5, 0.5, 0.9, 0.2));
    const top = add(g, new Mesh(new CircleGeometry(1.0, 8).rotateX(-Math.PI / 2), clothMat(0xd83a2a)));
    top.position.set(0.5, 2.9, 0.2);
    top.rotation.z = 0.12;
    for (let k = 0; k < 4; k++) {
      const s = add(g, box(0.18, 0.015, 1.9, clothMat(0xf2f0ea), 0.5, 2.91, 0.2));
      s.rotation.y = (k * Math.PI) / 4;
    }
    umbrella = { x: cartX + 0.5, z: kerbZ + 0.2 };
    pool.addSolid(cartX, kerbZ, 0, 1.4, 0.8);
    person({ style: 'older', extra: 'jacket' }, cartX - 0.2, kerbZ - 0.75, 0, 'day', 'talk', 'fruit');
  }
  mergeStatic(root);

  // ------------------------------------------------ parrots between the umbrella and the rooftop rail
  const perches: { at: P2; y: number }[] = [];
  if (umbrella) perches.push({ at: umbrella, y: PAVEMENT_TOP + 2.95 });
  if (rail) perches.push({ at: rail, y: roofY + 1.95 });
  const birds = perches.length ? [0, 1, 2].map((k) => {
    const b = parrot(moving);
    const p = perches[k % perches.length];
    b.g.position.set(p.at.x + (k - 1) * 0.25, p.y, p.at.z);
    return { ...b, from: k % perches.length, to: k % perches.length, t: 1, wait: 6 + random() * 14 };
  }) : [];

  let time = 0;
  let sayIn = 5;
  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const p of people) p.a.shown = 0;
    },
    update(dt, ctx) {
      time += dt;
      const fest = ctx.happenings.find((h) => h.id === 'festival');
      const festOn = !!fest;
      const party = ctx.clock >= PARTY_HOURS[0] && ctx.clock < PARTY_HOURS[1];
      const day = ctx.clock < 1500;
      for (const p of people) {
        const want = p.when === 'festival' ? festOn && (p.a.voice === 'checker' || p.i % 3 < Math.ceil(3 * (fest?.crowd ?? 0))) : p.when === 'party' ? party : day;
        fade(p.a, want, dt, 0.4);
      }
      if (ball) ball.rotation.y += dt * (ctx.still ? 0 : 0.8);
      for (const s of spots) {
        if (!ball) break;
        s.m.visible = party;
        s.a += dt * (ctx.still ? 0 : 0.6);
        s.m.position.x = ball.position.x + Math.cos(s.a) * 1.6;
        s.m.position.z = ball.position.z + Math.sin(s.a) * 1.1;
      }
      // Parrots: sit, now and then fly to the other perch in an arc, flapping.
      for (const b of birds) {
        if (b.t >= 1) {
          for (const w of b.wings) w.rotation.z = 0;
          if ((b.wait -= dt) <= 0 && perches.length > 1 && !ctx.still) { b.from = b.to; b.to = (b.to + 1) % perches.length; b.t = 0; }
          continue;
        }
        const A = perches[b.from], B = perches[b.to];
        const d = Math.hypot(B.at.x - A.at.x, B.at.z - A.at.z);
        b.t = Math.min(1, b.t + (dt * 7) / Math.max(4, d));
        const t = b.t;
        b.g.position.set(A.at.x + (B.at.x - A.at.x) * t, A.y + (B.y - A.y) * t + Math.sin(t * Math.PI) * Math.min(8, d * 0.25), A.at.z + (B.at.z - A.at.z) * t);
        b.g.rotation.y = Math.atan2(B.at.x - A.at.x, B.at.z - A.at.z);
        const flap = Math.sin(time * 24) * 0.9;
        b.wings[0].rotation.z = flap;
        b.wings[1].rotation.z = -flap;
        if (b.t >= 1) b.wait = 10 + random() * 20;
      }
      if ((sayIn -= dt) <= 0) {
        sayIn = 5 + random() * 6;
        const near = people.filter((p) => p.a.detailed && p.a.shown > 0.9 && p.a.voice);
        const p = near[Math.floor(random() * near.length)];
        if (p) board.speak(p.a.x, p.a.z, p.a.voice as string);
      }
    },
  };
}
