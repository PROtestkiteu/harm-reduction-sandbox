// Shared desktop panel placement, header clearance, focus return and compact layout sanity.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const url = process.argv[2] ?? 'http://127.0.0.1:5202/?scenario=tutorial&packs=none&quality=low';
const out = process.argv[3] ?? '/Volumes/Local2VPS-Work/tmp/hrs-desktop-qa';
mkdirSync(out, { recursive: true });
const bounds = `(()=>{const sels=['#hud','.hud-header','.top-bar','.sandbox-toggle','.tutorial-guide','.column','.sheet[data-open=true]','.sandbox:not(.sheet) .sandbox-body:not([hidden])'];return {errors:window.__qaErrors,tutorialActionsOwned:[...document.querySelectorAll('.tutorial-action')].every(b=>b.closest('.tutorial-guide')),genericTutorialActions:document.querySelectorAll('.options .tutorial-action').length,size:[innerWidth,innerHeight],rects:Object.fromEntries(sels.map(s=>{const e=document.querySelector(s);const r=e?.getBoundingClientRect();return [s,r&&e.getClientRects().length?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,scroll:e.scrollWidth,client:e.clientWidth}:null]}))};})()`;
const click = text => `(()=>{const b=[...document.querySelectorAll('.column button.opt, .tutorial-actions button')].find(b=>b.getClientRects().length&&b.textContent.includes(${JSON.stringify(text)}));if(!b)throw new Error('Missing action: '+${JSON.stringify(text)});b.focus();b.click();return true;})()`;
const dragSheet=[{eval:`window.sheetBefore=document.querySelector('.sheet[data-open=true]').getBoundingClientRect().toJSON();true`}];
for(const [dx,dy] of [[40,20],[-40,-20]]) dragSheet.push(
  {eval:`(()=>{const r=document.querySelector('.sheet[data-open=true] .window-drag-handle').getBoundingClientRect();window.sheetPoint={x:r.left+20,y:r.top+20};return true})()`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mousePressed',...sheetPoint,button:'left',buttons:1,clickCount:1})`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseMoved',x:sheetPoint.x+${dx},y:sheetPoint.y+${dy},button:'left',buttons:1})`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseReleased',x:sheetPoint.x+${dx},y:sheetPoint.y+${dy},button:'left',buttons:0,clickCount:1})`},
  {eval:`(()=>{const r=document.querySelector('.sheet[data-open=true]').getBoundingClientRect();if(Math.abs(r.left-sheetBefore.left-${dx===40?40:0})>1||Math.abs(r.top-sheetBefore.top-${dy===20?20:0})>1)throw Error('Sheet drag failed');return {sheetDragged:true}})()`});
const results=await drive(url,[...SKIP_WELCOME,
{eval:`window.__sandbox.sim.tutorial.state.stage='outreach';window.__sandbox.syncEvents();if(document.querySelector('.tutorial-toggle').getAttribute('aria-expanded')==='true')document.querySelector('.tutorial-toggle').click();true`},{wait:500},{eval:bounds},{shot:'desktop-folded.png'},
{eval:click('Review team skills')},{wait:300},{eval:`document.querySelector('.employee-skill-help').open=true;true`},{eval:bounds},{eval:`(()=>{const rows=[...document.querySelectorAll('.compact-member')];return {spacing:true,heights:rows.map(r=>r.getBoundingClientRect().height),skills:rows.map(r=>r.querySelectorAll('.skill-strip .indicator-value').length),identity:document.querySelector('.member-disclosure').getBoundingClientRect().height};})()`},{shot:'desktop-team.png'},...dragSheet,
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},{wait:100},{eval:`({closed:!document.querySelector('.sheet[data-open=true]'),focus:document.activeElement?.textContent.includes('Open outreach controls')})`},
{eval:`window.__sandbox.sim.tutorial.state.stage='complete';window.__sandbox.hud.setTutorialCapabilities(window.__sandbox.sim.tutorialCapabilities);window.__sandbox.syncEvents();document.querySelector('.money-btn').focus();document.querySelector('.money-btn').click();true`},{wait:300},{eval:bounds},{shot:'desktop-organisation.png'},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},
{eval:`window.__sandbox.sim.tutorial.state.stage='outreach';window.__sandbox.syncEvents();document.querySelector('.sandbox-toggle').click();true`},{wait:300},{eval:bounds},{shot:'desktop-settings.png'},
{eval:`document.querySelector('.sandbox-toggle').click();true`},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:1024,height:700,deviceScaleFactor:1,mobile:false}},{wait:500},{eval:bounds},{shot:'desktop-narrow.png'},
{eval:`window.__sandbox.sim.tutorial.state.reviewedSkills=false;window.__sandbox.syncEvents();true`},{wait:350},
{eval:click('Review team skills')},{wait:300},{eval:bounds},{shot:'desktop-narrow-team.png'},
{cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},{wait:500},{eval:bounds},{shot:'mobile.png'}
],{size:'1920x900',out,diagnostics:true,log:()=>{}});
console.log(JSON.stringify(results,null,2));
const spacing=results.find(v=>v?.spacing);assert(spacing.heights.every(h=>h<=116));assert(spacing.skills.every(n=>n===4));assert(spacing.identity>=40);
const views=results.filter(v=>v?.rects);
for(const v of views){assert.equal(v.errors.length,0);assert(v.tutorialActionsOwned);assert.equal(v.genericTutorialActions,0);const hud=v.rects['#hud'];for(const [name,r]of Object.entries(v.rects)){if(!r||name==='.column')continue;assert(r.left>=hud.left-1&&r.right<=hud.right+1&&r.top>=hud.top-1&&r.bottom<=hud.bottom+1,`${v.size}: ${name} outside HUD`);assert((v.size[0]<=760&&['.hud-header','.top-bar','.sandbox-toggle'].includes(name))||r.scroll<=r.client+1,`${name}: horizontal overflow`);}}
for(const v of views.filter(v=>v.size[0]>760)){const r=v.rects;const guide=r['.tutorial-guide'];if(guide)for(const selector of ['.hud-header','.top-bar','.sandbox-toggle']){const control=r[selector];assert(!control||guide.left>=control.right||guide.right<=control.left||guide.top>=control.bottom||guide.bottom<=control.top,'Tutorial overlaps '+selector);}const sheet=r['.sheet[data-open=true]'];if(sheet){assert(sheet.left>r['#hud'].left+16,'Sheet remains pinned to left');assert(Math.abs((sheet.left+sheet.right)/2-(r['#hud'].left+r['#hud'].right)/2)<=1,'Sheet is not horizontally centered in the viewport');assert(Math.abs((sheet.top+sheet.bottom)/2-(r['#hud'].top+r['#hud'].bottom)/2)<=1,'Sheet is not vertically centered in the viewport');}}
const settingsView=views.find(v=>v.rects['.sandbox:not(.sheet) .sandbox-body:not([hidden])']);assert(settingsView&&!settingsView.rects['.tutorial-guide'],'Settings must cover the tutorial instead of overlapping it');
assert(results.some(v=>v?.closed&&v?.focus),'Escape must return focus to originating action');
assert(views.filter(v=>v.rects['.sheet[data-open=true]']).length>=3,'Team and full organisation entry points tested');
console.log('Desktop header clearance, shared sheets, Settings overflow, focus return and mobile sanity passed');
