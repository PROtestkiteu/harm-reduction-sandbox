// Walking clearance check for the flavour packs: every prop and standing spot
// against the crowd's walking lines and the buildings, on several launches
// (the pocket parks move from launch to launch).
//
//   npm run dev                                   (in another terminal)
//   node scripts/bots/clearance.mjs [--url http://localhost:5199/] [--launches 3]
//
// Fails (exit 1) when anything stands in the walking band or inside a building.
// Reads layout and config modules through the dev server, so restart it after
// editing src/world/cityBuildings.ts (a hot-reloaded copy would be empty).

import { call, drive, SKIP_WELCOME } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const base = opt('url', 'http://localhost:5199/');
const launches = Number(opt('launches', 3));

let failed = false;
for (let n = 1; n <= launches; n++) {
  const steps = [...SKIP_WELCOME, { eval: '__sandbox.sim.camp.squat = 0.9; __sandbox.sim.configure({ clock: 1330 }); 1' }, { wait: 5000 }, call('./clearance.js')];
  const res = await drive(base, steps, { log: () => {} });
  const items = JSON.parse(res.at(-1));
  const bad = items.filter((x) => (x.clear < 0 && !x.n.includes('line')) || x.inBuilding !== null);
  failed ||= bad.length > 0;
  console.log(`launch ${n}: ${items.length} items, ${bad.length} problems`);
  for (const x of bad) console.log('  PROBLEM', x);
  for (const x of items.filter((i) => !i.n.includes('line')).sort((a, b) => a.clear - b.clear).slice(0, 5)) console.log(`  tightest ${x.n}: ${x.clear} m from ${x.edge}`);
  // Moving lines cross the crowd only at streets; one that comes close elsewhere is worth a look.
  for (const x of items.filter((i) => i.n.includes('line') && i.clear < 0.2)) console.log(`  line close: ${x.n} ${x.clear} m from ${x.edge}`);
}
process.exit(failed ? 1 : 0);
