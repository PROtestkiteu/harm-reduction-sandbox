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
  const point = camp => ({ eval: `window.__sandbox.actionMenu.close(); dispatchPoint=findPoint(${camp}); true` });
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
          if(document.elementFromPoint(x,y)!==s.renderer.domElement)continue;
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
      window.__sandbox.actionMenu.close();document.querySelector('.tutorial-reply button').click();true` },
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
