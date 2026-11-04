// Save round trip check: state that must survive a reload through the resume
// path (the update reload: sessionStorage RESUME_KEY with captureSave), an old
// save without the newer fields, and the Sandbox mark that keeps a run off the
// leaderboard.
//
//   npm run dev                                   (in another terminal)
//   node scripts/bots/saves.mjs [--url http://localhost:5199/]
//
// Each case changes the live game, saves it as the update reload does, reloads
// the page and reads the game back. Exits 1 if any check fails.

import { drive, SKIP_WELCOME } from './chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const url = opt('url', 'http://localhost:5199/');

/**
 * Page side: the modules the game itself loaded. The dev server adds `?t=` to a module edited
 * since it started, so each is imported by the exact URL the page used (the same instance).
 */
const MODS = `const mod = (path) => window.__sandbox.modules?.[path] ? Promise.resolve(window.__sandbox.modules[path]) : import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => new URL(n).pathname === path) ?? path);
  const sg = await mod('/src/game/saveGame.ts');
  const { RESUME_KEY } = await mod('/src/game/updates.ts');
  const { GRANTS } = await mod('/src/config/organisation.ts');
  const marks = await mod('/src/game/sandboxed.ts');
  const lb = await mod('/src/game/leaderboard.ts');
  const sim = window.__sandbox.sim;`;

/** What the checks read back after a load. */
const READ = `({
  favours: sim.favours,
  concessionOwed: sim.concessionAt !== null,
  budget: Math.round(sim.org.budget),
  grant: sim.org.applications.councilGrant.status,
  grantIncome: sim.org.grantIncome,
  canApplyAgain: (() => { const b = sim.org.budget; const ok = sim.org.apply('councilGrant', sim.clockMinutes); if (ok) { sim.org.applications.councilGrant = { status: 'idle' }; sim.org.budget = b; } return ok; })(),
  police: +sim.cityStress.police.toFixed(3), medics: +sim.cityStress.medics.toFixed(3), sobering: +sim.cityStress.sobering.toFixed(3),
  now: Math.round(sim.org.now),
  concessionInMin: sim.concessionAt === null ? null : Math.round(sim.concessionAt - sim.org.now),
  broke: sim.org.broke,
  sandboxed: marks.isSandboxed(),
  submitDisabled: document.querySelector('.save-submit')?.disabled ?? null,
  whyShown: document.getElementById('save-off-board')?.hidden === false,
  morale: +(sim.team.members[0]?.morale ?? -1).toFixed(3),
  special: sim.team.members[0]?.special ?? null,
  storm: sim.stakes.storm.phase, prepared: [...sim.stakes.storm.prepared].join(','),
  naloxone: sim.stakes.supplies.stock.naloxone, points: Math.round(sim.stakes.standing.points),
})`;

/** Saves as the update reload does and reloads; `strip` removes the newer fields first (an old save). */
const saveAndReload = (strip, plainAddress = false) => `(async () => { ${MODS}
  const save = sg.captureSave(sim, 'Check', undefined);
  if (${strip}) { delete save.more; delete save.rev; delete save.sandboxed; for (const m of save.team) { delete m.worn; delete m.morale; delete m.hours; delete m.special; } }
  const text = JSON.stringify(save);
  sessionStorage.setItem(RESUME_KEY, text);
  // A plain address: only the save can carry the mark (the address's settings would mark it too).
  setTimeout(() => { if (${plainAddress}) history.replaceState(null, '', location.pathname + '?play=1'); location.reload(); }, 50);
  return { bytes: text.length, liveSaveChars: sg.encodeSave(save).length };
})()`;

const steps = [
  ...SKIP_WELCOME,
  // 1. Use the city hall favour, win the council grant, push the stress meters.
  { eval: `(async () => { ${MODS}
    // Some hours of play first, so the game's own minute count is well past a fresh page's.
    for (let i = 0; i < 9000; i++) sim.tick(1 / 30);
    const b0 = sim.org.budget;
    const used = sim.askFavour('funding');
    sim.org.applications.councilGrant = { status: 'approved', at: sim.clockMinutes };
    sim.org.grantIncome += GRANTS.councilGrant.reward.incomePerHour;
    Object.assign(sim.cityStress, { police: 0.83, medics: 0.61, sobering: 0.47 });
    // Morale, a specialism, a storm being prepared for, stock and standing (sim/stakes.ts).
    sim.team.members[0].morale = 0.42;
    sim.team.members[0].special = 'dropIn';
    Object.assign(sim.stakes.storm, { phase: 'warned', kind: 'freeze' });
    sim.stakes.storm.prepared.add('beds');
    sim.stakes.supplies.stock.naloxone = 17;
    sim.stakes.standing.points = 77;
    return { case: 'before reload', used, favourMoney: Math.round(sim.org.budget - b0), ...${READ} };
  })()` },
  { eval: saveAndReload(false) },
  { wait: 12000, ready: true },
  { eval: `(async () => { ${MODS} return { case: 'after reload (new save)', ...${READ} }; })()` },
  // 2. An old save: the same game without the newer fields loads with start values.
  { eval: saveAndReload(true) },
  { wait: 12000, ready: true },
  { eval: `(async () => { ${MODS} return { case: 'after reload (old-format save)', ...${READ} }; })()` },
  // 3. The Sandbox budget slider marks the run; the mark survives a reload and the submit button is off.
  { eval: `(async () => { ${MODS}
    const input = document.getElementById('param-orgBudget');
    input.value = '5000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    window.__sandbox.syncEvents();
    return { case: 'after the budget slider', ...${READ} };
  })()` },
  { eval: saveAndReload(false, true) },
  { wait: 12000, ready: true },
  { eval: `(async () => { ${MODS}
    let refused = '';
    try { await lb.submitScore({ id: 'x', ts: 0, token: 'x' }, 'Check', 1, 1); } catch (e) { refused = e.message; }
    return { case: 'after reload (sandboxed run)', refused, ...${READ} };
  })()` },
];

const results = await drive(url, steps, { log: () => {} });
// The first result is the welcome skip's.
const [, before, sizes, after, , old, slider, , marked] = results;
for (const r of [before, sizes, after, old, slider, marked]) console.log(JSON.stringify(r));

const fail = [];
const near = (a, b) => Math.abs(a - b) < 0.05;
if (after.favours !== 0 || !after.concessionOwed) fail.push('favour came back after reload');
if (after.grant !== 'approved' || after.canApplyAgain) fail.push('approved grant can be won again after reload');
if (!near(after.police, 0.83) || !near(after.medics, 0.61) || !near(after.sobering, 0.47)) fail.push('stress meters not kept');
if (after.now < before.now || Math.abs(after.concessionInMin - before.concessionInMin) > before.now - after.now + 30) fail.push('org.now or the concession deadline moved');
if (old.favours !== 1 || old.grant !== 'idle') fail.push('old save did not load with start values');
if (!slider.sandboxed || !marked.sandboxed || marked.submitDisabled !== true || !marked.whyShown || !marked.refused) fail.push('sandbox mark not kept or not enforced');
if (!near(after.morale, 0.42) || after.special !== 'dropIn') fail.push('morale or specialism not kept');
if (after.storm !== 'warned' || after.prepared !== 'beds' || after.naloxone < 15 || after.naloxone > 17 || Math.abs(after.points - 77) > 6) fail.push('storm, supplies or standing not kept');
if (!near(old.morale, 0.7) || old.special !== null || old.naloxone > 6 || old.naloxone < 4 || old.points > 6) fail.push('old save did not start morale, stock and standing fresh');
if (sizes.liveSaveChars > 12000) fail.push(`live save too big: ${sizes.liveSaveChars} chars`);
console.log(fail.length ? `FAIL: ${fail.join('; ')}` : 'all save checks passed');
process.exit(fail.length ? 1 : 0);
