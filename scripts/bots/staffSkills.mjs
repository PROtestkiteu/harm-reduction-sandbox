// Inspector-to-team integration with real visitor data and responsive staff cards.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const args = process.argv.slice(2);
const option = (key, fallback) => { const index = args.indexOf(`--${key}`); return index < 0 ? fallback : args[index + 1]; };
const base = option('url', 'http://localhost:5199/');
const out = option('out', '/tmp/hrs-qa');
mkdirSync(out, { recursive: true });
const setup = `(async () => {
  const s = window.__sandbox;
  const TutorialProgress = s.sim.tutorial.constructor;
  s.sim.tutorial = TutorialProgress.restore({ ...s.sim.tutorial.snapshot(), stage: 'outreach', reviewedSkills: true });
  s.sim.tick(.1); s.sim.setEnabled('outreach', true);
  s.sim.staffArrived('outreach');
  let person;
  for (let i=0; i<18000 && !person; i++) {
    s.sim.tick(1/30);
    const pace=s.sim.pace, parts=Math.max(1,Math.ceil(pace));
    for(let p=0;p<parts;p++)s.crowd.update(pace/30/parts);
    if(i%300===0){s.syncEvents();await new Promise(requestAnimationFrame)}
    s.crowd.forEachVisible(p=>{if(!person && p.role==='visitor' && p.support && p.substance!=='none')person=p});
  }
  if(!person)throw Error('No inspectable visitor arrived');
  s.interaction.select({kind:'person',id:person.id});
  s.syncEvents();await new Promise(r=>setTimeout(r,400));
  const panel=document.querySelector('.person-support');
  const result={substance:person.support.substance, needs:person.support.needs, skills:person.support.skills, text:panel.textContent, visible:!panel.hidden, referenceCollapsed:!document.querySelector('.profile-reference')?.open, overflow:document.documentElement.scrollWidth>innerWidth};
  document.querySelector('.person-team').click();
  await new Promise(r=>setTimeout(r,350));
  return {...result,teamOpen:document.querySelector('#org-section').closest('.sheet').dataset.open==='true',guideHidden:document.querySelector('.tutorial-guide').hidden,context:document.querySelector('.employee-context').textContent,contextVisible:!!document.querySelector('.employee-context').getClientRects().length,rows:document.querySelectorAll('.org-team .employee-skills').length,stats:document.querySelectorAll('.org-team .employee-skill dd').length,matches:[...document.querySelectorAll('.team-strength')].map(e=>e.textContent),errors:window.__qaErrors};
})()`;
const layouts = [['320x568', 'pl'], ['1280x800', 'en']].filter(([size]) => option('size', size) === size);
for(const [size, language] of layouts) {
 const url=new URL(base);url.searchParams.set('scenario','tutorial');url.searchParams.set('packs','none');url.searchParams.set('lang',language);
 const results=await drive(url.href,[...SKIP_WELCOME,{eval:setup},{shot:`staff-skills-${size}.png`},{eval:`(async()=>{
 const layout={arrowPosition:getComputedStyle(document.querySelector('.employee-assignment'),'::after').position,overflow:document.documentElement.scrollWidth>innerWidth,labels:[...document.querySelectorAll('.team-assign')].every(e=>e.getAttribute('aria-label')),errors:window.__qaErrors};
 document.querySelector('#org-section').closest('.sheet').querySelector('.close').click();
 const s=window.__sandbox;let staff;s.crowd.forEachVisible(p=>{if(!staff&&p.worker)staff=p});
 if(!staff)throw Error('No named staff avatar to inspect');
 s.interaction.select({kind:'person',id:staff.id});await new Promise(r=>setTimeout(r,350));
 const root=document.querySelector('.person-support');
 return {...layout,workerName:staff.worker.name,shownName:document.querySelector('.speaker').textContent,workerSkills:root.querySelectorAll('.employee-skill dd').length,workerVisible:!root.hidden};
})()`}],{size,seed:777,diagnostics:true,out,log:()=>{}});
 console.log(size,JSON.stringify(results));
 const profile=results.at(-2), layout=results.at(-1);
 assert(profile.visible);assert(profile.referenceCollapsed);assert(!profile.overflow);assert(profile.teamOpen);assert(profile.guideHidden);assert(profile.contextVisible);assert(profile.rows>0);assert.equal(profile.stats,profile.rows*4);assert(profile.matches.every(text=>text.includes('%')));assert(!layout.overflow);assert(layout.labels);assert.equal(layout.arrowPosition,'absolute');assert(layout.workerVisible);assert.equal(layout.workerSkills,4);assert.equal(layout.shownName,layout.workerName);assert.deepEqual(layout.errors,[]);
}
console.log('NPC support inspector, contextual staff comparison and responsive cards: passed');
