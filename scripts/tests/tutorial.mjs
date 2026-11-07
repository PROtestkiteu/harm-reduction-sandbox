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
const fresh = () => { const sim = new Simulation(123); sim.startTutorial(); sim.serviceSites.footPatrol={kind:'curb',id:0}; sim.setEnabled('footPatrol',true); sim.start(); for(let i=0;i<sim.services.footPatrol.assigned;i++)sim.staffArrived('footPatrol'); return sim; };
const arriveCrew = (sim) => {
  assert(sim.patrol.returning, 'Timer expiry starts the return walk');
  assert.equal(sim.tutorial.stage, 'patrol', 'No next lesson before physical arrivals');
  assert(!sim.patrolReady, 'Cannot redispatch workers who are still returning');
  const count = sim.services.footPatrol.assigned;
  assert(count > 0);
  for (let i = 0; i < count; i++) {
    if (i < count - 1) assert.equal(sim.tutorial.stage, 'patrol');
    sim.staffArrived('footPatrol');
  }
  assert(!sim.patrol.returning);
};


const campOnly = new TutorialProgress();
campOnly.inspectCamp();
assert.equal(campOnly.stage, 'patrol', 'Camp selection exposes dispatch without visiting another panel');
assert.equal(campOnly.snapshot().openedPatrol, false);
const legacyCamp = TutorialProgress.restore({...campOnly.snapshot(), stage:'meet'});
assert.equal(legacyCamp.stage, 'patrol', 'Recover saves stuck after selecting the camp');
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
// Right-click and long-press must dispatch to the tutorial's accepted destination.
const { patrolMapTarget } = await import('../../src/game/patrolMapTarget.ts');
const camp = { x: -25, z: 80 }, ground = { x: 5, z: 10 }, crisis = { x: 6, z: 11 };
assert.equal(patrolMapTarget(true, null, null, camp), null);
assert.equal(patrolMapTarget(true, ground, null, camp), null, 'no camp action on unrelated ground');
assert.equal(patrolMapTarget(true, ground, crisis, camp), null, 'no camp action on unrelated people');
assert.deepEqual(patrolMapTarget(false, ground, null, camp, true), { spot: 'camp', at: camp });
assert.deepEqual(patrolMapTarget(false, ground, null, camp), { spot: 'street', at: ground });
assert.deepEqual(patrolMapTarget(false, ground, crisis, camp), { spot: 'daemon', at: crisis });
const mapPatrol = patrolMapTarget(true, ground, crisis, camp, true);
assert.deepEqual(mapPatrol, { spot: 'camp', at: camp });
assert.equal(sim.tutorialCapabilities.dispatch, false);
assert.equal(sim.sendPatrol(mapPatrol.spot, mapPatrol.at), false);
const mapRun = fresh();
mapRun.tutorialInspectCamp(); mapRun.tutorialOpenPatrol();
assert.equal(mapRun.tutorialCapabilities.dispatch, true);
const beforeDispatch = mapRun.org.budget;
assert(mapRun.sendPatrol(mapPatrol.spot, mapPatrol.at));
assert.equal(mapRun.org.budget, beforeDispatch - 15);
assert.deepEqual(mapRun.patrol.at, camp);
assert.equal(mapRun.sendPatrol(mapPatrol.spot, mapPatrol.at), false);
assert.equal(mapRun.org.budget, beforeDispatch - 15, 'duplicate dispatch must not charge twice');
for (let i = 0; i < 4000 && mapRun.tutorial.stage === 'patrol'; i++) mapRun.tick(1 / 10);
arriveCrew(mapRun);
assert.equal(mapRun.tutorial.stage, 'outreach', 'map dispatch completes the patrol lesson');

const notices = []; sim.on((e) => notices.push(e));
assert.deepEqual(sim.tutorialCapabilities.services, ['footPatrol']);
assert(sim.runningPerHour >= ORG.runningPerPlace && sim.runningPerHour < ORG.runningPerPlace * 2,'Only the established patrol pays rent and current footfall wear');
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
arriveCrew(sim);
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
arriveCrew(ladder);
let visitor = 100000;
ladder.tutorial.reviewSkills();
for (const [service, expected] of [['outreach', 'dropIn'], ['dropIn', 'nightlife'], ['clubHr', 'night']]) {
  ladder.setEnabled(service, true); ladder.staffArrived(service);
  for (let i = 0; i < 5; i++) {
    assert.equal(ladder.arrive(service, visitor++), 'admitted', JSON.stringify({ service, i, stage: ladder.tutorial.stage, status: ladder.services[service].status, reason: ladder.services[service].closedReason, staff: ladder.services[service].staffOnSite, inside: ladder.services[service].inService.size, queue: ladder.services[service].queue.length, now: ladder.org.now }));
    ladder.serviceReached(service, visitor - 1);
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

// Reload an in-flight map patrol across different teams/seeds, without charging again.
for (const seed of [1, 42, 777, 2026]) {
  const source = new Simulation(seed); source.startTutorial(); source.serviceSites.footPatrol={kind:'curb',id:0}; source.setEnabled('footPatrol',true); source.start(); for(let i=0;i<source.services.footPatrol.assigned;i++)source.staffArrived('footPatrol');
  source.tutorialInspectCamp(); source.tutorialOpenPatrol();
  assert(source.sendPatrol(mapPatrol.spot, mapPatrol.at));
  for (let i = 0; i < 300; i++) source.tick(1 / 30);
  const saved = parseSave(JSON.parse(JSON.stringify(captureSave(source, 'Patrol reload'))));
  const target = new Simulation(seed); applySave(target, saved); target.start();
  assert.deepEqual(target.patrol.snapshot(), source.patrol.snapshot());
  const budget = target.org.budget;
  assert(!target.sendPatrol(mapPatrol.spot, mapPatrol.at));
  assert.equal(target.org.budget, budget);
  for (let i = 0; i < 4000 && target.tutorial.stage === 'patrol'; i++) target.tick(1 / 10);
arriveCrew(target);
  assert.equal(target.tutorial.stage, 'outreach', 'in-flight reload completes for seed ' + seed);
}
console.log('In-flight tutorial patrol reload, duplicate cost guard and return across four seeds: passed');

const returningSource = fresh(); returningSource.tutorialInspectCamp(); returningSource.tutorialOpenPatrol();
assert(returningSource.sendPatrol('camp', camp));
for (let i=0;i<4000 && returningSource.patrol.out;i++) returningSource.tick(.1);
assert(returningSource.patrol.returning);
returningSource.staffArrived('footPatrol');
assert.equal(returningSource.tutorial.stage,'patrol','One of two workers is insufficient');
const returnSave = parseSave(JSON.parse(JSON.stringify(captureSave(returningSource,'Returning crew'))));
const returnReload = new Simulation(123); applySave(returnReload,returnSave); returnReload.start();
assert(returnReload.patrol.returning,'Return walk survives save/reload');
arriveCrew(returnReload);
assert.equal(returnReload.tutorial.stage,'outreach');
console.log('Physical return waits for the full crew and survives a save between arrivals: passed');

// The three visit lessons share a physical-arrival and completed-support contract.
for (const [stage,service] of [['outreach','outreach'],['dropIn','dropIn'],['nightlife','clubHr']]) {
  const run = fresh();
  run.tutorial = TutorialProgress.restore({...run.tutorial.snapshot(),stage,reviewedSkills:true,rewards:[stage]});
  run.org.paid=10; run.setEnabled(service,true); run.staffArrived(service);
  const id=700001;
  assert.equal(run.arrive(service,id),'admitted');
  const before=JSON.stringify(run.recipientCare.visits.get(id));
  for(let i=0;i<50;i++)run.tick(.1);
  assert.equal(JSON.stringify(run.recipientCare.visits.get(id)),before,'Walking is not care at '+service);
  run.emit({type:'served',service,visitor:id});
  assert.equal(run.tutorial.visits[service]??0,0,'A generic departure/referral cannot complete a tutorial visit');
  run.serviceReached(service,id);
  for(let i=0;i<2000&&!run.recipientCare.visits.get(id)?.tutorialSupported;i++)run.tick(.1);
  assert(run.recipientCare.visits.get(id)?.tutorialSupported,'Real completed support at '+service);
  const saved=parseSave(JSON.parse(JSON.stringify(captureSave(run,'Care at counter'))));
  const loaded=new Simulation(123);applySave(loaded,saved);loaded.start();loaded.staffArrived(service);
  assert(loaded.recipientCare.visits.get(id)?.tutorialSupported,'Support receipt survives reload');
  const pausedVisit=JSON.stringify(loaded.recipientCare.visits.get(id));
  loaded.tick(1);
  assert.equal(JSON.stringify(loaded.recipientCare.visits.get(id)),pausedVisit,'Restored route must reach its service point');
  loaded.serviceReached(service,id);
  for(let i=0;i<3000&&(loaded.tutorial.visits[service]??0)<1;i++)loaded.tick(.1);
  assert.equal(loaded.tutorial.visits[service],1,'Count only after actual support and visit outcome');
  loaded.emit({type:'served',service,visitor:id});
  assert.equal(loaded.tutorial.visits[service],1,'No duplicate credit after reload');
}
const emptyNight=fresh();
emptyNight.tutorial=TutorialProgress.restore({...emptyNight.tutorial.snapshot(),stage:'night',nightServices:['outreach','dropIn','clubHr'],rewards:['night']});
emptyNight.org.paid=10;
for(const site of ['outreach','dropIn','clubHr'])emptyNight.setEnabled(site,true);
emptyNight.clockMinutes=32*60-.1;emptyNight.tick(.1);
assert.equal(emptyNight.tutorial.stage,'night','Morning alone cannot finish unstaffed services');
assert.deepEqual(emptyNight.tutorial.nightServices,[],'A failed report cannot reuse an earlier night');
console.log('All visit lessons: physical arrival, completed support, saved routes, exactly-once credit; unstaffed morning rejected: passed');

const {tutorialNavigation,tutorialBriefing}=await import('../../src/ui/tutorialNavigation.ts');
const context = {patrolAway:false,patrolReady:true,canAffordPatrol:true,placing:false,placementReady:false,manuallyPaused:false,selectedCamp:false,selectedService:null,servicesOpen:false,running:()=>false,needsStaff:()=>false};
const cases = [
 ['meet',{},'camp','Find the camp'],
 ['patrol',{running:()=>true},'dispatch','Open camp panel'],
 ['patrol',{running:()=>true,selectedCamp:true},'dispatch','Highlight Send patrol to the camp'],
 ['patrol',{running:()=>true,canAffordPatrol:false},'clock','budget recovery'],
 ['patrol',{patrolAway:true},'clock','Highlight Time speed'],
 ['patrol',{patrolAway:true,manuallyPaused:true},'clock','Highlight Resume (Space)'],
 ['patrol',{patrolReady:false,running:()=>true},'clock','Highlight Time speed'],
 ['patrol',{},'service','Find Foot patrol'],
 ['outreach',{reviewedSkills:false},'team','Highlight Your portrait'],
];
for (const stage of ['outreach','dropIn','nightlife']) {
 const id = stage==='outreach'?'outreach':stage==='dropIn'?'dropIn':'clubHr';
 cases.push([stage,{reviewedSkills:true},'service',null],
 [stage,{reviewedSkills:true,servicesOpen:true},'service',null],
 [stage,{reviewedSkills:true,selectedService:id},'service','Highlight Open up.'],
 [stage,{reviewedSkills:true,placing:true},'placement','Highlight Next site'],
 [stage,{reviewedSkills:true,placing:true,placementReady:true},'placement','Highlight Open here'],
 [stage,{reviewedSkills:true,running:()=>true},'clock','Highlight Time speed'],
 [stage,{reviewedSkills:true,running:()=>true,manuallyPaused:true},'clock','Highlight Resume (Space)'],
 [stage,{reviewedSkills:true,running:()=>true,needsStaff:()=>true},'team','Highlight Your portrait']);
}
cases.push(['night',{running:()=>true},'clock','Highlight Time speed'],
 ['night',{running:id=>id!=='dropIn'},'service',null],
 ['night',{running:()=>true,needsStaff:id=>id==='dropIn'},'team','Highlight Your portrait'],
 ['complete',{},null,null]);
const briefedTasks = new Set();
for(const [stage,overrides,kind,label] of cases){
 const progress=TutorialProgress.restore({...fresh().tutorial.snapshot(),stage,reviewedSkills:overrides.reviewedSkills??true});
 const before=progress.snapshot();const plan=tutorialNavigation(progress,{...context,...overrides});
 assert.equal(plan?.kind??null,kind,'Navigation destination for '+stage);
 const briefing=tutorialBriefing(plan);
 briefedTasks.add(briefing.id);
 assert(briefing.id && briefing.context.length>15 && briefing.context.length<=110,'Every task and recovery path needs concise context: '+stage);
 if(plan)assert.equal('label' in plan,false,'No manual highlight action');
 if(plan){assert(plan.instruction.length<=110);assert(!plan.instruction.includes('Highlight '));}
 assert.deepEqual(progress.snapshot(),before,'Finding a control cannot complete a task');
}
console.log('All tutorial stages: contextual control labels, placement choice/confirmation, pause recovery, staff recovery and missing-service recovery: passed');

assert.deepEqual([...briefedTasks].sort(), ['camp','dispatch','team-review','staffing','service-footPatrol','service-outreach','service-dropIn','service-clubHr','placement','patrol-return','patrol-ready','patrol-funds','network','operating','complete'].sort());
console.log('All 15 authored task/recovery briefing paths covered: passed');
