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

const { RecipientCare, supportScore, visitScore, careRating, patience } = await import('../../src/sim/recipientCare.ts');
const { maximumSupport } = await import('../../src/config/recipientNeeds.ts');
const { Simulation } = await import('../../src/sim/simulation.ts');
const { captureSave, parseSave, applySave } = await import('../../src/game/saveGame.ts');
const { Reputation } = await import('../../src/sim/reputation.ts');
const { Team } = await import('../../src/sim/team.ts');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
const state = (id, completed) => ({ id, completed });
const worker = (id, paid = true, traits = [], workingAt = 'clinic') => ({ id, paid, traits, workingAt, energy: 1, name: `Worker ${id}` });
function fixture(workers = [worker(1, true, ['nurse'])], sites = ['clinic']) {
  const care = new RecipientCare(); const stock = { kits: 30, leaflets: 30 };
  const env = { workers, open: s => sites.includes(s), equipment: true, checking: true,
    has: s => stock[s] > 0, use: s => stock[s] > 0 && !!stock[s]--, timeFactor: () => 1 };
  return { care, env, stock };
}
function run(f, visitor, site = 'clinic', limit = 300) {
  f.care.activate(visitor);
  for (let i = 0; i < limit; i++) if (f.care.tick(site, 1, f.env).includes(visitor)) return;
  assert.fail('Visit did not finish');
}
check('Examples: 15, 45; average 22.5 including unmet state', () => {
  assert.equal(supportScore(state('jaw', { talk: 10, leaflet: 5 })), 15);
  assert.equal(supportScore(state('jaw', { talk: 30, leaflet: 5, kit: 10 })), 45);
  assert.equal(visitScore({ states: [state('jaw', { talk: 30, leaflet: 5, kit: 10 }), state('housing', {})] }), 22.5);
});
check('Exact rating boundaries, no rounding', () => {
  assert.deepEqual([0,5,5.001,40,40.001,80,80.001,100].map(careRating), ['none','none','bronze','bronze','silver','silver','gold','gold']);
});
check('Simple needs keep low maxima; best method replaces earlier tests', () => {
  assert.equal(maximumSupport('employment'), 35);
  assert.equal(supportScore(state('unknown', { talk: 30, leaflet: 5, strip: 5, tlc: 20, machine: 50 })),85);
});
check('Generation gives 1–5 distinct stable states', () => {
  const a = new RecipientCare(), b = new RecipientCare();
  for (let i=1;i<150;i++) { const v=a.ensure(i,'clinic'); assert(v.states.length>=1 && v.states.length<=5); assert.equal(new Set(v.states.map(s=>s.id)).size,v.states.length); assert.deepEqual(v,b.ensure(i,'clinic')); }
});
check('Nurse completes jaw support for 45; stocks consumed once', () => {
  const f=fixture(), v=f.care.ensure(1,'clinic',['jaw']); run(f,1); assert.equal(visitScore(v),45);
  assert.equal(f.stock.kits,29);assert.equal(f.stock.leaflets,29);
  assert.equal(f.care.finish(1),'silver');assert.equal(f.care.finish(1),undefined);assert.equal(f.care.pending.points,2);
});
check('Conversation upgrade adds only difference', () => {
  const f=fixture(),v=f.care.ensure(1,'clinic',['jaw']);v.states[0].completed.talk=10;run(f,1);assert.equal(visitScore(v),45);
});
check('Volunteer, paid worker and specialist have distinct conversation scores', () => {
  for (const [paid,traits,score] of [[false,[],5],[true,[],10],[false,['nurse'],30]]) {
    const f=fixture([worker(1,paid,traits)]);const v=f.care.ensure(1,'clinic',['jaw']);
    assert.equal(f.care.options(v,f.env.workers,f.env).find(o=>o.action==='talk').points,score);
  }
});
check('No stock means no item points; irrelevant kit not offered', () => {
  const f=fixture();f.stock.kits=f.stock.leaflets=0;const v=f.care.ensure(1,'clinic',['jaw']);run(f,1);assert.equal(visitScore(v),30);
  const social=f.care.ensure(2,'clinic',['employment']);assert(!f.care.options(social,f.env.workers,f.env).some(o=>o.action==='kit'));
});
check('Credentials and equipment gate analysis; calm is not psychologist', () => {
  const f=fixture([worker(1,true,['calm'],'drugChecking')],['drugChecking']);const v=f.care.ensure(1,'drugChecking',['unknown']);
  assert(!f.care.options(v,f.env.workers,f.env).some(o=>o.action==='machine'));
  f.env.workers[0].traits=['chemist'];f.env.equipment=false;assert(!f.care.options(v,f.env.workers,f.env).some(o=>o.action==='tlc'));
  const mental=f.care.ensure(2,'dropIn',['psychosis']);assert.equal(f.care.options(mental,[worker(2,true,['calm'],'dropIn')],f.env).find(o=>o.action==='talk').points,10);
});
check('One task per worker, urgency before visitor order', () => {
  const f=fixture();f.care.ensure(1,'clinic',['jaw']);f.care.ensure(2,'clinic',['psychosis']);f.care.activate(1);f.care.activate(2);f.care.tick('clinic',1,f.env);
  assert(!f.care.visits.get(1).task);assert(f.care.visits.get(2).task);assert.equal(f.care.visits.get(2).task.worker,1);
});
check('Shared equipment has one slot', () => {
  const f=fixture([worker(1,true,['chemist'],'drugChecking'),worker(2,true,['chemist'],'drugChecking')],['drugChecking']);
  for(const id of [1,2]) {const v=f.care.ensure(id,'drugChecking',['unknown']);v.states[0].completed={talk:30,leaflet:5};f.care.activate(id);}
  f.care.tick('drugChecking',1,f.env);assert.equal([...f.care.visits.values()].filter(v=>v.task?.action==='machine').length,1);
});
check('Pause leaves task and supplies unchanged', () => {
  const f=fixture();f.care.ensure(1,'clinic',['jaw']);f.care.activate(1);f.care.tick('clinic',1,f.env);const before=f.care.snapshot();f.care.tick('clinic',0,f.env);assert.deepEqual(f.care.snapshot(),before);
});
check('Specialist/leaflet time modifiers and 50% floor', () => {
  const f=fixture(),v=f.care.ensure(1,'clinic',['jaw']);v.states[0].completed.leaflet=5;
  assert.equal(f.care.options(v,f.env.workers,f.env).find(o=>o.action==='talk').remaining,6.75);
  f.env.timeFactor=()=>0.01;assert.equal(f.care.options(v,f.env.workers,f.env).find(o=>o.action==='talk').remaining,5);
});
check('Deferred assignment completes task; explicit interrupt grants nothing', () => {
  const f=fixture([worker(1,true,['nurse']),worker(2,true,['nurse'])]);const v=f.care.ensure(1,'clinic',['jaw']);f.care.activate(1);f.care.tick('clinic',1,f.env);
  f.care.assign(1,2);assert.equal(v.task.worker,1);assert.equal(v.nextWorker,2);
  f.care.tick('clinic',20,f.env);assert.equal(v.states[0].completed.talk,30);assert.equal(v.preferred,2);
  f.care.tick('clinic',1,f.env);f.care.assign(1,1,true);assert(!v.task);assert.equal(f.stock.kits,30);assert.equal(v.states[0].completed.kit,undefined);
});
check('Cross-site visit retains progress; only open useful destinations', () => {
  const f=fixture([worker(1,true,[],'outreach'),worker(2,true,['nurse'],'clinic')],['outreach','clinic']);const v=f.care.ensure(1,'outreach',['jaw']);
  run(f,1,'outreach');assert.equal(v.phase,'transfer');assert.equal(v.destination,'clinic');assert.equal(f.care.pending.points,0);
  const before=supportScore(v.states[0]);f.care.arrive(1,'clinic');run(f,1);assert.equal(visitScore(v),45);assert(visitScore(v)>before);assert.equal(f.care.finish(1),'silver');
});
check('Unavailable referral never creates transfer success', () => {
  const f=fixture([worker(1,true,[])]);const v=f.care.ensure(1,'clinic',['housing']);run(f,1);assert.equal(v.destination,undefined);assert.equal(v.phase,'active');
  assert.equal(f.care.refer(1,'shelter',f.env),false);
});
check('A single sample analysis covers both relevant states without double testing', () => {
  const f=fixture([worker(1,true,['chemist'],'drugChecking')],['drugChecking']);const v=f.care.ensure(1,'drugChecking',['unknown','adulteration']);let tests=0;f.env.completed=(_,a)=>{if(a==='machine')tests++;};run(f,1,'drugChecking');assert.equal(tests,1);assert.equal(visitScore(v),85);
});
check('Night boundary retains active visits; settlement is exactly once', () => {
  const f=fixture();const v=f.care.ensure(1,'clinic',['jaw']);v.states[0].completed={talk:30,leaflet:5,kit:10};f.care.finish(1);f.care.ensure(2,'clinic',['housing']);
  assert.equal(f.care.settle(0).points,2);assert(f.care.visits.has(2));assert.equal(f.care.settle(0).points,0);assert.equal(f.care.settle(1).points,0);
});
check('Save restores active progress, pending awards and settlement marker', () => {
  const f=fixture();f.care.ensure(1,'clinic',['jaw']);f.care.activate(1);f.care.tick('clinic',1,f.env);f.care.tick('clinic',2,f.env);
  f.care.pending={none:0,bronze:1,silver:2,gold:1,points:8};f.care.lastNight=4;
  const saved=f.care.snapshot(), copy=new RecipientCare();copy.restore(saved);assert.deepEqual(copy.snapshot(),saved);assert.equal(copy.settle(4).points,0);assert.equal(copy.settle(5).points,8);
});
check('Corrupt save ignores invalid IDs, rewards, activities and duplicate reservations', () => {
  const f=fixture();const v=f.care.ensure(1,'clinic',['jaw']);f.care.activate(1);f.care.tick('clinic',1,f.env);
  const raw=f.care.snapshot();raw.visits.push({...structuredClone(v),visitor:2});raw.visits.push({...structuredClone(v),visitor:3,states:[{id:'bogus',completed:{}}]});raw.pending.points=999;
  const copy=new RecipientCare();copy.restore(raw);assert.equal(copy.visits.size,2);assert.equal([...copy.visits.values()].filter(v=>v.task).length,1);assert.equal(copy.pending.points,0);
});
check('Reputation cumulative, migration retains all unlocks, modern save idempotent', () => {
  const r=new Reputation();assert.equal(r.score,0);r.tick(10000,1,1.5,0);assert.equal(r.score,0);r.award(200);assert.equal(r.score,200);
  r.restore({score:40,progress:.4,earned:['partnership']},0,0);assert.equal(r.score,70);assert(r.earned.has('partnership'));assert.equal(r.progress,.4);
  const snap=r.snapshot();r.restore(snap,0,0);assert.deepEqual(r.snapshot(),snap);
});
check('Real save parser preserves worker identity, task, queues and resources without admission costs', () => {
  const sim=new Simulation(12);sim.start();sim.team.members[0].id=77;
  const member=sim.team.members[0];member.assignment='clinic';member.workingAt='clinic';member.traits=['nurse'];
  const v=sim.recipientCare.ensure(900,'clinic',['jaw']);sim.recipientCare.activate(900);sim.services.clinic.inService.set(900,0);
  sim.recipientCare.tick('clinic',1,sim.careEnvironment());sim.recipientCare.tick('clinic',2,sim.careEnvironment());
  const waiting=sim.recipientCare.ensure(901,'clinic',['housing']);waiting.waited=12;sim.services.clinic.queue.push({visitor:901,waited:3});
  const before=sim.recipientCare.snapshot(), budget=sim.org.budget,stock=sim.stakes.supplies.stock.kits;
  const parsed=parseSave(captureSave(sim,'Care'));assert(parsed);const loaded=new Simulation(13);applySave(loaded,parsed);
  assert.equal(loaded.team.members[0].id,77);assert.deepEqual(loaded.recipientCare.snapshot(),before);assert.equal(loaded.org.budget,budget);assert.equal(loaded.stakes.supplies.stock.kits,stock);
  assert(loaded.services.clinic.inService.has(900));assert.equal(loaded.services.clinic.queue[0].visitor,901);
});
check('Closure lets current action finish but starts no further action', () => {
  const f=fixture();const v=f.care.ensure(1,'clinic',['jaw']);f.care.activate(1);f.care.tick('clinic',1,f.env);f.env.open=()=>false;
  f.care.tick('clinic',20,f.env);assert.equal(v.states[0].completed.talk,30);assert(f.care.tick('clinic',1,f.env).includes(1));assert.equal(f.stock.kits,30);
});
check('Requested priorities deduplicate and keep explicit count', () => {
  const c=new RecipientCare();assert.equal(c.ensure(77,'clinic',['jaw','jaw','housing']).states.length,2);
});
check('Real queue warns, escalates and records unavailable referral as unmet', () => {
  const sim=new Simulation(5);sim.start();for(const site of Object.values(sim.services))site.staffOnSite=0;
  const v=sim.recipientCare.ensure(800,'clinic',['jaw','housing','unknown','paranoia','badTrip']);
  sim.services.clinic.queue.push({visitor:800,waited:0});sim.tickService(sim.services.clinic,22);assert(v.escalated);
  sim.tickService(sim.services.clinic,10);assert(!sim.recipientCare.visits.has(800));assert.equal(sim.recipientCare.pending.none,1);
});
check('Real queue transfers only to an available qualified destination', () => {
  const sim=new Simulation(5);sim.start();for(const site of Object.values(sim.services))site.staffOnSite=0;
  const m=sim.team.members[0];m.workingAt='shelter';m.traits=['social'];m.energy=1;
  sim.services.shelter.enabled=true;sim.services.shelter.staffOnSite=1;
  const v=sim.recipientCare.ensure(801,'clinic',['housing']);sim.services.clinic.queue.push({visitor:801,waited:0});
  sim.tickService(sim.services.clinic,61);assert.equal(v.destination,'shelter');assert.equal(v.phase,'queued');
  sim.tickService(sim.services.clinic,10);assert.equal(v.phase,'transfer');assert.equal(sim.recipientCare.pending.points,0);
});
check('Deferred referral finishes current activity and reserves its coordinator', () => {
  const f=fixture([worker(1,true,[],'outreach'),worker(2,true,['nurse'],'clinic')],['outreach','clinic']);const v=f.care.ensure(1,'outreach',['jaw']);
  f.care.activate(1);f.care.tick('outreach',1,f.env);assert(v.task);const activity={...v.task};assert(f.care.refer(1,'clinic',f.env));
  f.care.tick('outreach',10,f.env);assert.equal(v.states[activity.state].completed[activity.action],activity.points);
  f.care.tick('outreach',1,f.env);assert.equal(v.referralWorker,1);assert(!v.task);
  f.care.tick('outreach',10,f.env);assert.equal(v.phase,'transfer');assert.equal(v.destination,'clinic');
});
check('Permission removal cancels active analysis before credit or spending', () => {
  const f=fixture([worker(1,true,['chemist'],'drugChecking')],['drugChecking']);const v=f.care.ensure(1,'drugChecking',['unknown']);
  v.states[0].completed={talk:30,leaflet:5};f.care.activate(1);f.care.tick('drugChecking',1,f.env);assert.equal(v.task.action,'machine');
  f.env.checking=false;f.care.tick('drugChecking',40,f.env);assert.equal(v.states[0].completed.machine,undefined);
});
check('A disappearing avatar releases service capacity and cannot award twice', () => {
  const sim=new Simulation(12);sim.start();sim.recipientCare.ensure(900,'clinic',['jaw']);sim.services.clinic.inService.set(900,0);
  sim.forget(900);assert(!sim.services.clinic.inService.has(900));sim.forget(900);assert.equal(sim.recipientCare.pending.none,1);
});
check('Simulation pause freezes queue and active care', () => {
  const sim=new Simulation(12);sim.start();sim.cycle=false;const v=sim.recipientCare.ensure(900,'clinic',['jaw']);
  sim.services.clinic.queue.push({visitor:900,waited:0});sim.tickService(sim.services.clinic,100);assert.equal(v.waited,0);assert.equal(sim.recipientCare.pending.none,0);
});
check('A matched group packet covers relevant states once without helping unrelated states', () => {
  const f=fixture(),v=f.care.ensure(1,'clinic',['jaw','nosebleed','employment']);run(f,1);
  assert.equal(v.states[0].completed.kit,10);assert.equal(v.states[1].completed.kit,10);assert.equal(v.states[2].completed.kit,undefined);
  assert.equal(f.stock.kits,29);assert.equal(f.stock.leaflets,28);
});
check('Calibrated state-count distribution keeps five-state visits rare and reproducible', () => {
  const c=new RecipientCare(), counts=[0,0,0,0,0];for(let i=1;i<=10000;i++)counts[c.ensure(i,'clinic').states.length-1]++;
  for(const [i,expected] of [4500,2500,1500,1000,500].entries())assert(Math.abs(counts[i]-expected)<180,JSON.stringify(counts));
});
check('Real fixed-step care progresses equally at 1x and 3x clock speeds', () => {
  const models=[1,3].map(speed=>{const sim=new Simulation(333);sim.start();sim.configure({clockSpeed:speed});sim.org.budget=10000;
    const m=sim.team.members[0];m.assignment='dropIn';m.workingAt='dropIn';m.traits=['psychologist'];m.energy=1;
    sim.services.dropIn.enabled=true;sim.services.dropIn.staffOnSite=2;
    sim.recipientCare.ensure(900,'dropIn',['psychosis','loneliness']);sim.recipientCare.activate(900);sim.services.dropIn.inService.set(900,0);
    for(let i=0;i<600;i++)sim.tick(1/30/speed);return sim;});
  assert(Math.abs(models[0].org.now-models[1].org.now)<1e-7);
  const normalized=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v));
  assert.deepEqual(normalized(models[0].recipientCare.snapshot()),normalized(models[1].recipientCare.snapshot()));
});
check('TLC is available before instrumental equipment and yields silver rather than gold', () => {
  const f=fixture([worker(1,true,['chemist'],'drugChecking')],['drugChecking']);f.env.machine=false;
  const v=f.care.ensure(1,'drugChecking',['unknown']);run(f,1,'drugChecking');assert.equal(v.states[0].completed.tlc,20);assert.equal(v.states[0].completed.machine,undefined);assert.equal(visitScore(v),55);
});
check('Saving just before morning preserves the pending night settlement', () => {
  const sim=new Simulation(123);sim.start();sim.clockMinutes=1920-.1;sim.recipientCare.pending={none:0,bronze:1,silver:0,gold:0,points:1};
  const save=parseSave(captureSave(sim,'Before morning'));assert(save.clock<1920);
  const loaded=new Simulation(2);applySave(loaded,save);loaded.tick(.2);assert.equal(loaded.reputation.score,1);assert.equal(loaded.totals.nights,1);
  loaded.tick(.2);assert.equal(loaded.reputation.score,1);
});
console.log(`${checks} recipient-care checks passed`);
