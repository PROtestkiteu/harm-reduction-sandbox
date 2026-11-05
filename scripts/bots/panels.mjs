import assert from 'node:assert/strict';
import {drive,SKIP_WELCOME} from './chrome.mjs';
import {mkdirSync} from 'node:fs';
const url=process.argv[2]??'http://127.0.0.1:5208/?scenario=sandbox&packs=none&quality=low';
const out=process.argv[3]??'/tmp/hrs-right-modules-qa';mkdirSync(out,{recursive:true});
for(const size of (process.env.PANEL_SIZES?.split(',')??['1440x900','393x852','568x320'])){
 const results=await drive(url,[...SKIP_WELCOME,
 {eval:`(()=>{const visible=e=>!!e&&e.getClientRects().length>0;return {layers:![...document.querySelectorAll('.map-layer-rail button')].some(b=>{const r=b.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}),launcher:!!document.querySelector('.panels-toggle'),services:visible(document.querySelector('.service-module-toggle')),goals:visible(document.querySelector('.column .goals-head')),events:visible(document.querySelector('.column .events-heading')),idle:document.querySelector('.column .window').hidden,overflow:document.documentElement.scrollWidth>innerWidth}})()`},
 {shot:size+'-overview.png'},
 {eval:`document.querySelector('.portrait').click();({open:!!document.querySelector('.sheet[data-open=true] #org-section')})`},
 {eval:`document.querySelector('.sheet[data-open=true] .panel-dismiss').click();document.querySelector('.goals-head').click();window.__sandbox.syncEvents();({goals:document.querySelector('.goals-strip').dataset.open})`},
 {eval:`document.querySelector('.goals-head').click();document.querySelector('.events-heading').click();window.__sandbox.syncEvents();({goals:document.querySelector('.goals-strip').dataset.open,events:document.querySelector('.events').dataset.open})`},
 {eval:`document.querySelector('.events-heading').click();document.querySelector('.service-module-toggle').click();({services:document.querySelector('.service-module-toggle').getAttribute('aria-expanded'),rows:[...document.querySelectorAll('.svc-row')].filter(e=>e.getClientRects().length).length})`},
 {eval:`document.querySelector('.service-module-toggle').click();window.__sandbox.interaction.selectLocation('footPatrol');({closed:document.querySelector('.service-module-toggle').getAttribute('aria-expanded'),facts:document.querySelector('.place-facts').innerText,chips:document.querySelectorAll('.location-view .chip').length,status:document.querySelector('.window .said').innerText})`},
 {shot:size+'-service.png'},
 {eval:`(()=>{const s=window.__sandbox;s.hud.showPerson({title:'QA nurse',subtitle:'Foot patrol team',activity:'On shift',role:'staff',worker:s.sim.team.members[0],inView:true});const title=document.querySelector('.window .selection-heading');return {title:title.textContent,visible:!!title.getClientRects().length,role:document.querySelector('.aside')?.textContent??document.querySelector('.person-summary')?.previousElementSibling?.textContent,skills:document.querySelectorAll('.person-summary .skill-strip .indicator').length,overflow:document.documentElement.scrollWidth>innerWidth}})()`}
 ],{out,size,touch:!size.startsWith('1440'),seed:777,log:()=>{}});
 results.shift();console.log(size,JSON.stringify(results));
 const [initial,portrait,opened,folded,services,selected,person]=results;
 assert(initial.layers&&!initial.launcher&&initial.services&&initial.goals&&initial.events&&!initial.overflow&&initial.idle);assert(portrait.open);assert.equal(opened.goals,'true');assert.equal(folded.goals,'false');assert.equal(folded.events,'true');assert.equal(services.services,'true');assert(services.rows>0);assert.equal(selected.closed,'false');assert(selected.facts&&selected.chips>0&&selected.status);assert(person.title.includes('QA nurse')&&person.visible&&person.skills===4&&!person.overflow);
}
console.log('Portrait organisation, direct right-side modules, retained fold state and complete inspectors: passed');
