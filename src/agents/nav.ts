import { EDGES, NODES, nearestNodeTo, type NodeId, type P2 } from '../world/layout';

/** Shortest paths over the small pavement graph, precomputed once (Floyd-Warshall). */
const ids = Object.keys(NODES) as NodeId[];
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
