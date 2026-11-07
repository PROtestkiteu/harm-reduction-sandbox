import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const out=process.env.OUT??'/tmp/hrp-sign-facing';mkdirSync(out,{recursive:true});
const results=await drive('http://127.0.0.1:5199/?packs=none&quality=low&lang=en',[...SKIP_WELCOME,
 {eval:`(async()=>{
 const s=window.__sandbox;
 if(document.querySelector('.time-pause').dataset.paused!=='true')document.querySelector('.time-pause').click();
 const {PATROL,CAMPER_SPOTS}=await import('/src/world/layout.ts');
 const {ServiceHosting}=await import('/src/world/serviceHosting.ts');
 window.signQA={PATROL,CAMPER_SPOTS,hosting:new ServiceHosting(s.world.locations,(id,m)=>s.world.transformStage(id,m))};
 const loc=s.world.locations.footPatrol;loc.setServiceLevel(1);loc.update(10,0);s.world.setStaffing('footPatrol',0,0,true);s.world.update(3,0);
 s.hud.setFolded(true);s.interaction.selectLocation(null);
 s.rig.lookAt(loc.labelAnchor.clone().setY(1.5),3.2);s.rig.setView({azimuthDeg:225,elevationDeg:25});s.rig.step(0,true);s.rig.invalidate();
 s.camera.zoom=2;
 return {authored:!!loc.roofSign,boards:loc.root.getObjectsByProperty('name','footPatrolSign').length,errors:window.__qaErrors};
 })()`}, {wait:500},{shot:'patrol-front.png'},
 {eval:`(()=>{const s=window.__sandbox;s.rig.setView({azimuthDeg:45,elevationDeg:25});s.rig.step(0,true);s.rig.invalidate();return true})()`},
 {wait:500},{shot:'patrol-back.png'},
 {eval:`(()=>{const s=window.__sandbox;const id=signQA.CAMPER_SPOTS.findIndex(c=>c.rot!==signQA.PATROL.frame.rot);signQA.hosting.set('footPatrol',{kind:'curb',id});s.rig.lookAt(s.world.locations.footPatrol.labelAnchor.clone().setY(1.5),3.2);s.rig.setView({azimuthDeg:135,elevationDeg:25});s.rig.step(0,true);s.rig.invalidate();return {id,errors:window.__qaErrors}})()`},
 {wait:500},{shot:'patrol-rotated.png'},
 {cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},
 {wait:400},{eval:`(()=>{const s=window.__sandbox;s.rig.lookAt(s.world.locations.footPatrol.labelAnchor.clone().setY(1.5),3.2);s.rig.setView({azimuthDeg:135,elevationDeg:25});s.rig.step(0,true);s.camera.zoom=2;s.rig.invalidate();return true})()`},{wait:400},{shot:'patrol-mobile.png'},
 {eval:`(()=>({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__qaErrors}))()`},
],{out,seed:777,size:'1280x800',colorScheme:process.env.SCHEME??'dark',reducedMotion:process.env.REDUCED_MOTION==='1',diagnostics:true,log:()=>{}});
console.log(JSON.stringify(results));assert(results[1].authored&&results[1].boards===1);for(const r of results)if(r?.errors)assert.deepEqual(r.errors,[]);assert(!results.at(-1).overflow);
