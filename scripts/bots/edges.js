// Page side of edges.mjs: one function expression, sent to the dev page by
// chrome.mjs. Watches every mover the world tags (`userData.mover`: cars,
// buses, vans, emergency vehicles, the bin lorry and sweeper, boats, aircraft,
// the train, the helicopter) through a series of camera views and reports:
//   pops      a mover that appeared or vanished while on screen
//   jumps     one that moved more than 20 m between samples while on screen
//   inside    a road vehicle inside a registered building's footprint
//   overlaps  two registered road vehicles in each other's bodies
//   stuck     a registered vehicle standing more than 40 s
// plus counts per kind of what was seen moving.
async (views, holdMs) => {
  const s = __sandbox;
  const cam = s.camera;
  const scene = s.world.scene;
  const rig = s.rig;
  const V = cam.position.constructor;
  const v = new V();
  const B = await import('/src/world/cityBuildings.ts');
  const blds = B.allBuildings().filter((b) => !b.ground);
  const ROAD = new Set(['through', 'outer', 'van', 'bus', 'ambulance', 'police', 'main', 'taxi', 'nightBus', 'lorry', 'sweeper']);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const onScreen = (p) => { v.copy(p).project(cam); return Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92 && v.z < 1; };
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const r1 = (p) => [Math.round(p.x), Math.round(p.y), Math.round(p.z)];
  const pops = [], jumps = [], inside = [], overlaps = [], stuck = [];
  const seen = {};
  const stuckIds = new Set();
  const report = (list, item) => { if (list.length < 40) list.push(item); };
  const traffic = s.world.traffic.cars;

  for (const view of views) {
    rig.setView({ azimuthDeg: view.az, elevationDeg: view.el });
    rig.zoomBy(view.zoom / rig.zoom, true);
    const f = rig.targetFocus;
    rig.pan(view.x - f.x, view.z - f.z, true);
    await sleep(1500);
    let prev = null;
    for (let t = 0; t < holdMs; t += 250) {
      await sleep(250);
      const now = new Map();
      scene.traverse((o) => {
        const kind = o.userData.mover;
        if (!kind) return;
        now.set(o.uuid, { kind, p: o.getWorldPosition(new V()), vis: shown(o) && !!o.parent });
      });
      if (prev) {
        for (const [id, a] of now) {
          const b = prev.get(id);
          if (a.vis && !(b && b.vis) && onScreen(a.p)) report(pops, { at: view.name, ev: 'in', kind: a.kind, p: r1(a.p) });
          if (a.vis && b && b.vis && a.p.distanceTo(b.p) > 20 && (onScreen(a.p) || onScreen(b.p))) report(jumps, { at: view.name, kind: a.kind, from: r1(b.p), to: r1(a.p) });
          if (a.vis && b && b.vis && a.p.distanceTo(b.p) > 0.05) seen[a.kind] = (seen[a.kind] ?? 0) + 1;
          if (a.vis && ROAD.has(a.kind) && a.p.y < 2) {
            const hit = blds.find((q) => a.p.x > q.x0 + 0.3 && a.p.x < q.x1 - 0.3 && a.p.z > q.z0 + 0.3 && a.p.z < q.z1 - 0.3);
            if (hit) report(inside, { at: view.name, kind: a.kind, p: r1(a.p), building: hit.id });
          }
        }
        for (const [id, b] of prev) {
          const a = now.get(id);
          if (b.vis && !(a && a.vis) && onScreen(b.p)) report(pops, { at: view.name, ev: 'out', kind: b.kind, p: r1(b.p) });
        }
      }
      prev = now;
      const act = traffic.filter((c) => c.active);
      for (let i = 0; i < act.length; i++) {
        const a = act[i];
        if (a.waited > 40 && !stuckIds.has(a.id) && stuckIds.add(a.id)) report(stuck, { at: view.name, id: a.id, p: [Math.round(a.x), Math.round(a.z)], waited: Math.round(a.waited) });
        for (let j = i + 1; j < act.length; j++) {
          const b = act[j];
          const rx = b.x - a.x;
          const rz = b.z - a.z;
          const along = Math.abs(rx * a.dx + rz * a.dz);
          const side = Math.abs(rx * a.dz - rz * a.dx);
          const parallel = Math.abs(a.dx * b.dx + a.dz * b.dz) > 0.7;
          const hit = parallel ? side < 1.6 && along < a.half + b.half - 0.3 : Math.hypot(rx, rz) < 1.6;
          if (hit) report(overlaps, { at: view.name, ids: [a.id, b.id], halves: [a.half, b.half], waited: [+a.waited.toFixed(1), +b.waited.toFixed(1)], p: [Math.round(a.x), Math.round(a.z)], along: +along.toFixed(1), side: +side.toFixed(1) });
        }
      }
    }
  }
  return JSON.stringify({ pops, jumps, inside, overlaps, stuck, seen });
}
