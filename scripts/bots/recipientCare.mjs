/** Real game panel + domain integration on desktop and touch, using the canonical Chrome driver. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('/tmp/hrs-recipient-care-qa', { recursive: true });
import { drive, SKIP_WELCOME } from './chrome.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5199/';
const setup = `(async()=>{
 const {sim,interaction}=window.__sandbox; sim.cycle=false; sim.tick=()=>{}; sim.services.clinic.enabled=true;sim.services.clinic.staffOnSite=2;
 const {RecipientCarePanel}=await import('/src/ui/recipientCare.ts');
 const {careEnvironment}=sim;
 const workers=sim.team.members.slice(0,2);
 workers.forEach((w,i)=>{w.traits=['nurse'];w.workingAt='clinic';w.energy=1;w.name='Pracownik '+i;});
 sim.recipientCare.visits.clear();
 const v=sim.recipientCare.ensure(9900,'clinic',['jaw','housing']);sim.recipientCare.activate(9900);
 v.states[0].completed={talk:10,leaflet:5};
 sim.recipientCare.tick('clinic',1,sim.careEnvironment());
 const q=sim.recipientCare.ensure(9901,'clinic',['psychosis','badTrip','unknown']);q.waited=30;
 interaction.selectLocation('clinic');window.__sandbox.syncEvents();
 // The full game panel owns this component; opening its disclosure must show actual sim cards.
 return {module:!!RecipientCarePanel,task:sim.recipientCare.visits.get(9900).task};
})()`;
const open = `(()=>{const p=document.querySelector('.recipient-care');p.open=true;return true;})()`;
const inspect = `(()=>{const p=document.querySelector('.recipient-care');const rows=[...p.querySelectorAll('article')];const visible=e=>!!e.getClientRects().length;return {
 flat:rows.length>0&&getComputedStyle(rows[0]).borderTopWidth==='0px'&&getComputedStyle(rows[0]).borderRadius==='0px', placeholder:p.textContent.includes('Wartości koncepcyjne'), count:rows.length, labels:rows.map(r=>r.querySelector('h4').textContent),
 progress:rows.map(r=>[...r.querySelectorAll('progress')].map(p=>p.value)),
 overflow:[p,...p.querySelectorAll('article,select,button')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.tagName),
 selects:rows.map(r=>r.querySelector('select').getAttribute('aria-label')),errors:window.__careErrors??[],
 };})()`;
for (const [size,touch,colorScheme] of [['1440x900',false,'dark'],['393x852',true,'light']]) {
 const values=await drive(`${base}?lang=pl&quality=low&packs=none`,[
 ...SKIP_WELCOME,{eval:`window.__careErrors=[];window.addEventListener('error',e=>window.__careErrors.push(e.message));true`},
 {eval:setup},{wait:500},{eval:open},{wait:200},{eval:inspect},
 {eval:`(()=>{const {sim}=window.__sandbox;const row=document.querySelector('.recipient-care-row');const select=row.querySelector('select');select.focus();select.value=String(sim.team.members[1].id);select.dispatchEvent(new Event('change',{bubbles:true}));const v=sim.recipientCare.visits.get(9900);return {deferred:v.nextWorker,active:v.task.worker,expected:sim.team.members[1].id};})()`},
 {wait:200},{eval:`(()=>{const {sim}=window.__sandbox;const r=document.querySelector('.recipient-care-row');r.querySelector('button').click();return {interrupted:!sim.recipientCare.visits.get(9900).task,score:sim.recipientCare.visits.get(9900).states[0].completed.talk};})()`},
 {shot:`recipients-${size}.png`},
 ],{size,touch,colorScheme,out:'/tmp/hrs-recipient-care-qa',log:()=>{}});
 const panel=values.find(v=>v?.labels);assert(panel);assert.equal(panel.count,2);assert(panel.flat);assert.equal(panel.placeholder,false);assert.equal(panel.overflow.length,0);assert.equal(panel.errors.length,0);assert(panel.labels.every(s=>s.startsWith('Odbiorca')));assert(panel.selects.every(Boolean));
 const changed=values.find(v=>v?.deferred);assert.equal(changed.deferred,changed.expected);assert.notEqual(changed.active,changed.expected);
 const stopped=values.find(v=>v?.interrupted);assert(stopped);assert.equal(stopped.score,10);
 console.log(`${size} ${colorScheme}: recipient traits, shared progress, accessible controls, deferred assignment, cancellation and no overflow passed`);
}
