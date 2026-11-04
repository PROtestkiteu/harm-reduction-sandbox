// Frame cost check: JavaScript time per frame and draw calls, with every flavour
// pack off and on, on the same seeded city and the default view.
//
//   npm run dev                                   (in another terminal)
//   node scripts/bots/perf.mjs [--url http://localhost:5199/] [--seed 777] [--runs 2] [--size 1280x800]
//
// Headless Chrome is held at 60 fps, so the useful numbers are the CPU ms and
// the draw calls, compared between runs of the same build or two builds.

import { call, drive, SKIP_WELCOME } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const base = opt('url', 'http://localhost:5199/');
const seed = opt('seed', '777');
const runs = Number(opt('runs', 2));
const size = opt('size', '1280x800');

const rows = [];
for (let run = 1; run <= runs; run++) {
  for (const packs of ['none', null]) {
    const url = new URL(base);
    if (packs) url.searchParams.set('packs', packs);
    const [, a, b] = await drive(url.href, [...SKIP_WELCOME, { wait: 2000 }, call('./perf.js', 8), call('./perf.js', 8)], { seed, size, log: () => {} });
    if ([a, b].some(r => !r || !Number.isFinite(r.cpuMeanMs) || r.frames < 10)) throw new Error('No valid frame-cost samples; check startup or a dev-server reload');
    for (const r of [a, b]) rows.push({ run, packs: packs ?? 'all on', 'cpu ms': r.cpuMeanMs, 'p95 ms': r.cpuP95Ms, draws: r.drawCallsPerRenderedFrame, fps: r.fps });
  }
}
console.log(`seed ${seed}, ${size}`);
console.table(rows);
