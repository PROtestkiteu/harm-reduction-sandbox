import { BufferAttribute, BufferGeometry, Matrix4, Mesh, type Material, type MeshLambertMaterial, type Object3D } from 'three';
import { GLOW_BANK_SIZE, glowBankMat, isGlow, isPlain, mergedPlainMat } from './materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mark an object (and its subtree) as animated so `mergeStatic` leaves it alone. */
export function dynamic<T extends Object3D>(o: T): T {
  o.userData.dynamic = true;
  return o;
}

/**
 * Bakes every static single-material mesh under `root` into one mesh per
 * material, in `root`'s local space. Plain palette colours all share one
 * mesh: each colour is written onto its vertices. Glow materials (lit
 * windows, signs, lamps) share glow banks: up to 64 light groups a draw, each
 * still animated through its own material. Cuts draw calls for every pass
 * (shadow and colour) without changing what is rendered.
 */
export function mergeStatic(root: Object3D): void {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<Material, { geos: BufferGeometry[]; cast: boolean }>();
  const merged: Mesh[] = [];
  /** Glow materials in the order met (a bank is each run of GLOW_BANK_SIZE), and their geometry. */
  const glowMats: MeshLambertMaterial[] = [];
  const glowIndex = new Map<Material, number>();
  const glowGeos: BufferGeometry[][] = [];

  const visit = (o: Object3D) => {
    if (o.userData.dynamic) return;
    if (o instanceof Mesh && !Array.isArray(o.material)) {
      // Kept indexed: a box is 24 vertices shared by its 36 corners, not 36 copies. Every bucket merges
      // indexed (a rare unindexed source gets a plain 0..n index), so the merge never multiplies vertices.
      let g = o.geometry.clone();
      if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
      g.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, o.matrixWorld));
      if (isGlow(o.material) && o.material.visible) {
        let i = glowIndex.get(o.material);
        if (i === undefined) {
          i = glowMats.length;
          glowMats.push(o.material);
          glowIndex.set(o.material, i);
        }
        const bank = Math.floor(i / GLOW_BANK_SIZE);
        (glowGeos[bank] ??= []).push(withChannel(g, i % GLOW_BANK_SIZE));
        merged.push(o);
        for (const child of o.children) visit(child);
        return;
      }
      let key: Material = o.material;
      if (isPlain(o.material)) {
        g = withColour(g, o.material.color);
        key = mergedPlainMat(o.material);
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
  glowGeos.forEach((geos, bank) => {
    const geometry = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!geometry) return;
    const { material, sync } = glowBankMat(glowMats.slice(bank * GLOW_BANK_SIZE, (bank + 1) * GLOW_BANK_SIZE));
    // Kept out of any later, wider merge (the far city merges, then the whole scene): a re-merge would
    // drop this per-draw read-back and freeze every light in the bank at its value now.
    const mesh = dynamic(new Mesh(geometry, material));
    // The light groups' colour and glow, read back from their own materials just before each draw.
    mesh.onBeforeRender = sync;
    // Lit things cast no shadow (as above).
    mesh.receiveShadow = true;
    root.add(mesh);
  });
}

/** Positions, normals and the index only, with the light group's index in the bank on every vertex. */
function withChannel(g: BufferGeometry, channel: number): BufferGeometry {
  const out = new BufferGeometry();
  out.setIndex(g.getIndex());
  out.setAttribute('position', g.getAttribute('position'));
  out.setAttribute('normal', g.getAttribute('normal'));
  out.setAttribute('glowCh', new BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(channel), 1));
  g.dispose();
  return out;
}

/** Positions, normals and the index only, with `colour` on every vertex (plain materials use no textures). */
function withColour(g: BufferGeometry, colour: { r: number; g: number; b: number }): BufferGeometry {
  const out = new BufferGeometry();
  out.setIndex(g.getIndex());
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
