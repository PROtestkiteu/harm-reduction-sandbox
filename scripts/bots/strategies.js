// Page-side: runs one strategy bot on the real simulation in the dev page
// (window.__sandbox exists only under `vite` dev). Called as
// (thisFile)(name, days, opts). Ticks sim and crowd at the game's own fixed step,
// acts every 30 game minutes, logs the key numbers every game hour.
// Strategies (from the game-mechanics-audit procedure):
//   idle      does nothing
//   hoarder   switches every service off and only brings money in (grants, drives)
//   spammer   the cheap repeatables as often as allowed: city hall favours and drives
//   sensible  what the welcome box suggests: services as they start, grants and drives
//   greedy    every lever: all services on, grants, hiring, volunteers, invest in the busiest
//   naive     a first-time player who keeps the team growing but never prepares: grants, drives,
//             volunteers and hires as money allows; no rest, no stock bought ahead, no storm prep
//   prepared  naive, plus what the game teaches: tired or shaken people rest, supplies bought
//             ahead, and once a storm is announced every preparation, a full shelf and a rested team
// opts.clockSpeed sets the game clock's speed (1 = default) for speed-dependence checks.
async (name, days = 3, opts = {}) => {
  const { sim, crowd, world } = window.__sandbox;
  const { visitScore } = await import('/src/sim/recipientCare.ts');
  const careMetrics = { ratings: { none: 0, bronze: 0, silver: 0, gold: 0 }, finished: 0, scoreSum: 0, durationSum: 0, queuePeak: 0, activePeak: 0, urgentUnrated: 0, byStateCount: {}, nights: [] };
  const born = new Map();
  const care = sim.recipientCare;
  const ensure = care.ensure.bind(care), finish = care.finish.bind(care);
  care.ensure = (...args) => { const v = ensure(...args); if (!born.has(v.visitor)) born.set(v.visitor, sim.org.now); return v; };
  care.finish = (visitor) => {
    const v = care.visits.get(visitor), score = v ? visitScore(v) : 0;
    const rating = finish(visitor);
    if (rating && v) {
      careMetrics.ratings[rating]++; careMetrics.finished++; careMetrics.scoreSum += score;
      careMetrics.durationSum += sim.org.now - (born.get(visitor) ?? sim.org.now); born.delete(visitor);
      if (rating === 'none' && v.escalated) careMetrics.urgentUnrated++;
      const bucket = careMetrics.byStateCount[v.states.length] ??= { n: 0, score: 0 }; bucket.n++; bucket.score += score;
    }
    return rating;
  };
  let sceneTime = 0;
  const STEP = 1 / 30;
  if (opts.clockSpeed) sim.configure({ clockSpeed: opts.clockSpeed });
  const ids = Object.keys(sim.services);
  const grants = Object.keys(sim.org.applications);
  const acts = {};
  const did = (k, ok) => { if (ok !== false) acts[k] = (acts[k] ?? 0) + 1; };
  const grant = (above) => { for (const g of grants) if (sim.org.applications[g].status === 'idle' && sim.org.budget > above) did('grant', sim.applyFor(g)); };
  const st = sim.stakes;
  // The bots enable scenario-style project failure while measuring balance.
  st.hardcore = true;
  // `careful`: hire only when the hour's surplus already covers the new wage, and never while a storm is coming.
  const grow = (careful = false) => {
    // Everyone applies for every grant they can afford: it is the main way money comes in.
    grant(200);
    did('drive', sim.startDonationDrive());
    const want = Object.values(sim.services).reduce((n, x) => n + (x.closedReason === null || x.closedReason === 'noStaff' ? x.requested : 0), 0);
    const have = sim.org.paid + sim.org.volunteers;
    if (have < want && sim.org.budget > 150 && sim.org.recruiting.length === 0) did('volunteers', sim.recruit('volunteerDrive'));
    const canHire = careful ? sim.org.budget > 1200 && sim.org.netPerHour > 45 && st.storm.phase === 'none' : sim.org.budget > 900 && sim.org.netPerHour > 0;
    if (canHire && sim.org.paid < 3 && sim.org.recruiting.length === 0) did('hire', sim.recruit('hirePaid'));
  };
  const strategy = {
    naive() { grow(); },
    prepared() {
      grow(true);
      const storm = st.storm.phase;
      // Rest whoever is worn or shaken, and bring them back once they are fit again; before a
      // storm, rest the most tired half so the night starts fresh.
      const resting = sim.team.members.filter((m) => m.assignment === 'rest');
      for (const m of resting) if (m.energy > 0.85 && m.morale > 0.5) sim.assignMember(m.id, 'auto');
      const working = sim.team.members.filter((m) => m.assignment === 'auto' && m.workingAt);
      const cap = Math.max(0, Math.floor(sim.team.members.length / 3) - resting.length);
      const tired = working.filter((m) => m.morale < 0.3 || (storm === 'warned' && m.energy < 0.6)).sort((a, b) => a.morale - b.morale).slice(0, cap);
      for (const m of tired) did('rest', sim.assignMember(m.id, 'rest'));
      if (storm === 'peak') for (const m of resting) sim.assignMember(m.id, 'auto');
      // Spare money goes into capacity, as a good player in a well-funded city would: one more
      // service at a time (with volunteers to staff it), then growing the busiest place.
      if (storm === 'none' && sim.org.budget > 1500) {
        const closed = ids.find((i) => !sim.services[i].switchedOn && !sim.org.closedDown.has(i));
        if (closed) { sim.setEnabled(closed, true); did('open', true); if (sim.org.recruiting.length === 0) did('volunteers', sim.recruit('volunteerDrive')); }
        else if (sim.org.budget > 1200) did('invest', sim.invest(sim.busiest.service));
      }
      // Keep the shelf stocked ahead; before a storm, stock what it needs.
      for (const [id, low] of [['naloxone', 6], ['kits', 15]]) if (st.supplies.stock[id] < low && sim.org.budget > 300) did('order', sim.orderSupply(id));
      if (st.supplies.stock.leaflets < 50 && sim.org.budget > 120) did('order', sim.orderSupply('leaflets'));
      if (storm === 'warned') {
        // Prepare in order of value for money, always keeping a reserve to run the night on.
        const reserve = 250;
        const need = st.storm.kind === 'freeze' ? 'blankets' : 'naloxone';
        if (!st.storm.prepared.has('warn')) did('prep:warn', sim.prepareStorm('warn'));
        if (st.supplies.stock[need] < 30 && sim.org.budget > reserve + 150) did('order', sim.orderSupply(need));
        if (!st.storm.prepared.has('standby') && sim.org.budget > reserve + 120) did('prep:standby', sim.prepareStorm('standby'));
        if (!st.storm.prepared.has('beds') && sim.org.budget > reserve + 200) did('prep:beds', sim.prepareStorm('beds'));
      }
    },
    idle() {},
    hoarder() {
      for (const id of ids) if (sim.services[id].switchedOn) sim.setEnabled(id, false);
      grant(100);
      did('drive', sim.startDonationDrive());
    },
    spammer() {
      for (const f of ['funding', 'police', 'camp']) did('favour:' + f, sim.askFavour(f));
      did('drive', sim.startDonationDrive());
    },
    sensible() {
      grant(200);
      did('drive', sim.startDonationDrive());
    },
    greedy() {
      grant(200);
      for (const id of ids) if (!sim.services[id].switchedOn) sim.setEnabled(id, true);
      if (sim.org.budget > 400 && sim.org.recruiting.length === 0) did('hire', sim.recruit('hirePaid'));
      if (sim.org.budget > 150 && sim.org.recruiting.length === 0) did('volunteers', sim.recruit('volunteerDrive'));
      if (sim.org.budget > 500) did('invest', sim.invest(sim.busiest.service));
      did('drive', sim.startDonationDrive());
    },
  }[name];
  if (!strategy) throw new Error('unknown bot ' + name);
  const red = () => { const s = sim.cityStress; return s.police >= 0.7 || s.medics >= 0.7 || s.sobering >= 0.7 || sim.vitality.level < 0.3; };
  const rows = [];
  const start = sim.org.now;
  let firstRed = null, overAt = null, redHours = 0, nextAct = 0, nextLog = 0, guard = 0, foldedAt = null, quits = 0, wonAt = null;
  const storms = [];
  // Where morale went: every rise and fall through Team.move, summed by cause (lifts as 'lift').
  const morale = {};
  const T = sim.team.constructor;
  const move = T.move;
  T.move = (m, amount, cause, steadier) => {
    const before = m.morale;
    move.call(T, m, amount, cause, steadier);
    const k = cause ?? 'lift';
    morale[k] = +((morale[k] ?? 0) + m.morale - before).toFixed(3);
  };
  sim.on((e) => {
    if (e.type === 'nightReport' && e.report.care) careMetrics.nights.push({ night: e.report.night, ...e.report.care, reputation: sim.reputation.score });
    if (e.type === 'storm' && e.what === 'ended') storms.push({ ...e.report, h: Math.round((sim.org.now - start) / 60) });
    if (e.type === 'orgNotice' && / has quit: /.test(e.notice.text)) quits++;
  });
  while (sim.org.now - start < days * 1440 && guard++ < 5e6) {
    const t = sim.org.now - start;
    if (t >= nextAct) { nextAct += 30; strategy(); }
    const target = sim.org.now + 1;
    let inner = 0;
    while (sim.org.now < target && inner++ < 10000) {
      sim.tick(STEP);
      const pace = sim.pace ?? 1, parts = Math.max(1, Math.ceil(pace));
      for (let k = 0; k < parts; k++) crowd.update((STEP * pace) / parts);
      // Mirror the game's fixed step: signals must advance with people, including in headless runs.
      world.update(STEP, sceneTime);
      sceneTime += STEP;
    }
    if (red()) { redHours += 1 / 60; firstRed ??= Math.round(t / 60); }
    // No game over any more: the first hour all three starting services had closed down for money.
    if (overAt === null && sim.org.closedDown.size >= 3) overAt = Math.round(t / 60);
    if (foldedAt === null && st.runOver) foldedAt = Math.round(t / 60);
    if (wonAt === null && sim.goals.won) wonAt = Math.round(t / 60);
    careMetrics.queuePeak = Math.max(careMetrics.queuePeak, ...ids.map(id => sim.services[id].queue.length));
    careMetrics.activePeak = Math.max(careMetrics.activePeak, care.visits.size);
    if (t >= nextLog) {
      nextLog += 60;
      const s = sim.cityStress;
      rows.push({
        h: Math.round(t / 60), clock: Math.floor(sim.clockMinutes / 60) % 24, budget: Math.round(sim.org.budget), net: Math.round(sim.org.netPerHour),
        police: +s.police.toFixed(2), medics: +s.medics.toFixed(2), sobering: +s.sobering.toFixed(2), district: +sim.vitality.level.toFixed(2), size: sim.growth ? +sim.growth.size.toFixed(2) : 1, street: sim.growth ? +sim.growth.street.toFixed(2) : 0,
        crisis: +sim.crisis.toFixed(2), unmet24: sim.unmet24, helped: sim.totals.helped, broke: sim.org.broke ? Math.round(sim.org.brokeMinutes / 60) : 0,
        staff: `${sim.org.paid}+${sim.org.volunteers}`, open: ids.filter((i) => sim.services[i].status === 'open').length,
        reputation: +sim.reputation.score.toFixed(2), favours: sim.favours, favourProgress: +sim.reputation.progress.toFixed(3), unlocks: sim.reputation.earned.size,
        stars: sim.goals?.stars ?? 0, trust: sim.funders ? +sim.funders.trust.toFixed(2) : 1,
        morale: +sim.team.morale.toFixed(2), tier: st.standing.tier, points: Math.round(st.standing.points), deaths: sim.deaths,
        naloxone: st.supplies.stock.naloxone, kits: st.supplies.stock.kits, storm: st.storm.phase, turnedAway: sim.turnedAwayTotal,
      });
    }
    if (guard % 240 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const totals = Object.fromEntries(Object.entries(sim.totals).filter(([, v]) => typeof v === 'number'));
  return { careMetrics, name, days, clockSpeed: opts.clockSpeed ?? 1, firstRedHour: firstRed, redHours: Math.round(redHours), gameOverHour: overAt, foldedHour: foldedAt, quits, storms, scenario: sim.goals.scenario?.id ?? null, foldCause: st.runOver?.cause ?? null, closedDown: [...sim.org.closedDown], closedReasons: Object.fromEntries(ids.map((i) => [i, sim.services[i].closedReason])), wonHour: wonAt, stars: sim.goals.stars, nights: sim.totals.nights, morale, alone: sim.health.alone, acts, totals, rows };
}
