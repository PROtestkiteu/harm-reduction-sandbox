/** Deterministic domain and simulation regression checks, without a browser or renderer. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      const candidate = [`${base.href}.ts`, `${base.href}/index.ts`].find((url) => existsSync(fileURLToPath(url)));
      if (candidate) return { url: candidate, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
  },
});
const { TutorialProgress } = await import('../../src/game/tutorial.ts');
const { Simulation } = await import('../../src/sim/simulation.ts');
const { captureSave, parseSave, applySave } = await import('../../src/game/saveGame.ts');
const { SERVICE_IDS } = await import('../../src/sim/types.ts');
const { ORG } = await import('../../src/config/organisation.ts');
const fresh = () => { const sim = new Simulation(123); sim.startTutorial(); sim.start(); return sim; };

let p = new TutorialProgress();
assert.equal(p.stage, 'meet');
p.openPatrol(); assert.equal(p.stage, 'meet');
p.inspectCamp(); assert.equal(p.stage, 'patrol');
p.patrol(3, false); assert.equal(p.stage, 'patrol');
p.patrol(0, true); assert.equal(p.stage, 'outreach');
p.served('dropIn'); assert.equal(p.visits.dropIn, undefined);
for (let i = 0; i < 5; i++) p.served('outreach');
assert.equal(p.stage, 'outreach', 'visits alone do not skip the skills review');
assert.equal(TutorialProgress.restore(p.snapshot()).reviewedSkills, false);
p.reviewSkills(); assert.equal(p.stage, 'dropIn');
assert.equal(TutorialProgress.restore(p.snapshot()).reviewedSkills, true);
p = TutorialProgress.restore({ ...p.snapshot(), stage: 'outreach', visits: {} });
for (const [service, stage] of [['outreach', 'dropIn'], ['dropIn', 'nightlife'], ['clubHr', 'night']]) {
  for (let i = 0; i < 4; i++) p.served(service);
  assert.notEqual(p.stage, stage);
  p.served(service); assert.equal(p.stage, stage);
  assert(p.claimReward());
  const restored = TutorialProgress.restore(p.snapshot());
  assert(restored); assert.equal(restored.stage, stage); assert(!restored.claimReward());
}
p.night(false); assert.equal(p.stage, 'night');
p.night(true); assert.equal(p.stage, 'complete'); assert(!p.active);
assert.equal(TutorialProgress.restore({ version: 1, stage: 'bad' }), null);
assert.equal(TutorialProgress.restore({ version: 1, stage: 'patrol', patrolContacts: NaN }).patrolContacts, 0);

const sim = fresh();
const notices = []; sim.on((e) => notices.push(e));
assert.deepEqual(sim.tutorialCapabilities.services, ['footPatrol']);
assert.equal(sim.runningPerHour, ORG.runningPerPlace);
const initial = sim.org.budget;
sim.setEnabled('dropIn', true); sim.assignMember(sim.team.members[0].id, 'clinic');
assert(!sim.services.dropIn.switchedOn);
assert.notEqual(sim.team.members[0].assignment, 'clinic');
assert(!sim.openPoint(0, 'dropIn')); assert(!sim.rentUnit(0, 'outreach'));
assert(!sim.sendCamper(0)); assert(!sim.invest('clinic'));
assert(!sim.sendPatrol('camp'));
sim.configure({ orgBudget: 1, 'clinic.staff': 50 });
assert.equal(sim.org.budget, initial); assert.notEqual(sim.services.clinic.params.staff, 50);
for (let i = 0; i < 500; i++) sim.tick(1 / 30);
for (const id of SERVICE_IDS.filter((id) => id !== 'footPatrol')) {
  assert.equal(sim.services[id].metrics.demand, 0); assert.equal(sim.services[id].metrics.unmetNeed, 0);
  assert.equal(sim.services[id].assigned, 0);
}
assert(!notices.some((e) => e.type === 'spawnCar' || e.type === 'storm' || e.type === 'runOver'));
assert(!notices.some((e) => e.type === 'spawnVisitor' && e.intent !== 'footPatrol'));
sim.tutorialInspectCamp(); sim.tutorialOpenPatrol();
assert(sim.sendPatrol('camp'));
for (let i = 0; i < 4000 && sim.tutorial.stage === 'patrol'; i++) sim.tick(1 / 10);
assert.equal(sim.tutorial.stage, 'outreach');
assert(sim.tutorial.patrolContacts >= 3);
assert.equal(sim.patrol.out, false);
// Newly unlocked demand must become finite after spending a stage with zero demand.
sim.setEnabled('outreach', true);
notices.length = 0;
for (let i = 0; i < 600; i++) sim.tick(1 / 10);
assert(notices.some((e) => e.type === 'spawnVisitor' && e.intent === 'outreach'));
sim.org.budget = 0; sim.org.paid = 0;
sim.tick(1); assert(sim.org.budget > 0); assert(sim.org.paid >= 3); assert.equal(sim.stakes.runOver, null);

// Every stage round-trips exactly, reward receipts included, and old saves stay unrestricted.
for (const stage of ['meet', 'patrol', 'outreach', 'dropIn', 'nightlife', 'night', 'complete']) {
  const source = fresh();
  source.tutorial = TutorialProgress.restore({ ...source.tutorial.snapshot(), stage, rewards: [stage] });
  const save = parseSave(JSON.parse(JSON.stringify(captureSave(source, 'Test'))));
  assert(save); assert(save.sandboxed);
  const target = new Simulation(456); applySave(target, save);
  assert.deepEqual(target.tutorial.snapshot(), source.tutorial.snapshot());
  assert(!target.tutorial.claimReward());
  for (const id of SERVICE_IDS) if (!target.tutorialAllowsService(id)) assert.equal(target.services[id].assigned, 0);
  delete save.tutorial; applySave(target, save); assert.equal(target.tutorial, null);
}
// Exercise the complete ladder through actual service completions and a fresh night report.
const ladder = fresh();
ladder.tutorialInspectCamp(); ladder.tutorialOpenPatrol(); assert(ladder.sendPatrol('camp'));
for (let i = 0; i < 4000 && ladder.tutorial.stage === 'patrol'; i++) ladder.tick(1 / 10);
let visitor = 100000;
ladder.tutorial.reviewSkills();
for (const [service, expected] of [['outreach', 'dropIn'], ['dropIn', 'nightlife'], ['clubHr', 'night']]) {
  ladder.setEnabled(service, true); ladder.staffArrived(service);
  for (let i = 0; i < 5; i++) {
    assert.equal(ladder.arrive(service, visitor++), 'admitted', JSON.stringify({ service, i, stage: ladder.tutorial.stage, status: ladder.services[service].status, reason: ladder.services[service].closedReason, staff: ladder.services[service].staffOnSite, inside: ladder.services[service].inService.size, queue: ladder.services[service].queue.length, now: ladder.org.now }));
    for (let j = 0; j < 120 && ladder.services[service].inService.size; j++) ladder.tick(1);
  }
  assert.equal(ladder.tutorial.stage, expected);
}
assert.equal(ladder.tutorial.active, true);
ladder.tick(0.1);
// Natural 06:00 club closure must not prevent the 08:00 completion report.
ladder.clockMinutes = 30 * 60 - 0.1; ladder.tick(0.1);
assert.equal(ladder.services.clubHr.assigned, 0);
ladder.clockMinutes = 32 * 60 - 0.1; ladder.tick(0.1);
assert.equal(ladder.tutorial.stage, 'complete'); assert.equal(ladder.stakes.hardcore, false);
assert.equal(ladder.stakes.runOver, null);
const ordinary = []; ladder.on((event) => ordinary.push(event));
for (let i = 0; i < 200; i++) ladder.tick(0.1);
assert(ordinary.some((event) => event.type === 'spawnVisitor' && event.intent === 'passerby'));
console.log('Tutorial progression, guards, recovery, unlocked demand and save compatibility: passed.');

assert.equal(parseSave({ ...captureSave(fresh(), 'Seed'), worldSeed: 123456 }).worldSeed, 123456);
assert.equal(parseSave({ ...captureSave(fresh(), 'Seed'), worldSeed: -1 }).worldSeed, undefined);
