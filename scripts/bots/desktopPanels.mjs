// Shared desktop panel placement, header clearance, focus return and compact layout sanity.
import assert from 'node:assert/strict';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const url = process.argv[2] ?? 'http://127.0.0.1:5202/?scenario=tutorial&packs=none&quality=low';
const out = process.argv[3] ?? '/Volumes/Local2VPS-Work/tmp/hrs-desktop-qa';
const bounds = `(()=>{const sels=['#hud','.hud-header','.sandbox-toggle','.tutorial-guide','.column','.sheet[data-open=true]','.sandbox:not(.sheet) .sandbox-body:not([hidden])'];return {errors:window.__qaErrors,size:[innerWidth,innerHeight],rects:Object.fromEntries(sels.map(s=>{const e=document.querySelector(s);const r=e?.getBoundingClientRect();return [s,r&&e.getClientRects().length?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,scroll:e.scrollWidth,client:e.clientWidth}:null]}))};})()`;
const click = text => `(()=>{const b=[...document.querySelectorAll('.column button')].find(b=>b.getClientRects().length&&b.textContent.includes(${JSON.stringify(text)}));if(!b)throw new Error('Missing action: '+${JSON.stringify(text)});b.focus();b.click();return true;})()`;
const results=await drive(url,[...SKIP_WELCOME,
{eval:`window.__sandbox.sim.tutorial.state.stage='outreach';window.__sandbox.syncEvents();document.querySelector('.tutorial-toggle').click();true`},{wait:500},{eval:bounds},{shot:'desktop-folded.png'},
{eval:click('Review team skills')},{wait:300},{eval:`document.querySelector('.employee-skill-help').open=true;true`},{eval:bounds},{eval:`(()=>{const rect=e=>e.getBoundingClientRect();const paragraphs=[...document.querySelectorAll('.org-team>.factor-summary')];const who=document.querySelector('.org-team .team-list .team-who');const parts=[...who.children].map(rect);return {spacing:true,paragraphGap:rect(paragraphs[1]).top-rect(paragraphs[0]).bottom,helpGap:rect(document.querySelector('.employee-skill-help')).top-rect(paragraphs[1]).bottom,cardGaps:parts.slice(1).map((r,i)=>r.top-parts[i].bottom),identity:rect(document.querySelector('.team-identity')).height};})()`},{shot:'desktop-team.png'},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},{wait:100},{eval:`({closed:!document.querySelector('.sheet[data-open=true]'),focus:document.activeElement?.textContent.includes('Review team skills')})`},
{eval:`window.__sandbox.sim.tutorial.state.stage='complete';window.__sandbox.hud.setTutorialCapabilities(window.__sandbox.sim.tutorialCapabilities);window.__sandbox.syncEvents();document.querySelector('.money-btn').focus();document.querySelector('.money-btn').click();true`},{wait:300},{eval:bounds},{shot:'desktop-organisation.png'},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},
{eval:`window.__sandbox.sim.tutorial.state.stage='outreach';window.__sandbox.syncEvents();document.querySelector('.sandbox-toggle').click();true`},{wait:300},{eval:bounds},{shot:'desktop-settings.png'},
{eval:`document.querySelector('.sandbox-toggle').click();document.querySelector('.hud-title').textContent='Harm reduction project with a long translated heading that wraps across several lines';true`},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:1024,height:700,deviceScaleFactor:1,mobile:false}},{wait:500},{eval:bounds},{shot:'desktop-wrapped.png'},
{eval:click('Review team skills')},{wait:300},{eval:bounds},{shot:'desktop-narrow-team.png'},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},
{eval:`document.querySelector('.hud-title').textContent='Harm reduction project';true`},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},{wait:500},{eval:bounds},{shot:'mobile.png'}
],{size:'1920x900',out,diagnostics:true,log:()=>{}});
console.log(JSON.stringify(results,null,2));
const spacing=results.find(v=>v?.spacing);assert(spacing.paragraphGap>=12);assert(spacing.helpGap>=16);assert(spacing.cardGaps.every(g=>g>=12));assert(spacing.identity>=40);
const views=results.filter(v=>v?.rects);
for(const v of views){assert.equal(v.errors.length,0);const hud=v.rects['#hud'];for(const [name,r]of Object.entries(v.rects)){if(!r||name==='.column')continue;assert(r.left>=hud.left-1&&r.right<=hud.right+1&&r.top>=hud.top-1&&r.bottom<=hud.bottom+1,`${v.size}: ${name} outside HUD`);assert((v.size[0]<=760&&['.hud-header','.sandbox-toggle'].includes(name))||r.scroll<=r.client+1,`${name}: horizontal overflow`);}}
for(const v of views.filter(v=>v.size[0]>760)){const r=v.rects;const guide=r['.tutorial-guide'];if(guide)assert(guide.top>=Math.max(r['.hud-header'].bottom,r['.sandbox-toggle'].bottom)+10,'Tutorial overlaps desktop controls');const sheet=r['.sheet[data-open=true]'];if(sheet){assert(sheet.left>r['#hud'].left+16,'Sheet remains pinned to left');assert(Math.abs((sheet.left+sheet.right)/2-(r['#hud'].left+r['#hud'].right)/2)<=1,'Sheet is not horizontally centered in the viewport');assert(Math.abs((sheet.top+sheet.bottom)/2-(r['#hud'].top+r['#hud'].bottom)/2)<=1,'Sheet is not vertically centered in the viewport');}}
const settingsView=views.find(v=>v.rects['.sandbox:not(.sheet) .sandbox-body:not([hidden])']);assert(settingsView&&!settingsView.rects['.tutorial-guide'],'Settings must cover the tutorial instead of overlapping it');
assert(results.some(v=>v?.closed&&v?.focus),'Escape must return focus to originating action');
assert(views.filter(v=>v.rects['.sheet[data-open=true]']).length>=3,'Team and full organisation entry points tested');
console.log('Desktop header clearance, shared sheets, Settings overflow, focus return and mobile sanity passed');
