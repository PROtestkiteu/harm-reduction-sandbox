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
const { Team } = await import('../../src/sim/team.ts');
const { SKILL_IDS, SKILL_MAX, SERVICE_SKILL_WEIGHTS } = await import('../../src/config/employeeSkills.ts');
const { SERVICE_IDS } = await import('../../src/sim/types.ts');
const { Simulation } = await import('../../src/sim/simulation.ts');
const { captureSave, parseSave, applySave } = await import('../../src/game/saveGame.ts');

// Recruitment stays deterministic and neither payment status nor a role creates a hard gate.
const a = new Team(123); const b = new Team(123); a.sync(2, 2); b.sync(2, 2);
assert.deepEqual(a.members, b.members);
assert(a.members.every(m => SKILL_IDS.every(id => m.skills[id] >= 0 && m.skills[id] <= SKILL_MAX)));
const person = a.members[0];
const baseline = Team.initialSkills('Test worker', []);
assert.deepEqual(Team.initialSkills('Test worker', []), baseline);
assert(Team.initialSkills('Test worker', ['nurse']).care > baseline.care);
assert(Team.initialSkills('Test worker', ['chemist']).analysis > baseline.analysis);
assert(Team.initialSkills('Test worker', ['peer']).outreach > baseline.outreach);
assert(Team.initialSkills('Test worker', ['social']).coordination > baseline.coordination);
assert.notDeepEqual(Team.initialSkills('Another worker', []), baseline);
for (const service of SERVICE_IDS) assert(Math.abs(Object.values(SERVICE_SKILL_WEIGHTS[service]).reduce((sum, n) => sum + n, 0) - 1) < 1e-12);

// Capacity modifiers stay small, and no service ever requires an individual skill threshold.
const worker = {...person, traits: [], special: null, energy: 1, morale: 1, hours: {}, skills: Object.fromEntries(SKILL_IDS.map(id => [id, 0]))};
for (const service of SERVICE_IDS) {
  assert(Math.abs(Team.skillFit(worker, service) + .12) < 1e-12);
  assert(Team.fit(worker, service) >= .4);
}
worker.skills = Object.fromEntries(SKILL_IDS.map(id => [id, 20]));
for (const service of SERVICE_IDS) assert(Math.abs(Team.skillFit(worker, service) - .18) < 1e-12);

// Practice uses ordinary shift hours, develops relevant skills, and stops at a bounded gain.
worker.skills = {...baseline}; worker.workingAt = 'outreach';
const training = new Team(321); training.members.push(worker);
const before = Team.skill(worker, 'outreach');
training.tick(1, false);
assert(Team.skill(worker, 'outreach') > before);
assert.equal(Team.skill(worker, 'analysis'), baseline.analysis);
worker.hours.outreach = 100000;
assert.equal(Team.skill(worker, 'outreach'), Math.min(20, baseline.outreach + 4));
worker.workingAt = null;
const rested = Team.skillProfile(worker); training.tick(2, false);
assert.deepEqual(Team.skillProfile(worker), rested);

// Existing automatic placement consumes skill-aware fit without any manual assignment.
const sim = new Simulation(123); sim.start();
sim.org.paid = 2; sim.org.volunteers = 0; sim.org.budget = 1000;
const candidates = sim.team.members.slice(0, 2).map((m, i) => ({...m, paid: true, traits: [], special: null, energy: 1, morale: 1, worn: false, assignment: 'auto', hours: {},
  skills: {outreach: 8, care: 8, analysis: i ? 0 : 20, coordination: i ? 20 : 0}}));
sim.team.members.splice(0, sim.team.members.length, ...candidates);
for (const id of SERVICE_IDS) {sim.services[id].switchedOn = id === 'dropIn'; sim.services[id].params.staff = id === 'dropIn' ? 1 : 0;}
sim.reallocate();
assert.equal(candidates[1].workingAt, 'dropIn');
assert(sim.services.dropIn.skill > Team.traitFit(candidates[1], 'dropIn'));
[candidates[0].skills, candidates[1].skills] = [candidates[1].skills, candidates[0].skills];
sim.reallocate(); assert.equal(candidates[0].workingAt, 'dropIn');
// A skilled crew changes real service capacity, not just its displayed rating.
sim.services.dropIn.params.staff = 2;
sim.services.dropIn.staffOnSite = 2;
for (const m of candidates) m.skills = Object.fromEntries(SKILL_IDS.map(id => [id, 0]));
sim.reallocate(); const lowCapacity = sim.services.dropIn.capacity;
for (const m of candidates) m.skills = Object.fromEntries(SKILL_IDS.map(id => [id, 20]));
sim.reallocate(); assert(sim.services.dropIn.capacity > lowCapacity);

// Baseline skills and accrued practice round-trip, including future growth after restoration.
candidates[0].hours = {outreach: 36, dropIn: 18};
const save = parseSave(JSON.parse(JSON.stringify(captureSave(sim, 'Skills'))));
assert(save);
const loaded = new Simulation(456); applySave(loaded, save);
const original = sim.team.members[0], restored = loaded.team.members[0];
assert.deepEqual(restored.skills, original.skills);
assert.deepEqual(Team.skillProfile(restored), Team.skillProfile(original));
original.hours.outreach += 18; restored.hours.outreach += 18;
assert.deepEqual(Team.skillProfile(restored), Team.skillProfile(original));

// Old saves derive stable baselines; malformed new fields cannot introduce NaN or unbounded fit.
const old = JSON.parse(JSON.stringify(save));
for (const m of old.team) delete m.skills;
const parsedOld = parseSave(old); const oldA = new Simulation(99), oldB = new Simulation(100);
applySave(oldA, parsedOld); applySave(oldB, parsedOld);
assert.deepEqual(oldA.team.members.map(m=>m.skills), oldB.team.members.map(m=>m.skills));
assert(oldA.team.members.every(m=>SKILL_IDS.every(id=>Number.isFinite(Team.skill(m,id)))));
const bad = JSON.parse(JSON.stringify(save));
bad.team[0].skills = {outreach: -1e9, care: 1e9, analysis: 8, coordination: 0};
const clamped = parseSave(bad); assert.equal(clamped.team[0].skills.outreach, 0); assert.equal(clamped.team[0].skills.care, 20);
bad.team[0].skills.analysis = 'not a skill';
assert.equal(parseSave(bad).team[0].skills, undefined);
assert.equal(save.team[0].skills.outreach, original.skills.outreach);
// Real people retain stable disclosed priorities, independent of substance or appearance.
const { personSupport, supportFit } = await import('../../src/sim/personSupport.ts');
for (let id = 1; id <= 100; id++) {
  const first = personSupport(id, {substance: 'stimulant', injects: false});
  assert.deepEqual(first.needs, personSupport(id, {substance: 'cannabis', injects: false}).needs);
  assert.deepEqual(first, personSupport(id, {substance: 'stimulant', injects: false}));
  assert(first.needs.length <= 2); assert.equal(new Set(first.needs).size, first.needs.length);
}
assert(personSupport(1, {substance:'stimulant',injects:false}).skills.includes('care'));
assert(personSupport(1, {substance:'cannabis',injects:false}).skills.includes('analysis'));
const withProfile = new Simulation(333); withProfile.start();
withProfile.profiles.set(401, {substance:'cannabis',injects:false});
assert.strictEqual(withProfile.supportOf(401), withProfile.supportOf(401));
assert.equal(withProfile.supportOf(999), undefined);
withProfile.forget(401); assert.equal(withProfile.supportOf(401), undefined);

// The same disclosed support reaches real admission, even before the staged matching intro.
const admission = (skill) => {
  const model = new Simulation(555); model.start();
  for (const member of model.team.members) {
    member.skills = Object.fromEntries(SKILL_IDS.map(id => [id, skill])); member.hours = {};
    member.traits = []; member.energy = 1; member.morale = 1; member.workingAt = 'dropIn';
  }
  model.profiles.set(402, {substance:'stimulant',injects:false});
  model.services.dropIn.enabled = true; model.services.dropIn.staffOnSite = 2;
  assert.equal(model.stakes.introduced('matching'), false);
  assert.equal(model.arrive('dropIn',402), 'admitted');
  return model;
};
const skilledVisit = admission(20), noviceVisit = admission(0);
assert.equal(supportFit(skilledVisit.team.members[0], skilledVisit.supportOf(402)), 1);
assert.equal(supportFit(noviceVisit.team.members[0], noviceVisit.supportOf(402)), 0);
assert(Math.abs(skilledVisit.recipientCare.visits.get(402).timeFactor / noviceVisit.recipientCare.visits.get(402).timeFactor - .85 / 1.35) < 1e-12);
assert.equal(skilledVisit.stakes.matchedTonight, 1); assert.equal(noviceVisit.stakes.matchedTonight, 0);
assert.equal(noviceVisit.stakes.admitted('dropIn',0), 1); // Anonymous/legacy early visits keep their grace period.

// Automatic staffing follows disclosed queued needs when ordinary service fit is otherwise equal.
const wanted = Array.from({length:500},(_,i)=>i+1).find(id => {
  const p=personSupport(id,{substance:'none',injects:false}); return p.needs.length===1 && p.needs[0]==='language';
});
assert(wanted);
const auto = new Simulation(999); auto.start(); auto.org.paid=2; auto.org.volunteers=0;
const fitting = auto.team.members.slice(0,2).map((m,i)=>({...m,paid:true,traits:[],energy:1,morale:1,special:null,worn:false,assignment:'auto',hours:{},
  skills:{outreach:i?16:0,care:i?0:16,coordination:8,analysis:8}}));
auto.team.members.splice(0,auto.team.members.length,...fitting);
assert.equal(Team.fit(fitting[0],'dropIn'),Team.fit(fitting[1],'dropIn'));
for(const service of SERVICE_IDS){auto.services[service].switchedOn=service==='dropIn';auto.services[service].params.staff=service==='dropIn'?1:0;}
auto.profiles.set(wanted,{substance:'none',injects:false});
auto.services.dropIn.queue.push({visitor:wanted,waited:0});
auto.reallocate(); assert.equal(fitting[1].workingAt,'dropIn'); assert.equal(fitting[0].workingAt,null);
console.log('Individual skills, practice, saves, stable person support, real admission and automatic need matching: passed.');
