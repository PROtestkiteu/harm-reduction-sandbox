import { AdditiveBlending, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, DoubleSide, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Mesh, Object3D, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, RepeatWrapping, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3, type Material } from 'three';
import { allBuildings, claimRoof, flatRoofTop, frontFrame, lookClaimed, roofClaimed, type CityBuilding } from '../cityBuildings';
import { t } from '../../i18n';
import { add, box, cylinder, signBoard } from '../kit';
import { DISTRICT, FESTIVAL, PAVEMENT_TOP, STREETS, clearOfWalks, groundY, type P2 } from '../layout';
import { clothMat, glowMat, mat, vehicleMat } from '../materials';
import { dynamic, mergeStatic } from '../mergeStatic';
import { fade, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * Harm reduction where people are, after Échele Cabeza's pixel-art city (the
 * Colombian drug checking project; art by Mierdinsky).
 *
 * At the festival grounds: a tall black star tent in Échele Cabeza's colours
 * (one centre mast to a sharp spire, six points pegged out, arches between
 * them hung with the mark and SAFE SPACE), its skirt caught violet by
 * uplights with pink pools on the grass, green laser dots drifting over the inside and fairy lights
 * round it; under it a crew tests
 * what people bring (reagents, spot plates, a spectrometer, a results board),
 * with free water and earplugs, a chill-out rug of beanbags and plastic
 * chairs, an arcade cabinet, and out front a DJ table with its lamp between
 * speaker stacks; portable toilets by the picnic tables; a red heart balloon
 * over it all.
 *
 * On a flat roof: a party from ten till four, dancers spread over the deck
 * round a turning disco ball throwing coloured spots, string lights, the DJ,
 * a crate bar, a sunbather on a towel, beach chairs, bottles, a roof garden of
 * planters and a donkey (as in the picture), leaf flags on the parapet and a
 * lit CHILL ROOM sign; down the front a SUPPORT. DON'T PUNISH. banner, a big
 * round leaf mural and a row of posters. Nearby a vertical neon MOTEL sign
 * and a billboard with a painted face.
 *
 * On the ring road's inner south pavement: a street garden of planters, road
 * works with a pile of cones, a fruit cart under a striped umbrella, a corner
 * drink stop with a POLA board, beer crates and people at plastic tables, and
 * a kiosk of newspapers and books; green parrots perch on the umbrella, the
 * rooftop rail and the donkey, and fly between them.
 */

/** The star tent: its centre, the radius of its pegged points and of its arches, the arches' height, the mast tip. (w is its width for laying out round it.) */
const TENT = { x: (FESTIVAL.x1 - 5) as number, z: (FESTIVAL.z0 + FESTIVAL.z1) / 2 + 1.7, tips: 4.4, arches: 3.0, archH: 2.3, peak: 8.6, w: 7.4 };
const PARTY_HOURS: readonly [number, number] = [1320, 1680];

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}
const texture = (c: HTMLCanvasElement) => { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; };

/**
 * A star tent, the kind harm reduction crews pitch at festivals: one tall
 * centre mast, `n` points pegged out low to the ground at radius `tips`, and
 * between them the cloth's hem sweeps up into arches `archH` high at radius
 * `arches`. The cloth falls from the mast tip a little concave, as a
 * tensioned membrane does. u runs round (one canvas panel per point), v out.
 */
function starTent(n: number, tips: number, arches: number, archH: number, peak: number): { geo: BufferGeometry; at: (theta: number, s: number) => [number, number, number] } {
  // Arch middles face θ = 0 (+z, the camera side); the points sit between them.
  const tipness = (th: number) => Math.pow(Math.abs(Math.sin((n * th) / 2)), 3);
  const at = (th: number, s: number): [number, number, number] => {
    const t = tipness(th);
    const rE = arches + (tips - arches) * t;
    const yE = archH * (1 - t) + 0.15 * t;
    const r = s * rE;
    // Steeply concave: the cloth drops fast off the mast, so the top is a sharp spire over a wide skirt.
    return [Math.sin(th) * r, peak - (peak - yE) * Math.pow(s, 0.5), Math.cos(th) * r];
  };
  const nt = 96, ns = 16;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= ns; j++) {
    for (let i = 0; i <= nt; i++) {
      const th = (i / nt) * Math.PI * 2;
      pos.push(...at(th, Math.max(0.002, j / ns)));
      uv.push((i / nt) * n, j / ns);
    }
  }
  for (let j = 0; j < ns; j++) for (let i = 0; i < nt; i++) {
    const a = j * (nt + 1) + i, b = a + 1, c = a + nt + 1, e = c + 1;
    idx.push(a, b, c, b, e, c);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, at };
}

/** The Échele Cabeza mark, as on their tents in the pixel art: ÉCHELE in green over CABEZA in magenta, a small cloud beside. */
function logo(g: CanvasRenderingContext2D, x: number, y: number, size: number, cloud = true): void {
  g.save(); g.translate(x, y);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `italic bold ${size}px sans-serif`;
  g.fillStyle = '#3ac05a'; g.fillText('ÉCHELE', 0, -size * 0.55);
  g.fillStyle = '#e0308a'; g.fillText('CABEZA', 0, size * 0.5);
  g.fillStyle = '#f2f0ea';
  if (cloud) for (const [cx, cy, r] of [[size * 2.2, -size * 0.2, size * 0.35], [size * 2.55, -size * 0.35, size * 0.42], [size * 2.9, -size * 0.18, size * 0.32]] as const) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** One panel of the star tent's canvas (u runs round, v from the mast out): black, seams down each side, ribbons at the hem. */
function tentCanvas(): CanvasTexture {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#16161a'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(90,90,100,0.5)'; g.fillRect(0, 0, 2, 256); g.fillRect(126, 0, 2, 256);
  // The texture is flipped (canvas top is v = 1, the hem), so the hem's ribbons go at the top.
  g.fillStyle = '#c8308a'; g.fillRect(0, 4, 128, 6);
  g.fillStyle = '#3ac05a'; g.fillRect(0, 12, 128, 4);
  return texture(c);
}

/** A banner for the tent's arches: the words in cream on deep purple, as the crews hang them. */
function safeSpaceTexture(text: string): CanvasTexture {
  const [c, g] = canvas(256, 96);
  g.fillStyle = '#141418'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#c8308a'; g.fillRect(0, 90, 256, 6);
  logo(g, 92, 30, 17);
  g.fillStyle = '#f2e6c8'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 72);
  return texture(c);
}

/** The banner, the mural and the posters on the party's building. */
function bannerTexture(): CanvasTexture {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#f2ead6'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#1e5a2a'; g.lineWidth = 4; g.strokeRect(4, 4, 120, 248);
  leaf(g, 64, 160, 1);
  g.fillStyle = '#1a1a1a'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
  g.fillText('SUPPORT.', 64, 36); g.fillText("DON'T", 64, 62); g.fillText('PUNISH.', 64, 88);
  return texture(c);
}
function leaf(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#2e7a3a';
  for (const [a, l] of [[0, 62], [0.5, 48], [-0.5, 48], [1.0, 34], [-1.0, 34]] as const) {
    g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, -l / 2, 9, l / 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.fillStyle = '#1e4a24'; g.fillRect(-2, -4, 4, 40);
  g.restore();
}
function muralTexture(): CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#efe6cc'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2e5a2a'; g.lineWidth = 6; g.stroke();
  // A coca branch: leaves along a stem, in two greens, and the words round the rim.
  g.strokeStyle = '#3a5a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(60, 200); g.quadraticCurveTo(128, 140, 196, 70); g.stroke();
  for (let k = 0; k < 7; k++) {
    const t = k / 6, x = 60 + t * 136, y = 200 - t * 130 + Math.sin(t * 3) * 10;
    g.fillStyle = k % 2 ? '#3a8a3a' : '#2a6a2a';
    for (const s of [-1, 1]) { g.save(); g.translate(x, y); g.rotate(s * 0.9 - 0.8); g.beginPath(); g.ellipse(0, -18, 9, 20, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  g.fillStyle = '#1e3a1e'; g.font = 'bold 17px sans-serif'; g.textAlign = 'center';
  g.fillText('REGULATE, DON\'T PUNISH', 128, 40);
  g.fillText('PEACE · CARE · RIGHTS', 128, 232);
  return texture(c);
}
function posterTexture(k: number): CanvasTexture {
  const [c, g] = canvas(64, 96);
  const bg = ['#f0d040', '#3a8ac0', '#e8e2d8', '#c8308a', '#3ab05a'][k % 5];
  g.fillStyle = bg; g.fillRect(0, 0, 64, 96);
  g.fillStyle = '#1a1a1a'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
  g.fillText(['TEST IT', 'NALOXONE', 'NO ONE', 'CARE NOT', 'START LOW'][k % 5], 32, 16);
  g.fillText(['FIRST', 'SAVES', 'USES', 'CELLS', 'GO SLOW'][k % 5], 32, 30);
  leaf(g, 32, 72, 0.45);
  return texture(c);
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
    add(w, box(0.16, 0.015, 0.12, mat(0x1e8a3a), s * 0.08, 0, 0));
    return w;
  });
  return { g, wings };
}

/** A donkey standing, facing +z, about 1.2 m at the back. */
function donkey(g: Object3D): void {
  const grey = mat(0x6a6460);
  const pale = mat(0xc8c0b4);
  add(g, box(0.5, 0.5, 1.1, grey, 0, 0.62, 0));
  for (const [x, z] of [[-0.17, -0.42], [0.17, -0.42], [-0.17, 0.42], [0.17, 0.42]] as const) add(g, box(0.1, 0.64, 0.1, grey, x, 0, z));
  const neck = add(g, box(0.22, 0.5, 0.25, grey, 0, 0.95, 0.55));
  neck.rotation.x = 0.5;
  add(g, box(0.24, 0.24, 0.45, grey, 0, 1.25, 0.82));
  add(g, box(0.2, 0.16, 0.12, pale, 0, 1.2, 1.06));
  for (const x of [-0.07, 0.07]) add(g, box(0.06, 0.32, 0.04, grey, x, 1.42, 0.7)).rotation.z = x * 3;
  add(g, box(0.04, 0.4, 0.04, mat(0x3a3430), 0, 0.55, -0.58)).rotation.x = -0.3;
  add(g, box(0.06, 0.3, 0.5, mat(0x2a2624), 0, 1.15, 0.45)).rotation.x = 0.5;
}

/** A plastic garden chair facing +z. */
function chair(g: Object3D, x: number, z: number, rot: number, colour: number): void {
  const c = add(g, new Group(), rot);
  c.position.set(x, 0, z);
  const m = mat(colour);
  add(c, box(0.45, 0.04, 0.45, m, 0, 0.42, 0));
  add(c, box(0.45, 0.45, 0.04, m, 0, 0.44, -0.21));
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) add(c, box(0.03, 0.42, 0.03, m, lx, 0, lz));
}

export function buildCareStreet({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  // What turns, bobs or flies: kept out of the static merge.
  const moving = dynamic(new Group());
  root.add(moving);
  type When = 'festival' | 'party' | 'day' | 'late';
  const people: { a: Actor; when: When; i: number }[] = [];
  const person = (look: Parameters<typeof pool.add>[0], p: P2, face: number, when: When, pose: Actor['pose'], voice?: string, lift = 0) => {
    const a = pool.add(look, p.x, p.z);
    a.heading = face;
    a.pose = pose;
    a.lift = lift;
    if (voice) a.voice = voice;
    people.push({ a, when, i: people.length });
    return a;
  };
  const perches: { at: P2; y: number }[] = [];

  // ------------------------------------------------ the festival's drug checking tent
  let balloon: Group | null = null;
  let lasers: Object3D | null = null;
  {
    // The star tent itself, upright and the same from every side, in the world's frame.
    const tent = starTent(6, TENT.tips, TENT.arches, TENT.archH, TENT.peak);
    const shell = add(root, new Group());
    shell.position.set(TENT.x, 0.02, TENT.z);
    // Washed purple by its uplights; one canvas panel per point.
    const canvasTex = tentCanvas();
    canvasTex.wrapS = RepeatWrapping;
    // Black cloth; the uplights catch only its lower skirt, a faint violet at the hem (v runs from the mast out).
    const [wc, wg] = canvas(8, 64);
    const wash = wg.createLinearGradient(0, 0, 0, 64);
    wash.addColorStop(0, '#000000'); wash.addColorStop(0.65, '#1a0a2a'); wash.addColorStop(1, '#5a1a6a');
    wg.fillStyle = wash; wg.fillRect(0, 0, 8, 64);
    const washTex = texture(wc);
    washTex.flipY = false;
    const cloth = new MeshLambertMaterial({ map: canvasTex, side: DoubleSide, emissive: new Color(0xffffff), emissiveMap: washTex, emissiveIntensity: 0.6 });
    shell.add(new Mesh(tent.geo, cloth));
    const pole = mat(0x8a8c8e);
    add(shell, cylinder(0.07, TENT.peak + 0.35, pole, 8, 0, 0, 0));
    add(shell, cylinder(0.1, 0.18, pole, 8, 0, TENT.peak + 0.3, 0));
    // A stake and a short line out from each point.
    const rope = mat(0xb8b8b0);
    for (let k = 0; k < 6; k++) {
      const th = Math.PI / 6 + (k * Math.PI) / 3;
      const [x, , z] = tent.at(th, 1);
      add(shell, box(0.06, 0.3, 0.06, mat(0x3a3a3c), x * 1.12, 0, z * 1.12));
      const line = add(shell, box(0.015, 0.015, TENT.tips * 0.13, rope, x * 1.06, 0.12, z * 1.06));
      line.rotation.y = th;
    }
    // The mark, twice, high on the cone where the cloth is narrow and little curved: a patch that follows the cloth,
    // just proud of it, on the two panels facing the camera.
    const markTex = (() => { const [c, mg] = canvas(256, 128); logo(mg, 100, 64, 34); return texture(c); })();
    const mark = new MeshLambertMaterial({ map: markTex, transparent: true, alphaTest: 0.3, side: DoubleSide, emissive: new Color(0xffffff), emissiveMap: markTex, emissiveIntensity: 0.35 });
    for (const th of [0, Math.PI / 3]) {
      // Flat, laid on the cloth at an arch's middle: across it runs round the cone, up it runs up the slope,
      // and it stands a few centimetres proud along the outward normal, so it never warps or sinks in.
      const s0 = 0.4;
      const p0 = new Vector3(...tent.at(th, s0));
      const up = new Vector3(...tent.at(th, s0 - 0.03)).sub(new Vector3(...tent.at(th, s0 + 0.03))).normalize();
      const across = new Vector3(Math.cos(th), 0, -Math.sin(th));
      const out = new Vector3().crossVectors(across, up).normalize();
      const m = new Mesh(new PlaneGeometry(1.5, 0.75), mark);
      m.matrixAutoUpdate = false;
      m.matrix.makeBasis(across, up, out).setPosition(p0.addScaledVector(out, 0.07));
      shell.add(m);
    }
    // The banners on the two arches the camera sees, hung just under the hem, leaning with the cloth.
    const bannerMat = new MeshLambertMaterial({ map: safeSpaceTexture(t('Safe space')), emissive: new Color(0xffffff), emissiveIntensity: 0.12 });
    for (const th of [0, Math.PI / 3]) {
      const [x, y, z] = tent.at(th, 0.97);
      const b = new Mesh(new PlaneGeometry(2.3, 0.86), bannerMat);
      b.position.set(x * 1.01, y - 0.55, z * 1.01);
      b.rotation.set(-0.32, th, 0, 'YXZ');
      shell.add(b);
    }
    // Uplights: pink and purple pools on the grass under the cloth, and fairy lights round the inside.
    for (const [k, c] of [[0, 0xc83ac8], [1, 0x8a3ae0], [2, 0xe03a8a]] as const) {
      const th = (k * Math.PI * 2) / 3 + 0.4;
      const pool = new Mesh(new CircleGeometry(1.3, 18).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, blending: AdditiveBlending, depthWrite: false }));
      pool.position.set(Math.sin(th) * 2.0, 0.04, Math.cos(th) * 2.0);
      shell.add(pool);
    }
    const fairy = [glowMat(0x2a2a6a, 0x6a8aff, 1.4), glowMat(0x5a2a6a, 0xd88aff, 1.4), glowMat(0x5a4a20, 0xffd890, 1.3)];
    for (let k = 0; k < 30; k++) {
      const th = (k / 30) * Math.PI * 2;
      const r = TENT.arches * 0.82;
      add(shell, box(0.07, 0.07, 0.07, fairy[k % 3], Math.sin(th) * r, 2.0 - 0.18 * Math.abs(Math.sin(th * 3)), Math.cos(th) * r));
    }
    // Green laser dots on the inside of the cloth, drifting slowly round (one instanced draw).
    const dots = new InstancedMesh(new PlaneGeometry(0.07, 0.07), new MeshBasicMaterial({ color: 0x6aff6a, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), 140);
    const tmp = new Object3D();
    for (let k = 0; k < 140; k++) {
      const th = random() * Math.PI * 2;
      const [x, y, z] = tent.at(th, 0.18 + random() * 0.65);
      tmp.position.set(x * 0.97, y - 0.05, z * 0.97);
      tmp.lookAt(0, y + 2, 0);
      tmp.updateMatrix();
      dots.setMatrixAt(k, tmp.matrix);
    }
    lasers = add(dynamic(new Group()), dots);
    lasers.position.set(TENT.x, 0.02, TENT.z);
    moving.add(lasers);
    // The rest, laid out in the tent's own turned frame (local −x looks south).
    const g = add(root, new Group(), Math.PI / 2);
    g.position.set(TENT.x, 0.02, TENT.z);
    // The testing table: cloth, reagent bottles, spot plates, a spectrometer and a laptop, a waste bin.
    const tx = -0.6, tz = -1.6;
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
    const sign = signBoard('DRUG CHECKING', 1.7, 0.34, '#ffffff', '#4a1a5a', 0.7);
    add(g, sign.mesh).position.set(tx, 0.36, tz + 0.42);
    add(g, box(2.4, 0.7, 0.02, clothMat(0x2a1a4a), tx, 0.04, tz + 0.4));
    // Results on a board: green, amber, red cards.
    add(g, box(0.9, 0.7, 0.04, mat(0xf2f0ea), tx + 1.6, 1.0, tz - 0.38));
    for (let k = 0; k < 6; k++) add(g, box(0.18, 0.12, 0.02, mat([0x3a9a4a, 0xd0a020, 0xc83a2a][k % 3]), tx + 1.35 + (k % 3) * 0.25, 1.15 - Math.floor(k / 3) * 0.25, tz - 0.35));
    add(g, box(0.05, 1.0, 0.05, mat(0x3a3a3c), tx + 1.6, 0, tz - 0.4));
    // Free water and earplugs.
    add(g, box(0.4, 0.9, 0.4, mat(0x3a3a3c), 1.9, 0, -1.6));
    add(g, cylinder(0.15, 0.4, glowMat(0x4a8ac0, 0x6ab0e0, 0.35), 8, 1.9, 0.9, -1.6));
    add(g, box(0.3, 0.12, 0.2, mat(0xe07a20), 1.6, 0.78, -1.7));
    // The chill-out: a rug, beanbags and plastic chairs, an arcade cabinet.
    add(g, box(3.6, 0.02, 2.2, clothMat(0x6a2a5a), 0.6, 0.01, 1.2));
    const seats: [number, number, number][] = [[-0.8, 0.6, 0x2a8ac0], [0.2, 1.6, 0xe0a020], [1.2, 0.7, 0xc83a7a], [1.9, 1.7, 0x3ab05a], [-0.4, 1.9, 0xe8e2d8]];
    seats.forEach(([x, z, c], k) => {
      if (k % 2) {
        const bag = add(g, new Mesh(new SphereGeometry(0.42, 8, 6), clothMat(c)));
        bag.position.set(x, 0.22, z);
        bag.scale.set(1, 0.55, 1);
      } else chair(g, x, z, Math.PI, c);
    });
    add(g, box(0.6, 1.6, 0.55, mat(0x2a2a8a), 2.2, 0, 0.1));
    add(g, box(0.5, 0.4, 0.02, glowMat(0x102030, 0x6ad0ff, 0.8), 2.2, 1.05, 0.38)).rotation.x = -0.2;
    add(g, box(0.62, 0.12, 0.5, mat(0xc8308a), 2.2, 1.55, 0.1));
    // Out front (south): the DJ table with its lamp, between speaker stacks.
    add(g, box(1.4, 0.85, 0.6, mat(0x1a1a1c), -TENT.w / 2 - 1.2, 0, 0));
    for (const dz of [-0.35, 0.35]) add(g, cylinder(0.14, 0.03, mat(0x3a3a3c), 12, -TENT.w / 2 - 1.2, 0.86, dz));
    add(g, cylinder(0.02, 0.45, mat(0x2a2a2c), 5, -TENT.w / 2 - 1.0, 0.86, 0.55));
    add(g, box(0.16, 0.08, 0.1, glowMat(0x5a4a20, 0xffd890, 1.4), -TENT.w / 2 - 1.05, 1.28, 0.5));
    for (const dz of [-1.6, 1.6]) {
      add(g, box(0.6, 0.8, 0.55, mat(0x141416), -TENT.w / 2 - 1.2, 0, dz));
      add(g, box(0.55, 0.7, 0.5, mat(0x1a1a1c), -TENT.w / 2 - 1.2, 0.8, dz));
      add(g, cylinder(0.18, 0.02, mat(0x3a3a3c), 10, -TENT.w / 2 - 1.47, 0.4, dz)).rotation.z = Math.PI / 2;
    }
    // The tent's local (x, z) in the world, turned as the tent is (a quarter turn: local −x looks south).
    const at = (lx: number, lz: number): P2 => ({ x: TENT.x + lz, z: TENT.z - lx });
    for (const [lx, lz] of [[tx - 0.5, tz - 0.7], [tx + 0.5, tz - 0.7], [1.9, -1.1]] as const) {
      person({ style: 'everyday', vest: 0x7a3a9a }, at(lx, lz), lz < -2 ? Math.PI / 2 : 0, 'festival', 'talk', 'checker');
    }
    for (let k = 0; k < 4; k++) person({ style: k % 2 ? 'raver' : 'queerRave' }, at(tx - 0.4 + k * 0.05, tz + 0.7 + k * 0.65), -Math.PI / 2, 'festival', 'stand', 'festival');
    // Two crouched at the table's end, looking at the leaflets.
    for (const k of [0, 1]) person({ style: 'student', extra: 'backpack' }, at(tx + 1.3 + k * 0.55, tz + 0.75), -Math.PI / 2 + (k ? 0.5 : -0.3), 'festival', 'crouch', 'festival');
    seats.forEach(([x, z], k) => person({ style: k % 3 ? 'raver' : 'student' }, at(x, z - (k % 2 ? 0 : 0.05)), k % 2 ? 0 : -Math.PI / 2, 'festival', 'sit', 'festival', k % 2 ? 0.12 : 0));
    // The DJ, and people dancing on the grass in front of the decks.
    person({ style: 'technoBlack' }, at(-TENT.w / 2 - 0.7, 0), Math.PI / 2 + Math.PI, 'festival', 'dance', 'festival');
    for (let k = 0; k < 6; k++) person({ style: ['raver', 'queerRave', 'hiphop'][k % 3] as 'raver' }, at(-TENT.w / 2 - 2.4 - (k % 2) * 0.9, -2 + k * 0.8), Math.PI / 2, 'festival', 'dance', 'festival');
    // A heart balloon on a long string from the mast.
    balloon = new Group();
    const red = mat(0xd82a3a);
    for (const x of [-0.25, 0.25]) add(balloon, new Mesh(new SphereGeometry(0.34, 10, 8), red)).position.set(x, 0.1, 0);
    const tip = add(balloon, new Mesh(new ConeGeometry(0.5, 0.6, 10), red));
    tip.rotation.z = Math.PI;
    tip.position.y = -0.25;
    const m0 = { x: TENT.x + 0.4, z: TENT.z };
    balloon.position.set(m0.x, TENT.peak + 3.2, m0.z);
    balloon.userData.base = { ...m0, y: TENT.peak + 3.2 };
    moving.add(balloon);
    add(moving, box(0.01, 3.0, 0.01, rope, m0.x, TENT.peak + 0.3, m0.z));
    // Portable toilets by the picnic tables, west of the tent.
    const loo = add(root, new Group());
    for (const [k, x] of [[0, FESTIVAL.x1 - 11.2], [1, FESTIVAL.x1 - 10]] as const) {
      const c = [0x2a6ab0, 0x3a9a4a][k];
      add(loo, box(1.05, 2.2, 1.05, mat(c), x, 0, FESTIVAL.z0 + 7.6));
      add(loo, box(1.12, 0.12, 1.12, mat(0xe8e2d8), x, 2.2, FESTIVAL.z0 + 7.6));
      add(loo, box(0.7, 1.7, 0.02, mat(0xe8e2d8), x, 0.1, FESTIVAL.z0 + 8.13));
    }
  }

  // ------------------------------------------------ the rooftop party, its building's face, the neon and the billboard
  const decks = allBuildings()
    .map((b) => ({ b, deck: b.deck ?? { x0: b.x0 + 1, x1: b.x1 - 1, z0: b.z0 + 1, z1: b.z1 - 1 } }))
    .filter(({ b, deck }) => flatRoofTop(b) !== null && !roofClaimed(b.id) && deck.x1 - deck.x0 > 5 && deck.z1 - deck.z0 > 5 && Math.abs((b.x0 + b.x1) / 2) < DISTRICT - 10 && Math.abs((b.z0 + b.z1) / 2) < DISTRICT - 8)
    .sort((a, b) => Math.hypot((a.b.x0 + a.b.x1) / 2 - 15, (a.b.z0 + a.b.z1) / 2 - 38) - Math.hypot((b.b.x0 + b.b.x1) / 2 - 15, (b.b.z0 + b.b.z1) / 2 - 38));
  const host: CityBuilding | undefined = decks[0]?.b;
  let ball: Mesh | null = null;
  let spots: { m: Mesh; a: number }[] = [];
  if (host) {
    const d = decks[0].deck;
    // The roof is ours now: terraces, tarps and rooftop rooms built later leave it be.
    claimRoof([host.id]);
    const roofY = flatRoofTop(host) as number;
    const w = d.x1 - d.x0, dd = d.z1 - d.z0;
    // Lay the deck out along its longer side: DJ at one end, the dance floor, the sunbathing and the garden at the other.
    const alongX = w >= dd;
    const L = Math.max(w, dd), S = Math.min(w, dd);
    const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
    /** A deck point `a` along its length (−L/2…L/2) and `b` across (−S/2…S/2). */
    const on = (a: number, b: number): P2 => (alongX ? { x: cx + a, z: cz + b } : { x: cx + b, z: cz + a });
    const g = add(root, new Group());
    g.position.set(0, roofY, 0);
    const put = (o: Object3D, p: P2, rot = 0) => { o.position.set(p.x, 0, p.z); o.rotation.y = rot + (alongX ? 0 : Math.PI / 2); g.add(o); return o; };
    const piece = (w0: number, h0: number, d0: number, m: Material, p: P2, y = 0) => { const o = box(w0, h0, d0, m, 0, 0, 0); put(o, p); o.position.y = y; return o; };
    // String lights round the deck on posts.
    const bulb = glowMat(0x5a4a20, 0xffd070, 1.2);
    const corners = [on(-L / 2 + 0.3, -S / 2 + 0.3), on(L / 2 - 0.3, -S / 2 + 0.3), on(L / 2 - 0.3, S / 2 - 0.3), on(-L / 2 + 0.3, S / 2 - 0.3)];
    corners.forEach((p, k) => {
      const q = corners[(k + 1) % 4];
      add(g, cylinder(0.03, 2.0, mat(0x3a3a3c), 5, p.x, 0, p.z));
      const n = Math.max(4, Math.round(Math.hypot(q.x - p.x, q.z - p.z) / 1.1));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        add(g, box(0.1, 0.1, 0.1, bulb, p.x + (q.x - p.x) * t, 1.9 - Math.sin(t * Math.PI) * 0.35, p.z + (q.z - p.z) * t));
      }
    });
    // The DJ end: decks and speakers; a crate bar beside.
    const dj = -L / 2 + 1.0;
    piece(S > 5 ? 1.6 : 1.2, 0.85, 0.6, mat(0x1a1a1c), on(dj, 0));
    piece(0.5, 0.05, 0.35, glowMat(0x202a3a, 0x8ac0ff, 0.7), on(dj, -0.2), 0.86);
    for (const s of [-1, 1]) piece(0.45, 1.1, 0.4, mat(0x141416), on(dj - 0.2, s * (S / 2 - 0.6)));
    piece(0.9, 0.6, 0.5, mat(0x6a4426), on(dj + 1.3, S / 2 - 0.5));
    for (let k = 0; k < 4; k++) add(g, cylinder(0.04, 0.24, mat(0x2a6a2a), 6, on(dj + 1.05 + k * 0.15, S / 2 - 0.5).x, 0.6, on(dj + 1.05 + k * 0.15, S / 2 - 0.5).z));
    // The disco ball over the dance floor, turning, throwing coloured spots.
    const floor = on(dj + Math.min(4.2, L * 0.3), 0);
    add(g, cylinder(0.03, 2.6, mat(0x8a8c8e), 5, floor.x + (alongX ? 0 : S / 2 - 0.4), 0, floor.z + (alongX ? S / 2 - 0.4 : 0)));
    ball = new Mesh(new IcosahedronGeometry(0.32, 1), vehicleMat(0xd8dadc, 2));
    ball.position.set(floor.x, roofY + 2.6, floor.z);
    moving.add(ball);
    spots = [0xff4fa8, 0x4ff0ff, 0xb8ff4a, 0xf0e040].map((c, k) => {
      const m = new Mesh(new CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }));
      m.position.y = roofY + 0.03;
      moving.add(m);
      return { m, a: (k * Math.PI) / 2 };
    });
    // Dancers on a loose grid over the floor, a body's width apart, none under the ball's pole.
    const floorLen = Math.min(L * 0.45, 6);
    let n = 0;
    for (let a = -floorLen / 2; a <= floorLen / 2 && n < 9; a += 1.0) {
      for (let b = -S / 2 + 1.0; b <= S / 2 - 1.0 && n < 9; b += 1.0) {
        const p = on(dj + Math.min(4.2, L * 0.3) + a + (random() - 0.5) * 0.2, b + (random() - 0.5) * 0.2);
        if (Math.hypot(p.x - floor.x, p.z - floor.z) < 0.7) continue;
        person({ style: ['raver', 'queerRave', 'hiphop', 'student'][n % 4] as 'raver' }, p, random() * Math.PI * 2, 'party', 'dance', 'party', roofY);
        n++;
      }
    }
    person({ style: 'technoBlack' }, on(dj + 0.55, 0), alongX ? -Math.PI / 2 : Math.PI, 'party', 'talk', 'party', roofY);
    // Past the floor: a sunbather on a towel, two beach chairs, bottles; the roof garden and its donkey at the far end.
    const rest = Math.min(L / 2 - 2.4, dj + Math.min(4.2, L * 0.3) + floorLen / 2 + 1.4);
    piece(1.8, 0.02, 0.8, clothMat(0x2a8ac0), on(rest, -S / 4));
    const sunbather = person({ style: 'everyday' }, on(rest, -S / 4), alongX ? Math.PI / 2 : 0, 'day', 'stand', undefined, roofY + 0.05);
    sunbather.lying = true;
    for (const [k, c] of [[0, 0xe8642a], [1, 0xd8c040]] as const) {
      const p = on(rest + (k ? 0.9 : -0.2), S / 4 + 0.1);
      const seat = piece(0.55, 0.04, 1.2, clothMat(c), p, 0.32);
      seat.rotation.x = alongX ? 0 : 0;
      piece(0.55, 0.6, 0.04, clothMat(c), on(rest + (k ? 0.9 : -0.2), S / 4 + 0.65), 0.3);
    }
    for (let k = 0; k < 5; k++) { const p = on(rest - 0.6 + k * 0.12, -S / 4 + 0.6); add(g, cylinder(0.04, 0.25, mat(k % 2 ? 0x2a6a2a : 0x8a5a1a), 6, p.x, 0, p.z)); }
    const gardenAt = L / 2 - 0.8;
    if (gardenAt - rest > 1.6) {
      for (let k = 0; k < 3; k++) {
        const p = on(gardenAt, -S / 2 + 0.8 + k * ((S - 1.6) / 2));
        piece(0.6, 0.45, 0.6, mat(0x6a4a2a), p);
        add(g, new Mesh(new SphereGeometry(0.3, 6, 4), mat(0x3a7a32))).position.set(p.x, 0.75, p.z);
      }
      const dk = add(g, new Group());
      const dp = on(gardenAt - 1.3, 0);
      dk.position.set(dp.x, 0, dp.z);
      dk.rotation.y = alongX ? -Math.PI / 2 : Math.PI;
      donkey(dk);
      perches.push({ at: dp, y: roofY + 1.15 });
    }
    // Leaf flags on the parapet, the venue's lit sign on the front edge.
    const flag = new MeshLambertMaterial({ map: (() => { const [c, cx2] = canvas(64, 48); cx2.fillStyle = '#f2f0ea'; cx2.fillRect(0, 0, 64, 48); leaf(cx2, 32, 34, 0.42); return texture(c); })(), side: DoubleSide });
    for (const p of [corners[1], corners[2]]) {
      add(g, cylinder(0.025, 2.6, mat(0x8a8c8e), 5, p.x, 0, p.z));
      add(g, new Mesh(new PlaneGeometry(0.8, 0.55), flag)).position.set(p.x + 0.42, 2.3, p.z);
    }
    const front = host.front === '-x' || host.front === '-z' ? null : host.front ?? '+z';
    const chill = signBoard('CHILL ROOM', 3.2, 0.8, '#ffffff', '#141418', 0.9);
    if (front === '+x') add(root, chill.mesh, Math.PI / 2).position.set(host.x1 + 0.08, roofY - 0.2, (host.z0 + host.z1) / 2);
    else add(root, chill.mesh).position.set((host.x0 + host.x1) / 2, roofY - 0.2, host.z1 + 0.08);
    perches.push({ at: corners[2], y: roofY + 2.0 });
    // Down the face the camera sees: the banner, the round mural, a row of posters on the first floor.
    const faceSouth = front !== '+x';
    const onFace = (o: Object3D, along: number, y: number) => {
      if (faceSouth) o.position.set((host.x0 + host.x1) / 2 + along, y, host.z1 + 0.06);
      else { o.position.set(host.x1 + 0.06, y, (host.z0 + host.z1) / 2 - along); o.rotation.y = Math.PI / 2; }
      root.add(o);
    };
    const faceW = faceSouth ? host.x1 - host.x0 : host.z1 - host.z0;
    const btex = bannerTexture();
    const bh = Math.min(roofY - 4, 6);
    if (bh > 2) onFace(new Mesh(new PlaneGeometry(1.6, bh), new MeshLambertMaterial({ map: btex, emissive: new Color(0xffffff), emissiveMap: btex, emissiveIntensity: 0.22 })), faceW / 2 - 1.2, roofY - 0.6 - bh / 2);
    const mtex = muralTexture();
    if (faceW > 7 && roofY > 8) onFace(new Mesh(new CircleGeometry(1.7, 28), new MeshLambertMaterial({ map: mtex })), -faceW / 2 + 2.2, roofY - 3.2);
    for (let k = 0; k < Math.min(5, Math.floor(faceW / 1.3)); k++) {
      const t = posterTexture(k);
      onFace(new Mesh(new PlaneGeometry(0.7, 1.0), new MeshLambertMaterial({ map: t })), -faceW / 2 + 0.9 + k * 1.15, 4.3);
    }
    // The nearest ordinary building to the south or east carries a vertical neon MOTEL sign and a billboard.
    const neighbour = allBuildings()
      .filter((b) => b.id !== host.id && !lookClaimed(b.id) && b.height > 8 && Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz) < 45)
      .sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - cx, (a.z0 + a.z1) / 2 - cz) - Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz))[0];
    if (neighbour) {
      const f = frontFrame(neighbour);
      const right = { x: Math.cos(f.rot), z: -Math.sin(f.rot) };
      const nrm = { x: Math.sin(f.rot), z: Math.cos(f.rot) };
      // The blade sign at the front's right-hand corner, standing out from the wall, lit both sides.
      const blade = new MeshLambertMaterial({ map: (() => { const [c, g2] = canvas(32, 160); g2.fillStyle = '#18081a'; g2.fillRect(0, 0, 32, 160); g2.fillStyle = '#ff4fa8'; g2.font = 'bold 26px sans-serif'; g2.textAlign = 'center'; 'MOTEL'.split('').forEach((ch, k) => g2.fillText(ch, 16, 28 + k * 30)); return texture(c); })(), emissive: new Color(0xffffff), emissiveIntensity: 1.1, side: DoubleSide });
      blade.emissiveMap = blade.map;
      const bm = new Mesh(new PlaneGeometry(0.6, 2.8), blade);
      bm.position.set(f.x + right.x * (f.width / 2 - 0.3) + nrm.x * 0.6, Math.min(neighbour.height - 1.6, 7.2), f.z + right.z * (f.width / 2 - 0.3) + nrm.z * 0.6);
      bm.rotation.y = f.rot + Math.PI / 2;
      root.add(bm);
      // The billboard: a painted face (one of the game's portraits) in a frame, high on the front.
      if (f.width > 6 && neighbour.height > 9) {
        const bill = new Group();
        bill.position.set(f.x - right.x * 1.2 + nrm.x * 0.08, neighbour.height - 3.0, f.z - right.z * 1.2 + nrm.z * 0.08);
        bill.rotation.y = f.rot;
        root.add(bill);
        add(bill, box(2.3, 2.8, 0.08, mat(0x2a2a2c), 0, -1.4, -0.05));
        const face = new MeshLambertMaterial({ color: 0xffffff });
        new TextureLoader().load(`${import.meta.env.BASE_URL}portraits/dusk-v3/queer-rave.webp`, (t) => { t.colorSpace = SRGBColorSpace; face.map = t; face.needsUpdate = true; });
        add(bill, new Mesh(new PlaneGeometry(2.0, 2.5), face)).position.set(0, 0, 0.01);
      }
    }
  }

  // ------------------------------------------------ the street: garden, works, fruit, drinks, kiosk
  // On the ring's inner south pavement, at the kerb (the walking lines and the skaters keep to the middle).
  const pave = STREETS.ringSouth.pavements[0];
  const kerbZ = pave.z1 - 0.55;
  const room = (x: number, z: number, w: number, d: number) => groundY(x, z) >= PAVEMENT_TOP && clearOfWalks(x, z, 0, w, d) && !pool.blocked(x, z, Math.max(w, d) / 2);
  let cursor = -42;
  /** The next clear stretch of kerb `len` long, past the last thing put down. */
  const next = (len: number, w: number, d: number): number | null => {
    for (let x = cursor; x < 44; x += 1) {
      let ok = true;
      for (let t = -len / 2; t <= len / 2 && ok; t += 1) ok = room(x + t, kerbZ, w, d);
      if (ok) { cursor = x + len / 2 + 2; return x; }
    }
    return null;
  };
  const street = add(root, new Group());
  const gardenX = next(5, 1.3, 0.6);
  if (gardenX !== null) {
    const leafs = [0x3a7a32, 0x2e6a2a, 0x4a8a3a];
    for (let k = 0; k < 3; k++) {
      const x = gardenX - 2 + k * 2;
      add(street, box(1.6, 0.5, 0.6, mat(0x6a4a2a), x, PAVEMENT_TOP, kerbZ));
      add(street, box(1.5, 0.04, 0.5, mat(0x2e2418), x, PAVEMENT_TOP + 0.5, kerbZ));
      for (let p = 0; p < 4; p++) {
        const h = 0.4 + random() * 0.5;
        add(street, cylinder(0.02, h, mat(0x3a5a2a), 4, x - 0.55 + p * 0.37, PAVEMENT_TOP + 0.5, kerbZ));
        const bush = add(street, new Mesh(new SphereGeometry(0.2 + random() * 0.1, 6, 4), mat(leafs[p % 3])));
        bush.position.set(x - 0.55 + p * 0.37, PAVEMENT_TOP + 0.5 + h, kerbZ);
        bush.scale.y = 1.3;
      }
      pool.addSolid(x, kerbZ, 0, 1.6, 0.6);
    }
  }
  const conesX = next(3, 1.2, 0.8);
  if (conesX !== null) {
    const orange = mat(0xe8641e);
    const white = mat(0xf2f0ea);
    for (const [x, z, lying] of [[-0.9, 0, false], [-0.4, 0.15, false], [0.1, -0.1, false], [0.6, 0.1, false], [-0.2, -0.1, true], [0.35, 0.2, true], [1.0, -0.05, false]] as const) {
      const c = add(street, new Group());
      c.position.set(conesX + x, PAVEMENT_TOP + (lying ? 0.12 : 0), kerbZ + z);
      if (lying) c.rotation.set(0, random() * 6, Math.PI / 2);
      add(c, box(0.32, 0.04, 0.32, mat(0x1a1a1a), 0, 0, 0));
      add(c, cylinder(0.12, 0.62, orange, 8, 0, 0.04, 0));
      add(c, cylinder(0.125, 0.08, white, 8, 0, 0.36, 0));
    }
    add(street, box(1.4, 0.2, 0.05, orange, conesX, PAVEMENT_TOP + 0.75, kerbZ + 0.3));
    for (const x of [-0.65, 0.65]) add(street, box(0.05, 0.75, 0.05, white, conesX + x, PAVEMENT_TOP, kerbZ + 0.3));
    pool.addSolid(conesX, kerbZ, 0, 2.2, 0.8);
  }
  const cartX = next(2, 1.4, 0.9);
  if (cartX !== null) {
    const g = add(street, new Group());
    g.position.set(cartX, PAVEMENT_TOP, kerbZ);
    add(g, box(1.3, 0.55, 0.7, mat(0x7a5a3a), 0, 0.35, 0));
    for (const x of [-0.45, 0.45]) add(g, cylinder(0.3, 0.04, mat(0x1a1a1a), 12, x, 0.3, -0.36)).rotation.x = Math.PI / 2;
    for (let k = 0; k < 9; k++) add(g, new Mesh(new SphereGeometry(0.07, 5, 4), mat([0xe8a020, 0xe8642a, 0xd8c040, 0x6aa03a][k % 4]))).position.set(-0.5 + (k % 5) * 0.25, 0.97, -0.15 + Math.floor(k / 5) * 0.3);
    add(g, cylinder(0.025, 2.0, mat(0x8a8c8e), 5, 0.5, 0.9, 0.2));
    const top = add(g, new Mesh(new CircleGeometry(1.0, 8).rotateX(-Math.PI / 2), clothMat(0xd83a2a)));
    top.position.set(0.5, 2.9, 0.2);
    for (let k = 0; k < 4; k++) add(g, box(0.18, 0.015, 1.9, clothMat(0xf2f0ea), 0.5, 2.91, 0.2)).rotation.y = (k * Math.PI) / 4;
    perches.unshift({ at: { x: cartX + 0.5, z: kerbZ + 0.2 }, y: PAVEMENT_TOP + 2.95 });
    pool.addSolid(cartX, kerbZ, 0, 1.4, 0.8);
    person({ style: 'older', extra: 'jacket' }, { x: cartX - 0.2, z: kerbZ - 0.75 }, 0, 'day', 'talk', 'fruit');
  }
  const drinksX = next(2.6, 1.0, 0.9);
  if (drinksX !== null) {
    // A corner drink stop: a POLA board, a crate stack, a plastic table with bottles, people on chairs either side.
    const g = add(street, new Group());
    g.position.set(drinksX, PAVEMENT_TOP, kerbZ);
    const pola = signBoard('POLA', 0.9, 0.4, '#ffffff', '#c8202a', 0.6);
    add(g, box(0.05, 1.0, 0.05, mat(0x3a3a3c), -1.2, 0, 0));
    add(g, pola.mesh).position.set(-1.2, 1.15, 0.03);
    for (let k = 0; k < 4; k++) add(g, box(0.5, 0.28, 0.35, mat(k % 2 ? 0xd0a020 : 0xc8202a), -1.25 + (k % 2) * 0.05, 0.02 + Math.floor(k / 2) * 0.28 + (k > 1 ? 0 : 0), -0.25 + (k % 2) * 0.02));
    add(g, box(0.7, 0.04, 0.6, mat(0xe8e2d8), 0.2, 0.7, 0));
    for (const [lx, lz] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]] as const) add(g, box(0.03, 0.7, 0.03, mat(0xe8e2d8), 0.2 + lx * 0.9, 0, lz * 0.9));
    for (let k = 0; k < 4; k++) add(g, cylinder(0.035, 0.24, mat(0x7a4a1a), 6, 0.05 + k * 0.1, 0.74, (k % 2) * 0.1 - 0.05));
    for (const s of [-1, 1]) {
      chair(g, 0.2 + s * 0.65, 0, s < 0 ? Math.PI / 2 : -Math.PI / 2, 0xe8e2d8);
      person({ style: 'everyday', extra: 'none' }, { x: drinksX + 0.2 + s * 0.65, z: kerbZ }, s < 0 ? Math.PI / 2 : -Math.PI / 2, 'late', 'sit', 'pub');
    }
    pool.addSolid(drinksX, kerbZ, 0, 2.6, 0.9);
  }
  const kioskX = next(1.8, 1.6, 1.0);
  if (kioskX !== null) {
    // A kiosk of newspapers and books: a green booth, magazines on its racks, books laid out, its seller.
    const g = add(street, new Group());
    g.position.set(kioskX, PAVEMENT_TOP, kerbZ);
    add(g, box(1.5, 1.9, 0.8, mat(0x2a5a3a), 0, 0, 0.05));
    add(g, box(1.7, 0.08, 1.05, mat(0x1e3a2a), 0, 1.92, -0.05));
    add(g, box(1.2, 0.5, 0.04, glowMat(0x3a3a20, 0xfff0c0, 0.5), 0, 1.25, -0.36));
    for (let k = 0; k < 8; k++) add(g, box(0.2, 0.28, 0.02, mat([0xc8308a, 0x2a6ab0, 0xf0d040, 0xe8e2d8, 0x3ab05a][k % 5]), -0.62 + (k % 4) * 0.4, 0.5 + Math.floor(k / 4) * 0.36, -0.37));
    add(g, box(1.3, 0.05, 0.3, mat(0x6a4426), 0, 0.42, -0.55));
    for (let k = 0; k < 6; k++) add(g, box(0.16, 0.05, 0.22, mat([0x8a2a2a, 0x2a4a7a, 0x3a6a3a][k % 3]), -0.5 + k * 0.2, 0.47, -0.55));
    pool.addSolid(kioskX, kerbZ, 0, 1.6, 1.0);
    person({ style: 'older' }, { x: kioskX + 0.95, z: kerbZ - 0.45 }, Math.PI, 'day', 'stand', 'fruit');
  }
  mergeStatic(root);

  // ------------------------------------------------ parrots between the perches
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
      const still = ctx.still;
      const fest = ctx.happenings.find((h) => h.id === 'festival');
      const party = ctx.clock >= PARTY_HOURS[0] && ctx.clock < PARTY_HOURS[1];
      for (const p of people) {
        const want = p.when === 'festival' ? !!fest && (p.a.voice === 'checker' || p.i % 3 < Math.ceil(3 * (fest?.crowd ?? 0)))
          : p.when === 'party' ? party : p.when === 'late' ? ctx.clock >= 1140 && ctx.clock < 1560 : ctx.clock < 1500;
        fade(p.a, want, dt, 0.4);
      }
      if (balloon) {
        const b = balloon.userData.base as { x: number; y: number; z: number };
        balloon.position.set(b.x + Math.sin(time * 0.6) * (still ? 0 : 0.25), b.y + Math.sin(time * 0.9) * (still ? 0 : 0.15), b.z + Math.cos(time * 0.5) * (still ? 0 : 0.2));
      }
      if (lasers) { lasers.visible = !!fest || ctx.clock > 1260; lasers.rotation.y += dt * (still ? 0 : 0.12); }
      if (ball) ball.rotation.y += dt * (still ? 0 : 0.8);
      for (const s of spots) {
        if (!ball) break;
        s.m.visible = party;
        s.a += dt * (still ? 0 : 0.6);
        s.m.position.x = ball.position.x + Math.cos(s.a) * 1.4;
        s.m.position.z = ball.position.z + Math.sin(s.a) * 1.0;
      }
      // Parrots: sit, now and then fly to another perch in an arc, flapping.
      for (const b of birds) {
        if (b.t >= 1) {
          for (const w of b.wings) w.rotation.z = 0;
          if ((b.wait -= dt) <= 0 && perches.length > 1 && !still) { b.from = b.to; b.to = (b.to + 1 + Math.floor(random() * (perches.length - 1))) % perches.length; b.t = 0; }
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
