import { Matrix4, Mesh, type BufferGeometry, type Material, type MeshLambertMaterial, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mark an object (and its subtree) as animated so `mergeStatic` leaves it alone. */
export function dynamic<T extends Object3D>(o: T): T {
  o.userData.dynamic = true;
  return o;
}

/**
 * Bakes every static single-material mesh under `root` into one mesh per
 * material, in `root`'s local space. Cuts draw calls for all three passes
 * (shadow, colour, normals) without changing what is rendered.
 */
export function mergeStatic(root: Object3D): void {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<Material, { geos: BufferGeometry[]; cast: boolean }>();
  const merged: Mesh[] = [];

  const visit = (o: Object3D) => {
    if (o.userData.dynamic) return;
    if (o instanceof Mesh && !Array.isArray(o.material)) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, o.matrixWorld));
      const bucket = buckets.get(o.material) ?? { geos: [], cast: false };
      bucket.geos.push(g);
      bucket.cast ||= o.castShadow;
      buckets.set(o.material, bucket);
      merged.push(o);
    }
    for (const child of o.children) visit(child);
  };
  visit(root);

  for (const m of merged) m.removeFromParent();
  for (const [material, { geos, cast }] of buckets) {
    const geometry = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!geometry) continue;
    const mesh = new Mesh(geometry, material);
    // Lit panes and signs sit flat on walls; their shadows would never show,
    // and skipping them keeps the shadow pass cheap.
    const glows = 'emissive' in material && (material as MeshLambertMaterial).emissive.getHex() !== 0;
    mesh.castShadow = cast && !glows;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}
