// Seeded scenario balance on the real simulation/crowd, using the canonical Chrome driver.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { drive, SKIP_WELCOME, call } from './chrome.mjs';

const args = process.argv.slice(2);
function option(key, fallback) {
  const at = args.indexOf(`--${key}`);
  if (at < 0) return fallback;
  assert(args[at + 1] && !args[at + 1].startsWith('--'), `Missing --${key} value`);
  return args[at + 1];
}
const models = { 'new-zealand': 'nz', australia: 'au', ukraine: 'ua', colombia: 'mx-latam' };
const base = option('url', 'http://127.0.0.1:5199/');
const seeds = option('seeds', '777,123,2026').split(',').map(Number);
const scenarios = option('scenarios', Object.keys(models).join(',')).split(',');
const bots = option('bots', 'naive,prepared').split(',');
const out = option('out', '/tmp/hrs-regional-balance');
for (const seed of seeds) assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Invalid seed');
for (const id of scenarios) assert(Object.hasOwn(models, id), `Unknown scenario: ${id}`);
for (const bot of bots) assert(['naive', 'prepared', 'prepared-lean', 'prepared-resourceful'].includes(bot), `Unknown bot: ${bot}`);
mkdirSync(out, { recursive: true });

function describe(id, seed, bot, run) {
  return { id, seed, bot, wonHour: run.wonHour, foldedHour: run.foldedHour, nights: run.nights, ...run.scenarioNights.at(-1) };
}
async function runScenario(id, seed, bot) {
  const url = new URL(base);
  for (const [key, value] of Object.entries({ play: '1', scenario: id, model: models[id], packs: 'none', quality: 'low', lang: 'en' })) url.searchParams.set(key, value);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const results = await drive(url.href, [
        ...SKIP_WELCOME,
        call('./strategies.js', bot.startsWith('prepared-') ? 'prepared' : bot, 5, { lean: bot === 'prepared-lean' || bot === 'prepared-resourceful', resourceful: bot === 'prepared-resourceful' }),
        { eval: '({scenario:window.__sandbox.sim.goals.scenario?.id,errors:window.__qaErrors})' },
      ], { seed, diagnostics: true, settle: 3000, log: () => {} });
      const run = results.at(-2), status = results.at(-1);
      assert(run?.rows?.length, `No simulation rows: ${id}/${seed}/${bot}`);
      assert.equal(run.scenario, id);
      assert.equal(status.scenario, id);
      assert.deepEqual(status.errors, []);
      return run;
    } catch (error) {
      const transient = /navigated|closed|ready within|Chrome did not start|Access is denied for this document/.test(String(error));
      if (attempt === 3 || !transient) throw error;
      console.error(`Retry ${attempt}: ${id}/${seed}/${bot}: ${error.message}`);
    }
  }
}

const summary = [];
for (const id of scenarios) for (const seed of seeds) for (const bot of bots) {
  const file = join(out, `${id}-${seed}-${bot}.json`);
  const resumed = args.includes('--resume') && existsSync(file);
  // Resume only within one fixed fixture/configuration; use a new directory after changing it.
  const run = resumed ? JSON.parse(readFileSync(file, 'utf8')) : await runScenario(id, seed, bot);
  assert.equal(run.scenario, id);
  assert(run.scenarioNights?.length, 'Night-boundary measurements are required');
  if (!resumed) writeFileSync(file, JSON.stringify(run, null, 2));
  const row = describe(id, seed, bot, run);
  summary.push(row);
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(resumed ? 'Resumed' : 'Completed', JSON.stringify(row));
}
console.table(summary);
