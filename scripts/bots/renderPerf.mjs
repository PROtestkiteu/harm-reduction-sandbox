// Render cost per scenario: desktop and phone, zoomed in and out, optionally with the CPU throttled
// like a weak phone. One headless Chrome per scenario, same seeded city.
//
//   npm run dev                                  (in another terminal)
//   node scripts/bots/renderPerf.mjs [--url http://localhost:5199/] [--seed 777] [--throttle 4] [--quality auto] [--shots dir]
//
// Headless Chrome is held at 60 fps, so compare cpu, gpu and synced ms and the draw calls, not fps.

import { call, drive, SKIP_WELCOME } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const base = opt('url', 'http://localhost:5199/');
const seed = opt('seed', '777');
const throttle = Number(opt('throttle', 1));
const quality = opt('quality', null);
const shots = opt('shots', null);
const only = opt('only', null);

const SCENARIOS = [
  { name: 'desktop in', size: '1280x800', dpr: 2, zoom: 2.6 },
  { name: 'desktop out', size: '1280x800', dpr: 2, zoom: 0.35 },
  { name: 'phone out', size: '390x844', dpr: 3, zoom: 0.71 },
  { name: 'phone in', size: '390x844', dpr: 3, zoom: 2.6 },
];

const rows = [];
for (const sc of SCENARIOS) {
  if (only && !sc.name.includes(only)) continue;
  const url = new URL(base);
  if (quality) url.searchParams.set('quality', quality);
  const steps = [...SKIP_WELCOME, { wait: 1000 }, call('./renderProbe.js', sc.zoom, 5)];
  if (shots) steps.push({ shot: `${sc.name.replace(' ', '-')}${quality ? `-${quality}` : ''}${throttle > 1 ? `-x${throttle}` : ''}.png` });
  const res = await drive(url.href, steps, { seed, size: sc.size, dpr: sc.dpr, cpuThrottle: throttle, out: shots ?? '.', log: () => {} });
  const r = res[res.length - 1];
  rows.push(typeof r === 'object' && r ? { scenario: sc.name, ...r } : { scenario: sc.name, error: String(r) });
}
console.log(`seed ${seed}, cpu throttle x${throttle}${quality ? `, quality ${quality}` : ''}`);
console.table(rows);
