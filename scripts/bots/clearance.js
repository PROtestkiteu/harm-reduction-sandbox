// Page-side: walking clearances of the flavour packs' props and standing spots. For each, the gap
// (metres) to the crowd's walking lines (pavement graph centrelines, minus the walkers' 0.45 m side
// offset and the item's own radius) and whether it lies inside a building's footprint. Moving lines
// (the wardens' round, buyers' routes) report their closest approach; they cross the crowd only at streets.
async () => {
  const L = await import('/src/world/layout.ts');
  const B = await import('/src/world/cityBuildings.ts');
  const st = await import('/src/config/flavour/street.ts');
  const gd = await import('/src/config/flavour/guard.ts');
  const cr = await import('/src/config/flavour/crime.ts');
  const vg = await import('/src/config/flavour/vignettes.ts');
  const sv = await import('/src/config/flavour/service.ts');
  const us = await import('/src/config/flavour/users.ts');
  const sp = await import('/src/config/flavour/streetPeople.ts');
  const cy = await import('/src/config/flavour/cycling.ts');
  const pe = await import('/src/config/flavour/pets.ts');
  const de = await import('/src/config/flavour/decor.ts');
  const ki = await import('/src/config/flavour/kids.ts');
  const pi = await import('/src/config/flavour/pioneers.ts');
  const to = await import('/src/config/flavour/tourists.ts');
  const items = [];
  const add = (name, p, r = 0.35, still = true) => items.push({ name, x: p.x, z: p.z, r, still });
  st.DEAL_SPOTS.forEach((d, i) => { add('dealer' + i, d.at); if (d.lookout) add('lookout' + i, d.lookout); });
  st.USE_SPOTS.forEach((u, i) => add('use' + i, u.at));
  for (const a of __sandbox.flavour.packs.pool.actors) if (['dealer', 'lookout', 'user'].includes(a.voice) && !a.look.kit?.bedroll) add('actor:' + a.voice + '@' + a.x.toFixed(1) + ',' + a.z.toFixed(1), a);
  for (const a of __sandbox.flavour.packs.pool.actors) if (a.voice === 'user' && a.look.kit?.bedroll && a.shown > 0.1) add('sitter@' + a.x.toFixed(1) + ',' + a.z.toFixed(1), a);
  st.RESIDENT_USERS.forEach((u, i) => add('resident' + i, u.at));
  for (const k in cr.CRIME_SITES) cr.CRIME_SITES[k].forEach((s, i) => add(k + i, s.at, k === 'flyTipping' ? 1.2 : 0.6));
  add('busker', vg.BUSKER.at); add('guitarCase', { x: vg.BUSKER.at.x + Math.sin(vg.BUSKER.face) * 0.9, z: vg.BUSKER.at.z + Math.cos(vg.BUSKER.face) * 0.9 }, 0.5);
  vg.BUSKER.listeners.forEach((p, i) => add('listener' + i, p));
  vg.DELIVERY.wait.forEach((p, i) => add('riderBike' + i, p, 0.6));
  add('bench', vg.BENCH.at, 0.85); add('pigeons', { x: vg.BENCH.at.x, z: vg.BENCH.at.z + 1.6 }, 1.6);
  sv.BIN_ROUND.bins.forEach((p, i) => add('bin' + i, p, 0.45));
  vg.HOTDOG.pitches.forEach((p, i) => { add('cartPitch' + i, p, 0.8); });
  vg.BUS_STOPS.stops.forEach((st, i) => {
    const fx = Math.sin(st.face), fz = Math.cos(st.face);
    // The shelter's footprint corners and its waiting places, in world space.
    for (const [lx, lz] of [[-1.27, -0.32], [1.27, -0.32], [-1.27, 0.28], [1.27, 0.28], [1.6, -0.2]]) add('stop' + i + '.' + lx + ',' + lz, { x: st.at.x + fz * lx + fx * lz, z: st.at.z - fx * lx + fz * lz }, 0.05);
    for (const k of [0, 1]) { const off = (k - 0.5); add('stopWait' + i + '.' + k, { x: st.at.x + fz * off + fx * 0.1, z: st.at.z - fx * off + fz * 0.1 }, 0.3); }
  });
  // Who uses what: every spot, the far end of each pacing line, and the smokers' bench.
  us.USER_GROUPS.forEach((g) => g.spots.forEach((sp, i) => { add(g.kind + i, sp.at, sp.liesDown ? 0.9 : 0.35); if (sp.pace) add(g.kind + i + 'pace', sp.pace); }));
  { const c = us.USER_GROUPS.find((g) => g.kind === 'cannabis'); if (c) add('usersBench', { x: (c.spots[0].at.x + c.spots[1].at.x) / 2, z: (c.spots[0].at.z + c.spots[1].at.z) / 2 + 0.05 }, 0.85); }
  // Thieves: the shop guards where the pack stands them; pickets and clergy at the drop-in.
  for (const a of __sandbox.flavour.packs.pool.actors) if (a.look.vest === 0x1c1c20) add('shopGuard@' + a.x.toFixed(1) + ',' + a.z.toFixed(1), a);
  (await import('/src/world/flavour/visitors.ts')).visitSpots().forEach((p, i) => add('visit' + i, p));
  // Bike racks (their length along x), cats, street furniture and the bookshop's book cart.
  cy.RACKS.forEach((r, i) => { const w = Math.max(1.6, r.bikes * 0.75); for (const dx of [-w / 2, 0, w / 2]) add('rack' + i + '@' + dx.toFixed(1), { x: r.at.x + dx, z: r.at.z }, 0.45); });
  pe.PETS.cats.forEach((c, i) => add('cat' + i, c, 0.2));
  de.DECOR.forEach((d, i) => add(d.kind + i, d.at, d.kind === 'planter' ? 0.8 : 0.3));
  { const id = __sandbox.world.bookshop; const b = id === null ? null : (await import('/src/world/cityBuildings.ts')).cityBuilding(id); if (b) add('bookCart', { x: b.x1 - 1.2, z: b.z1 + 0.55 }, 0.6); }
  // Where big-day crowds gather when no bar is open (world/flavour/crowds.ts NO_BARS, mirrored here).
  for (const [x, z] of [[-28, -54.2], [12, -54.2], [38, -54.2]]) add('crowdSpot' + x, { x, z }, 1.2);
  // Squat sitters and club smokers, where they stand this launch.
  for (const a of __sandbox.flavour.packs.pool.actors) if (a.voice === 'smoker' || (a.voice === 'user' && a.look.kit?.bedroll && a.shown > 0.1)) add(a.voice + '@' + a.x.toFixed(1) + ',' + a.z.toFixed(1), a);
  // Distance from a point to a segment.
  const seg = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); };
  const BAND = 0.45; // walkers keep this lateral offset from the centreline
  const out = [];
  for (const it of items) {
    let best = Infinity, edge = '';
    for (const [a, b] of L.EDGES) { const d = seg(it, L.NODES[a], L.NODES[b]) - BAND - it.r; if (d < best) { best = d; edge = a + '-' + b; } }
    // Inside a building's footprint?
    let inB = null;
    for (let id = 0; id < 2000; id++) { const b = B.cityBuilding(id); if (!b) break; if (it.x > b.x0 + 0.05 && it.x < b.x1 - 0.05 && it.z > b.z0 + 0.05 && it.z < b.z1 - 0.05) { inB = id; break; } }
    out.push({ n: it.name, clear: +best.toFixed(2), edge, inBuilding: inB });
  }
  // The guard round and the moving actors' lines: closest approach to the crowd's lines.
  const lines = [...gd.GUARD_ROUND.map((p, i, r) => ['guard', p, r[(i + 1) % r.length]]), ...st.DEAL_SPOTS.map((d, i) => ['approach' + i, d.approach[0], d.approach[1]]), ...sp.PICKPOCKET_BEATS.map((b, i) => ['pickpocket' + i, b.from, b.to]), ...sp.PICKPOCKET_BEATS.map((b, i) => ['pickpocketAway' + i, b.from, b.away]), ...pe.DOG_WALKS.map((w, i) => ['dogWalk' + i, w.from, w.to]), ...ki.FAMILIES.map((f, i) => ['family' + i, f.from, f.to]), ...pi.PIONEER_WALK.slice(1).map((p, i) => ['pioneers' + i, pi.PIONEER_WALK[i], p]), ...to.TOURIST_ROUTES.flatMap((r, k) => r.path.slice(1).map((p, i) => ['tourists' + k + '.' + i, r.path[i], p]))];
  for (const [n, a, b] of lines) {
    let best = Infinity, edge = '';
    for (let k = 0; k <= 40; k++) { const p = { x: a.x + (b.x - a.x) * k / 40, z: a.z + (b.z - a.z) * k / 40 }; for (const [e0, e1] of L.EDGES) { const d = seg(p, L.NODES[e0], L.NODES[e1]) - BAND - 0.3; if (d < best) { best = d; edge = e0 + '-' + e1; } } }
    out.push({ n: n + ' (line)', clear: +best.toFixed(2), edge, inBuilding: null });
  }
  return JSON.stringify(out);
}
