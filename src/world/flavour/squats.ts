import { CanvasTexture, DoubleSide, Group, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { add, box, pixelTextTexture } from '../kit';
import { mat } from '../materials';
import { cityBuilding } from '../cityBuildings';
import { dynamic } from '../mergeStatic';
import { fade, type Actor } from './actors';
import type { Pack, PackDeps, SquatDoor } from './index';

/**
 * The squats look lived in and political: a black and red anarchist flag on
 * a pole out of an upper window, circle-A and other graffiti on the wall by
 * the door, a painted banner over it, and a resident punk with a red mohawk
 * leaning by the door. Rebuilt only when the squats change (a new door list);
 * nothing runs per frame but the punk's fade.
 */
const BANNER = 'HOUSES FOR PEOPLE';

/** One canvas of spray-painted tags, shared by every squat. */
function graffiti(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 128);
  // A circle-A in red, big.
  g.strokeStyle = '#c8202a';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(58, 64, 40, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(30, 104); g.lineTo(58, 18); g.lineTo(88, 104);
  g.moveTo(38, 74); g.lineTo(80, 74);
  g.stroke();
  // Tags and drips in black and white.
  g.font = 'bold 26px sans-serif';
  g.fillStyle = '#111111';
  g.fillText('NO PASARAN', 112, 48);
  g.fillStyle = '#e8e4d8';
  g.font = 'bold 22px sans-serif';
  g.fillText('DIY OR DIE', 120, 92);
  g.strokeStyle = '#2a6ab8';
  g.lineWidth = 4;
  g.beginPath();
  for (let x = 110; x < 250; x += 14) { g.moveTo(x, 104); g.quadraticCurveTo(x + 7, 112 + (x % 3) * 4, x + 14, 104); }
  g.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A black and red flag split on the diagonal, the anarcho-syndicalist colours. */
function flagTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b8141c';
  g.fillRect(0, 0, 48, 32);
  g.fillStyle = '#0e0e10';
  g.beginPath();
  g.moveTo(0, 32); g.lineTo(48, 32); g.lineTo(48, 0); g.closePath();
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The city building whose footprint holds (x, z), if any. */
function buildingAt(x: number, z: number) {
  for (let id = 0; ; id++) {
    const b = cityBuilding(id);
    if (!b) return null;
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b;
  }
}

/** The tallest building within 16 m on the camera's side (south and east) of `b`. */
function tallestInFront(b: { x0: number; x1: number; z0: number; z1: number }): number {
  let h = 0;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  for (let id = 0; ; id++) {
    const o = cityBuilding(id);
    if (!o) return h;
    const ox = (o.x0 + o.x1) / 2, oz = (o.z0 + o.z1) / 2;
    if (o !== b && ox + oz > cx + cz && Math.hypot(ox - cx, oz - cz) < 16) h = Math.max(h, o.height);
  }
}

/** A hanging banner: black and red on the diagonal, a white circle-A in the middle. */
function bannerTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b8141c';
  g.fillRect(0, 0, 64, 96);
  g.fillStyle = '#0e0e10';
  g.beginPath();
  g.moveTo(0, 96); g.lineTo(64, 96); g.lineTo(64, 0); g.closePath();
  g.fill();
  g.strokeStyle = '#f0ece0';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(32, 48, 20, 0, Math.PI * 2);
  g.moveTo(18, 66); g.lineTo(32, 22); g.lineTo(46, 66);
  g.moveTo(22, 52); g.lineTo(42, 52);
  g.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildSquats({ pool, scene }: PackDeps): Pack {
  const root = dynamic(new Group());
  scene.add(root);
  const tagMat = new MeshLambertMaterial({ map: graffiti(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const flagMat = new MeshLambertMaterial({ map: flagTexture(), side: DoubleSide });
  const bannerMat = new MeshLambertMaterial({ map: pixelTextTexture(BANNER, '#141414', '#e8e2d0'), side: DoubleSide });
  const tagGeo = new PlaneGeometry(2.6, 1.3);
  const flagGeo = new PlaneGeometry(1.2, 0.8).translate(0.6, -0.4, 0);
  const bannerGeo = new PlaneGeometry(3.4, 0.5);
  const hangMat = new MeshLambertMaterial({ map: bannerTexture(), side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const hangGeo = new PlaneGeometry(2.2, 3.3).translate(0, -1.65, 0);
  const punks: Actor[] = [];
  const mohawks: Group[] = [];
  let doors: readonly SquatDoor[] | null = null;

  const rebuild = (list: readonly SquatDoor[]) => {
    for (const c of [...root.children]) root.remove(c);
    doors = list;
    list.forEach((d, i) => {
      const face = Math.atan2(d.nx, d.nz);
      // The wall's face: the door point is 0.6 m out from it.
      const wx = d.x - d.nx * 0.6;
      const wz = d.z - d.nz * 0.6;
      const tags = new Mesh(tagGeo, tagMat);
      tags.position.set(wx + d.nx * 0.03 + d.ax * 2.4, 1.1, wz + d.nz * 0.03 + d.az * 2.4);
      tags.rotation.y = face;
      root.add(tags);
      const banner = new Mesh(bannerGeo, bannerMat);
      banner.position.set(wx + d.nx * 0.05, 3.1, wz + d.nz * 0.05);
      banner.rotation.y = face;
      root.add(banner);
      // The flag: a pole out of a first-floor window, the cloth hanging off it.
      const pole = add(root, new Group());
      pole.position.set(wx - d.ax * 1.6, 4.4, wz - d.az * 1.6);
      pole.rotation.y = face;
      add(pole, box(0.04, 0.04, 1.4, mat(0x4a3a2a), 0, 0, 0.7)).rotation.x = -0.35;
      const cloth = new Mesh(flagGeo, flagMat);
      cloth.position.set(0, 0.42, 1.3);
      cloth.rotation.y = Math.PI / 2;
      pole.add(cloth);
      // And on the roof, a taller pole with the same flag, so the squat reads from across the city.
      const b = buildingAt(wx - d.nx * 0.8, wz - d.nz * 0.8);
      if (b) {
        const roof = add(root, new Group());
        roof.position.set(wx - d.nx * 0.6 + d.ax * 0.8, b.height, wz - d.nz * 0.6 + d.az * 0.8);
        // Tall enough to show over the neighbours between it and the camera (south and east), within reason.
        const pole = Math.min(8, Math.max(2.6, tallestInFront(b) + 1.6 - b.height));
        add(roof, box(0.05, pole, 0.05, mat(0x3a3a3e), 0, 0, 0));
        const top = new Mesh(flagGeo, flagMat);
        top.scale.setScalar(1.4);
        top.position.set(0, pole - 0.05, 0);
        top.rotation.y = face + Math.PI / 2;
        roof.add(top);
      }
      // A big banner hung down the squat's front (the south or east face, which the camera sees), from the roof edge.
      if (b) {
        const south = b.x1 - b.x0 >= b.z1 - b.z0;
        const hang = new Mesh(hangGeo, hangMat);
        hang.position.set(south ? (b.x0 + b.x1) / 2 : b.x1 + 0.04, b.height - 0.25, south ? b.z1 + 0.04 : (b.z0 + b.z1) / 2);
        hang.rotation.y = south ? 0 : Math.PI / 2;
        root.add(hang);
      }
      // A resident punk leaning by the door, a red mohawk on top.
      let a = punks[i];
      if (!a) {
        a = pool.add({ style: 'punk', extra: 'jacket', dress: { height: 1.78, hairStyle: 5 } });
        a.voice = 'punk';
        a.pose = 'stand';
        const m = new Group();
        add(m, box(0.04, 0.12, 0.24, mat(0xd82a3a), 0, 1.72, -0.02));
        m.traverse((o) => { o.castShadow = false; });
        root.parent?.add(m);
        a.attach = m;
        punks.push(a);
        mohawks.push(m);
      }
      a.x = d.x - d.ax * 2.4 - d.nx * 0.25;
      a.z = d.z - d.az * 2.4 - d.nz * 0.25;
      a.heading = face;
    });
  };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const a of punks) a.shown = 0;
    },
    update(dt, ctx) {
      if (ctx.squatDoors !== doors) rebuild(ctx.squatDoors);
      punks.forEach((a, i) => fade(a, i < ctx.squatDoors.length && ctx.clock < 2400, dt, 0.6));
    },
  };
}
