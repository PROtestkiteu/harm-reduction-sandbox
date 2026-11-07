import assert from 'node:assert/strict';
import { drive, SKIP_WELCOME } from './chrome.mjs';
import { mkdirSync } from 'node:fs';
const out = '/tmp/hrs-city-people-qa'; mkdirSync(out, { recursive: true });
const steps = [...SKIP_WELCOME,
  { eval: `(()=>{window.qaErrors=[];window.addEventListener('error',e=>qaErrors.push(e.message));window.addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));return true})()` },
  { cdp: 'Input.dispatchKeyEvent', params: { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 } },
  { cdp: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 } },
  { eval: `(()=>{const s=window.__sandbox;window.findPerson=(coarse,offset)=>{const f=s.pipeline.frame;let found; s.world.people.forEachVisible(p=>{if(found)return;const v=p.root.position.clone();v.y+=0.9*p.root.scale.y;v.project(s.camera);const x=(v.x+1)/2*f.cssW+offset,y=(1-v.y)/2*f.cssH;if(x<40||x>innerWidth-40||y<150||y>innerHeight-100)return;const e=document.elementFromPoint(x,y);if(e!==s.renderer.domElement)return;const hit=s.interaction.picker.pick(x,y,s.camera,f,coarse);if(hit?.kind==='person'&&hit.id===p.id)found={x,y,id:p.id};});if(!found)throw Error('No selectable ambient person');window.clickPerson=found;return found;};return findPerson(false,10)})()` },
  { cdp: 'Input.dispatchMouseEvent', paramsEval: `({type:'mousePressed',x:clickPerson.x,y:clickPerson.y,button:'left',clickCount:1})` },
  { cdp: 'Input.dispatchMouseEvent', paramsEval: `({type:'mouseReleased',x:clickPerson.x,y:clickPerson.y,button:'left',clickCount:1})` },
  { wait: 800 },
  { eval: `(()=>{const s=window.__sandbox;if(s.interaction.selected?.id!==clickPerson.id)throw Error('Native mouse did not select ambient person');if(!s.crowd.person(clickPerson.id)?.ambient)throw Error('Lost ambient identity');return {selected:s.interaction.selected,drawCalls:s.renderer.info.render.calls}})()` },
  { shot: 'desktop-ambient.png' },
  { eval: `window.__sandbox.interaction.select(null);window.__sandbox.interaction.resetView();true` },
  { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 393, height: 852, deviceScaleFactor: 1, mobile: true } },
  { cdp: 'Emulation.setTouchEmulationEnabled', params: { enabled: true } },
  { wait: 800 },
  { eval: `findPerson(true,20)` },
  { cdp: 'Input.dispatchTouchEvent', paramsEval: `({type:'touchStart',touchPoints:[{x:clickPerson.x,y:clickPerson.y}]})` },
  { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } },
  { wait: 800 },
  { eval: `(()=>{if(window.__sandbox.interaction.selected?.id!==clickPerson.id)throw Error('Native touch did not select ambient person');return true})()` },
  { shot: 'phone-ambient.png' },
  { eval: `(()=>{const s=window.__sandbox;const p=s.crowd.person(clickPerson.id);s.sim.daemon.restore({since:s.sim.org.now,person:{id:p.id,x:p.root.position.x,z:p.root.position.z}});return true})()` },
  { cdp: 'Input.dispatchKeyEvent', params: { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 } },
  { cdp: 'Input.dispatchKeyEvent', params: { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 } },
  { wait: 1200 },
  { eval: `(()=>{const s=window.__sandbox;const p=s.crowd.person(clickPerson.id);if(!p?.crisis)throw Error('Ambient person did not evolve into crisis');if(s.sim.daemon.person.id!==p.id)throw Error('Crisis changed identity');let n=0;s.crowd.forEachVisible(x=>{if(x.id===p.id)n++});if(n!==1)throw Error('Duplicate crisis identity');const save=s.sim.daemon.snapshot();if(save.person.id!==p.id)throw Error('Snapshot lost crisis person');return {id:p.id,crisis:p.crisis,identities:n,save}})()` },
  { shot: 'phone-existing-person-crisis.png' },
  { eval: `(()=>{const s=window.__sandbox;s.world.setParkActivities({joggers:2,yoga:true,picnic:true});let n=0;s.world.people.forEachVisible(p=>{if(p.id<=-2000&&p.id>-3000){n++;if(s.crowd.person(p.id)!==p)throw Error('Park person missing from shared selection')}});if(n!==14)throw Error('Missing park people: '+n);s.world.setParkActivities({joggers:2,yoga:false,picnic:false});s.world.people.forEachVisible(p=>{if(p.id<=-2000&&p.id>-3000)throw Error('Hidden park person remained selectable')});return {parkPeople:n}})()` },
  { eval: `(async()=>{const s=window.__sandbox;await s.flavour.packs.set('street',true);await s.flavour.packs.set('squats',true);await s.flavour.packs.set('nightlife',true);const c={...s.flavour.context,market:0.8,squat:0.8,clock:1260};for(let i=0;i<100;i++)s.flavour.packs.update(0.1,c);let n=0;s.world.people.forEachVisible(p=>{if(p.id<=-10000){n++;if(s.crowd.person(p.id)!==p)throw Error('Flavour person missing from shared selection')}});if(!n)throw Error('No flavour people registered');await s.flavour.packs.set('street',false);return {flavourPeople:n}})()` },
  { eval: `(()=>{if(qaErrors.length)throw Error(qaErrors.join('; '));return {errors:qaErrors}})()` },
];
const results = await drive(process.argv[2] ?? 'http://127.0.0.1:5297/?packs=none&quality=low', steps, { out, size: '1440x900', seed: 777, settle: 12000 });
for (const result of results) assert(!result.exceptionDetails, JSON.stringify(result));
console.log(JSON.stringify(results, null, 2));
