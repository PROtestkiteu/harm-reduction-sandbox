import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const mobile=process.env.SIZE?.startsWith('393'),out=process.env.OUT??'/tmp/hrp-map-placement';mkdirSync(out,{recursive:true});
const curbTarget=process.env.SERVICE==='outreach';
const point=`(()=>{const s=window.__sandbox,m=s.world.scene.getObjectByName('serviceSiteTargets').children[1],v=m.children[0];const p=(${curbTarget}?m.children[1]:v).getWorldPosition(s.world.locations.dropIn.labelAnchor.clone());if(!${curbTarget})p.y+=v.scale.y/2;p.project(s.camera);const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}})()`;
const pointer=mobile?[
 {cdp:'Input.dispatchTouchEvent',paramsEval:`(()=>{const p=${point};return {type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]}})()`},
 {cdp:'Input.dispatchTouchEvent',params:{type:'touchEnd',touchPoints:[]}},
]:[
 {cdp:'Input.dispatchMouseEvent',paramsEval:`(()=>{const p=${point};return {type:'mouseMoved',...p}})()`},
 {cdp:'Input.dispatchMouseEvent',paramsEval:`(()=>{const p=${point};return {type:'mousePressed',button:'left',buttons:1,clickCount:1,...p}})()`},
 {cdp:'Input.dispatchMouseEvent',paramsEval:`(()=>{const p=${point};return {type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p}})()`},
];
const selectedService=process.env.SERVICE??'dropIn';
const results=await drive('http://127.0.0.1:5199/?scenario=tutorial&packs=none&lang=en&quality=low',[...SKIP_WELCOME,
 {eval:`(async()=>{const s=window.__sandbox,wait=()=>new Promise(r=>setTimeout(r,350));
 s.sim.tutorial=s.sim.tutorial.constructor.restore({...s.sim.tutorial.snapshot(),stage:'dropIn',reviewedSkills:true});s.syncEvents();await wait();
 s.interaction.selectLocation('dropIn');await wait();document.querySelector('.opt.switch[data-service=dropIn]').click();await wait();
 const count=s.world.scene.getObjectByName('serviceSiteTargets')?.children.length??0;
 if(count<2)throw Error('No map choices');
 const before=s.sim.services.dropIn.switchedOn;
 document.querySelector('[data-placement-action=cancel]').click();await wait();
 const cancelled=!s.sim.services.dropIn.switchedOn&&!s.world.scene.getObjectByName('serviceSiteMarkers');
 document.querySelector('.opt.switch[data-service=dropIn]').click();await wait();
 return {count,before,cancelled,modal:!!document.querySelector('dialog.site-picker'),mapActive:document.getElementById('hud').dataset.placing==='true',paused:document.querySelector('.time-pause').dataset.paused};})()`},
 {shot:'building-choices.png'},
 // Invalid ground keeps the placement state and its controls available.
 {eval:`(()=>{const s=window.__sandbox;s.interaction.activate(-1000,-1000,false);return {kept:!!s.world.scene.getObjectByName('serviceSiteMarkers'),off:!s.sim.services.dropIn.switchedOn}})()`},
 // Bring the candidate into view, then use native mouse/touch input to choose its roof.
 {eval:`(()=>{const s=window.__sandbox,m=s.world.scene.getObjectByName('serviceSiteTargets').children[1];s.rig.lookAt(m.position.clone().setY(0),1.6);s.rig.step(0,true);s.rig.invalidate();return true})()`},
 {wait:500},{shot:'target-before-click.png'},...pointer,{wait:500},
 {eval:`(async()=>{const s=window.__sandbox,site=s.sim.serviceSites.dropIn;if(!site)throw Error('Map click did not open service');
 const {captureSave,parseSave}=await import('/src/game/saveGame.ts');const saved=parseSave(captureSave(s.sim,'Sites'));
 for(let i=0;i<3600*30&&(s.sim.tutorial.visits.dropIn??0)<5;i++){s.sim.tick(1/30);const pace=s.sim.pace,n=Math.max(1,Math.ceil(pace));for(let p=0;p<n;p++)s.crowd.update(pace/30/n);s.world.update(1/30,i/30);if(i%900===0){s.syncEvents();await new Promise(requestAnimationFrame);}}
 return {site,savedSite:saved.serviceSites.dropIn,open:s.sim.services.dropIn.switchedOn,visits:s.sim.tutorial.visits.dropIn??0,markersGone:!s.world.scene.getObjectByName('serviceSiteMarkers'),barHidden:document.querySelector('.site-picker').hidden,overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__qaErrors};})()`},
 {shot:'building-opened.png'},
].map(step=>selectedService==='dropIn'?step:{...step,...(step.eval?{eval:step.eval.replaceAll('dropIn',selectedService)}:{}),...(step.paramsEval?{paramsEval:step.paramsEval.replaceAll('dropIn',selectedService)}:{})}),{out,seed:777,size:process.env.SIZE??'1280x800',colorScheme:process.env.SCHEME??'dark',reducedMotion:process.env.REDUCED_MOTION==='1',touch:mobile,diagnostics:true,log:()=>{}});
console.log(JSON.stringify(results));const setup=results.find(r=>r?.count),result=results.find(r=>r?.site);
assert(setup.count>1&&!setup.before&&setup.cancelled&&!setup.modal&&setup.mapActive);assert(results.find(r=>r?.kept)?.off);assert(result.open&&result.visits>=5&&result.markersGone&&result.barHidden&&!result.overflow);assert.equal(result.site.kind,selectedService==='outreach'?'curb':'building');assert.deepEqual(result.site,result.savedSite);assert.deepEqual(result.errors,[]);
