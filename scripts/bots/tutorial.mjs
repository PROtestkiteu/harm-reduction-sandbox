// Browser integration: a real patrol and real visitor routes advance the authored map and UI.
import assert from 'node:assert/strict';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const args = process.argv.slice(2);
const index = args.indexOf('--url');
const url = new URL(index < 0 ? 'http://localhost:5199/' : args[index + 1]);
url.searchParams.set('scenario', 'tutorial');
url.searchParams.set('packs', 'none');
const results = await drive(url.href, [...SKIP_WELCOME, { eval: `(async () => {
  const s = window.__sandbox;
  const module = performance.getEntriesByType('resource').find(r => new URL(r.name).pathname === '/src/world/eventFx.ts');
  const { CAMP_AT } = s.CAMP_AT ? { CAMP_AT: s.CAMP_AT } : await import(module.name);
  const stages = [];
  const advance = async (target, seconds = 800) => {
    for (let i = 0; i < seconds * 30 && s.sim.tutorial.stage !== target; i++) {
      s.sim.tick(1 / 30);
      const pace = s.sim.pace, parts = Math.max(1, Math.ceil(pace));
      for (let p = 0; p < parts; p++) s.crowd.update(pace / 30 / parts);
      if (i % 900 === 0) { s.syncEvents(); await new Promise(requestAnimationFrame); }
    }
    s.syncEvents();
    await new Promise(resolve => setTimeout(resolve, 350));
    stages.push(s.sim.tutorial.stage);
  };
  const first = { stage: s.sim.tutorial.stage, locked: !s.sim.tutorialAllowsService('dropIn') };
  s.interaction.select({ kind: 'building', id: s.world.camps.park });
  s.interaction.selectLocation('footPatrol');
  const sent = s.sim.sendPatrol('camp', CAMP_AT);
  await advance('outreach');
  const patrol = { contacts: s.sim.tutorial.patrolContacts, returned: !s.sim.patrol.out };
  document.querySelectorAll('.tutorial-actions button')[0].focus();
  document.querySelectorAll('.tutorial-actions button')[0].click();
  await new Promise(resolve => setTimeout(resolve, 350));
  const skills = { reviewed: s.sim.tutorial.reviewedSkills, rows: document.querySelectorAll('.org-team .employee-skills').length, values: document.querySelectorAll('.org-team .employee-skill dd').length, teamOnly: document.getElementById('org-section').classList.contains('org-team-mode'), lockedOptions: [...document.querySelectorAll('.team-assign option[value="clinic"]')].every(o=>o.disabled && o.hidden), overflow: document.documentElement.scrollWidth > innerWidth };
  document.querySelector('#org-section').closest('.sheet').querySelector('.close').click();
  skills.focusReturned = !!document.activeElement?.closest('.tutorial-guide') && document.activeElement.isConnected;
  s.sim.setEnabled('outreach', true);
  await advance('dropIn');
  const ui = { stage: document.querySelector('.tutorial-guide').dataset.stage, budget: document.getElementById('hud').dataset.tutorialBudget, maintenance: document.getElementById('hud').dataset.tutorialMaintenance, organisation: document.getElementById('hud').dataset.tutorialOrganisation };
  return { first, sent, stages, patrol, skills, ui, popups: document.querySelectorAll('.event-popup[open]').length, visits: s.sim.tutorial.visits.outreach };
})()` }], { seed: 777, log: () => {} });
const result = results.at(-1);
console.log(JSON.stringify(result));
assert.equal(result.first.stage, 'meet'); assert(result.first.locked); assert(result.sent);
assert.deepEqual(result.stages, ['outreach', 'dropIn']); assert(result.patrol.contacts >= 3); assert(result.patrol.returned);
assert(result.skills.reviewed); assert(result.skills.focusReturned); assert(result.skills.rows > 0); assert.equal(result.skills.values, result.skills.rows * 4); assert(result.skills.teamOnly); assert(result.skills.lockedOptions); assert(!result.skills.overflow);
assert(result.visits >= 5); assert.equal(result.ui.stage, 'dropIn'); assert.equal(result.ui.budget, 'true');
assert.equal(result.ui.maintenance, 'true'); assert.equal(result.ui.organisation, 'false'); assert.equal(result.popups, 0);
console.log('Tutorial browser routes, milestone UI and crisis deferral: passed');
