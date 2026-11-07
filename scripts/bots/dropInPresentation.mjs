// A fixture reaches the lesson; service choice and confirmation use the real UI.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {drive,call,SKIP_WELCOME} from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5308/thegame/';
const baseline=process.argv.includes('--baseline'),out=process.env.OUT??'/tmp/hrp-home-533-visual';mkdirSync(out,{recursive:true});
const mouse=selector=>['mousePressed','mouseReleased'].map(type=>({cdp:'Input.dispatchMouseEvent',paramsEval:`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {type:'${type}',x:r.x+r.width/2,y:r.y+r.height/2,button:'left',buttons:${type==='mousePressed'?1:0},clickCount:1}})()`}));
const click=selector=>process.env.SIZE?.startsWith('393')?[
{cdp:'Input.dispatchTouchEvent',paramsEval:`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]}})()`},
{cdp:'Input.dispatchTouchEvent',params:{type:'touchEnd',touchPoints:[]}}
]:mouse(selector);
const rows=await drive(base+'?scenario=tutorial&packs=none&quality=low',[
...SKIP_WELCOME,
{eval:`(()=>{const s=window.__sandbox;s.sim.tutorial=s.sim.tutorial.constructor.restore({...s.sim.tutorial.snapshot(),stage:'dropIn',reviewedSkills:true});s.syncEvents();document.querySelector('.tutorial-close').click();const c=s.world.locations.dropIn;return {pendingBranded:c.root.visible,pendingNeutral:c.vacantRoot?.visible??false,labelHidden:s.hud.labelFor('dropIn').hidden}})()`},
{wait:350},{shot:'before-placement.png'},call('./renderProbe.js',1,2),
{eval:`(()=>{const s=window.__sandbox;s.rig.lookAt(s.world.locations.dropIn.labelAnchor,2);s.rig.step(0,true);s.rig.invalidate();return true})()`},{wait:250},{shot:'home-before-setup.png'},
{eval:`(()=>{const s=window.__sandbox;s.interaction.selectLocation('dropIn');document.querySelector('.opt.switch[data-service=dropIn]').click();return {stillOff:!s.sim.services.dropIn.switchedOn}})()`},
...click('[data-placement-action=cancel]'),
{eval:`(()=>{const s=window.__sandbox;const cancelled=!s.sim.services.dropIn.switchedOn&&!s.world.scene.getObjectByName('serviceSiteMarkers');document.querySelector('.opt.switch[data-service=dropIn]').click();return {cancelled}})()`},
...click('[data-placement-action=next]'),...click('[data-placement-action=next]'),...click('[data-placement-action=open]'),{wait:500},
{eval:`(()=>{const s=window.__sandbox,c=s.world.locations.dropIn,site=s.sim.serviceSites.dropIn,fit=s.world.scene.getObjectByName('fitOuts').children.find(g=>g.visible);s.rig.lookAt(c.labelAnchor,3.2);s.rig.step(0,true);s.rig.invalidate();return {site,brandedHome:c.root.visible,neutralHome:c.vacantRoot?.visible??false,frontVisible:fit?.visible??false,frontY:fit?.position.y,paused:document.querySelector('.time-pause').dataset.paused,visits:s.sim.tutorial.visits.dropIn??0,overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__qaErrors}})()`},
{wait:250},{shot:'chosen-building-paused.png'},
{eval:`(()=>{const s=window.__sandbox,g=s.world.scene.getObjectByName('fitOuts').children.find(g=>g.visible);document.querySelector('.tutorial-minimize').click();s.hud.setFolded(true);const p=g.children[0].getWorldPosition(s.rig.focus.clone());p.y=1.5;s.rig.lookAt(p,2.6);s.rig.step(0,true);s.rig.invalidate();return true})()`},{wait:350},{shot:'chosen-frontage.png'}
],{out,seed:777,size:process.env.SIZE??'1280x800',touch:process.env.SIZE?.startsWith('393'),diagnostics:true,log:()=>{}});
console.log(JSON.stringify(rows));
const pending=rows.find(r=>r?.pendingBranded!==undefined),result=rows.find(r=>r?.site);
assert(rows.some(r=>r?.cancelled));assert.equal(result.site.kind,'building');assert.equal(result.paused,'true');assert.equal(result.visits,0);assert(!result.overflow);assert.deepEqual(result.errors,[]);
if(!baseline){assert(!pending.pendingBranded&&pending.pendingNeutral&&pending.labelHidden);assert(!result.brandedHome&&result.neutralHome&&result.frontVisible);assert.equal(result.frontY,0);}
console.log(baseline?'Baseline placement appearance captured':'Unplaced neutral home, cancel, chosen frontage visible while paused and no false visit credit: passed');
