import { Raycaster, Vector3, type Object3D, type OrthographicCamera } from 'three';
import type { Crowd } from '../agents/crowd';
import { clientToNdc, worldToClient } from '../render/camera';
import type { RenderFrame } from '../render/frame';
import { LOCATION_IDS, type LocationId } from '../sim/types';
import type { LocationVisual } from '../world/buildings';
import { pickBuilding } from '../world/cityBuildings';

/** Something the pointer can hover or select. */
export type Target =
  | { kind: 'location'; id: LocationId; part?: 'stand' }
  | { kind: 'person'; id: number }
  | { kind: 'building'; id: number }
  | { kind: 'vehicle'; id: number };

export function sameTarget(a: Target | null, b: Target | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'person') return b.kind === 'person' && a.id === b.id;
  if (a.kind === 'building') return b.kind === 'building' && a.id === b.id;
  if (a.kind === 'vehicle') return b.kind === 'vehicle' && a.id === b.id;
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
  private readonly visibleRoots: Object3D[] = [];
  private readonly foot = new Vector3();
  private readonly head = new Vector3();
  private readonly mid = new Vector3();

  /** `extras`: more objects that belong to a place (extra campers), named by its id. */
  constructor(
    locations: Record<LocationId, LocationVisual>,
    private readonly crowd: Crowd,
    private readonly extras: () => readonly Object3D[] = () => [],
    /** Police cars and ambulances out on the streets. */
    private readonly vehicles: () => readonly { id: number; root: Object3D }[] = () => [],
  ) {
    this.roots = LOCATION_IDS.map((id) => locations[id].root);
  }

  /** The id of whichever of `targets` is under the pointer (nearest first), or null. */
  pickAmong(clientX: number, clientY: number, camera: OrthographicCamera, frame: RenderFrame, targets: readonly { id: number; root: Object3D }[], respectBuildings = false): number | null {
    this.raycaster.setFromCamera(clientToNdc(clientX, clientY, frame), camera);
    let best: { id: number; d: number } | null = null;
    for (const t of targets) {
      const h = this.raycaster.intersectObject(t.root, true)[0];
      if (h && (!best || h.distance < best.d)) best = { id: t.id, d: h.distance };
    }
    const foreground = respectBuildings && best ? pickBuilding(this.raycaster.ray) : null;
    if (foreground && best && foreground.distance + .05 < best.d) return null;
    return best?.id ?? null;
  }

  pick(clientX: number, clientY: number, camera: OrthographicCamera, frame: RenderFrame, coarse: boolean): Target | null {
    this.raycaster.setFromCamera(clientToNdc(clientX, clientY, frame), camera);
    const ray = this.raycaster.ray.clone();
    const extras = this.extras();
    // Three.js raycasting also intersects invisible objects; unplaced venues have no hit target.
    this.visibleRoots.length = 0;
    for (const root of this.roots) if (root.visible) this.visibleRoots.push(root);
    for (const root of extras) if (root.visible) this.visibleRoots.push(root);
    const placeHit = this.raycaster.intersectObjects(this.visibleRoots, true)[0];
    const buildingHit = pickBuilding(ray);
    // A police car or ambulance in front of everything else wins.
    let vehicle: { id: number; distance: number } | null = null;
    for (const v of this.vehicles()) {
      const h = this.raycaster.intersectObject(v.root, true)[0];
      if (h && (!vehicle || h.distance < vehicle.distance)) vehicle = { id: v.id, distance: h.distance };
    }

    // Whichever is nearer along the ray: a service's building or an ordinary one.
    const hit = placeHit && (!buildingHit || placeHit.distance <= buildingHit.distance) ? placeHit : null;
    const nearest = Math.min(placeHit?.distance ?? Infinity, buildingHit?.distance ?? Infinity);

    let best: { id: number; score: number; depth: number } | null = null;
    const minRadius = coarse ? 24 : 14;
    this.crowd.forEachVisible((p) => {
      const root = p.root;
      this.foot.copy(root.position);
      this.head.set(0, FIGURE_HEIGHT * root.scale.y * (p.seated ? 0.65 : 1), 0).applyQuaternion(root.quaternion).add(this.foot);
      const a = worldToClient(this.foot, camera, frame);
      const b = worldToClient(this.head, camera, frame);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const radius = Math.max(minRadius, len * 0.32);
      const d = distToSegment(clientX, clientY, a.x, a.y, b.x, b.y);
      if (d > radius) return;
      const depth = this.mid.addVectors(this.foot, this.head).multiplyScalar(0.5).sub(ray.origin).dot(ray.direction);
      // A building surface clearly in front of this person hides them.
      if (nearest < depth - 0.5) {
        // Padding beside a visible body must not inherit a neighbouring wall's hit.
        const dx = b.x - a.x, dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? Math.min(1, Math.max(0, ((clientX - a.x) * dx + (clientY - a.y) * dy) / l2)) : 0;
        this.raycaster.setFromCamera(clientToNdc(a.x + t * dx, a.y + t * dy, frame), camera);
        const wall = pickBuilding(this.raycaster.ray);
        const place = this.raycaster.intersectObjects(this.visibleRoots, true)[0];
        if (Math.min(wall?.distance ?? Infinity, place?.distance ?? Infinity) < depth - 0.5) return;
      }
      if (vehicle && vehicle.distance < depth - 0.5) return;
      const score = d / radius;
      if (!best || score < best.score - 0.05 || (Math.abs(score - best.score) <= 0.05 && depth < best.depth)) {
        best = { id: p.id, score, depth };
      }
    });
    if (best) return { kind: 'person', id: (best as { id: number }).id };
    if (vehicle && vehicle.distance <= nearest) return { kind: 'vehicle', id: vehicle.id };
    if (!hit) return buildingHit ? { kind: 'building', id: buildingHit.building.id } : null;

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
