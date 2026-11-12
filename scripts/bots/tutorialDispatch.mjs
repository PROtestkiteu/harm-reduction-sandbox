// Native input checks the actual picked camp, rather than converting any map point to it.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5202/';
const out = '/tmp/hrs-tutorial-dispatch'; mkdirSync(out, { recursive: true });
for (const touch of [false, true]) {
  const press = touch ? [
    { cdp: 'Input.dispatchTouchEvent', paramsEval: `({type:'touchStart',touchPoints:[dispatchPoint]})` },
    { wait: 650 },
    { cdp: 'Input.dispatchTouchEvent', params: { type: 'touchEnd', touchPoints: [] } },
  ] : [
    { cdp: 'Input.dispatchMouseEvent', paramsEval: `({type:'mousePressed',...dispatchPoint,button:'right',buttons:2,clickCount:1})` },
    { cdp: 'Input.dispatchMouseEvent', paramsEval: `({type:'mouseReleased',...dispatchPoint,button:'right',buttons:0,clickCount:1})` },
  ];
  // Settle the camera before aiming: a press must land where the pick was measured.
  const point = camp => ({ eval: `(async()=>{const s=window.__sandbox;s.actionMenu.close();document.querySelector('.tutorial-guide[data-collapsed=false] .tutorial-close')?.click();s.rig.step(0,true);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);dispatchPoint=findPoint(${camp});return true})()` });
  const results = await drive(new URL('?scenario=tutorial&packs=none&quality=low', base).href, [
    ...SKIP_WELCOME,
    { eval: `(() => {
      const s=window.__sandbox;
      if(document.querySelector('.time-pause').dataset.paused!=='true')document.querySelector('.time-pause').click();
      s.rig.lookAt(s.rig.focus.clone().set(s.CAMP_AT.x,0,s.CAMP_AT.z));s.rig.step(0,true);
      window.dispatchAudit={};
      window.patrolButtons=()=>[...document.querySelectorAll('.action-menu:not([hidden]) button')].filter(b=>/send.*patrol/i.test(b.textContent));
      window.findPoint=camp=>{
        for(let y=180;y<innerHeight-140;y+=8)for(let x=20;x<innerWidth-20;x+=8){
          // A finger's width clear of every overlay: touch hit-testing snaps near-misses onto nearby windows.
          if([[0,0],[-14,0],[14,0],[0,-14],[0,14]].some(([dx,dy])=>document.elementFromPoint(x+dx,y+dy)!==s.renderer.domElement))continue;
          const picked=s.interaction.pick(x,y,s.camera,s.pipeline.frame,${touch});
          const isCamp=picked?.kind==='building'&&picked.id===s.world.camps.park;
          if(camp?isCamp:!picked)return {x,y};
        }
        throw Error('No visible '+(camp?'camp':'empty ground')+' input point');
      };return true;
    })()` },
    { wait: 500 }, point(false), ...press,
    { eval: `dispatchAudit.initialGround=patrolButtons().length;true` },
    point(true), ...press,
    { eval: `dispatchAudit.locked=patrolButtons().length===1&&patrolButtons()[0].disabled;
      window.__sandbox.actionMenu.close();true` },
    // Reach a ready patrol through the real lesson: select the camp, open Foot patrol, place its stand, wait for the crew.
    { eval: `(async()=>{const s=window.__sandbox;let scene=0;
      s.interaction.select({kind:'building',id:s.world.camps.park});s.syncEvents();await new Promise(requestAnimationFrame);
      if(document.getElementById('services-management').hidden)document.querySelector('.service-module-toggle').click();
      document.querySelector('.svc-row[data-tutorial-service=footPatrol] .opt').click();
      document.querySelector('.opt.switch[data-service=footPatrol]').click();await new Promise(r=>setTimeout(r,350));
      document.querySelector('[data-placement-action=next]').click();document.querySelector('[data-placement-action=open]').click();
      await new Promise(r=>setTimeout(r,350));document.querySelector('.tutorial-guide .tutorial-close:not([hidden])')?.click();
      for(let i=0;i<18000&&!s.sim.patrolReady;i++){s.sim.tick(1/30);const pace=s.sim.pace,n=Math.max(1,Math.ceil(pace));for(let k=0;k<n;k++)s.crowd.update(pace/30/n);s.world.update(1/30,scene);scene+=1/30;if(i%900===0)await new Promise(requestAnimationFrame);}
      if(!s.sim.patrolReady)throw Error('Crew did not reach the patrol stand');
      if(document.querySelector('.time-pause').dataset.paused!=='true')document.querySelector('.time-pause').click();
      s.interaction.select(null);s.syncEvents();s.rig.lookAt(s.rig.focus.clone().set(s.CAMP_AT.x,0,s.CAMP_AT.z));s.rig.step(0,true);await new Promise(requestAnimationFrame);return true})()` },
    { wait: 500 }, point(false), ...press,
    { eval: `dispatchAudit.unlockedGround=patrolButtons().length; window.__sandbox.actionMenu.close();
      dispatchAudit.funds=window.__sandbox.sim.org.budget;window.__sandbox.sim.org.budget=14;true` },
    point(true), ...press,
    { eval: `dispatchAudit.poorDisabled=patrolButtons().length===1&&patrolButtons()[0].disabled;
      dispatchAudit.poorReason=patrolButtons()[0]?.textContent;
      window.__sandbox.sim.org.budget=dispatchAudit.funds;true` },
    point(true), ...press,
    { eval: `dispatchAudit.count=patrolButtons().length;dispatchAudit.label=patrolButtons()[0]?.textContent;
      dispatchAudit.before=window.__sandbox.sim.org.budget;patrolButtons()[0].click();true` },
    { wait: 500 }, point(true), ...press,
    { eval: `const s=window.__sandbox;
      Object.assign(dispatchAudit,{selected:s.interaction.selected,campId:s.world.camps.park,sent:s.sim.patrol.spot,
        atCamp:s.sim.patrol.at?.x===s.CAMP_AT.x&&s.sim.patrol.at?.z===s.CAMP_AT.z,
        cost:dispatchAudit.before-s.sim.org.budget,repeatCount:patrolButtons().length,
        repeatDisabled:patrolButtons()[0]?.disabled,reason:patrolButtons()[0]?.textContent});true` },
    { shot: touch ? 'touch-camp-menu.png' : 'mouse-camp-menu.png' },
    point(false), ...press,
    { eval: `dispatchAudit.outGround=patrolButtons().length;dispatchAudit.errors=window.__qaErrors;
      dispatchAudit.overflow=document.documentElement.scrollWidth>innerWidth;dispatchAudit` },
    { shot: touch ? 'touch-ground-menu.png' : 'mouse-ground-menu.png' },
  ], { size: touch ? '393x852' : '1280x800', touch, diagnostics: true, seed: 777,
    colorScheme: touch ? 'light' : 'dark', reducedMotion: touch, out, log: () => {} });
  const r=results.at(-1);console.log(JSON.stringify({touch,...r}));
  assert.equal(r.initialGround,0);assert.equal(r.unlockedGround,0);assert.equal(r.outGround,0);
  assert(r.locked&&r.poorDisabled&&r.poorReason.includes('not enough money'));
  assert.equal(r.count,1);assert.equal(r.repeatCount,1);assert(r.repeatDisabled&&r.reason.includes('already out'));
  assert.equal(r.selected.kind,'building');assert.equal(r.selected.id,r.campId);
  assert.equal(r.sent,'camp');assert(r.atCamp);assert.equal(r.cost,15);
  assert.deepEqual(r.errors,[]);assert(!r.overflow);
}
console.log('Camp-only contextual patrol, no global tutorial replies, native mouse/touch and single-charge guards passed');
