import assert from 'node:assert/strict';
import {drive,SKIP_WELCOME} from './chrome.mjs';
const url=process.argv[2]??'http://127.0.0.1:5299/';
const results=await drive(new URL('?scenario=tutorial&packs=none&quality=low&lang=en',url).href,[...SKIP_WELCOME,{eval:`(async()=>{
const s=window.__sandbox;const {captureSave,parseSave,applySave}=await import('/src/game/saveGame.ts');
const {ServiceHosting}=await import('/src/world/serviceHosting.ts');const {allBuildings}=await import('/src/world/cityBuildings.ts');const {TUTORIAL_AREAS}=await import('/src/config/tutorialMap.ts');const hosting=new ServiceHosting(s.world.locations,(id,m)=>s.world.transformStage(id,m));const used=new Set();
if(document.querySelector('.time-pause').dataset.paused!=='true')document.querySelector('.time-pause').click();
const rows=[];const normalStep=s.crowd.step;let nextVisitor=700001;let sceneTime=0;const step=()=>{s.sim.tick(.1);s.crowd.update(.1);s.world.update(.1,sceneTime);sceneTime+=.1};
for(const [stage,site] of [['outreach','outreach'],['dropIn','dropIn'],['nightlife','clubHr']]){
 for(let id=700001;id<nextVisitor;id++)s.sim.forget(id);
 s.sim.tutorial=s.sim.tutorial.constructor.restore({...s.sim.tutorial.snapshot(),stage,reviewedSkills:true,visits:{},rewards:[stage]});
 s.sim.clockMinutes=18*60;s.sim.org.paid=10;s.sim.org.budget=10000;s.world.locations.outreach.root.visible=true;
 for(const id of ['footPatrol','outreach','dropIn','clubHr'])s.sim.setEnabled(id,id===site);
 if(site!=='outreach'){const bounds=TUTORIAL_AREAS[s.sim.tutorialCapabilities.district];const building=allBuildings().find(b=>!used.has(b.id)&&b.x1-b.x0>=5&&b.z1-b.z0>=4&&b.x0>=bounds.x0&&b.x1<=bounds.x1&&b.z0>=bounds.z0&&b.z1<=bounds.z1);if(!building)throw Error('No fixture building');used.add(building.id);const point={kind:'building',id:building.id};s.sim.serviceSites[site]=point;hosting.set(site,point,building);}
 for(const member of s.sim.team.members){member.energy=1;member.morale=1}const member=s.sim.team.members.find(m=>m.workingAt===site);if(member)s.sim.assignMember(member.id,site);
 s.sim.staffArrived(site);const visitor=nextVisitor++;s.sim.recipientCare.ensure(visitor,site,['lowMood']);
 if(s.sim.arrive(site,visitor)!=='admitted')throw Error('Fixture not admitted: '+site);
 const saved=parseSave(JSON.parse(JSON.stringify(captureSave(s.sim,'Saved route'))));
 applySave(s.sim,saved);s.sim.staffArrived(site);s.crowd.restoreTutorialVisitors();
 const body=s.crowd.byVisitor.get(visitor);if(!body||!body.visible||body.mode!=='walking')throw Error('Saved visitor has no visible route at '+site+': '+JSON.stringify({has:!!body,visible:body?.visible,mode:body?.mode,count:s.crowd.agents.size,visit:s.sim.recipientCare.visits.get(visitor),visits:[...s.sim.recipientCare.visits.keys()]}));
 for(const key of Object.keys(s.sim.timers))s.sim.timers[key]=Infinity;
 const care=JSON.stringify(s.sim.recipientCare.visits.get(visitor));
 s.crowd.step=function(a,dt){if(a!==body)normalStep.call(this,a,dt)};
 for(let i=0;i<120;i++){step()}
 if(JSON.stringify(s.sim.recipientCare.visits.get(visitor))!==care||(s.sim.tutorial.visits[site]??0)!==0)throw Error('Held route progressed care at '+site);
 s.crowd.step=normalStep;
 for(let i=0;i<9000&&(s.sim.tutorial.visits[site]??0)<1;i++){step();if(i%900===0)await new Promise(requestAnimationFrame)}
 if(s.sim.tutorial.visits[site]!==1)throw Error('Restored route never completed support at '+site+': '+JSON.stringify({visit:s.sim.recipientCare.visits.get(visitor),body:{mode:body.mode,service:body.service,pos:body.pos},status:s.sim.services[site].status,workers:s.sim.team.members.filter(m=>m.workingAt===site).map(m=>({energy:m.energy,assigned:m.assignment}))}));
 rows.push({site,visibleRestoredRoute:true,heldRouteCannotProgress:true,completedVisits:s.sim.tutorial.visits[site]});
}
return {rows,errors:window.__qaErrors};})()`}],{seed:777,diagnostics:true,log:()=>{}});
const r=results.at(-1);assert.equal(r.rows.length,3);assert.deepEqual(r.errors,[]);console.log(JSON.stringify(r));console.log('Saved tutorial visitors follow real routes; all three held routes block care until physical service arrival: passed');
