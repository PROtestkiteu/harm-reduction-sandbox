// Page-side: frame cost over a few seconds of real play. Wraps requestAnimationFrame to time each
// frame's JavaScript and counts the renderer's draw calls per frame (all passes, shadows included).
async (seconds = 8) => {
  const s = window.__sandbox; const r = s.renderer;
  const raf = window.requestAnimationFrame.bind(window);
  let cpu = [], calls = 0, tris = 0, frames = 0, perFrameCalls = [];
  const orig = r.render.bind(r);
  r.render = (a, b) => { orig(a, b); calls += r.info.render.calls; tris += r.info.render.triangles; };
  window.requestAnimationFrame = (cb) => raf((t) => { const c0 = calls; const t0 = performance.now(); cb(t); cpu.push(performance.now() - t0); perFrameCalls.push(calls - c0); frames++; });
  const start = performance.now();
  await new Promise((res) => setTimeout(res, seconds * 1000));
  window.requestAnimationFrame = raf; r.render = orig;
  const el = performance.now() - start;
  const sorted = [...cpu].sort((a, b) => a - b);
  const drawn = perFrameCalls.filter((c) => c > 0);
  return { frames, fps: +(frames / el * 1000).toFixed(1), cpuMeanMs: +(cpu.reduce((a, b) => a + b, 0) / cpu.length).toFixed(2), cpuP95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2), drawCallsPerRenderedFrame: +(drawn.reduce((a, b) => a + b, 0) / drawn.length).toFixed(0), renderedFrames: drawn.length, scene: s.world.scene.children.length };

}
