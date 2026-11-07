import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshLambertMaterial, type Object3D } from 'three';

export const PLACEMENT_SECONDS = 1.65;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => { const p = clamp(t); return p * p * (3 - 2 * p); };

/** First construction is visual only: no simulation timers, navigation changes or scenery RNG. */
export class PlacementAssembly {
  private readonly root = new Group();
  private readonly geometry = new BoxGeometry(.58, .18, .45);
  private readonly materials = [new MeshLambertMaterial({ color: 0xe4eee9 }), new MeshLambertMaterial({ color: 0x3f8caa })];
  private readonly batches = this.materials.map(material => new InstancedMesh(this.geometry, material, 6));
  private readonly matrix = new Matrix4();
  private target: Object3D | null = null;
  private elapsed = 0;
  private baseY = 0;
  private baseScaleY = 1;
  constructor(private readonly home: Object3D) {
    this.root.name = 'placementAssembly'; this.root.visible = false;
    for (const batch of this.batches) { batch.frustumCulled = false; this.root.add(batch); }
    // Present during startup compileAsync so first placement does not compile a new shader.
    home.add(this.root);
  }
  get active(): boolean { return this.target !== null; }
  start(target: Object3D, still: boolean): void {
    this.finish();
    if (still) return;
    this.target = target; this.baseY = target.position.y; this.baseScaleY = target.scale.y; this.elapsed = 0;
    (target.parent ?? this.home).add(this.root);
    this.root.position.copy(target.position); this.root.rotation.copy(target.rotation); this.root.scale.copy(target.scale);
    this.root.visible = true; this.update(0, false);
  }
  /** Called by the existing real-time frame, including while the simulation clock is paused. */
  update(dt: number, still: boolean): boolean {
    const target = this.target;
    if (!target) return false;
    if (still) { this.finish(); return true; }
    this.elapsed += Math.max(0, dt);
    const t = clamp(this.elapsed / PLACEMENT_SECONDS);
    const rise = ease((t - .08) / .84);
    target.position.y = this.baseY - (1 - rise) * 3.8;
    target.scale.y = this.baseScaleY * (.92 + .08 * rise);
    for (let batch = 0; batch < this.batches.length; batch++) {
      const mesh = this.batches[batch];
      for (let i = 0; i < 6; i++) {
        const n = batch * 6 + i;
        const p = clamp((t - n * .018) / .7), q = ease(p);
        const size = Math.max(.001, Math.sin(Math.PI * p) * .9);
        this.matrix.makeScale(size, size, size);
        this.matrix.setPosition((batch ? -1 : 1) * (1.2 + .6 * (1 - q)), -.35 + q * (1 + (n % 3) * .7) + Math.sin(Math.PI * p) * .8, -2.75 + i * 1.1);
        mesh.setMatrixAt(i, this.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (t >= 1) this.finish();
    return true;
  }
  finish(): void {
    if (this.target) { this.target.position.y = this.baseY; this.target.scale.y = this.baseScaleY; }
    this.target = null; this.root.visible = false;
    if (this.root.parent !== this.home) this.home.add(this.root);
    this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.root.scale.set(1, 1, 1);
  }
  dispose(): void {
    this.finish(); this.root.removeFromParent();
    this.batches.forEach(batch => batch.dispose()); this.geometry.dispose(); this.materials.forEach(material => material.dispose());
  }
}
