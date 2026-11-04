import { EDGES, NODES, ENTRY_NODES, TUTORIAL_LAYOUT, nearestNodeTo, type NodeId, type P2 } from '../world/layout';

/** Shortest paths over the small pavement graph, precomputed once (Floyd-Warshall). */
const ids = (Object.keys(NODES) as NodeId[]).filter(id => TUTORIAL_LAYOUT || !id.startsWith('tutorial'));
const index = new Map(ids.map((id, i) => [id, i]));
const n = ids.length;
const dist = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
const next = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? j : -1)));

for (const [a, b] of EDGES) {
  const i = index.get(a)!;
  const j = index.get(b)!;
  const d = Math.hypot(NODES[a].x - NODES[b].x, NODES[a].z - NODES[b].z);
  dist[i][j] = dist[j][i] = d;
  next[i][j] = j;
  next[j][i] = i;
}
for (let k = 0; k < n; k++)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (dist[i][k] + dist[k][j] < dist[i][j]) {
        dist[i][j] = dist[i][k] + dist[k][j];
        next[i][j] = next[i][k];
      }

export function nearestNode(p: P2): NodeId {
  // The nearest node on this side of the road: people walk to a zebra to cross.
  return nearestNodeTo(p);
}

/** Node sequence from `from` to `to`, inclusive. */
export function nodePath(from: NodeId, to: NodeId): NodeId[] {
  let i = index.get(from)!;
  const j = index.get(to)!;
  if (next[i][j] < 0) return [to];
  const out: NodeId[] = [ids[i]];
  while (i !== j) {
    i = next[i][j];
    out.push(ids[i]);
  }
  return out;
}

/**
 * Waypoints from a position to a node. Each walker keeps a small lateral
 * offset so people sharing a pavement walk side by side, not in one file.
 */
export function routeTo(from: P2, to: NodeId, offset: P2): P2[] {
  const nodes = nodePath(nearestNode(from), to);
  return nodes.map((id, k) => {
    const last = k === nodes.length - 1;
    const pt = NODES[id];
    return last ? { x: pt.x, z: pt.z } : { x: pt.x + offset.x, z: pt.z + offset.z };
  });
}


/** A small authored map gets its own connected pavement graph once per expansion. */
export function navigationWithin(bounds: { x0: number; x1: number; z0: number; z1: number }) {
  const nodes = ids.filter((id) => { const p = NODES[id]; return p.x >= bounds.x0 && p.x <= bounds.x1 && p.z >= bounds.z0 && p.z <= bounds.z1; });
  const allowed = new Set(nodes);
  const neighbours = new Map(nodes.map((id) => [id, [] as NodeId[]]));
  for (const [a, b] of EDGES) if (allowed.has(a) && allowed.has(b)) { neighbours.get(a)!.push(b); neighbours.get(b)!.push(a); }
  const entries = ENTRY_NODES.filter((id) => allowed.has(id));
  const nearest = (point: P2, candidates = nodes): NodeId => candidates.reduce((best, id) => Math.hypot(NODES[id].x - point.x, NODES[id].z - point.z) < Math.hypot(NODES[best].x - point.x, NODES[best].z - point.z) ? id : best, candidates[0]);
  return {
    nodes, entries,
    entry: (point: P2) => nearest(point, entries),
    route(from: P2, to: NodeId, offset: P2): P2[] {
      if (!allowed.has(to)) throw new Error('Destination outside playable neighbourhood');
      const start = nearest(from);
      const costs = new Map<NodeId, number>([[start, 0]]);
      const previous = new Map<NodeId, NodeId>();
      const pending = new Set(nodes);
      while (pending.size) {
        let current: NodeId | undefined;
        let best = Infinity;
        for (const id of pending) if ((costs.get(id) ?? Infinity) < best) { current = id; best = costs.get(id)!; }
        if (!current) break;
        pending.delete(current);
        if (current === to) break;
        for (const next of neighbours.get(current)!) {
          const value = best + Math.hypot(NODES[next].x - NODES[current].x, NODES[next].z - NODES[current].z);
          if (value < (costs.get(next) ?? Infinity)) { costs.set(next, value); previous.set(next, current); }
        }
      }
      if (!costs.has(to)) throw new Error('Disconnected playable neighbourhood');
      const path: NodeId[] = [to];
      while (path[0] !== start) path.unshift(previous.get(path[0])!);
      return path.map((id, i) => ({ x: NODES[id].x + (i === path.length - 1 ? 0 : offset.x), z: NODES[id].z + (i === path.length - 1 ? 0 : offset.z) }));
    },
  };
}
