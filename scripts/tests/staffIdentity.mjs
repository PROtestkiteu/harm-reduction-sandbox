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
    if (url.endsWith('/agents/character.ts')) return {format:'module',shortCircuit:true,source:'export class CharacterRig{}; export const randomAppearance=()=>({});'};
    if (url.endsWith('/agents/humanFigure.ts')) return {format:'module',shortCircuit:true,source:'export class HumanFigure{}; export const peopleLibrary=()=>null;'};
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
  },
});
globalThis.location={search:'?quality=low'};globalThis.matchMedia=()=>({matches:false});
const { Crowd } = await import('../../src/agents/crowd.ts');
const { Simulation } = await import('../../src/sim/simulation.ts');
const { SERVICE_IDS } = await import('../../src/sim/types.ts');
const { Group } = await import('three');

// Exercise the actual crowd staff state machine with only drawing and path traversal stubbed.
// This isolates identity/count bookkeeping from WebGL, canvas atlases and wall-clock walking.
function staffingCrowd(sim) {
  const crowd = Object.create(Crowd.prototype);
  Object.assign(crowd,{sim,agents:new Map(),staffQueue:[],random:()=>.5,nextId:1,beatersOut:false,beatKey:'',clock:0});
  crowd.routeTo=()=>[];
  crowd.createAgent=(pos,role)=>{
    const agent={id:crowd.nextId++,role,pos:{...pos},rig:{look:{staff:true,style:'everyday'},root:new Group()},route:[],mode:'walking',pose:'walk',visible:true,offset:{x:0,z:0},moodLeft:0};
    crowd.agents.set(agent.id,agent);return agent;
  };
  crowd.walk=(agent,route,done)=>{agent.route=route;agent.onArrive=done;agent.mode='walking'};
  crowd.leave=(agent)=>{agent.mode='leaving';agent.route=[];agent.onArrive=undefined};
  crowd.leaveAnywhere=crowd.leave;
  crowd.show=(agent,pos)=>{agent.visible=true;agent.pos={...pos}};
  crowd.hide=(agent)=>{agent.visible=false};
  sim.on(event=>crowd.handle(event));
  return crowd;
}
function arriveQueued(crowd) {
  const queue=crowd.staffQueue.splice(0);
  for(const entry of queue)crowd.spawnStaff(entry.service,entry.post,entry.member);
  for(const agent of crowd.agents.values())if(agent.mode==='walking'&&agent.onArrive){const done=agent.onArrive;agent.onArrive=undefined;agent.route=[];done()}
}
const sim=new Simulation(123);sim.org.paid=2;sim.org.volunteers=0;
for(const id of SERVICE_IDS){sim.services[id].switchedOn=id==='dropIn';sim.services[id].params.staff=id==='dropIn'?2:1}
sim.reallocate();const crowd=staffingCrowd(sim);let revisions=0;sim.on(e=>{if(e.type==='staffRota')revisions++});sim.start();arriveQueued(crowd);
const [first,second]=sim.team.members;
const avatarA=[...crowd.agents.values()].find(a=>a.staffMember===first);
const avatarB=[...crowd.agents.values()].find(a=>a.staffMember===second);
assert(avatarA&&avatarB);assert.equal(sim.services.dropIn.staffOnSite,2);
assert.strictEqual(crowd.person(avatarA.id).worker,first);

// Roster compaction must release the actual resting person, not whoever now occupies their old index.
sim.assignMember(first.id,'rest');
assert.equal(avatarA.mode,'leaving');assert.equal(avatarB.mode,'post');
assert.strictEqual(crowd.person(avatarA.id).worker,first);assert.strictEqual(crowd.person(avatarB.id).worker,second);
assert.equal(sim.services.dropIn.staffOnSite,1);assert.equal(crowd.staffQueue.length,0);
const unchanged=revisions;
for(let i=0;i<5;i++){second.hours.dropIn=(second.hours.dropIn??0)+1;sim.reallocate()}
assert.equal(revisions,unchanged);assert.equal(sim.services.dropIn.staffOnSite,1);assert.equal(crowd.staffQueue.length,0);

// A returning member gets a fresh avatar; the selected departing avatar never morphs into a replacement.
sim.assignMember(first.id,'dropIn');arriveQueued(crowd);
const replacement=[...crowd.agents.values()].find(a=>a.staffMember===first&&a.mode==='post');
assert(replacement);assert.notEqual(replacement.id,avatarA.id);assert.equal(replacement.memberId,first.id);
assert.strictEqual(crowd.person(avatarA.id).worker,first);assert.equal(sim.services.dropIn.staffOnSite,2);

// Reassignment walks the existing avatar off and binds the destination avatar to that same employee.
sim.setEnabled('outreach',true);sim.assignMember(first.id,'outreach');arriveQueued(crowd);
const outreach=[...crowd.agents.values()].find(a=>a.staffMember===first&&a.service==='outreach'&&a.mode==='post');
assert(outreach);assert.equal(replacement.mode,'leaving');assert.equal(sim.services.dropIn.staffOnSite,1);assert.equal(sim.services.outreach.staffOnSite,1);
assert.strictEqual(crowd.person(replacement.id).worker,first);

// Quitting/removal preserves the departing reference, and a queued replacement can be cancelled safely.
sim.team.members.splice(sim.team.members.indexOf(first),1);sim.org.paid=1;sim.reallocate();
assert.equal(outreach.mode,'leaving');assert.strictEqual(crowd.person(outreach.id).worker,first);assert.equal(sim.services.outreach.staffOnSite,0);
sim.org.paid=2;sim.reallocate();const newcomer=sim.team.members.find(m=>m!==second);
assert(newcomer);assert.notEqual(newcomer.id,first.id);assert(crowd.staffQueue.some(q=>q.member===newcomer));
sim.assignMember(newcomer.id,'rest');assert(!crowd.staffQueue.some(q=>q.member===newcomer));arriveQueued(crowd);
assert(![...crowd.agents.values()].some(a=>a.staffMember===newcomer));assert.equal(sim.services.outreach.staffOnSite,0);
assert.strictEqual(crowd.person(avatarB.id).worker,second);

// The same named patrol members return from the beat, even when the requested post differs.
const patrol=new Simulation(321);patrol.startTutorial();
// The tutorial patrol starts only once its stand is placed and switched on.
patrol.serviceSites.footPatrol={kind:'curb',id:0};patrol.setEnabled('footPatrol',true);
const beat=staffingCrowd(patrol);patrol.start();arriveQueued(beat);
assert.equal(patrol.services.footPatrol.staffOnSite,2);
patrol.tutorial.inspectCamp();patrol.tutorial.openPatrol();
assert(patrol.sendPatrol('camp',{x:-20,z:80}));
assert.equal(patrol.services.footPatrol.staffOnSite,0);
const walkers=[...beat.agents.values()].filter(a=>a.onBeat);
assert.equal(walkers.length,2);const [walkerA,walkerB]=walkers;
assert(beat.returnFromBeat(0,walkerB.staffMember));assert.equal(walkerB.onBeat,false);assert.equal(walkerA.onBeat,true);
assert.strictEqual(beat.person(walkerB.id).worker,walkerB.staffMember);
console.log('Stable staff identity, rest, reassignment, departures, queue cancellation, site counts and patrol return: passed.');
