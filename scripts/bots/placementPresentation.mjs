import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5217/', out=process.argv[3]??'/tmp/hrp-placement-presentation';mkdirSync(out,{recursive:true});
const reduced=process.env.REDUCED_MOTION==='1';
const results=await drive(base+'?scenario=tutorial&lang=en&packs=none&quality=low',[...SKIP_WELCOME,
 {eval:`(async()=>{const s=window.__sandbox;
 const wait=async(f)=>{const end=Date.now()+5000;while(!f()&&Date.now()<end)await new Promise(r=>setTimeout(r,25));if(!f())throw Error('Timed out preparing tutorial')};
 if(document.querySelector('.tutorial-guide').dataset.collapsed==='false')document.querySelector('.tutorial-toggle').click();
 s.sim.tutorial=s.sim.tutorial.constructor.restore({...s.sim.tutorial.snapshot(),stage:'outreach',reviewedSkills:true});s.syncEvents();
 if(document.querySelector('.time-pause').dataset.paused==='true')document.querySelector('.time-pause').click();
 await wait(()=>document.getElementById('hud').dataset.tutorialStaff==='true');
 if(document.querySelector('.tutorial-guide').dataset.collapsed==='false')document.querySelector('.tutorial-toggle').click();
 if(document.querySelector('.time-pause').dataset.paused!=='true')document.querySelector('.time-pause').click();
 s.interaction.selectLocation('outreach');if(s.world.camper.root.visible)throw Error('Camper exists before setup');
 document.querySelector('.opt.switch[data-service=outreach]').click();await wait(()=>!document.querySelector('.site-picker').hidden);
 document.querySelector('[data-placement-action=next]').click();document.querySelector('[data-placement-action=next]').click();
 const marker=s.world.scene.getObjectByName('serviceSiteTargets').children[1];s.rig.lookAt(marker.position.clone().setY(1),3.2);s.rig.step(0,true);s.rig.invalidate();
 return {beforeVisible:s.world.camper.root.visible,fields:s.world.scene.getObjectByName('serviceSiteTargets').children.length,errors:window.__qaErrors};})()`},
 {wait:400},{shot:'placement-fields.png'},
 {eval:`(async()=>{const s=window.__sandbox;document.querySelector('[data-placement-action=open]').click();const end=Date.now()+3000;while(!s.sim.outreachPlaced&&Date.now()<end)await new Promise(requestAnimationFrame);return {placed:s.sim.outreachPlaced,firstY:s.world.camper.placementRoot.position.y,drive:s.world.camper.drive.position.toArray(),paused:document.querySelector('.time-pause').dataset.paused};})()`},
 {wait:350},{shot:'assembly-early.png'},
 {eval:`({y:window.__sandbox.world.camper.placementRoot.position.y,active:window.__sandbox.world.scene.getObjectByName('placementAssembly').visible})`},
 {wait:450},{shot:'assembly-middle.png'},
 {wait:1100},{shot:'assembly-complete.png'},
 {eval:`(()=>{const s=window.__sandbox;return {visible:s.world.camper.root.visible,y:s.world.camper.placementRoot.position.y,scale:s.world.camper.placementRoot.scale.y,effects:s.world.scene.getObjectByName('placementAssembly').visible,overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__qaErrors}})()`},
],{out,seed:777,size:process.env.SIZE??'1280x800',colorScheme:process.env.SCHEME??'dark',reducedMotion:reduced,diagnostics:true,log:()=>{}});
console.log(JSON.stringify(results));assert(!results[1].beforeVisible&&results[1].fields===2);assert(results[2].placed);assert.equal(results[2].paused,'true');assert.deepEqual(results[2].drive,[0,0,0]);if(reduced)assert.equal(results[2].firstY,0);else assert(results[2].firstY<0);
const final=results.at(-1);assert(final.visible&&final.y===0&&final.scale===1&&!final.effects&&!final.overflow);assert.deepEqual(final.errors,[]);
console.log('First setup at chosen curb, real-time assembly while paused, placement colors, final cleanup and reduced-motion contract passed');
