// Browser integration: a real patrol and real visitor routes advance the authored map and UI.
import assert from 'node:assert/strict';
import { drive, SKIP_WELCOME } from './chrome.mjs';
const args = process.argv.slice(2);
const index = args.indexOf('--url');
const url = new URL(index < 0 ? 'http://localhost:5199/' : args[index + 1]);
url.searchParams.set('scenario', 'tutorial');
url.searchParams.set('packs', 'none');
const results = await drive(url.href, [...SKIP_WELCOME, { eval: `(async () => {
  const s = window.__sandbox;
  const module = performance.getEntriesByType('resource').find(r => new URL(r.name).pathname === '/src/world/eventFx.ts');
  const { CAMP_AT } = s.CAMP_AT ? { CAMP_AT: s.CAMP_AT } : await import(module.name);
  const stages = [];
  let sceneTime = 0;
  const arrivals = { club: 0, stand: 0 };
  s.sim.on(e => { if(e.type === 'spawnVisitor' && e.intent === 'club') { arrivals.club++; if(e.wantsStand) arrivals.stand++; } });
  const advance = async (target, seconds = 800) => {
    for (let i = 0; i < seconds * 30 && s.sim.tutorial.stage !== target; i++) {
      s.sim.tick(1 / 30);
      const pace = s.sim.pace, parts = Math.max(1, Math.ceil(pace));
      for (let p = 0; p < parts; p++) s.crowd.update(pace / 30 / parts);
      s.world.update(1 / 30, sceneTime); sceneTime += 1 / 30;
      if (i % 900 === 0) {
        if (s.sim.tutorial.stage !== 'complete') document.querySelector('.night-report[open] .welcome-start')?.click();
        await new Promise(requestAnimationFrame);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 350));
    const card = document.querySelector('.tutorial-guide');
    if (target !== 'complete' && document.querySelector('.event-popup[open]:not(.night-report)')) throw Error('Ordinary event interrupted active tutorial at '+target+': '+document.querySelector('.event-popup[open]').innerText);
    if (card.dataset.stage !== target) throw Error('Objective not synchronized without test refresh: '+target);
    // Manual simulation ticks can leave the real report queued behind the completed guide's pause.
    // Publish that queued event only after verifying objective synchronization without a test refresh.
    if (target === 'complete') s.syncEvents();
    const nextService = target === 'outreach' ? 'outreach' : target === 'dropIn' ? 'dropIn' : target === 'nightlife' ? 'clubHr' : null;
    if (nextService) {
      const row = document.querySelector('#services-management [data-tutorial-service="'+nextService+'"]');
      if (row.dataset.tutorialLocked !== 'false' || row.querySelector('button').disabled) throw Error('New objective still locks its service: '+nextService);
    }
    if (card.querySelector('.tutorial-feedback')) throw new Error('Previous mission checkmark remains');
    if (target !== 'complete' && [...card.querySelectorAll('.tutorial-action')].some(b => b.dataset.tutorialNavigation !== 'true')) throw new Error('Tutorial replaced a regular control');
    if (card.querySelector('.tutorial-instruction').textContent.length > 110) throw new Error('Tutorial prompt is too long');
    stages.push(s.sim.tutorial.stage);
    if (s.sim.tutorial.stage !== target) throw new Error(JSON.stringify({ target, stage: s.sim.tutorial.stage, clock: s.sim.clockMinutes, arrivals, timers: s.sim.timers, crew:s.sim.team.members.map(m=>({at:m.workingAt, assignment:m.assignment})), visits: s.sim.tutorial.visits, operational: s.sim.tutorial.nightServices, services: Object.fromEntries(['outreach','dropIn','clubHr'].map(id => [id, {status:s.sim.services[id].status, assigned:s.sim.services[id].assigned, on:s.sim.services[id].switchedOn, staff:s.sim.services[id].staffOnSite}])) }));
  };
  const briefings = [];
  const closeBriefing = () => {
    const card = document.querySelector('.tutorial-guide');
    if (card.dataset.collapsed !== 'false') return;
    if (!card.querySelector('.tutorial-context').textContent || !card.dataset.chapter) throw Error('Task has no explanation');
    if (document.querySelector('.tutorial-ui-target') || !document.querySelector('.tutorial-pointer').hidden) throw Error('Clues preceded briefing acknowledgement');
    briefings.push(card.dataset.stage+':'+card.dataset.chapter);
    card.querySelector('.tutorial-close').click();
  };
  const auditControl = async (selector) => {
    closeBriefing();
    const before=JSON.stringify(s.sim.tutorial.snapshot());
    s.syncEvents();
    const guide=document.querySelector('.tutorial-guide'), target=document.querySelector(selector);
    if(guide.querySelector('.tutorial-action'))throw Error('Active tutorial still has a navigation button');
    if(!target||target.disabled||!target.getClientRects().length||!target.classList.contains('tutorial-ui-target'))throw Error('Missing automatic cue '+selector+' at '+s.sim.tutorial.stage+': '+document.querySelector('.tutorial-ui-target')?.outerHTML);
    const rect=target.getBoundingClientRect();if(rect.left<0||rect.right>innerWidth+1||rect.top<0||rect.bottom>innerHeight+1)throw Error('Tutorial control outside viewport '+selector);
    if(JSON.stringify(s.sim.tutorial.snapshot())!==before)throw Error('Guidance completed a gameplay task');
  };
  const chapters = [];
  const auditPopup = id => {
    const card = document.querySelector('.tutorial-guide');
    if (card.dataset.chapter !== id || card.dataset.collapsed !== 'false' || card.hidden || card.getAttribute('role') !== 'dialog') throw Error('Missing tutorial chapter popup: '+id);
    const context = card.querySelector('.tutorial-context');
    if (!context || context.hidden || !context.textContent || context.textContent.length > 110) throw Error('Missing concise chapter context: '+id);
    if (document.querySelector('.time-pause').dataset.paused !== 'true') throw Error('Reading chapter did not freeze time: '+id);
    chapters.push(s.sim.tutorial.stage+':'+id);
    closeBriefing();
  };
  const first = { stage: s.sim.tutorial.stage, locked: !s.sim.tutorialAllowsService('dropIn') };
  const prompt = document.querySelector('.tutorial-guide');
  first.autoExpanded = prompt.dataset.collapsed === 'false' && prompt.parentElement.id === 'hud';
  const promptRect = prompt.getBoundingClientRect(), hudRect = document.getElementById('hud').getBoundingClientRect();
  first.centered = Math.abs((promptRect.left + promptRect.right - hudRect.left - hudRect.right) / 2) < 1 && Math.abs((promptRect.top + promptRect.bottom - hudRect.top - hudRect.bottom) / 2) < 1;
  prompt.querySelector('.tutorial-toggle').click();
  first.docked = !!prompt.closest('.tutorial-dock');
  if (prompt.dataset.briefing !== 'minimized' || document.querySelector('.tutorial-ui-target')) throw Error('Minimize acknowledged unread briefing');
  prompt.querySelector('.tutorial-toggle').click();
  closeBriefing();
  s.rig.step(0, true);
  if (!first.autoExpanded || !first.centered || !first.docked) throw new Error('Tutorial presentation: ' + JSON.stringify(first));
  const home = s.rig.focus.clone();
  s.rig.pan(80, -80, true);
  s.rig.step(0, true);
  await new Promise(resolve => setTimeout(resolve, 350));
  first.cameraFreedom = Math.abs(s.rig.focus.x - home.x - 80) < .1 && Math.abs(s.rig.focus.z - home.z + 80) < .1;
  const projected = s.rig.focus.clone().project(s.camera);
  const x = (projected.x + 1) * innerWidth / 2, y = (1 - projected.y) * innerHeight / 2;
  first.cameraClear = [...document.querySelectorAll('.hud-header,.top-bar,.column,.tutorial-guide:not([hidden])')].every(panel => {
    const rect = panel.getBoundingClientRect();
    return !(rect.width && rect.height && x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);
  });
  s.rig.lookAt(home, 1); s.rig.step(0, true);
  s.interaction.select({ kind: 'building', id: s.world.camps.park });
  await auditControl('.service-module-toggle');
  if(document.getElementById('services-management').hidden)document.querySelector('.service-module-toggle').click();
  await auditControl('.svc-row[data-tutorial-service=footPatrol] .opt');document.querySelector('.svc-row[data-tutorial-service=footPatrol] .opt').click();
  await auditControl('.opt.switch[data-service=footPatrol]');document.querySelector('.opt.switch[data-service=footPatrol]').click();
  await new Promise(resolve=>setTimeout(resolve,350));auditPopup('placement');
  document.querySelector('[data-placement-action=next]').click();document.querySelector('[data-placement-action=open]').click();
  await new Promise(resolve=>setTimeout(resolve,350));closeBriefing();
  for(let i=0;i<18000&&!s.sim.patrolReady;i++){
    s.sim.tick(1/30);const pace=s.sim.pace,n=Math.max(1,Math.ceil(pace));for(let p=0;p<n;p++)s.crowd.update(pace/30/n);s.world.update(1/30,sceneTime);sceneTime+=1/30;if(i%900===0)await new Promise(requestAnimationFrame);
  }
  if(!s.sim.patrolReady)throw Error('Crew did not arrive at chosen patrol stand');
  s.syncEvents();

  s.interaction.select({kind:'building',id:s.world.camps.park});s.syncEvents();
  await auditControl('[data-building-action=patrolCamp]');
  const dispatch=document.querySelector('[data-building-action=patrolCamp]');
  if(!dispatch||dispatch.disabled||!dispatch.getClientRects().length)throw Error('Camp panel dispatch unavailable');
  dispatch.click();await new Promise(resolve=>setTimeout(resolve,350));
  const sent=s.sim.patrol.out;
  auditPopup('patrol-return');
  await auditControl('.speed-toggle');
  await advance('outreach');
  const patrol = { contacts: s.sim.tutorial.patrolContacts, returned: !s.sim.patrol.out };
  await auditControl('[aria-label="Close details (Escape)"]');
  document.querySelector('[aria-label="Close details (Escape)"]').click();
  await auditControl('.portrait[data-who=player]');
  if(s.sim.tutorial.reviewedSkills||document.querySelector('.sheet[data-open=true]'))throw Error('Automatic cue completed team review');
  document.querySelector('.portrait[data-who=player]').focus();
  document.querySelector('.portrait[data-who=player]').click();
  await new Promise(resolve => setTimeout(resolve, 350));
  const skills = { reviewed: s.sim.tutorial.reviewedSkills, rows: document.querySelectorAll('.org-team .skill-strip').length, values: document.querySelectorAll('.org-team .skill-strip .indicator-value').length, teamOnly: document.getElementById('org-section').classList.contains('org-team-mode'), lockedOptions: [...document.querySelectorAll('.team-assign option[value="clinic"]')].every(o=>o.disabled && o.hidden), overflow: document.documentElement.scrollWidth > innerWidth };
  const portraits = [...document.querySelectorAll('.team-portrait')];
  await Promise.all(portraits.map(image => image.decode().catch(() => {})));
  skills.portraits = portraits.filter(image => image.naturalWidth > 0).length;
  const before = [...document.querySelectorAll('.team-member')].map(row => row.getBoundingClientRect().height);
  portraits.forEach(image => image.hidden = true);
  skills.sameHeight = [...document.querySelectorAll('.team-member')].every((row, i) => row.getBoundingClientRect().height === before[i]);
  portraits.forEach(image => image.hidden = false);
  const team = document.querySelector('.org-team');
  team.querySelector(':scope > summary').click();
  await new Promise(resolve => setTimeout(resolve, 50));
  skills.foldKeepsSheet = !team.open && !team.closest('.sandbox-body').hidden;
  team.querySelector(':scope > summary').click();
  skills.reviewConfirmed = s.sim.tutorial.reviewedSkills && !document.querySelector('.tutorial-review-status') && !document.querySelector('.tutorial-guide').hidden;
  skills.noGuideActions = !document.querySelector('.tutorial-action');
  const close = document.querySelector('.sheet[data-open=true] .panel-dismiss');
  skills.oneClose = document.querySelectorAll('.sheet[data-open=true] .panel-dismiss').length === 1;
  close.click();
  skills.closedDirectly = !document.querySelector('.sheet[data-open="true"]');
  skills.focusReturned = !!document.activeElement?.matches('.portrait[data-who=player]') && document.activeElement.isConnected;
  await new Promise(resolve => setTimeout(resolve, 350));
  auditPopup('service-outreach');
  if(document.getElementById('services-management').hidden){await auditControl('.service-module-toggle');document.querySelector('.service-module-toggle').click();}
  await new Promise(requestAnimationFrame);
  await auditControl('.svc-row[data-tutorial-service='+ (s.sim.tutorial.stage==='outreach'?'outreach':s.sim.tutorial.stage==='dropIn'?'dropIn':'clubHr')+'] .opt');
  document.querySelector('.svc-row[data-tutorial-service=outreach] .opt').click();
  await new Promise(resolve=>setTimeout(resolve,350));
  await auditControl('.opt.switch[data-service=outreach]');
  document.querySelector('.opt.switch[data-service="outreach"]').click();
  await new Promise(resolve => setTimeout(resolve, 350));
  auditPopup('placement');
  await auditControl('[data-placement-action=next]');
  document.querySelector('.site-picker:not([hidden]) [data-placement-action=previous]')?.click();
  await auditControl('[data-placement-action=open]');
  document.querySelector('.site-picker:not([hidden]) [data-placement-action=open]')?.click();
  await new Promise(resolve => setTimeout(resolve, 350));
  auditPopup('operating');
  skills.outreachEnabled = s.sim.services.outreach.switchedOn;
  await auditControl('.speed-toggle');
  await advance('dropIn');
  const ui = { stage: document.querySelector('.tutorial-guide').dataset.stage, budget: document.getElementById('hud').dataset.tutorialBudget, maintenance: document.getElementById('hud').dataset.tutorialMaintenance, organisation: document.getElementById('hud').dataset.tutorialOrganisation };
  const later = [];
  for (const [service, target] of [['dropIn', 'nightlife'], ['clubHr', 'night']]) {
    auditPopup('service-' + service);
      await new Promise(resolve => setTimeout(resolve, 350));
    if(document.getElementById('services-management').hidden){await auditControl('.service-module-toggle');document.querySelector('.service-module-toggle').click();}
  await new Promise(requestAnimationFrame);
  await auditControl('.svc-row[data-tutorial-service='+ (s.sim.tutorial.stage==='outreach'?'outreach':s.sim.tutorial.stage==='dropIn'?'dropIn':'clubHr')+'] .opt');
    document.querySelector('.svc-row[data-tutorial-service="'+service+'"] .opt').click();
    await new Promise(resolve=>setTimeout(resolve,350));
    await auditControl('.opt.switch[data-service="'+service+'"]');
    document.querySelector('.opt.switch[data-service="' + service + '"]').click();
    await new Promise(resolve => setTimeout(resolve, 350));
    auditPopup('placement');
    await auditControl('[data-placement-action=next]');
    document.querySelector('.site-picker:not([hidden]) [data-placement-action=next]')?.click();
    await auditControl('[data-placement-action=open]');
    document.querySelector('.site-picker:not([hidden]) [data-placement-action=open]')?.click();
    await new Promise(resolve => setTimeout(resolve, 350));
    auditPopup('operating');
    if(!s.sim.services[service].switchedOn) throw new Error('UI did not enable ' + service);
    await auditControl('.speed-toggle');
    await advance(target, 7200);
    later.push({ service, enabled: s.sim.services[service].switchedOn, visits: s.sim.tutorial.visits[service], stage: s.sim.tutorial.stage });
  }
  // Keep a prepared, physically staffed network through the report rather than relying on a changing automatic rota.
  const nightCrew = ['outreach','dropIn','clubHr'].map(site => {
    const member = s.sim.team.members.find(member => member.workingAt === site);
    if (!member) throw new Error('No worker assigned to ' + site);
    return {id:member.id,site};
  });
  for (const member of nightCrew) s.sim.assignMember(member.id,member.site);
  // Read and fold the coordinated-night objective before letting the clock run to morning.
  if (document.querySelector('.tutorial-toggle').getAttribute('aria-expanded') === 'true') closeBriefing();
  await auditControl('.speed-toggle');
  await advance('complete', 3600);
  const completion = { stage: s.sim.tutorial.stage, uiStage: document.querySelector('.tutorial-guide').dataset.stage, fullUi: s.sim.tutorialCapabilities.fullUi, report: !!document.querySelector('.night-report[open]'), errors: window.__qaErrors };
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  await new Promise(resolve => setTimeout(resolve, 350));
  const finalCard = document.querySelector('.tutorial-guide');
  finalCard.querySelector('.tutorial-close').click();
  if(finalCard.dataset.collapsed !== 'true' || finalCard.hidden)throw Error('Completion X did not close briefing while retaining mission');
  finalCard.querySelector('.tutorial-toggle').click();
  const continueButton = document.querySelector('.tutorial-reply button');
  if (!continueButton) throw new Error(JSON.stringify({completion, guide:document.querySelector('.tutorial-guide').outerHTML, column:document.querySelector('.column').innerText, dialogs:document.querySelectorAll('dialog[open]').length}));
  continueButton.click();
  await new Promise(resolve => setTimeout(resolve, 350));
  completion.dismissed = document.querySelector('.tutorial-guide').hidden;
  for (let pending = 0; pending < 3 && document.querySelector('.night-report[open]'); pending++) {
    document.querySelector('.night-report[open] .welcome-start').click();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  }
  return { briefings, chapters, first, sent, stages, patrol, skills, ui, later, completion, popups: document.querySelectorAll('.event-popup[open]').length, visits: s.sim.tutorial.visits.outreach };
})()` }], { seed: Number(process.env.SEED ?? 777), diagnostics: true, colorScheme: 'dark', size: process.env.TUTORIAL_SIZE ?? '1440x900', log: () => {} });
const result = results.at(-1);
console.log(JSON.stringify(result));
assert(result.first.cameraFreedom); assert(result.first.cameraClear);
assert.equal(result.first.stage, 'meet'); assert(result.first.locked); assert(result.sent);
assert.deepEqual(result.stages, ['outreach', 'dropIn', 'nightlife', 'night', 'complete']); assert(result.patrol.contacts >= 3); assert(result.patrol.returned);
assert.equal(result.skills.portraits, result.skills.rows); assert(result.skills.sameHeight); assert(result.skills.foldKeepsSheet);
assert(result.skills.outreachEnabled); assert(result.skills.reviewConfirmed); assert(result.skills.noGuideActions); assert(result.skills.oneClose); assert(result.skills.closedDirectly);
assert(result.skills.reviewed); assert(result.skills.focusReturned); assert(result.skills.rows > 0); assert.equal(result.skills.values, result.skills.rows * 4); assert(result.skills.teamOnly); assert(result.skills.lockedOptions); assert(!result.skills.overflow);
assert(result.visits >= 5); assert.equal(result.ui.stage, 'dropIn'); assert.equal(result.ui.budget, 'true');
assert.equal(result.ui.maintenance, 'true'); assert.equal(result.ui.organisation, 'false');
assert.equal(result.popups, 0);
assert.deepEqual(result.later.map(row => row.stage), ['nightlife', 'night']);
assert(result.later.every(row => row.enabled && row.visits >= 5));
assert.equal(result.completion.stage, 'complete'); assert.equal(result.completion.uiStage, 'complete');
assert(result.completion.fullUi && result.completion.report && result.completion.dismissed);
assert.deepEqual(result.completion.errors, []);
console.log('Complete tutorial browser journey, real visitor routes, milestone UI, morning report and continue: passed');
