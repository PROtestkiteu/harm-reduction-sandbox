// Tutorial hierarchy: central new objectives, explicit folding into the contextual dock.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const url = process.argv[2] ?? 'http://127.0.0.1:5217/?scenario=tutorial&packs=none&quality=low';
const out = process.argv[3] ?? '/tmp/hrs-tutorial-presentation-qa';
mkdirSync(out, { recursive: true });
const inspect = `(() => {
  const card = document.querySelector('.tutorial-guide'), r = card.getBoundingClientRect(), h = document.getElementById('hud').getBoundingClientRect();
  // Lessons use the game's own controls; only the completed tutorial keeps a guide button.
  const buttons = card.querySelectorAll('.tutorial-action');
  return { expanded: card.dataset.collapsed === 'false', dialog: card.getAttribute('role') === 'dialog', docked: !!card.closest('.tutorial-dock'),
    centered: Math.abs((r.left+r.right-h.left-h.right)/2)<1 && Math.abs((r.top+r.bottom-h.top-h.bottom)/2)<1,
    bounded: r.left>=h.left && r.right<=h.right && r.top>=h.top && r.bottom<=h.bottom,
    scrollable: card.scrollHeight<=card.clientHeight+1 || getComputedStyle(card).overflowY==='auto',
    noGuideActions: buttons.length === 0,
    errors: window.__qaErrors, size: [innerWidth,innerHeight] };
})()`;
const steps = [...SKIP_WELCOME,
  {eval:`(()=>{const r=document.querySelector('.tutorial-guide > .window-drag-margin[data-edge=left]').getBoundingClientRect();window.dragPoint={x:r.left+5,y:r.top+20};window.dragBefore=document.querySelector('.tutorial-guide').getBoundingClientRect().toJSON();return true})()`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mousePressed',...dragPoint,button:'left',buttons:1,clickCount:1})`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseMoved',x:dragPoint.x+80,y:dragPoint.y+32,button:'left',buttons:1})`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseReleased',x:dragPoint.x+80,y:dragPoint.y+32,button:'left',buttons:0,clickCount:1})`},
  {eval:`(()=>{const card=document.querySelector('.tutorial-guide'),r=card.getBoundingClientRect();if(card.dataset.collapsed!=='false'||Math.abs(r.left-dragBefore.left-80)>1||Math.abs(r.top-dragBefore.top-32)>1)throw Error('Tutorial native drag failed or folded the card');card.querySelector('.tutorial-toggle').click();card.querySelector('.tutorial-toggle').click();return true})()`},
  {eval:inspect}, {shot:'desktop-expanded.png'},
  {eval:`document.querySelector('.tutorial-toggle').click(); true`}, {wait:150}, {eval:inspect}, {shot:'desktop-docked.png'},
  {eval:`window.__sandbox.syncEvents(); true`}, {wait:150}, {eval:inspect},
  {eval:`document.querySelector('.tutorial-toggle').click();document.querySelector('.tutorial-toggle').focus();true`},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}}, {wait:150}, {eval:inspect},
  {eval:`(async()=>{window.__sandbox.sim.tutorial.state.stage='outreach';window.__sandbox.syncEvents();const end=Date.now()+5000;while(document.querySelector('.tutorial-guide').dataset.stage!=='outreach'&&Date.now()<end)await new Promise(r=>setTimeout(r,25));if(document.querySelector('.tutorial-guide').dataset.stage!=='outreach')throw Error('Objective refresh timed out');return true})()`}, {wait:150}, {eval:inspect},
  // Team review through the real control: Your portrait opens Your team beside the briefing.
  {eval:`(()=>{const p=document.querySelector('.portrait[data-who="player"]');p.focus();p.click();return true})()`}, {wait:200},
  {eval:`({companion:!document.querySelector('.tutorial-guide').hidden,sheet:!!document.querySelector('.sheet[data-open=true]')})`},
  {cdp:'Input.dispatchKeyEvent',params:{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}}, {wait:300}, {eval:inspect},
  {eval:`({focusReturned:!!document.activeElement?.closest('.portrait[data-who="player"], .tutorial-guide')})`},
  {eval:`document.querySelector('.tutorial-guide[data-collapsed=false] .tutorial-close').click();true`}, {wait:150}, {eval:inspect}];
for (const [width,height] of [[393,852],[320,568],[852,393],[667,375]]) steps.push(
  {cdp:'Emulation.setDeviceMetricsOverride',params:{width,height,deviceScaleFactor:1,mobile:true}},
  {eval:`if(document.querySelector('.tutorial-guide').dataset.collapsed==='true')document.querySelector('.tutorial-toggle').click();true`},
  {wait:200},{eval:inspect},{shot:`expanded-${width}x${height}.png`},
  {eval:`document.querySelector('.tutorial-toggle').click();true`},{wait:150},{eval:inspect},{shot:`docked-${width}x${height}.png`});
steps.push(
  {eval:`(async()=>{if(document.getElementById('services-management').hidden)document.querySelector('.service-module-toggle').click();document.querySelector('.svc-row[data-tutorial-service=outreach] .opt').click();await new Promise(r=>setTimeout(r,150));document.querySelector('.opt.switch[data-service="outreach"]').click();const end=Date.now()+5000;while(document.querySelector('.site-picker').hidden&&Date.now()<end)await new Promise(r=>setTimeout(r,25));const picker=document.querySelector('.site-picker');if(picker.hidden)throw Error('Placement did not open');window.pickerBefore=picker.getBoundingClientRect().toJSON();const h=picker.querySelector('.window-drag-handle').getBoundingClientRect();window.pickerPoint={x:h.left+24,y:h.top+20};return true})()`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mousePressed',...pickerPoint,button:'left',buttons:1,clickCount:1})`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseMoved',x:pickerPoint.x+10,y:pickerPoint.y-15,button:'left',buttons:1})`},
  {cdp:'Input.dispatchMouseEvent',paramsEval:`({type:'mouseReleased',x:pickerPoint.x+10,y:pickerPoint.y-15,button:'left',buttons:0,clickCount:1})`},
  {eval:`(()=>{const picker=document.querySelector('.site-picker'),r=picker.getBoundingClientRect();if(picker.hidden||Math.abs(r.top-pickerBefore.top+15)>1||r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight)throw Error('Placement panel drag or bounds failed');picker.querySelector('[data-placement-action=cancel]').click();if(!picker.hidden||picker.style.getPropertyValue('--window-drag-x'))throw Error('Placement cancellation did not reset');return {placementDrag:true}})()`});
const results = await drive(url, steps, {size:'1440x900',out,diagnostics:true,log:()=>{}});
const views = results.filter(r=>r?.size);
console.log(JSON.stringify(views));
assert(results.some(r=>r?.placementDrag),'Placement panel dragging and cancellation');
assert(views[0].expanded && views[0].dialog && views[0].centered && !views[0].docked,'Initial central prompt');
for(const i of [1,2,3]) assert(!views[i].expanded && views[i].docked,'Fold persists through refresh and Escape');
assert(views[4].expanded && views[4].centered,'New objective auto expands');
assert(results.some(r=>r?.companion && r.sheet),'Team sheet opens beside the tutorial');
assert(results.some(r=>r?.focusReturned),'Focus returns to the opener after team review');
assert(views[5].expanded,'Skills review reveals the next central objective');
assert(!views[6].expanded && views[6].docked,'Closing the briefing returns the card to its dock');
for(const v of views){assert.equal(v.errors.length,0);assert(v.bounded && v.scrollable && v.noGuideActions,JSON.stringify(v));if(v.expanded)assert(v.centered && v.dialog);else assert(v.docked && !v.dialog);}
console.log('Tutorial auto expansion, central/docked hierarchy, Escape, team review through real controls, focus and four mobile viewports: passed');
