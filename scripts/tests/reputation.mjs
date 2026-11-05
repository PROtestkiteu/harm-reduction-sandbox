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

const { Reputation } = await import('../../src/sim/reputation.ts');
const { reputationRate } = await import('../../src/config/reputation.ts');
const { favourView } = await import('../../src/sim/favourView.ts');
const near = (a,b) => assert(Math.abs(a-b)<1e-8, `${a} != ${b}`);
assert.deepEqual([0,14.99,15,54.99,55,200].map(reputationRate), [.25,.25,.5,.5,.75,.75]);
const r = new Reputation();
near(r.score,0); assert.equal(r.capacity,2);
r.tick(1440,1,1.5,1); near(r.score,0); r.award(35);
assert(r.earned.has('protocol')); assert(!r.earned.has('mandate'));
const one = new Reputation(), many = new Reputation();
one.award(55);many.award(55);
let a = one.tick(1440,1,1.5,0), b=0;
for(let i=0;i<1440;i++) b=many.tick(1,1,1.5,b);
near(one.score,many.score);near(one.progress,many.progress);assert.equal(a,b);
const frozen = one.snapshot(); assert.equal(one.tick(0,0,0.25,a),a);assert.deepEqual(one.snapshot(),frozen);
const stable = new Reputation();stable.restore({version:2,score:35,progress:0,earned:['credibility']},.5,1);
stable.tick(1440,.5,.875,0);near(stable.progress,.5);near(stable.score,35);
stable.tick(1440,.5,.875,2);near(stable.progress,0);
stable.restore({version:2,score:200,progress:.9,earned:[]},1,1.5);assert.equal(stable.capacity,3);
assert.equal(stable.tick(1440,1,1.5,2),3);near(stable.progress,0);
const earned=stable.snapshot().earned;stable.tick(144000,0,.25,0);assert.deepEqual(stable.snapshot().earned,earned);
const saved=stable.snapshot(), copy=new Reputation();copy.restore(saved,0,0.25);assert.deepEqual(copy.snapshot(),saved);
copy.restore(undefined,.5,1);assert(copy.earned.has('community'));assert(copy.earned.has('relationship'));near(copy.score,15);near(copy.progress,0);
copy.restore({score:NaN,progress:Infinity,earned:['bogus','mandate','protocol']},0,.25);assert.equal(copy.score,55);assert.equal(copy.progress,0);assert.equal(copy.capacity,3);
const fresh = new Reputation();
assert(favourView(fresh,1,false,false).items.find(i=>i.id==='funding').available);
assert(!favourView(fresh,1,false,false).items.find(i=>i.id==='police').available);
assert(favourView(fresh,2,true,false).items.every(i=>!i.available));
assert(favourView(fresh,2,false,true).items.every(i=>!i.available));
assert(favourView(fresh,0,false,false).items.every(i=>!i.available));
console.log('Reputation: cumulative awards, thresholds, step parity, pause, cap, permanence, migration and availability passed');

// Real simulation entry points and canonical save parser.
const { Simulation } = await import('../../src/sim/simulation.ts');
const { captureSave, parseSave, applySave } = await import('../../src/game/saveGame.ts');
const sim = new Simulation(123); sim.start();
assert.equal(sim.reputation.score,0);assert.equal(sim.favours,1);
assert.equal(sim.askFavour('police'),false);
const budget=sim.org.budget;
assert(sim.askFavour('funding'));assert.equal(sim.org.budget,budget+300);
const debt=sim.concessionAt;assert(debt>=sim.org.now+360 && debt<=sim.org.now+1080);
sim.favours=2;assert.equal(sim.askFavour('funding'),false);assert.equal(sim.concessionAt,debt);
sim.answerConcession('cleanUp',true);assert.equal(sim.favours,2);
const paid=sim.org.budget;sim.answerConcession('cleanUp',true);assert.equal(sim.org.budget,paid);
assert(sim.askFavour('funding'));const held=sim.favours;sim.answerConcession('camperOff',false);assert.equal(sim.favours,held);
sim.reputation.restore({score:95,progress:.45,earned:[]},1,1.5);sim.favours=3;
assert(sim.askFavour('camp'));const until=sim.campHoldUntil;assert.equal(until,sim.org.now+72*60);
const save=parseSave(captureSave(sim,'Reputation test'));assert(save);
const loaded=new Simulation(456);applySave(loaded,save);
assert.deepEqual(loaded.reputation.snapshot(),sim.reputation.snapshot());assert.equal(loaded.favours,sim.favours);assert.equal(loaded.campHoldUntil,until);assert(Math.abs(loaded.concessionAt-sim.concessionAt)<=.05);
const old=structuredClone(save);delete old.more.city.reputation;old.more.city.favours=1;
const migrated=new Simulation(789);applySave(migrated,parseSave(old));assert.equal(migrated.favours,1);assert(migrated.reputation.earned.has('community'));assert(migrated.reputation.earned.has('relationship'));assert(Math.abs(migrated.concessionAt-sim.concessionAt)<=.05);
const ancient=structuredClone(old);delete ancient.more;delete ancient.rev;const legacy=new Simulation(44);applySave(legacy,parseSave(ancient));assert(legacy.reputation.earned.has('relationship'));assert.equal(legacy.reputation.score,15);
const tutorial=new Simulation(13);tutorial.startTutorial();tutorial.start();const snap=tutorial.reputation.snapshot();tutorial.tick(3600);assert.deepEqual(tutorial.reputation.snapshot(),snap);assert.equal(tutorial.askFavour('funding'),false);
console.log('Simulation: spend guards, repeated decisions, concessions, upgraded expiry, save round trip, both legacy revisions and tutorial suppression passed');
