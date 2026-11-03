import { BufferGeometry, CanvasTexture, CircleGeometry, Color, Group, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { add, box, cylinder } from '../kit';
import { DISTRICT, MAIN_CROSSINGS, PAVEMENT_TOP, ROAD, STREETS, clearOfWalks, groundY, type P2, type Rect } from '../layout';
import { mat } from '../materials';
import { mergeStatic } from '../mergeStatic';
import type { Pack, PackDeps } from './index';

/**
 * Traffic signs on the district's streets, as a city would put them up:
 * one-way arrows where the one-way streets start and no-entry signs where
 * they end, give-way signs where the cross streets meet the ring road and
 * priority-road diamonds at the ring's own corners, crossing signs either side
 * of each zebra, parking signs along the parking kerbs, a 30 zone sign where
 * each street enters the district, a street-name plate on every corner pole,
 * and blue direction boards where the main and east streets meet the ring.
 * Every face is drawn once onto one atlas, so the whole pack is one textured
 * draw and one for the poles. Poles stand only on a pavement, clear of the
 * walking lines and of anything solid.
 */

type Face = 'stop' | 'giveWay' | 'noEntry' | 'oneWay' | 'zone30' | 'crossing' | 'parking' | 'priority';
const FACES: readonly Face[] = ['stop', 'giveWay', 'noEntry', 'oneWay', 'zone30', 'crossing', 'parking', 'priority'];
const NAMES = ['MAIN STREET', 'NORTH STREET', 'SOUTH STREET', 'EAST STREET', 'RING ROAD'] as const;
type Name = (typeof NAMES)[number];

/** The atlas: a row of 64 px sign faces, a row of name plates (128 by 32), a row of direction boards (256 by 64). */
const ATLAS = { w: 512, h: 256, cell: 64, plate: { w: 128, h: 32, y: 64 }, board: { w: 256, h: 64, y: 128 } };

function drawAtlas(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = ATLAS.w;
  c.height = ATLAS.h;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const S = ATLAS.cell;
  const red = '#c8202a';
  const blue = '#1e4aa8';
  const ring = (x: number, y: number, r: number, fill: string, stroke: string, lw: number) => {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = stroke; g.stroke();
  };
  const text = (s: string, x: number, y: number, size: number, colour: string) => {
    g.fillStyle = colour; g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  };
  FACES.forEach((f, i) => {
    const x = i * S + S / 2;
    const y = S / 2;
    if (f === 'stop') {
      g.beginPath();
      for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; g.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); }
      g.closePath(); g.fillStyle = red; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#ffffff'; g.stroke();
      text('STOP', x, y + 1, 15, '#ffffff');
    } else if (f === 'giveWay') {
      g.beginPath(); g.moveTo(x - 29, y - 25); g.lineTo(x + 29, y - 25); g.lineTo(x, y + 27); g.closePath();
      g.fillStyle = red; g.fill();
      g.beginPath(); g.moveTo(x - 19, y - 19); g.lineTo(x + 19, y - 19); g.lineTo(x, y + 14); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
    } else if (f === 'noEntry') {
      ring(x, y, 29, red, red, 1);
      g.fillStyle = '#ffffff'; g.fillRect(x - 20, y - 5, 40, 10);
    } else if (f === 'oneWay') {
      g.fillStyle = blue; g.fillRect(x - 29, y - 29, 58, 58);
      g.fillStyle = '#ffffff'; g.fillRect(x - 20, y - 5, 26, 10);
      g.beginPath(); g.moveTo(x + 4, y - 15); g.lineTo(x + 22, y); g.lineTo(x + 4, y + 15); g.closePath(); g.fill();
    } else if (f === 'zone30') {
      g.fillStyle = '#f2f0ea'; g.fillRect(x - 29, y - 29, 58, 58);
      ring(x, y - 3, 19, '#ffffff', red, 5);
      text('30', x, y - 2, 18, '#101010');
      text('ZONE', x, y + 23, 9, '#101010');
    } else if (f === 'crossing') {
      g.fillStyle = blue; g.fillRect(x - 29, y - 29, 58, 58);
      g.beginPath(); g.moveTo(x, y - 23); g.lineTo(x + 24, y + 20); g.lineTo(x - 24, y + 20); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
      // A walker on stripes.
      g.fillStyle = '#101010';
      for (let k = 0; k < 4; k++) g.fillRect(x - 15 + k * 8, y + 13, 5, 4);
      g.beginPath(); g.arc(x + 1, y - 9, 3, 0, Math.PI * 2); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#101010'; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x - 2, y + 4); g.lineTo(x - 7, y + 11); g.moveTo(x - 2, y + 4); g.lineTo(x + 5, y + 11); g.moveTo(x, y - 2); g.lineTo(x + 6, y + 1); g.stroke();
    } else if (f === 'parking') {
      g.fillStyle = blue; g.fillRect(x - 29, y - 29, 58, 58);
      text('P', x, y + 2, 42, '#ffffff');
    } else {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
      g.fillStyle = '#ffffff'; g.fillRect(-21, -21, 42, 42);
      g.fillStyle = '#f0c020'; g.fillRect(-15, -15, 30, 30);
      g.restore();
    }
  });
  NAMES.forEach((n, i) => {
    const x = (i % 4) * ATLAS.plate.w;
    const y = ATLAS.plate.y + Math.floor(i / 4) * ATLAS.plate.h;
    g.fillStyle = '#1e3a7a'; g.fillRect(x + 1, y + 1, ATLAS.plate.w - 2, ATLAS.plate.h - 2);
    g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, ATLAS.plate.w - 6, ATLAS.plate.h - 6);
    text(n, x + ATLAS.plate.w / 2, y + ATLAS.plate.h / 2 + 1, 14, '#ffffff');
  });
  const boards = [
    [['CITY CENTRE', '↑'], ['HOSPITAL', '→'], ['STADIUM', '→']],
    [['CITY CENTRE', '↑'], ['STATION', '←'], ['PARK', '↓']],
  ];
  boards.forEach((rows, i) => {
    const x = i * ATLAS.board.w;
    const y = ATLAS.board.y;
    g.fillStyle = '#1e4aa8'; g.fillRect(x + 1, y + 1, ATLAS.board.w - 2, ATLAS.board.h - 2);
    g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, ATLAS.board.w - 8, ATLAS.board.h - 8);
    rows.forEach(([label, arrow], k) => {
      g.fillStyle = '#ffffff'; g.font = 'bold 15px sans-serif'; g.textBaseline = 'middle';
      g.textAlign = 'left'; g.fillText(label, x + 14, y + 15 + k * 17);
      g.textAlign = 'right'; g.fillText(arrow, x + ATLAS.board.w - 14, y + 15 + k * 17);
    });
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A face's shape, its UVs pointed at its cell of the atlas (texture y runs up). */
function faceGeometry(face: Face, size: number): BufferGeometry {
  const r = size / 2;
  const geo = face === 'stop' ? new CircleGeometry(r, 8, Math.PI / 8)
    : face === 'giveWay' ? new CircleGeometry(r, 3, -Math.PI / 2)
      : face === 'noEntry' ? new CircleGeometry(r, 18)
        : face === 'priority' ? new CircleGeometry(r * 0.95, 4)
          : new PlaneGeometry(size, size);
  const i = FACES.indexOf(face);
  return toCell(geo, i * ATLAS.cell, 0, ATLAS.cell, ATLAS.cell);
}

function toCell(geo: BufferGeometry, px: number, py: number, pw: number, ph: number): BufferGeometry {
  const uv = geo.getAttribute('uv');
  for (let k = 0; k < uv.count; k++) {
    uv.setXY(k, (px + uv.getX(k) * pw) / ATLAS.w, 1 - (py + (1 - uv.getY(k)) * ph) / ATLAS.h);
  }
  uv.needsUpdate = true;
  return geo;
}

const plateGeometry = (n: Name) => {
  const i = NAMES.indexOf(n);
  return toCell(new PlaneGeometry(1.15, 0.29), (i % 4) * ATLAS.plate.w, ATLAS.plate.y + Math.floor(i / 4) * ATLAS.plate.h, ATLAS.plate.w, ATLAS.plate.h);
};

/** A sign as put up: its place on the pavement, the faces on its pole (top first) and which way each looks. */
interface Post { at: P2; faces: { face: Face; look: number; flip?: boolean }[]; name?: { name: Name; look: number } }

export function buildSigns({ pool, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const atlas = drawAtlas();
  // Faintly lit at night, as retroreflective sheeting reads in headlights.
  const face = new MeshLambertMaterial({ map: atlas, emissive: new Color(0xffffff), emissiveMap: atlas, emissiveIntensity: 0.22, transparent: false, alphaTest: 0.5 });
  const pole = mat(0x8a8c8e);
  const back = mat(0x9a9c9e);

  // A pole is thin and its plates hang above head height: only its foot has to keep off the walking band.
  const room = (p: P2, r = 0.06) => groundY(p.x, p.z) >= PAVEMENT_TOP && clearOfWalks(p.x, p.z, 0, r * 2, r * 2) && !pool.blocked(p.x, p.z, Math.max(r, 0.18));
  const posts: Post[] = [];
  const near = (p: P2) => posts.some((q) => Math.hypot(q.at.x - p.x, q.at.z - p.z) < 2.2);
  const put = (p: Post) => { if (room(p.at) && !near(p.at)) posts.push(p); };
  /** The first of `spots` with room (a corner, then stepped back along either kerb). */
  const putFirst = (spots: readonly P2[], p: Omit<Post, 'at'>) => {
    const at = spots.find((q) => room(q) && !near(q));
    if (at) posts.push({ ...p, at });
  };

  const xStreets = { north: STREETS.north, south: STREETS.south, ringNorth: STREETS.ringNorth, ringSouth: STREETS.ringSouth };
  const zStreets = { main: STREETS.main, east: STREETS.east, ringWest: STREETS.ringWest, ringEast: STREETS.ringEast };
  const nameOf = (k: string): Name => (k === 'main' ? 'MAIN STREET' : k === 'north' ? 'NORTH STREET' : k === 'south' ? 'SOUTH STREET' : k === 'east' ? 'EAST STREET' : 'RING ROAD');
  // One-way streets and their flow: the north street eastbound, the south street westbound, the east street southbound.
  const flow: Partial<Record<string, P2>> = { north: { x: 1, z: 0 }, south: { x: -1, z: 0 }, east: { x: 0, z: 1 } };
  const ring = (k: string) => k.startsWith('ring');
  // `look`: the way a face looks (its normal), as a rotation about y (0 looks +z).
  const looking = (dx: number, dz: number) => Math.atan2(dx, dz);

  for (const [xk, xs] of Object.entries(xStreets)) {
    for (const [zk, zs] of Object.entries(zStreets)) {
      const xr: Rect = xs.road;
      const zr: Rect = zs.road;
      if (zr.x1 < xr.x0 || zr.x0 > xr.x1 || xr.z1 < zr.z0 || xr.z0 > zr.z1) continue;
      const corners = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => {
        const cx = sx < 0 ? zr.x0 : zr.x1;
        const cz = sz < 0 ? xr.z0 : xr.z1;
        // The corner itself, then back from it along each kerb (0.3 m in), clear of the zebras' walking lines.
        const spots: P2[] = [{ x: cx + sx * 0.4, z: cz + sz * 0.4 }];
        for (const d of [1.6, 2.8, 4.2]) spots.push({ x: cx + sx * 0.3, z: cz + sz * d }, { x: cx + sx * d, z: cz + sz * 0.3 });
        return { sx, sz, spots };
      });
      for (const c of corners) {
        const faces: Post['faces'] = [];
        const fx = flow[xk];
        const fz = flow[zk];
        if (ring(xk) && ring(zk)) faces.push({ face: 'priority', look: looking(-c.sx, 0) });
        else if (ring(xk) || ring(zk)) {
          // The street meeting the ring gives way: the sign looks back along it, at its traffic coming up.
          if (ring(xk)) faces.push({ face: 'giveWay', look: looking(0, c.sz) });
          else faces.push({ face: 'giveWay', look: looking(c.sx, 0) });
        }
        // On a one-way street: an arrow at the corners it flows away from, no entry at the corners it flows towards.
        for (const [f, along] of [[fx, 'x'], [fz, 'z']] as const) {
          if (!f) continue;
          const downstream = along === 'x' ? c.sx === f.x : c.sz === f.z;
          if (downstream) {
            if (!faces.some((q) => q.face === 'noEntry')) faces.push({ face: 'noEntry', look: looking(along === 'x' ? f.x : 0, along === 'z' ? f.z : 0) });
          } else if (faces.length < 2 && !faces.some((q) => q.face === 'oneWay')) {
            const look = along === 'x' ? looking(0, c.sz) : looking(c.sx, 0);
            // The arrow is drawn pointing to the reader's right: turned over where the street flows the other way.
            faces.push({ face: 'oneWay', look, flip: Math.cos(look) * f.x - Math.sin(look) * f.z < 0 });
          }
        }
        // The name of the street the corner's plate runs along: the cross street's, alternately.
        const plateAlongX = (c.sx + c.sz) % 4 === 0;
        putFirst(c.spots, { faces: faces.slice(0, 2), name: { name: nameOf(plateAlongX ? xk : zk), look: plateAlongX ? looking(0, c.sz) : looking(c.sx, 0) } });
      }
    }
  }
  // Crossing signs either side of each zebra on the main street, facing the traffic both ways.
  for (const z of MAIN_CROSSINGS) {
    const mid = (z.z0 + z.z1) / 2;
    putFirst([1.6, 2.4, 3.4].map((d) => ({ x: ROAD.x0 - 0.3, z: mid - d })), { faces: [{ face: 'crossing', look: looking(0, -1) }] });
    putFirst([1.6, 2.4, 3.4].map((d) => ({ x: ROAD.x1 + 0.3, z: mid + d })), { faces: [{ face: 'crossing', look: looking(0, 1) }] });
  }
  // A 30 zone where each street comes into the district, on the driver's right.
  for (const [k, s] of Object.entries({ ...xStreets, ...zStreets })) {
    const r: Rect = s.road;
    const ends = s.along === 'x'
      ? [{ at: { x: -DISTRICT + 2, z: r.z1 + 0.45 }, look: looking(-1, 0), d: 1 }, { at: { x: DISTRICT - 2, z: r.z0 - 0.45 }, look: looking(1, 0), d: -1 }]
      : [{ at: { x: r.x0 - 0.45, z: -DISTRICT + 2 }, look: looking(0, -1), d: 1 }, { at: { x: r.x1 + 0.45, z: DISTRICT - 2 }, look: looking(0, 1), d: -1 }];
    for (const e of ends) {
      const f = flow[k];
      // A one-way street is only entered at its upstream end.
      if (f && (s.along === 'x' ? f.x : f.z) !== e.d) continue;
      put({ at: e.at, faces: [{ face: 'zone30', look: e.look }] });
    }
  }
  // Parking signs along the parking kerbs (the north street's south side, the south street's south side, the east street's east side).
  for (const [s, side] of [[STREETS.north, 'z1'], [STREETS.south, 'z1'], [STREETS.east, 'x1']] as const) {
    const r: Rect = s.road;
    for (let t = -DISTRICT + 12; t < DISTRICT - 12; t += 26) {
      const p = side === 'z1' ? { x: t, z: r.z1 + 0.4 } : { x: r.x1 + 0.4, z: t };
      put({ at: p, faces: [{ face: 'parking', look: side === 'z1' ? looking(-1, 0) : looking(0, -1) }] });
    }
  }

  // Build them: a pole, its faces (backs in plain metal), the name plate under the top face.
  const faceGeos = new Map<Face, BufferGeometry>();
  const geoFor = (f: Face) => faceGeos.get(f) ?? (faceGeos.set(f, faceGeometry(f, 0.78)), faceGeos.get(f) as BufferGeometry);
  for (const p of posts) {
    const g = add(root, new Group());
    g.position.set(p.at.x, PAVEMENT_TOP, p.at.z);
    add(g, cylinder(0.035, p.name ? 3.15 : 2.8, pole, 6, 0, 0, 0));
    add(g, cylinder(0.05, 0.08, mat(0x4a4c4e), 6, 0, 0, 0));
    p.faces.forEach((f, i) => {
      const y = 2.4 - i * 0.85;
      const m = new Mesh(geoFor(f.face), face);
      m.position.set(Math.sin(f.look) * 0.05, y, Math.cos(f.look) * 0.05);
      m.rotation.y = f.look;
      if (f.flip) m.rotation.z = Math.PI;
      g.add(m);
      const b = add(g, box(0.62, 0.62, 0.02, back, 0, y - 0.31, 0));
      b.rotation.y = f.look;
    });
    if (p.name) {
      const m = new Mesh(plateGeometry(p.name.name), face);
      m.position.set(Math.sin(p.name.look) * 0.04, 3.0, Math.cos(p.name.look) * 0.04);
      m.rotation.y = p.name.look;
      g.add(m);
      const b = add(g, box(1.15, 0.29, 0.02, back, 0, 2.855, 0));
      b.rotation.y = p.name.look;
    }
  }
  // Direction boards on two posts where the main and east streets meet the ring, north and south.
  for (const [i, zr, xr, sz] of [[0, STREETS.east.road, STREETS.ringNorth.road, 1], [1, STREETS.main.road, STREETS.ringSouth.road, -1], [0, STREETS.main.road, STREETS.ringNorth.road, 1], [1, STREETS.east.road, STREETS.ringSouth.road, -1]] as const) {
    // On the right of traffic heading out to the ring, a few metres before it.
    const at = { x: zr.x1 + 0.9, z: sz > 0 ? xr.z1 + 6 : xr.z0 - 6 };
    if (!room(at, 0.9) || !room({ x: at.x + 0.9, z: at.z }) || near(at)) continue;
    const g = add(root, new Group());
    g.position.set(at.x, PAVEMENT_TOP, at.z);
    for (const dx of [-0.85, 0.85]) add(g, cylinder(0.045, 2.6, pole, 6, dx, 0, 0));
    const look = looking(0, sz);
    const m = new Mesh(toCell(new PlaneGeometry(2.0, 0.5), i * ATLAS.board.w, ATLAS.board.y, ATLAS.board.w, ATLAS.board.h), face);
    m.position.set(0, 2.3, 0.04 * sz);
    m.rotation.y = look;
    g.add(m);
    add(g, box(2.0, 0.5, 0.03, back, 0, 2.05, 0));
  }
  mergeStatic(root);

  return {
    setEnabled(on) {
      root.visible = on;
    },
    update() {},
  };
}
