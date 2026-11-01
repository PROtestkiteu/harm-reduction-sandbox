import { BufferAttribute, BufferGeometry, Matrix4, Mesh, type Material, type MeshLambertMaterial, type Object3D } from 'three';
import { isPlain, vertexColourMat } from './materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mark an object (and its subtree) as animated so `mergeStatic` leaves it alone. */
export function dynamic<T extends Object3D>(o: T): T {
  o.userData.dynamic = true;
  return o;
}

/**
 * Bakes every static single-material mesh under `root` into one mesh per
 * material, in `root`'s local space. Plain palette colours all share one
 * mesh: each colour is written onto its vertices. Cuts draw calls for every
 * pass (shadow and colour) without changing what is rendered.
 */
export function mergeStatic(root: Object3D): void {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<Material, { geos: BufferGeometry[]; cast: boolean }>();
  const merged: Mesh[] = [];

  const visit = (o: Object3D) => {
    if (o.userData.dynamic) return;
    if (o instanceof Mesh && !Array.isArray(o.material)) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, o.matrixWorld));
      let key: Material = o.material;
      if (isPlain(o.material)) {
        g = withColour(g, o.material.color);
        key = vertexColourMat();
      }
      const bucket = buckets.get(key) ?? { geos: [], cast: false };
      bucket.geos.push(g);
      bucket.cast ||= o.castShadow;
      buckets.set(key, bucket);
      merged.push(o);
    }
    for (const child of o.children) visit(child);
  };
  // The root itself may be marked dynamic (kept out of a wider merge); its own contents still merge.
  for (const child of root.children) visit(child);

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

/** Positions and normals only, with `colour` on every vertex (plain materials use no textures). */
function withColour(g: BufferGeometry, colour: { r: number; g: number; b: number }): BufferGeometry {
  const out = new BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  out.setAttribute('normal', g.getAttribute('normal'));
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = colour.r;
    c[i * 3 + 1] = colour.g;
    c[i * 3 + 2] = colour.b;
  }
  out.setAttribute('color', new BufferAttribute(c, 3));
  g.dispose();
  return out;
}
