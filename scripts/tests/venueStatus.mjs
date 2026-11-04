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

const { venueStatus } = await import('../../src/ui/venueStatus.ts');
const base = {status:'open', reason:null,queue:0,waitingRoom:5,staff:2,requested:2,assigned:2};
const view=(changes={})=>venueStatus({...base,...changes});
assert.deepEqual([view().tone,view().indicator,view().faded,view().crossed],['green',null,false,false]);
for (const status of ['closed','closing']) {
  const unused=view({status,reason:'switchedOff'});
  assert.equal(unused.tone,'muted');assert(unused.faded);assert(!unused.crossed);assert.equal(unused.indicator,'pause');
}
const unavailable=view({status:'closed',reason:'notPermitted'});
assert.equal(unavailable.tone,'red');assert.equal(unavailable.indicator,'lock');assert(unavailable.faded);assert(!unavailable.crossed);
assert(view({status:'closed',reason:'closedDown'}).crossed);
assert(!view({status:'closed',reason:'closedDown',reopening:true}).crossed);
assert.equal(view({reason:'closedDown',reopening:true}).indicator,'work');
assert.equal(view({status:'closed',reason:'hours'}).indicator,'clock');
assert.equal(view({status:'opening',assigned:1}).tone,'yellow');
assert.equal(view({status:'opening',assigned:0}).tone,'orange');
assert.equal(view({staff:1}).indicator,'staff');
assert.equal(view({queue:2}).count,2);assert.equal(view({queue:2}).tone,'yellow');
assert.equal(view({queue:5}).tone,'orange');assert.equal(view({queue:5,staff:0}).indicator,'queue');
assert.equal(view({queue:2,maintenanceRisk:true}).indicator,'maintenance');
assert.equal(view({reason:'outOfService',moving:true}).indicator,'route');
assert.equal(view({reason:'outOfService'}).tone,'red');
assert.equal(view({reason:'onPatrol'}).tone,'normal');
console.log('Venue states: six name colours, fading, unused versus shut down, cue priority and queue counts passed');

const { Simulation } = await import('../../src/sim/simulation.ts');
const { buildSnapshot } = await import('../../src/ui/snapshot.ts');
const sim=new Simulation(123);sim.start();sim.clockMinutes=22*60;
const stand=sim.services.clubHr;stand.enabled=false;stand.switchedOn=false;stand.staffOnSite=0;stand.closedReason='switchedOff';
let snap=buildSnapshot(sim,0);
assert.equal(snap.locations.club.venue.tone,'green');assert(!snap.locations.club.venue.faded);
assert.equal(snap.locations.club.closed.text,'Switched off');
sim.clockMinutes=36*60;snap=buildSnapshot(sim,0);assert(snap.locations.club.venue.faded);assert.equal(snap.locations.club.venue.indicator,'clock');
const svc=sim.services.dropIn;svc.enabled=true;svc.staffOnSite=svc.requested;svc.assigned=svc.requested;svc.closedReason=null;
sim.upgrades.dropIn.progress=.05;
snap=buildSnapshot(sim,0);assert.notEqual(snap.locations.dropIn.venue.indicator,'maintenance','A stage at its floor cannot downgrade');
sim.upgrades.dropIn.level++;
snap=buildSnapshot(sim,0);assert.equal(snap.locations.dropIn.venue.indicator,'maintenance');
svc.closedReason='switchedOff';svc.enabled=false;
snap=buildSnapshot(sim,0);assert.equal(snap.locations.dropIn.venue.tone,'muted');assert(!snap.locations.dropIn.venue.crossed);
console.log('Venue snapshot: actual club hours independent of stand, accurate downgrade floor, and disabled styling passed');

const outreach=sim.services.outreach;outreach.switchedOn=false;outreach.enabled=false;outreach.closedReason='switchedOff';
sim.context.outreachPermitted=false;
snap=buildSnapshot(sim,0);assert.equal(snap.locations.outreach.venue.indicator,'lock');assert(snap.locations.outreach.blockedByLaw);assert(snap.locations.outreach.venue.faded);
sim.context.outreachPermitted=true;
snap=buildSnapshot(sim,0);assert.equal(snap.locations.outreach.venue.tone,'muted');assert(!snap.locations.outreach.venue.crossed);
sim.org.closedDown.add('outreach');snap=buildSnapshot(sim,0);assert(snap.locations.outreach.venue.crossed);
console.log('Permission and shutdown remain visible even when a service is switched off: passed');

sim.clockMinutes=22*60;sim.club.inside=sim.club.capacity;sim.club.queue.push(101);
snap=buildSnapshot(sim,0);assert.equal(snap.locations.club.venue.tone,'orange');assert.equal(snap.locations.club.venue.count,1);assert(snap.locations.club.venue.message.startsWith('At capacity'));
sim.club.inside=0;
snap=buildSnapshot(sim,0);assert.equal(snap.locations.club.venue.tone,'yellow');
console.log('Club queue signals distinguish available space from blocked admission: passed');
