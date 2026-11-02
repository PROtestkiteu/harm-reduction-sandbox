import { Group, type MeshLambertMaterial, type Object3D } from 'three';
import { add, box, signBoard } from './kit';
import { mat } from './materials';
import { frontSide, type CityBuilding } from './cityBuildings';
import { SIDE_ROT } from './layout';

/** What a shop unit shows on the street. */
export type UnitLook = 'trading' | 'toLet' | { sign: string; fg: string; bg: string };

const post = mat(0x3a3a3a);

/** A drop that lands and settles with two small bounces. */
function bounce(v: number): number {
  const t = Math.min(1, Math.max(0, v));
  if (t < 0.6) return (t / 0.6) ** 2;
  if (t < 0.85) { const u = (t - 0.725) / 0.125; return 1 - 0.12 * (1 - u * u); }
  const u = (t - 0.925) / 0.075;
  return 1 - 0.03 * (1 - u * u);
}

interface Board { group: Group; face: MeshLambertMaterial }

/**
 * Boards on the roofs of shop units: an estate agent's TO LET when a shop
 * closes, the service's own sign once the organisation rents it. Each drops
 * in from above and bounces; the old one lifts away. Idle, nothing runs.
 */
export class Letting {
  private readonly toLet: Board;
  private sign: Board | null = null;
  private signKey = '';
  private shown: Board | null = null;
  private leaving: Board | null = null;
  private t = 1;
  private readonly baseY: number;

  /** `roof`: the measured top of the roof where the board stands. */
  constructor(private readonly root: Object3D, private readonly building: CityBuilding, roof: number) {
    this.baseY = roof;
    this.toLet = this.board('TO LET', '#1c1c1c', '#f2e8c8', 0.55);
  }

  private board(text: string, fg: string, bg: string, glow: number): Board {
    const b = this.building;
    const g = add(this.root, new Group());
    g.position.set((b.x0 + b.x1) / 2, this.baseY, (b.z0 + b.z1) / 2);
    // Turned to the building's street, reading from the pavement in front (and from behind on its back).
    g.rotation.y = SIDE_ROT[frontSide(b)];
    add(g, box(0.08, 1.1, 0.08, post, -1.3, 0, 0));
    add(g, box(0.08, 1.1, 0.08, post, 1.3, 0, 0));
    const front = signBoard(text, 3.2, 1, fg, bg, glow);
    add(g, front.mesh).position.y = 0.9;
    const back = signBoard(text, 3.2, 1, fg, bg, glow);
    // Wholly behind the front board (each is 0.12 deep): overlapping, the back's dark side fought the front's face and blacked out the text.
    add(g, back.mesh, Math.PI).position.set(0, 0.9, -0.13);
    // Both faces share one glow level.
    back.mesh.material = front.mesh.material;
    g.visible = false;
    return { group: g, face: front.material };
  }

  set(look: UnitLook): void {
    let next: Board | null = null;
    if (look === 'toLet') next = this.toLet;
    else if (look !== 'trading') {
      const key = `${look.sign}|${look.bg}`;
      if (key !== this.signKey) {
        if (this.sign && this.sign !== this.shown) this.root.remove(this.sign.group);
        this.sign = this.board(look.sign, look.fg, look.bg, 0.6);
        this.signKey = key;
      }
      next = this.sign;
    }
    if (next === this.shown) return;
    if (this.leaving) this.leaving.group.visible = false;
    this.leaving = this.shown;
    this.shown = next;
    this.t = 0;
  }

  /** Returns true while a board is moving. */
  update(dt: number, still: boolean): boolean {
    if (this.t >= 1) return false;
    this.t = still ? 1 : Math.min(1, this.t + dt / 1.6);
    const t = this.t;
    if (this.leaving) {
      const k = Math.min(1, t / 0.45);
      this.leaving.group.position.y = this.baseY + k * k * 5;
      this.leaving.group.visible = k < 1;
    }
    if (this.shown) {
      const fall = bounce((t - 0.3) / 0.7);
      this.shown.group.visible = t >= 0.3 || still;
      this.shown.group.position.y = this.baseY + (1 - fall) * 5;
    }
    if (t >= 1 && this.leaving) {
      this.leaving.group.visible = false;
      this.leaving = null;
    }
    return true;
  }
}
