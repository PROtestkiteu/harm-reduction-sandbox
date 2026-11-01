import { Raycaster, Vector3, type Object3D, type OrthographicCamera } from 'three';
import type { Crowd } from '../agents/crowd';
import { clientToNdc, worldToClient } from '../render/camera';
import type { RenderFrame } from '../render/frame';
import { LOCATION_IDS, type LocationId } from '../sim/types';
import type { LocationVisual } from '../world/buildings';

/** Something the pointer can hover or select. */
export type Target =
  | { kind: 'location'; id: LocationId; part?: 'stand' }
  | { kind: 'person'; id: number };

export function sameTarget(a: Target | null, b: Target | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'person') return b.kind === 'person' && a.id === b.id;
  return b.kind === 'location' && a.id === b.id && a.part === b.part;
}

/** Figures are modelled 1.75 m tall before the rig's scale. */
const FIGURE_HEIGHT = 1.75;

/**
 * Picks locations by raycasting their meshes and people by distance to their
 * projected body line, so small figures stay easy to hit with a finger. A
 * person behind a building does not win over the building in front.
 */
export class ScenePicker {
  private readonly raycaster = new Raycaster();
  private readonly roots: Object3D[];
  private readonly foot = new Vector3();
  private readonly head = new Vector3();
  private readonly mid = new Vector3();

  constructor(locations: Record<LocationId, LocationVisual>, private readonly crowd: Crowd) {
    this.roots = LOCATION_IDS.map((id) => locations[id].root);
  }

  pick(clientX: number, clientY: number, camera: OrthographicCamera, frame: RenderFrame, coarse: boolean): Target | null {
    this.raycaster.setFromCamera(clientToNdc(clientX, clientY, frame), camera);
    const ray = this.raycaster.ray;
    const hit = this.raycaster.intersectObjects(this.roots, true)[0];

    let best: { id: number; score: number; depth: number } | null = null;
    const minRadius = coarse ? 20 : 7;
    this.crowd.forEachVisible((p) => {
      const root = p.root;
      this.foot.copy(root.position);
      this.head.copy(root.position).setY(root.position.y + FIGURE_HEIGHT * root.scale.y);
      const a = worldToClient(this.foot, camera, frame);
      const b = worldToClient(this.head, camera, frame);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const radius = Math.max(minRadius, len * 0.22);
      const d = distToSegment(clientX, clientY, a.x, a.y, b.x, b.y);
      if (d > radius) return;
      const depth = this.mid.addVectors(this.foot, this.head).multiplyScalar(0.5).sub(ray.origin).dot(ray.direction);
      // A building surface clearly in front of this person hides them.
      if (hit && hit.distance < depth - 0.5) return;
      const score = d / radius;
      if (!best || score < best.score - 0.05 || (Math.abs(score - best.score) <= 0.05 && depth < best.depth)) {
        best = { id: p.id, score, depth };
      }
    });
    if (best) return { kind: 'person', id: (best as { id: number }).id };
    if (!hit) return null;

    let part: 'stand' | undefined;
    for (let o: Object3D | null = hit.object; o; o = o.parent) {
      if (o.name === 'clubStand') part = 'stand';
      if ((LOCATION_IDS as readonly string[]).includes(o.name)) return { kind: 'location', id: o.name as LocationId, part };
    }
    return null;
  }
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
