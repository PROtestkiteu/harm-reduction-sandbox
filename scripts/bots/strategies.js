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
// opts.clockSpeed sets the game clock's speed (1 = default) for speed-dependence checks.
async (name, days = 3, opts = {}) => {
  const { sim, crowd } = window.__sandbox;
  const STEP = 1 / 30;
  if (opts.clockSpeed) sim.configure({ clockSpeed: opts.clockSpeed });
  const ids = Object.keys(sim.services);
  const grants = Object.keys(sim.org.applications);
  const acts = {};
  const did = (k, ok) => { if (ok !== false) acts[k] = (acts[k] ?? 0) + 1; };
  const grant = (above) => { for (const g of grants) if (sim.org.applications[g].status === 'idle' && sim.org.budget > above) did('grant', sim.applyFor(g)); };
  const strategy = {
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
  let firstRed = null, overAt = null, redHours = 0, nextAct = 0, nextLog = 0, guard = 0;
  while (sim.org.now - start < days * 1440 && guard++ < 5e6) {
    const t = sim.org.now - start;
    if (t >= nextAct) { nextAct += 30; strategy(); }
    const target = sim.org.now + 1;
    let inner = 0;
    while (sim.org.now < target && inner++ < 10000) { sim.tick(STEP); crowd.update(STEP); }
    if (red()) { redHours += 1 / 60; firstRed ??= Math.round(t / 60); }
    // No game over any more: the first hour all three starting services had closed down for money.
    if (overAt === null && sim.org.closedDown.size >= 3) overAt = Math.round(t / 60);
    if (t >= nextLog) {
      nextLog += 60;
      const s = sim.cityStress;
      rows.push({
        h: Math.round(t / 60), clock: Math.floor(sim.clockMinutes / 60) % 24, budget: Math.round(sim.org.budget), net: Math.round(sim.org.netPerHour),
        police: +s.police.toFixed(2), medics: +s.medics.toFixed(2), sobering: +s.sobering.toFixed(2), district: +sim.vitality.level.toFixed(2), size: sim.growth ? +sim.growth.size.toFixed(2) : 1, street: sim.growth ? +sim.growth.street.toFixed(2) : 0,
        crisis: +sim.crisis.toFixed(2), unmet24: sim.unmet24, helped: sim.totals.helped, broke: sim.org.broke ? Math.round(sim.org.brokeMinutes / 60) : 0,
        staff: `${sim.org.paid}+${sim.org.volunteers}`, open: ids.filter((i) => sim.services[i].status === 'open').length,
        stars: sim.goals?.stars ?? 0, trust: sim.funders ? +sim.funders.trust.toFixed(2) : 1,
      });
    }
    if (guard % 240 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const totals = Object.fromEntries(Object.entries(sim.totals).filter(([, v]) => typeof v === 'number'));
  return { name, days, clockSpeed: opts.clockSpeed ?? 1, firstRedHour: firstRed, redHours: Math.round(redHours), gameOverHour: overAt, acts, totals, rows };
}
