import { ConeGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Object3D } from 'three';
import type { CityBuilding } from './cityBuildings';
import { add, box, cylinder } from './kit';
import { mat } from './materials';

/**
 * Places of worship dressed onto ordinary buildings, so each reads from the
 * usual view (the south and east faces, the roofline): a church with a bell
 * tower, a spire and a cross; a synagogue with a Star of David over its door
 * and tall arched windows; a mosque with a green dome and a minaret topped by
 * a crescent. Plain colours, built once and merged with the city.
 */
export type Worship = 'church' | 'synagogue' | 'mosque';

const STONE = 0xd8d0c0;
const GOLD = 0xd8b048;

/** Tall round-topped windows along the south face: dark glass with a stone surround. */
function archedWindows(g: Object3D, b: CityBuilding, y: number, n: number, glass: number): void {
  const w = b.x1 - b.x0;
  for (let i = 0; i < n; i++) {
    const x = b.x0 + ((i + 0.5) / n) * w;
    add(g, box(0.75, 2.1, 0.08, mat(STONE), x, y, b.z1 + 0.03));
    add(g, box(0.55, 1.8, 0.1, mat(glass), x, y + 0.1, b.z1 + 0.04));
    add(g, cylinder(0.275, 0.1, mat(glass), 10, x, y + 1.9, b.z1 + 0.04)).rotation.x = Math.PI / 2;
  }
}

export function worshipFront(parent: Object3D, b: CityBuilding, kind: Worship): void {
  const g = add(parent, new Group());
  const h = b.height;
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  if (kind === 'church') {
    // A square bell tower at the south-east corner, a slate spire and a cross.
    const tx = b.x1 - 1.4, tz = b.z1 - 1.4;
    add(g, box(2.8, h + 7, 2.8, mat(STONE), tx, 0.12, tz));
    for (const [x, z, r] of [[tx, tz + 1.42, 0], [tx + 1.42, tz, Math.PI / 2]] as const) {
      add(g, box(0.7, 1.4, 0.06, mat(0x2a2a30), x, h + 4.6, z), r);
      add(g, cylinder(0.35, 0.06, mat(0x2a2a30), 10, x, h + 6.0, z)).rotation.set(Math.PI / 2, 0, r);
    }
    const spire = add(g, new Mesh(new ConeGeometry(2.1, 6, 4), mat(0x4a5058)));
    spire.position.set(tx, h + 7.12 + 3, tz);
    spire.rotation.y = Math.PI / 4;
    add(g, box(0.12, 1.4, 0.12, mat(GOLD), tx, h + 13, tz));
    add(g, box(0.75, 0.12, 0.12, mat(GOLD), tx, h + 13.85, tz));
    archedWindows(g, b, 1.6, Math.max(2, Math.floor((w - 3) / 1.8)), 0x5a3a6a);
    // A round rose window high on the east face.
    add(g, cylinder(0.9, 0.1, mat(0x6a3a5a), 16, b.x1 + 0.05, h - 1.6, cz - 1)).rotation.z = Math.PI / 2;
  } else if (kind === 'synagogue') {
    // A Star of David over the door, two tablets on the roofline, tall arched windows.
    const star = add(g, new Group());
    star.position.set(cx, h - 1.4, b.z1 + 0.06);
    for (const r of [0, Math.PI]) {
      const tri = add(star, new Mesh(new TorusGeometry(0.62, 0.07, 4, 3), mat(0x2a5a9a)));
      tri.rotation.z = r + Math.PI / 2;
    }
    add(g, box(1.0, 1.2, 0.2, mat(STONE), cx, h + 0.4, b.z1 - 0.2));
    for (const s of [-1, 1]) add(g, cylinder(0.25, 0.2, mat(STONE), 10, cx + s * 0.25, h + 1.6, b.z1 - 0.2)).rotation.x = Math.PI / 2;
    archedWindows(g, b, 1.4, Math.max(2, Math.floor((w - 2) / 1.6)), 0x2a3a5a);
  } else {
    // A green dome on a drum, crowned with a crescent, and a slender minaret at the south-east corner.
    const domeR = Math.min(w, d) * 0.32;
    add(g, cylinder(domeR * 1.02, 0.9, mat(STONE), 16, cx, h + 0.12, cz));
    const dome = add(g, new Mesh(new SphereGeometry(domeR, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a7a5a)));
    dome.position.set(cx, h + 1.0, cz);
    const crescent = add(g, new Mesh(new TorusGeometry(0.32, 0.06, 6, 12, Math.PI * 1.4), mat(GOLD)));
    crescent.position.set(cx, h + 1.0 + domeR + 0.75, cz);
    crescent.rotation.z = Math.PI * 0.8;
    add(g, box(0.06, 0.5, 0.06, mat(GOLD), cx, h + 1.0 + domeR, cz));
    // The minaret rises from the roof's south-east corner, inside the building's footprint (never on the pavement).
    const mx = b.x1 - 0.8, mz = b.z1 - 0.8;
    add(g, cylinder(0.55, 9, mat(STONE), 12, mx, h, mz));
    add(g, cylinder(0.85, 0.25, mat(STONE), 12, mx, h + 6.5, mz));
    const cap = add(g, new Mesh(new ConeGeometry(0.6, 2.2, 12), mat(0x2a7a5a)));
    cap.position.set(mx, h + 9 + 1.1, mz);
    archedWindows(g, b, 1.5, Math.max(2, Math.floor((w - 2) / 1.8)), 0x2a4a4a);
  }
}
