/** Paused-game controls must update immediately without advancing the simulation or polling. */
import assert from 'node:assert/strict';
import { drive } from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5199/';
for(const [size,colorScheme] of [['1440x900','dark'],['320x568','light']]){
 const values=await drive(new URL('scripts/bots/recipientCare.fixture.html?lang=pl',base).href,[
 {eval:`(async()=>{for(let n=0;n<600&&!window.__careFixture;n++)await new Promise(r=>setTimeout(r,50));if(!window.__careFixture)throw Error('Fixture did not load: '+window.__careStage);const {panel,view,v}=window.__careFixture;const row=panel.root.querySelector('article'),select=row.querySelector('select');select.focus();select.value='2';select.dispatchEvent(new Event('change',{bubbles:true}));const deferred=v.nextWorker===2&&v.task.worker===1;const focus=document.activeElement===select;row.querySelector('button').click();const immediate=!v.task&&row.querySelector('p').textContent.includes('Oczekiwanie');panel.update(view);const same=select===row.querySelector('select');return{deferred,focus,immediate,same,flat:getComputedStyle(row).borderTopWidth==='0px',placeholder:panel.root.textContent.includes('Wartości koncepcyjne'),overflow:[row,...row.querySelectorAll('select,button')].some(e=>e.scrollWidth>e.clientWidth+2)};})()`},
 ],{menu:true,settle:1000,size,colorScheme,touch:size.startsWith('320'),log:()=>{}});
 const r=values[0];assert(r?.deferred&&r.focus&&r.immediate&&r.same&&r.flat);assert.equal(r.placeholder,false);assert.equal(r.overflow,false);console.log(`${size}: immediate paused feedback, preserved focus, flat controls and overflow passed`);
}
