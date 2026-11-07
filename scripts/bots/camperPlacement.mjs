// First setup creates the camper at a curb; there is no parked mesh or ghost target beforehand.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME, call } from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5217/';
const out=process.argv[3]??'/tmp/hrp-first-camper-qa';mkdirSync(out,{recursive:true});
for(const tutorial of [true,false]) {
 const url=new URL(base);url.search='?lang=en&packs=none&quality=low'+(tutorial?'&scenario=tutorial':'');
 const results=await drive(url.href,[...SKIP_WELCOME,
 {eval:`(async()=>{const s=window.__sandbox;window.camperState=s;
 if(document.querySelector('.time-pause').dataset.paused!=='true')document.querySelector('.time-pause').click();
 const wait=async(test)=>{const end=Date.now()+5000;while(!test()&&Date.now()<end)await new Promise(r=>setTimeout(r,25));if(!test())throw Error('UI refresh timed out')};window.waitCamper=wait;
 const initial={placed:s.sim.outreachPlaced,mesh:s.world.camper.root.visible,label:s.hud.labelFor('outreach').hidden,on:s.sim.services.outreach.switchedOn};
 if(initial.placed||initial.mesh||!initial.label||initial.on)throw Error('Camper exists before setup: '+JSON.stringify(initial));
 if(s.sim.tutorial){s.sim.tutorial=s.sim.tutorial.constructor.restore({...s.sim.tutorial.snapshot(),stage:'outreach',reviewedSkills:true});s.syncEvents();if(document.querySelector('.tutorial-guide').dataset.collapsed!=='true')document.querySelector('.tutorial-toggle').click();if(document.querySelector('.time-pause').dataset.paused==='true')document.querySelector('.time-pause').click();await wait(()=>document.getElementById('hud').dataset.tutorialStaff==='true');document.querySelector('.time-pause').click();}
 s.interaction.selectLocation('outreach');if(s.interaction.highlightFlags.select)throw Error('Unplaced camper has a selection highlight');
 return {initial,tutorial:${tutorial}};})()`},
 {shot: tutorial?'tutorial-before.png':'regular-before.png'},
 {eval:`if(document.querySelector('.tutorial-guide:not([hidden])')?.dataset.collapsed==='false')document.querySelector('.tutorial-toggle').click();if(document.querySelector('.time-pause').dataset.paused==='true')document.querySelector('.time-pause').click();true`},
 call('./perf.js',3),
 {eval:`if(document.querySelector('.time-pause').dataset.paused!=='true')document.querySelector('.time-pause').click();true`},
 {eval:`(async()=>{const s=camperState;document.querySelector('.opt.switch[data-service=outreach]').click();await waitCamper(()=>!document.querySelector('.site-picker').hidden);
 if(s.world.camper.root.visible||s.sim.serviceSites.outreach)throw Error('Choosing a site materialized a camper');
 const count=s.world.scene.getObjectByName('serviceSiteTargets').children.length;
 document.querySelector('[data-placement-action=next]').click();if(document.querySelector('.site-picker [role=status]').textContent.includes('Current location'))throw Error('First setup is offering a relocation origin');
 document.querySelector('[data-placement-action=cancel]').click();if(s.world.camper.root.visible||s.sim.outreachPlaced||s.sim.services.outreach.switchedOn)throw Error('Cancelled setup left camper behind');
 document.querySelector('.opt.switch[data-service=outreach]').click();await waitCamper(()=>!document.querySelector('.site-picker').hidden);
 document.querySelector('[data-placement-action=next]').click();document.querySelector('[data-placement-action=next]').click();const name=document.querySelector('.site-picker [role=status]').textContent;
 document.querySelector('[data-placement-action=open]').click();await waitCamper(()=>s.world.camper.root.visible);
 const firstY=s.world.camper.placementRoot.position.y;if(firstY>=0)throw Error('First setup has no assembly animation');
 const site=s.sim.serviceSites.outreach;if(site?.kind!=='curb')throw Error('First placement did not commit a curb');
 const {CAMPER_SPOTS}=await import('/src/world/layout.ts');const chosen=CAMPER_SPOTS[site.id],p=s.world.camper.root.position;
 if(Math.abs(p.x-chosen.x)>.001||Math.abs(p.z-chosen.z)>.001)throw Error('Camper appeared at a different curb');
 if(s.world.camper.drive.position.length()>.001)throw Error('First appearance is animating relocation from a phantom camper');
 if(s.hud.labelFor('outreach').dataset.placed!=='true')throw Error('Committed site did not restore map label');
 await waitCamper(()=>s.world.camper.placementRoot.position.y===0&&!s.world.scene.getObjectByName('placementAssembly').visible);
 if(s.world.camper.placementRoot.scale.y!==1)throw Error('Assembly left a distorted camper');
 if(s.world.scene.getObjectByName('placementAssembly').visible)throw Error('Assembly effects still render after completion');
 s.sim.setEnabled('outreach',false);s.syncEvents();await new Promise(r=>setTimeout(r,350));if(!s.world.camper.root.visible)throw Error('Closing an established camper erased its location');
 const {captureSave,parseSave}=await import('/src/game/saveGame.ts');const saved=parseSave(captureSave(s.sim,'Placed camper'));if(saved.serviceSites.outreach.id!==site.id||!saved.ran.includes('outreach'))throw Error('Placed/closed camper lost its save history');
 return {count,name,site,firstY,settledY:s.world.camper.placementRoot.position.y,closedVisible:s.world.camper.root.visible,errors:window.__qaErrors};})()`},
 {shot:tutorial?'tutorial-placed.png':'regular-placed.png'},{eval:`if(document.querySelector('.tutorial-guide:not([hidden])')?.dataset.collapsed==='false')document.querySelector('.tutorial-toggle').click();if(document.querySelector('.time-pause').dataset.paused==='true')document.querySelector('.time-pause').click();true`},call('./perf.js',3)
 ],{size:'1280x800',seed:777,out,diagnostics:true,log:()=>{}});
 console.log(JSON.stringify({tutorial,measurements:results.filter(r=>r?.cpuMeanMs!==undefined)}));
 const samples=results.filter(r=>r?.cpuMeanMs!==undefined);assert(samples.length===2&&samples.every(r=>r.renderedFrames>0&&Number.isFinite(r.drawCallsPerRenderedFrame)),'Active frame/draw-call measurements required');
 const outcome=results.find(r=>r?.site);assert(outcome&&outcome.count>1&&outcome.closedVisible);assert.deepEqual(outcome.errors,[]);
 console.log(JSON.stringify({tutorial,results}));
}
console.log('Tutorial and regular first appearance, curb choice, cancellation, controls, closure, save history, frame cost and screenshots passed');
