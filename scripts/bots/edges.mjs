// Traffic edge check: drives the dev page through a series of camera views
// (the widest, tilted low, at each corner; the junctions; the river; the
// level crossing) and watches every tagged mover. Fails when one appears,
// vanishes or jumps on screen, a road vehicle stands inside a building, two
// registered vehicles overlap, or one stands still for 40 s.
//
//   npm run dev                                   (in another terminal)
//   SEED=7 node scripts/bots/edges.mjs [--url http://localhost:5199/] [--hold 12000] [--clock 1330]
//
// The page-side half is edges.js. Nothing here reaches dist/.

import { call, drive, SKIP_WELCOME } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const base = opt('url', 'http://localhost:5199/');
const hold = Number(opt('hold', 12000));
const clock = Number(opt('clock', 1330));
const seed = process.env.SEED ?? opt('seed', '777');

const views = [
  { name: 'default', x: 0, z: 0, zoom: 1, az: 45, el: 35 },
  { name: 'wide-centre', x: 0, z: 0, zoom: 0.35, az: 45, el: 35 },
  { name: 'wide-NE-low', x: 66, z: -66, zoom: 0.35, az: 45, el: 15 },
  { name: 'wide-SE-low', x: 66, z: 66, zoom: 0.35, az: 315, el: 15 },
  { name: 'wide-SW-low', x: -66, z: 66, zoom: 0.35, az: 225, el: 15 },
  { name: 'wide-NW-low', x: -66, z: -66, zoom: 0.35, az: 135, el: 15 },
  { name: 'east-junctions', x: 26, z: 0, zoom: 1.4, az: 45, el: 35 },
  { name: 'river', x: 66, z: 0, zoom: 0.7, az: 45, el: 35 },
  { name: 'rail-crossing', x: 0, z: -66, zoom: 1, az: 45, el: 35 },
  { name: 'top-down-wide', x: 0, z: 0, zoom: 0.35, az: 45, el: 75 },
];

const steps = [...SKIP_WELCOME, { eval: `__sandbox.sim.configure({ clock: ${clock} }); 1` }, { wait: 3000 }, call('./edges.js', views, hold)];
const res = await drive(base, steps, { seed, log: () => {} });
const out = JSON.parse(res.at(-1));
const problems = out.pops.length + out.jumps.length + out.inside.length + out.overlaps.length + out.stuck.length;
console.log(`seed ${seed}, clock ${clock}: ${problems} problems; moving samples by kind:`, out.seen);
for (const k of ['pops', 'jumps', 'inside', 'overlaps', 'stuck']) for (const x of out[k]) console.log(`  ${k.toUpperCase()}`, JSON.stringify(x));
process.exit(problems ? 1 : 0);
