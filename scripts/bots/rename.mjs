// Verify the public editor alongside the heading's fold action.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const check = `(async()=>{const b=document.querySelector('.selection-rename');
  if(!b?.getClientRects().length)throw Error('Missing rename');
  b.click();
  await new Promise(r=>setTimeout(r,50));
  const i=document.querySelector('input.rename');
  if(document.activeElement!==i)throw Error('Missing focus');
  i.value='Test name';
  i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  if(document.querySelector('.selection-heading').textContent!=='Test name')throw Error('Save failed');
  b.click();
  await new Promise(r=>setTimeout(r,50));
  const j=document.querySelector('input.rename');
  j.value='Cancelled';
  j.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  if(document.querySelector('.selection-heading').textContent!=='Test name')throw Error('Cancel failed');
  b.click();
  await new Promise(r=>setTimeout(r,50));
  const k=document.querySelector('input.rename');
  if(document.activeElement!==k)throw Error('Third editor not focused: '+JSON.stringify({rect:k.getBoundingClientRect().toJSON(),hidden:k.hidden,connected:k.isConnected,active:document.activeElement?.tagName,html:k.parentElement?.outerHTML.slice(0,1000)}));
  k.value='Blur saved';
  k.blur();
  await new Promise(r=>setTimeout(r,50));
  if(document.querySelector('.selection-heading').textContent!=='Blur saved')throw Error('Blur failed');
  return true})()`;
mkdirSync('/tmp/hrs-rename-qa', { recursive: true });
const results=await drive(process.argv[2]??'http://127.0.0.1:5217/?packs=none&quality=low',[
...SKIP_WELCOME,
{cdp:'Emulation.setFocusEmulationEnabled',params:{enabled:true}},
{eval:`window.__sandbox.interaction.selectLocation('outreach');true`},{wait:200},{eval:check},{shot:'desktop.png'},
{eval:`(()=>{const s=window.__sandbox;let person;s.crowd.forEachVisible(p=>{person??=p;});if(!person)throw Error('No character');s.interaction.select({kind:'person',id:person.id});return true})()`},{wait:200},{eval:check},
{cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},{wait:300},
{eval:`(()=>{const b=document.querySelector('.selection-rename'),r=b.getBoundingClientRect();if(r.width<44||r.height<44||r.right>innerWidth)throw Error('Touch bounds');document.querySelector('.selection-heading').click();if(b.getClientRects().length)throw Error('Fold failed');document.querySelector('.selection-heading').click();return true})()`},{eval:check},{shot:'mobile.png'},
{eval:`(()=>{const r=document.querySelector('.selection-rename').getBoundingClientRect();window.renamePoint={x:r.left+r.width/2,y:r.top+r.height/2};return true})()`},
{cdp:'Input.dispatchTouchEvent',paramsEval:`({type:'touchStart',touchPoints:[window.renamePoint]})`},
{cdp:'Input.dispatchTouchEvent',params:{type:'touchEnd',touchPoints:[]}},{wait:100},
{eval:`(()=>{const i=document.querySelector('input.rename');if(document.activeElement!==i)throw Error('Native touch editor failed');i.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(window.__qaErrors.length)throw Error(window.__qaErrors.join(';'));return true})()`}
],{out:'/tmp/hrs-rename-qa',diagnostics:true,touch:true,log:()=>{}});
assert(results.every(Boolean));console.log('Venue and character rename: Enter, blur, Escape, focus, mobile 44px target and folding passed');
