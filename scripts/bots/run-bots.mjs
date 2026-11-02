// Balance check: runs strategy bots on the real simulation in the dev page and
// prints, per bot, money and meters every few game hours, the first red meter
// and the hour all three starting services had closed for money. Each bot gets a fresh page with the same seed.
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
const bots = args.length ? args : ['idle', 'hoarder', 'spammer', 'sensible', 'greedy', 'naive', 'prepared'];
mkdirSync(out, { recursive: true });

const url = new URL(base);
url.searchParams.set('packs', 'none');
const summary = [];
for (const name of bots) {
  // A dev-server reload (someone saved a file) restarts the page mid-run: such a run comes back
  // without rows and is tried again, at most twice.
  let result = null;
  for (let attempt = 0; attempt < 3 && !result?.rows?.length; attempt++) {
    [, result] = await drive(url.href, [...SKIP_WELCOME, call('./strategies.js', name, days, { clockSpeed: speed })], { seed, log: () => {} });
    if (!result?.rows?.length) console.error(name, 'run interrupted, retrying:', typeof result === 'string' ? result.slice(0, 120) : result);
  }
  if (!result?.rows?.length) { console.error(name, 'failed'); continue; }
  writeFileSync(join(out, `${name}.json`), JSON.stringify(result, null, 1));
  const rows = result.rows;
  const at = (f) => rows[Math.min(rows.length - 1, Math.floor(f * (rows.length - 1)))];
  summary.push({
    bot: name, money: `${at(0).budget} / ${at(0.5).budget} / ${at(1).budget}`, 'net/h end': at(1).net,
    'first red h': result.firstRedHour ?? '-', 'red h': result.redHours, 'all shut h': result.gameOverHour ?? '-',
    helped: result.totals.helped, away: at(1).turnedAway, deaths: at(1).deaths, 'folded h': result.foldedHour ?? '-', quits: result.quits,
    storms: (result.storms ?? []).map((x) => `${x.kind}@${x.h}: ${x.deaths}d ${x.turnedAway}a`).join('; ') || '-',
    stars: at(1).stars, tier: at(1).tier, morale: at(1).morale, 'staff end': at(1).staff, acts: JSON.stringify(result.acts),
  });
  console.log(`\n${name}: morale moved by cause ${JSON.stringify(result.morale)}; overdoses alone ${result.alone}`);
  console.log(`${name}: h clock budget net medics crisis unmet24 helped away deaths staff morale tier points nalox kits storm`);
  for (const r of rows.filter((row, i) => i % 6 === 0 || i === rows.length - 1 || row.storm === 'peak')) {
    console.log(`  ${[r.h, r.clock, r.budget, r.net, r.medics, r.crisis, r.unmet24, r.helped, r.turnedAway, r.deaths, r.staff, r.morale, r.tier, r.points, r.naloxone, r.kits, r.storm].join(' ')}`);
  }
}
console.log(`\nseed ${seed}, ${days} game days, clock speed ${speed}`);
console.table(summary);
console.log(`JSON in ${out}`);
