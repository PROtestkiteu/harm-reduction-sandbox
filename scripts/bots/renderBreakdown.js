// Page-side: GPU time of each part of a frame at one zoom (needs EXT_disjoint_timer_query_webgl2):
// the shadow map, the scene into the multisampled target, and the composite pass. Median of 15.
// With `tiers` (a build with render/renderQuality.ts), measures each tier in turn in the same page,
// so load from other programs falls on all of them alike.
async (zoom = 1, tiers = null) => {
  const s = window.__sandbox; const r = s.renderer; const gl = r.getContext(); const p = s.pipeline;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return 'no timer query';
  s.rig.zoom = zoom; s.rig.targetZoom = zoom; s.rig.invalidate();
  await new Promise((res) => setTimeout(res, 2500));
  const time = async (fn) => {
    const out = [];
    for (let i = 0; i < 15; i++) {
      const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); fn(); gl.endQuery(ext.TIME_ELAPSED_EXT);
      while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) await new Promise((res) => setTimeout(res, 2));
      out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q);
    }
    out.sort((a, b) => a - b); return +out[7].toFixed(2);
  };
  const scene = s.world.scene, cam = s.camera;
  if (tiers) {
    const out = {};
    for (let round = 0; round < 2; round++) for (const tier of tiers) {
      p.setTier(tier); p.render(scene, cam); // allocate the target at this tier's samples
      const sc = await time(() => { r.shadowMap.needsUpdate = false; r.setRenderTarget(p.colorTarget); r.render(scene, cam); });
      const comp = await time(() => { r.setRenderTarget(null); r.render(p.quadScene, p.quadCamera); });
      const o = (out[tier] ??= { scene: [], composite: [] }); o.scene.push(sc); o.composite.push(comp);
    }
    for (const k in out) out[k] = { scene: Math.min(...out[k].scene), composite: Math.min(...out[k].composite) };
    return { zoom, target: `${p.frame.lowW}x${p.frame.lowH}`, ...out };
  }
  const target = p.colorTarget;
  const sceneWithShadow = await time(() => { r.shadowMap.needsUpdate = true; r.setRenderTarget(target); r.render(scene, cam); });
  const sceneOnly = await time(() => { r.shadowMap.needsUpdate = false; r.setRenderTarget(target); r.render(scene, cam); });
  const composite = await time(() => { r.setRenderTarget(null); r.render(p.quadScene, p.quadCamera); });
  return { zoom, target: `${p.frame.lowW}x${p.frame.lowH}`, shadow: +(sceneWithShadow - sceneOnly).toFixed(2), scene: sceneOnly, composite };
}
