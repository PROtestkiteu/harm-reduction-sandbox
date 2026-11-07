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

const { readServiceSites } = await import('../../src/sim/serviceSites.ts');
const { ServiceHosting } = await import('../../src/world/serviceHosting.ts');
const { Group, Vector3 } = await import('three');
const { SPOTS, LOTS, CAMPER_SPOTS, PATROL, SERVICE_NODES } = await import('../../src/world/layout.ts');
const { registerBuilding, cityBuilding, frontDoor } = await import('../../src/world/cityBuildings.ts');
assert.deepEqual(readServiceSites({ dropIn: {kind:'building',id:2}, clinic:{kind:'building',id:2}, outreach:{kind:'building',id:4}, footPatrol:{kind:'curb',id:0}, shelter:{kind:'building',id:-1} }), {dropIn:{kind:'building',id:2},footPatrol:{kind:'curb',id:0}});
const locations = Object.fromEntries(['dropIn','club','outreach','footPatrol','drugChecking','shelter','clinic'].map(id => [id, {root:new Group(), labelAnchor:new Vector3(1,8,2),footprint:{x:1,z:2,rx:3,rz:4}}]));
const hosting = new ServiceHosting(locations);
const building = cityBuilding(registerBuilding(3,13,24,34,9,false,'+z','flat'));
const original = structuredClone(SPOTS.centerDoor), node=SERVICE_NODES.dropIn;
hosting.set('dropIn',{kind:'building',id:building.id},building);
assert.deepEqual(SPOTS.centerDoor,frontDoor(building,.25).door);
assert.equal(locations.dropIn.root.visible,false);
assert.equal(hosting.building('dropIn'),building.id);
hosting.set('dropIn',{kind:'original'});
assert.deepEqual(SPOTS.centerDoor,original); assert.equal(SERVICE_NODES.dropIn,node); assert(locations.dropIn.root.visible);
const table=structuredClone(PATROL.table), staff=structuredClone(PATROL.staff), queue=structuredClone(LOTS.footPatrol.queueHead);
hosting.set('footPatrol',{kind:'curb',id:CAMPER_SPOTS.findIndex(s=>s.rot!==PATROL.frame.rot)});
assert(Number.isFinite(PATROL.table.x)); assert.notDeepEqual(PATROL.table,table);
hosting.set('footPatrol',{kind:'curb',id:0});
hosting.set('footPatrol',{kind:'original'});
assert.deepEqual(PATROL.table,table);assert.deepEqual(PATROL.staff,staff);assert.deepEqual(LOTS.footPatrol.queueHead,queue);
for(const id of ['clubHr','drugChecking','shelter','clinic']) {hosting.set(id,{kind:'building',id:building.id},building);hosting.set(id,{kind:'original'});}
console.log('Service sites: validation, duplicate occupancy, entrances, original restoration and rotated curb placement passed.');
const { Simulation } = await import('../../src/sim/simulation.ts');
const { captureSave, parseSave, applySave } = await import('../../src/game/saveGame.ts');
const sim = new Simulation(42);
sim.serviceSites.dropIn = {kind:'building',id:building.id};
sim.serviceSites.footPatrol = {kind:'curb',id:3};
const saved = parseSave(captureSave(sim,'Sites'));
assert.deepEqual(saved.serviceSites,sim.serviceSites);
const loaded = new Simulation(42);
applySave(loaded,saved);
assert.deepEqual(loaded.serviceSites,sim.serviceSites);
applySave(loaded,parseSave({...saved,serviceSites:undefined}));
assert.deepEqual(loaded.serviceSites,{});
console.log('Save round trip and older-save fallback passed.');
// Exercise renderer-independent animation state with the canvas used only as a texture source.
const textureContext=new Proxy({measureText:()=>({width:0}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]??(()=>{})});
globalThis.document = {createElement:()=>({width:0,height:0,getContext:()=>textureContext})};
const { FitOuts } = await import('../../src/world/fitOut.ts');
const { MeshLambertMaterial } = await import('three');
const parent=new Group(), fits=new FitOuts(parent,new MeshLambertMaterial());
fits.set(building,{service:'dropIn',level:0});
const initial=parent.children[0].children[0];
assert.equal(initial.position.y,0,'A confirmed site must be identifiable before any simulation frame');
assert(initial.visible,'Paused tutorial cannot hide the new frontage');
fits.set(building,{service:'dropIn',level:1});
fits.update(.4,false);
fits.set(building,null);
fits.update(2,false);
assert(parent.children[0].children.every(g=>!g.visible));
fits.set(building,{service:'dropIn',level:0});fits.update(0,true);
assert(initial.visible);assert.equal(initial.position.y,0);
fits.set(building,null);fits.update(0,true);assert(!initial.visible);
console.log('Construction, interrupted expansion, dismantling and reduced-motion completion passed.');
const { TutorialProgress } = await import('../../src/game/tutorial.ts');
const { CLUB_OPENS } = await import('../../src/sim/clock.ts');
const evening=new Simulation(777);evening.startTutorial();
evening.tutorial=TutorialProgress.restore({...evening.tutorial.snapshot(),stage:'nightlife'});
evening.clockMinutes=CLUB_OPENS-1;evening.setEnabled('clubHr',true);evening.timers.club=Infinity;
evening.clockMinutes=CLUB_OPENS-.001;evening.tick(1);
assert(Number.isFinite(evening.timers.club));
console.log('Tutorial club demand resumes when the next evening opens.');

// A camper has equipment available, but no city location or closure penalty before setup.
for (const tutorial of [false,true]) {
  const fresh=new Simulation(777);if(tutorial)fresh.startTutorial();
  assert.equal(fresh.outreachPlaced,false);
  assert.equal(fresh.services.outreach.switchedOn,false);
  assert.equal(fresh.services.outreach.everRun,false);
  assert.equal(fresh.servicesClosedByPlayer,0);
  const pending=parseSave(captureSave(fresh,'Pending camper'));
  assert(Array.isArray(pending.ran),'Parser must retain the operated-service history');
  const restored=new Simulation(42);applySave(restored,pending);
  assert.equal(restored.outreachPlaced,false,'Reload cannot invent a first placement');
  restored.serviceSites.outreach={kind:'curb',id:2};
  assert(restored.outreachPlaced);
  const chosen=parseSave(captureSave(restored,'Chosen camper'));const chosenLoaded=new Simulation(42);applySave(chosenLoaded,chosen);
  assert(chosenLoaded.outreachPlaced);assert.deepEqual(chosenLoaded.serviceSites.outreach,{kind:'curb',id:2});
}
const known=new Simulation(777);known.setEnabled('outreach',true);known.setEnabled('outreach',false);
assert(known.outreachPlaced);assert.equal(known.servicesClosedByPlayer,1);
const closed=parseSave(captureSave(known,'Established but closed'));
const closedLoaded=new Simulation(42);applySave(closedLoaded,closed);
assert(closedLoaded.outreachPlaced,'Closing a placed camper does not erase its site');
assert(!closedLoaded.services.outreach.switchedOn);assert(closedLoaded.services.outreach.everRun);
const legacy=parseSave({...closed,on:['dropIn','clubHr'],ran:undefined,serviceSites:undefined});applySave(closedLoaded,legacy);
assert.deepEqual(closedLoaded.serviceSites.outreach,{kind:'original'},'Legacy parked campers keep their existing origin');
assert(closedLoaded.services.outreach.everRun);assert.equal(closedLoaded.servicesClosedByPlayer,1,'Legacy closed starters retain their closure accounting');
console.log('First placement, pending/placed/closed save round trips, legacy parked campers and closure penalties passed.');
const { ScenePicker } = await import('../../src/ui/picking.ts');
const { Mesh, BoxGeometry, MeshBasicMaterial, OrthographicCamera } = await import('three');
const pickLocations=Object.fromEntries(Object.entries(locations).map(([id])=>[id,{root:new Group()}]));
const cube=new Mesh(new BoxGeometry(3,3,3),new MeshBasicMaterial());cube.position.set(10000,0,10000);pickLocations.outreach.root.name='outreach';pickLocations.outreach.root.add(cube);pickLocations.outreach.root.updateMatrixWorld(true);
const camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.position.set(10000,10,10010);camera.lookAt(10000,0,10000);camera.updateMatrixWorld(true);
const picker=new ScenePicker(pickLocations,{forEachVisible(){}},()=>[]);const frame={cssW:640,cssH:480,dpr:1,factor:1,lowW:640,lowH:480};
const visibleHit=picker.pick(320,240,camera,frame,false);assert.equal(visibleHit?.kind,'location');assert.equal(visibleHit.id,'outreach');
pickLocations.outreach.root.visible=false;
const hiddenHit=picker.pick(320,240,camera,frame,false);assert(hiddenHit?.kind!=='location'||hiddenHit.id!=='outreach','Invisible camper must not be picked through an empty curb');
for(const seed of [1,123,777,2026]) {
 const pending=new Simulation(seed);const events=[];pending.on(e=>events.push(e));pending.start();for(let i=0;i<600;i++)pending.tick(1/30);
 assert(!pending.outreachPlaced);assert(!events.some(e=>e.type==='spawnVisitor'&&e.intent==='outreach'));assert.equal(pending.servicesClosedByPlayer,0);
}
console.log('Hidden camper has no raycast target; four seeded starts have no phantom outreach arrivals or closure penalties.');

const {servicePlaced}=await import('../../src/game/servicePlacement.ts');
const pendingCentre=new Simulation(777);pendingCentre.startTutorial();
assert(!servicePlaced(pendingCentre,'dropIn'));
pendingCentre.serviceSites.dropIn={kind:'original'};assert(servicePlaced(pendingCentre,'dropIn'));
delete pendingCentre.serviceSites.dropIn;pendingCentre.services.dropIn.everRun=true;assert(servicePlaced(pendingCentre,'dropIn'),'Established legacy centres keep their home');
const {buildDropIn}=await import('../../src/world/buildings.ts');
const {createRandom}=await import('../../src/sim/random.ts');
const centre=buildDropIn(createRandom(777));
assert(centre.vacantRoot && !centre.vacantRoot.visible);
const homeBuffers=new Set();centre.root.traverse(o=>{if(o.geometry)homeBuffers.add(o.geometry);});
centre.vacantRoot.traverse(o=>{if(o.geometry)assert(homeBuffers.has(o.geometry),'Vacant home reuses mesh buffers');});
const neutralLocations={...locations,dropIn:centre};
const centreHosting=new ServiceHosting(neutralLocations);
centreHosting.set('dropIn',{kind:'building',id:building.id},building);
assert(!centre.root.visible && centre.vacantRoot.visible,'Ordinary home shell stays when service chooses another building');
centreHosting.set('dropIn',{kind:'original'});
assert(centre.root.visible && !centre.vacantRoot.visible,'Returning home restores the branded centre without two buildings');
console.log('Drop-in: pending setup, confirmed/legacy home, neutral home shell and paused first frontage passed.');

for (const tutorial of [false,true]) for (const seed of [1,42,777,2026]) {
  const fresh=new Simulation(seed);if(tutorial)fresh.startTutorial();fresh.start();
  for(const id of ['dropIn','outreach','clubHr','footPatrol','drugChecking','shelter','clinic']) {
    assert(!servicePlaced(fresh,id),'No service has a first site: '+id);
    assert(!fresh.services[id].switchedOn && !fresh.services[id].everRun && !fresh.services[id].enabled && fresh.services[id].status==='closed','No automatic first opening: '+id);
  }
  assert.equal(fresh.servicesClosedByPlayer,0);assert.equal(fresh.runningPerHour,0);
  const arrivals=[];fresh.on(e=>arrivals.push(e));for(let i=0;i<600;i++)fresh.tick(1/30);
  assert(!arrivals.some(e=>e.type==='spawnVisitor'&&((e.intent in fresh.services)||e.wantsStand)),'No visitor is sent to an unplaced service');
  const roundtrip=new Simulation(seed);applySave(roundtrip,parseSave(captureSave(fresh,'Unplaced services')));
  for(const id of Object.keys(fresh.services))assert(!servicePlaced(roundtrip,id),'Pending first choice survives save: '+id);
}
const {buildDrugChecking,buildShelter,buildClinic}=await import('../../src/world/places.ts');
for(const build of [buildDrugChecking,buildShelter,buildClinic]) {
  const v=build(createRandom(777));assert(v.vacantRoot && !v.vacantRoot.visible);
  const buffers=new Set();v.root.traverse(o=>{if(o.geometry)buffers.add(o.geometry);});
  v.vacantRoot.traverse(o=>{if(o.geometry)assert(buffers.has(o.geometry));});
}
console.log('All seven services: first choice required, pending save round trips, neutral shells and shared buffers passed.');

for(const id of ['dropIn','outreach','clubHr','footPatrol','drugChecking','shelter','clinic']) {
 const source=new Simulation(777);source.serviceSites[id]={kind:'original'};source.setEnabled(id,true);source.setEnabled(id,false);
 const saved=parseSave(captureSave(source,'Closed established service'));const target=new Simulation(42);applySave(target,saved);
 assert(servicePlaced(target,id),'Closing never erases an established location: '+id);assert.deepEqual(target.serviceSites[id],{kind:'original'});
}
console.log('Closed established locations survive save/restore for all seven services.');

const {curbReserved}=await import('../../src/sim/serviceSites.ts');
assert(curbReserved({footPatrol:{kind:'curb',id:1}},1,'outreach'));
assert(!curbReserved({footPatrol:{kind:'curb',id:1}},1,'footPatrol'));
assert(!curbReserved({outreach:{kind:'original'}},1,'footPatrol'));
const reserved=new Simulation(777);reserved.serviceSites.footPatrol={kind:'curb',id:1};reserved.setEnabled('outreach',true);reserved.org.budget=10000;
assert(!reserved.sendCamper(1),'Additional campers cannot overwrite the patrol stand');
console.log('Shared curb reservations prevent an additional camper overwriting the patrol stand.');

const firstStand=new Simulation(777);firstStand.startTutorial();firstStand.serviceSites.footPatrol={kind:'curb',id:0};firstStand.setEnabled('footPatrol',true);firstStand.start();
assert(!firstStand.patrolReady,'A newly chosen stand waits for its crew');
firstStand.staffArrived('footPatrol');assert(!firstStand.patrolReady,'One of two tutorial workers is not a ready patrol');
firstStand.staffArrived('footPatrol');assert(firstStand.patrolReady,'The crew is physically ready at the stand');
console.log('First patrol dispatch waits for both workers at the chosen stand.');
