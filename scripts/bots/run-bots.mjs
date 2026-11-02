// Balance check: runs strategy bots on the real simulation in the dev page and
// prints, per bot, money and meters every few game hours, the first red meter
// and the game-over hour. Each bot gets a fresh page with the same seed.
//
//   npm run dev                                   (in another terminal)
//   node scripts/bots/run-bots.mjs [--days 3] [--url http://localhost:5199/] [--seed 777] [--speed 1] [--out dir] [bots...]
//
// Bots: idle hoarder spammer sensible greedy (default: all). Results are also
// written as JSON to --out (default: the system temp folder), never into the repo.
// Flavour packs are switched off (?packs=none): they are cosmetic and cost time.

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { call, drive, SKIP_WELCOME } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const days = Number(opt('days', 3));
const base = opt('url', 'http://localhost:5199/');
const seed = opt('seed', '777');
const speed = Number(opt('speed', 1));
const out = opt('out', join(tmpdir(), 'hrs-bots'));
const bots = args.length ? args : ['idle', 'hoarder', 'spammer', 'sensible', 'greedy'];
mkdirSync(out, { recursive: true });

const url = new URL(base);
url.searchParams.set('packs', 'none');
const summary = [];
for (const name of bots) {
  const [, result] = await drive(url.href, [...SKIP_WELCOME, call('./strategies.js', name, days, { clockSpeed: speed })], { seed, log: () => {} });
  if (!result || typeof result !== 'object') { console.error(name, 'failed:', result); continue; }
  writeFileSync(join(out, `${name}.json`), JSON.stringify(result, null, 1));
  const rows = result.rows;
  const at = (f) => rows[Math.min(rows.length - 1, Math.floor(f * (rows.length - 1)))];
  summary.push({
    bot: name, money: `${at(0).budget} / ${at(0.5).budget} / ${at(1).budget}`, 'net/h end': at(1).net,
    'first red h': result.firstRedHour ?? '-', 'red h': result.redHours, 'game over h': result.gameOverHour ?? '-',
    helped: result.totals.helped, 'open end': at(1).open, 'staff end': at(1).staff, acts: JSON.stringify(result.acts),
  });
  console.log(`\n${name}: h clock budget net police medics sobering district crisis unmet24 helped`);
  for (const r of rows.filter((_, i) => i % 6 === 0 || i === rows.length - 1)) {
    console.log(`  ${[r.h, r.clock, r.budget, r.net, r.police, r.medics, r.sobering, r.district, r.crisis, r.unmet24, r.helped].join(' ')}`);
  }
}
console.log(`\nseed ${seed}, ${days} game days, clock speed ${speed}`);
console.table(summary);
console.log(`JSON in ${out}`);
