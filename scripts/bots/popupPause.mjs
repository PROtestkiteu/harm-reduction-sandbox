// Public tutorial/welcome ownership and manual pause; development also exercises major-event overlap.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {drive} from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5217/';const out=process.argv[3]??'/tmp/hrp-popup-pause-qa';mkdirSync(out,{recursive:true});
const url=new URL(base);url.search='?menu=1&lang=en&packs=none&quality=low';
const results=await drive(url.href,[
{eval:`(async()=>{
 window.pauseWait=async(test,label,timeout=120000)=>{const end=Date.now()+timeout;while(!test()&&Date.now()<end)await new Promise(r=>setTimeout(r,50));if(!test())throw Error(label)};
 localStorage.setItem('hrp-tutorials-hidden',JSON.stringify(['guides']));await pauseWait(()=>document.querySelector('.main-menu-actions'),'menu');document.querySelectorAll('.main-menu-actions button')[1].click();[...document.querySelectorAll('.scenario-tile')].find(t=>t.querySelector('strong').textContent==='Tutorial').click();document.querySelector('.scenario-detail .menu-primary').click();
 await pauseWait(()=>document.querySelector('.tutorial-guide:not([hidden]) .tutorial-toggle')&&!document.getElementById('loading'),'tutorial');
 const intro=document.querySelector('dialog.intro');if(intro?.open)for(let i=0;i<5&&intro.open;i++)intro.querySelector('.intro-nav button:last-child').click();
 await new Promise(r=>setTimeout(r,100));
 window.pauseCycle=async()=>{
  const toggle=document.querySelector('.tutorial-toggle'),button=document.querySelector('.time-pause'),clock=document.querySelector('.top-bar .clock');
  if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();await pauseWait(()=>button.dataset.paused==='true','popup must freeze');
  let at=clock.textContent;await new Promise(r=>setTimeout(r,1500));if(clock.textContent!==at)throw Error('Clock advanced inside tutorial');
  toggle.click();await pauseWait(()=>button.dataset.paused==='false','fold must resume');at=clock.textContent;await pauseWait(()=>clock.textContent!==at,'Clock did not advance after folding',5000);
  button.click();toggle.click();if(button.dataset.paused!=='true')throw Error('Manual pause lost on opening');toggle.click();if(button.dataset.paused!=='true')throw Error('Manual pause lost on closing');
  button.click();await pauseWait(()=>button.dataset.paused==='false','manual resume');toggle.click();await pauseWait(()=>button.dataset.paused==='true','reopen must freeze');
  return {size:[innerWidth,innerHeight],frozen:true,resumed:true,manualPreserved:true,errors:window.__qaErrors};
 };return pauseCycle();})()`},
{shot:'desktop-tutorial-paused.png'},
{eval:`(async()=>{const s=window.__sandbox;if(!s)return {production:true};const button=document.querySelector('.time-pause'),toggle=document.querySelector('.tutorial-toggle'),clock=document.querySelector('.top-bar .clock');toggle.click();await pauseWait(()=>button.dataset.paused==='false','test start');
 const event={id:'pause-regression',title:'Pause check',lines:['Clock ownership check'],choices:[{label:'Continue'}]};
 s.eventPopup.show(event,s.sim.org.budget,()=> 'Outcome');await pauseWait(()=>button.dataset.paused==='true','event pause');const at=clock.textContent;await new Promise(r=>setTimeout(r,1500));if(clock.textContent!==at)throw Error('Clock advanced inside event');
 document.querySelector('dialog.event-popup[open] .event-choice').click();if(button.dataset.paused!=='true')throw Error('Event result released clock');document.querySelector('dialog.event-popup[open] .welcome-start').click();await pauseWait(()=>button.dataset.paused==='false','event close resume');
 s.eventPopup.show(event,s.sim.org.budget,()=> '');toggle.click();document.querySelector('dialog.event-popup[open] .event-choice').click();await new Promise(r=>setTimeout(r,100));if(button.dataset.paused!=='true')throw Error('Closing event released tutorial pause');toggle.click();await pauseWait(()=>button.dataset.paused==='false','last owner close');
 button.click();s.eventPopup.show(event,s.sim.org.budget,()=> '');document.querySelector('dialog.event-popup[open] .event-choice').click();await new Promise(r=>setTimeout(r,100));if(button.dataset.paused!=='true')throw Error('Event erased manual pause');button.click();
 s.eventPopup.show(event,s.sim.org.budget,()=> '');document.querySelector('dialog.event-popup[open]').close();s.eventPopup.show(event,s.sim.org.budget,()=> '');await new Promise(r=>setTimeout(r,100));if(button.dataset.paused!=='true')throw Error('Stale close released new event');document.querySelector('dialog.event-popup[open] .event-choice').click();await pauseWait(()=>button.dataset.paused==='false','new event close');toggle.click();return {eventFrozen:true,resultFrozen:true,overlap:true,staleClose:true,manualPreserved:true,errors:window.__qaErrors};})()`},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},{wait:150},
{eval:'pauseCycle()'},{shot:'phone-tutorial-paused.png'}
],{menu:true,diagnostics:true,size:'1280x800',out,log:()=>{}});
for(const row of results){assert(row);if(row.errors)assert.deepEqual(row.errors,[])}console.log(JSON.stringify(results));console.log('Popup freezes clock, fold/close resumes, manual pause and overlapping event ownership preserved on desktop/phone: passed');
