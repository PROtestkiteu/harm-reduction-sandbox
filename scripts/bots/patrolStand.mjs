import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {drive,SKIP_WELCOME} from './chrome.mjs';
const out='/tmp/hrp-stand-515-qa';mkdirSync(out,{recursive:true});
const results=await drive('http://127.0.0.1:5295/?packs=none&quality=low&lang=en',[
 ...SKIP_WELCOME,
 {eval:`(()=>{const s=window.__sandbox;const loc=s.world.locations.footPatrol;window.standLoc=loc;const kit=loc.root.children[0];window.checkStand=()=>{let meshes=0;kit.traverse(o=>{if(o.isMesh)meshes++});return {visible:kit.visible,meshes,errors:window.__qaErrors}};loc.setServiceLevel(0);loc.update(10,0);s.hud.setFolded(true);s.interaction.selectLocation(null);s.rig.lookAt(loc.labelAnchor.clone().setY(1.5),3.2);s.rig.setView({azimuthDeg:225,elevationDeg:25});s.rig.step(0,true);s.camera.zoom=2;s.rig.invalidate();return checkStand()})()`},
 {wait:300},{shot:'closed.png'},
 {eval:`(()=>{standLoc.setServiceLevel(1);standLoc.update(10,0);return checkStand()})()`},
 {wait:300},{shot:'open.png'},
 {eval:`(()=>{standLoc.setServiceLevel(0);standLoc.update(10,0);return checkStand()})()`},
 {cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},
 {wait:300},{shot:'phone-closed.png'},
 {eval:`(()=>({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__qaErrors}))()`}
],{out,seed:777,size:'1280x800',diagnostics:true,log:()=>{}});
for(const r of results){if(r?.meshes){assert(r.visible);assert(r.meshes>10)}if(r?.errors)assert.deepEqual(r.errors,[])}assert(!results.at(-1).overflow);console.log(JSON.stringify(results));console.log('Patrol stand persists closed, open and closed again; desktop and phone bounds passed');
