/** Deterministic domain and simulation regression checks, without a browser or renderer. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      const candidate = [`${base.href}.ts`, `${base.href}/index.ts`].find((url) => existsSync(fileURLToPath(url)));
      if (candidate) return { url: candidate, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
  },
});
globalThis.location = { search: '?scenario=tutorial' };
const { navigationWithin, routeTo } = await import('../../src/agents/nav.ts');
const { NODES, SERVICE_NODES, EDGES, MAIN_CROSSINGS, SQUAT_SPOT, camperSpot } = await import('../../src/world/layout.ts');
const { TUTORIAL_AREAS, TUTORIAL_PRIVACY_SPOT } = await import('../../src/config/tutorialMap.ts');
const { TutorialProgress, TUTORIAL_STAGES } = await import('../../src/game/tutorial.ts');
assert.notEqual(SQUAT_SPOT, camperSpot(), 'Camper and squat must occupy separate kerb sites');
assert(MAIN_CROSSINGS.some(c => c.z0 <= 71.5 && c.z1 >= 71.5), 'Park access has a marked crossing');
for (const stage of TUTORIAL_STAGES.filter(s => s !== 'complete')) {
  const progress = TutorialProgress.restore({ version: 1, stage });
  const bounds = TUTORIAL_AREAS[progress.capabilities.district];
  const graph = navigationWithin(bounds);
  assert(graph.entries.length > 0, stage + ' needs a local entry');
  if (progress.capabilities.district === 'city') continue;
  for (const service of progress.capabilities.services) {
    const to = SERVICE_NODES[service];
    assert(graph.nodes.includes(to), stage + ': service approach outside district: ' + service);
    for (const entry of graph.entries) {
      const route = graph.route(NODES[entry], to, { x: 0.2, z: 0.2 });
      assert(route.length > 0);
      for (const point of route) assert(point.x >= bounds.x0 && point.x <= bounds.x1 && point.z >= bounds.z0 && point.z <= bounds.z1, stage + ': route outside district');
    }
  }
  assert(graph.nodes.includes(TUTORIAL_PRIVACY_SPOT.node));
  assert(TUTORIAL_PRIVACY_SPOT.at.x >= bounds.x0 && TUTORIAL_PRIVACY_SPOT.at.x <= bounds.x1 && TUTORIAL_PRIVACY_SPOT.at.z >= bounds.z0 && TUTORIAL_PRIVACY_SPOT.at.z <= bounds.z1);
  for (const id of graph.nodes) graph.route(NODES[graph.entries[0]], id, { x: 0, z: 0 });
}
const park = navigationWithin(TUTORIAL_AREAS.park);
const campRoute = park.route(NODES[SERVICE_NODES.footPatrol], 'tutorialCampWest', { x: 0, z: 0 });
assert(campRoute.some(p => p.x < -20 && p.z > 76), 'Patrol can reach the encampment');
assert.throws(() => park.route(NODES.eS2, 'wClub', { x: 0, z: 0 }), /outside playable/);
assert(routeTo(NODES.eS2, 'tutorialCampWest', { x: 0, z: 0 }).length > 0);
assert(EDGES.some(([a,b]) => a === 'eS2' && b === 'wS2'));
console.log('Tutorial district connectivity, local routes and park crossing: passed');
