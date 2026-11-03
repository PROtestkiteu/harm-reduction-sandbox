// Page-side: render cost at one zoom. Sets the camera's zoom at once, lets it settle, then over
// `seconds` times each scene render on the CPU (the whole pipeline.render call), on the GPU where
// the browser exposes EXT_disjoint_timer_query_webgl2, and, for a few frames, synced (render then a
// 1-pixel read, so the GPU's work is in the number even where timer queries are missing). Also
// reports the frame interval, draw calls, triangles, programs, the render-target size, the quality
// tier when there is one, and an estimate of texture memory.
async (zoom = 1, seconds = 5) => {
  const s = window.__sandbox; const r = s.renderer; const gl = r.getContext(); const p = s.pipeline;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  s.rig.zoom = zoom; s.rig.targetZoom = zoom; s.rig.invalidate();
  await sleep(2500);
  // A build with the quality controller times its own frames (one timer query may run at a time).
  const own = s.quality && s.pipeline.timesGpu;
  const ext = own ? null : gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const cpu = [], gpu = [], gaps = []; let calls = 0, tris = 0, renders = 0, pending = [];
  const orig = p.render.bind(p);
  r.info.autoReset = false;
  p.render = (...a) => {
    r.info.reset();
    let q = null;
    if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
    const t0 = performance.now(); orig(...a); cpu.push(performance.now() - t0);
    if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); }
    calls += r.info.render.calls; tris += r.info.render.triangles; renders++;
    for (let i = pending.length - 1; i >= 0; i--) {
      const pq = pending[i];
      if (gl.getQueryParameter(pq, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) { gpu.push(gl.getQueryParameter(pq, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(pq); pending.splice(i, 1); }
    }
  };
  const origGpu = own ? s.quality.sampleGpu.bind(s.quality) : null;
  if (own) s.quality.sampleGpu = (ms) => { gpu.push(ms); origGpu(ms); };
  const tiers = new Set();
  const raf = window.requestAnimationFrame.bind(window); let lastT = 0;
  window.requestAnimationFrame = (cb) => raf((t) => { if (lastT) gaps.push(t - lastT); lastT = t; if (s.quality) tiers.add(s.quality.tier); cb(t); });
  await sleep(seconds * 1000);
  window.requestAnimationFrame = raf; p.render = orig; r.info.autoReset = true;
  if (own) s.quality.sampleGpu = origGpu;
  // Synced cost: eight renders each followed by a read that waits for the GPU.
  const px = new Uint8Array(4); const synced = [];
  for (let i = 0; i < 8; i++) { const t0 = performance.now(); p.render(s.world.scene, s.camera, { hover: false, select: false }); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); synced.push(performance.now() - t0); }
  const texSeen = new Set(); let texBytes = 0;
  s.world.scene.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) for (const k in m) {
      const t = m[k]; if (!t || !t.isTexture || texSeen.has(t)) continue; texSeen.add(t);
      const img = t.image; const w = img?.width ?? 0, h = img?.height ?? 0;
      texBytes += w * h * 4 * (t.generateMipmaps !== false && t.minFilter !== 1003 && t.minFilter !== 1006 ? 4 / 3 : 1);
    }
  });
  const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return +b[Math.floor(b.length / 2)].toFixed(2); };
  const p95 = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return +b[Math.floor(b.length * 0.95)].toFixed(2); };
  const f = p.frame;
  return {
    zoom, wpp: +(p.composite?.uniforms?.worldPerPixel?.value ?? 0).toFixed(4), target: `${f.lowW}x${f.lowH}`, dpr: f.dpr,
    tier: s.quality ? [...tiers].join('>') : null,
    renders, fps: gaps.length ? +(1000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)).toFixed(1) : 0, gapP95: p95(gaps),
    cpuMed: med(cpu), cpuP95: p95(cpu), gpuMed: med(gpu), gpuP95: p95(gpu), syncedMed: med(synced),
    calls: renders ? Math.round(calls / renders) : 0, trisK: renders ? Math.round(tris / renders / 1000) : 0,
    programs: r.info.programs?.length ?? null, textures: r.info.memory.textures, texMB: +(texBytes / 1048576).toFixed(1),
  };
}
