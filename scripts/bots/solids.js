// Page-side: every solid footprint (benches, bins, shelters, kiosks, parked cars, stage pieces) that
// a walker of radius 0.3 on one of the crowd's walking lines (the walk graph's edges, sampled every
// 0.2 m) would bump into. People walk those lines, so anything standing on one is a problem.
async () => {
  const L = await import('/src/world/layout.ts');
  const S = await import('/src/world/solids.ts');
  const solids = __sandbox.world.solids;
  const hits = new Map();
  for (const [a, b] of L.EDGES) {
    const p = L.NODES[a];
    const q = L.NODES[b];
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    for (let t = 0; t <= len; t += 0.2) {
      const x = p.x + ((q.x - p.x) * t) / len;
      const z = p.z + ((q.z - p.z) * t) / len;
      for (const box of solids.grid.get(Math.floor(x / 4) * 8192 + Math.floor(z / 4)) ?? []) {
        if (S.pushFromBox(box, x, z, 0.3, { x: 0, z: 0 })) hits.set(box, `${a}-${b}`);
      }
    }
  }
  return JSON.stringify([...hits].map(([b, edge]) => ({ at: [+b.x.toFixed(2), +b.z.toFixed(2)], size: [+(b.hw * 2).toFixed(2), +(b.hd * 2).toFixed(2)], edge })));
}
