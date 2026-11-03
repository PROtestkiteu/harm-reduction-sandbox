// Page-side: what the per-frame scene traversal walks. Counts objects, meshes, materials (all, and
// distinct by kind and settings), objects whose local transform changed over `seconds` of play,
// and the time of one scene.updateMatrixWorld(); grouped by top-level child of the scene.
async (seconds = 6) => {
  const s = window.__sandbox; const scene = s.world.scene;
  const snap = new Map();
  scene.traverse((o) => snap.set(o, [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()]));
  await new Promise((r) => setTimeout(r, seconds * 1000));
  const groups = new Map(); let objects = 0, meshes = 0, autoUpdate = 0, moved = 0, visible = 0;
  const mats = new Set(); const keys = new Set();
  const top = (o) => { while (o.parent && o.parent !== scene) o = o.parent; return o; };
  scene.traverse((o) => {
    objects++; if (o.matrixAutoUpdate) autoUpdate++;
    const was = snap.get(o); const now = [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()];
    const m = !was || was.some((v, i) => Math.abs(v - now[i]) > 1e-6); if (m) moved++;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; } if (vis) visible++;
    const t = top(o); const name = t === o && o.parent !== scene ? '(scene)' : (t.name || t.type) + (t.userData?.kind ? ':' + t.userData.kind : '');
    const g = groups.get(name) ?? { objects: 0, meshes: 0, moved: 0 }; g.objects++; if (m) g.moved++;
    if (o.isMesh || o.isSprite || o.isPoints || o.isLine) { meshes++; g.meshes++; for (const mm of [].concat(o.material)) { mats.add(mm); keys.add(mm.type + JSON.stringify([mm.color?.getHex(), mm.emissive?.getHex(), mm.map?.uuid, mm.transparent, mm.opacity, mm.side, mm.vertexColors, mm.flatShading, mm.emissiveIntensity, mm.alphaTest, mm.depthWrite])); } }
    groups.set(name, g);
  });
  const t0 = performance.now(); for (let i = 0; i < 20; i++) scene.updateMatrixWorld(); const umw = (performance.now() - t0) / 20;
  const top10 = [...groups.entries()].sort((a, b) => b[1].objects - a[1].objects).slice(0, 25).map(([k, v]) => `${k} ${v.objects}/${v.meshes}m/${v.moved}mv`);
  return { objects, meshes, autoUpdate, moved, visible, materials: mats.size, distinctMaterials: keys.size, updateMatrixWorldMs: +umw.toFixed(2), programs: s.renderer.info.programs.length, groups: top10 };
}
