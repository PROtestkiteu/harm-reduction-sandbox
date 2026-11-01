import { AdditiveBlending, Mesh, MeshBasicMaterial, RingGeometry, type Object3D } from 'three';

const POOL = 10;

/**
 * Red rings under whatever is working against the selected place or person:
 * a TV crew, a raid, police on foot or in a car near it. Pooled meshes, one
 * shared material; nothing is drawn while nothing is marked. They pulse
 * gently, or hold still with reduced motion.
 */
export class HostileMarks {
  private readonly rings: Mesh[] = [];
  private readonly material = new MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false });
  private time = 0;
  private shown = 0;

  constructor(scene: Object3D, private readonly reducedMotion: () => boolean) {
    const geo = new RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL; i++) {
      const m = new Mesh(geo, this.material);
      m.visible = false;
      m.renderOrder = 3;
      m.raycast = () => {};
      scene.add(m);
      this.rings.push(m);
    }
  }

  /** Marks these spots (`r`: ring radius in metres); an empty list clears them. */
  set(spots: readonly { x: number; z: number; r: number }[]): void {
    this.shown = Math.min(spots.length, POOL);
    this.rings.forEach((m, i) => {
      const s = spots[i];
      m.visible = i < this.shown;
      if (s) {
        m.position.set(s.x, 0.2, s.z);
        m.scale.setScalar(s.r);
      }
    });
  }

  /** Pulses the rings; returns true while any is shown. */
  update(dt: number): boolean {
    if (!this.shown) return false;
    this.time += dt;
    this.material.opacity = this.reducedMotion() ? 0.6 : 0.4 + 0.3 * (0.5 + 0.5 * Math.sin(this.time * 4));
    return true;
  }
}
