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
const { menuSave, menuLinkedSave } = await import('../../src/game/menuSave.ts');
const { deflateSync } = await import('fflate');
const save = { v: 1, name: 'Test', clock: 1200, org: { budget: 1500, paid: 4, volunteers: 2 }, team: [], upgrades: {}, units: [], campers: [], street: {}, totals: { helped: 0, nights: 0 } };
assert.equal(menuSave(null), null);
assert.equal(menuSave({ v: 1 }), null);
assert.equal(menuSave({ ...save, org: [] }), null);
assert.equal(menuSave({ ...save, clock: NaN }), null);
assert.equal(menuSave({ ...save, team: [null] }), null);
assert.equal(menuSave({ ...save, tutorial: { version: 1, stage: 'bad' } }), null);
assert(menuSave(save), 'Old revision-one saves remain accepted');
assert(menuSave({ ...save, tutorial: { version: 1, stage: 'complete' } }), 'Completed tutorial keeps its authored layout');
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const bytes = new TextEncoder().encode(JSON.stringify(save));
assert.deepEqual(await menuLinkedSave(b64(bytes), false), save);
assert.deepEqual(await menuLinkedSave(b64(deflateSync(bytes)), true), save);
assert.equal(await menuLinkedSave('broken', true), null);
assert.equal(await menuLinkedSave(b64(new TextEncoder().encode('{"v":1}')), false), null);
assert.equal(await menuLinkedSave(b64(deflateSync(new TextEncoder().encode('x'.repeat(60001)))), true), null);
assert.equal(await menuLinkedSave('a'.repeat(12001), false), null);
console.log('Menu save envelope and portable-link checks passed');

// Layout metadata must be resolved before the renderer's dependency graph is imported.
const { prepareAutomaticLaunch } = await import('../../src/game/automaticLaunch.ts');
const launch = await import('../../src/game/launch.ts');
const store = new Map();
globalThis.sessionStorage = { getItem: (key) => store.get(key) ?? null };
globalThis.document = { baseURI: 'http://localhost:5202/' };
globalThis.history = { replaceState: (_state, _unused, url) => { globalThis.location = new URL(url, globalThis.location); }, state: null };
const tutorialSave = { ...save, worldSeed: 123456, tutorial: { version: 1, stage: 'patrol' } };
globalThis.location = new URL('http://localhost:5202/?g=0123456789abcdef01234567');
globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: b64(new TextEncoder().encode(JSON.stringify(tutorialSave))) }) });
await prepareAutomaticLaunch();
assert.equal(launch.launchConfiguration.kind, 'link');
assert.equal(new URL(location.href).searchParams.get('scenario'), 'tutorial');
assert.equal(launch.launchConfiguration.save.tutorial.stage, 'patrol');
assert.equal(globalThis.__launchSeed, 123456, 'Saved city seed must be set before world import');
globalThis.location = new URL('http://localhost:5202/#g=' + b64(deflateSync(new TextEncoder().encode(JSON.stringify(tutorialSave)))));
await prepareAutomaticLaunch();
assert.equal(launch.launchConfiguration.kind, 'link');
assert.equal(new URL(location.href).searchParams.get('scenario'), 'tutorial');
store.set('hrp-resume', JSON.stringify(tutorialSave));
globalThis.location = new URL('http://localhost:5202/');
await prepareAutomaticLaunch();
assert.equal(launch.launchConfiguration.kind, 'resume');
assert.equal(new URL(location.href).searchParams.get('scenario'), 'tutorial');
store.clear();
globalThis.location = new URL('http://localhost:5202/?g=0123456789abcdef01234567');
globalThis.fetch = async () => ({ ok: false });
await assert.rejects(prepareAutomaticLaunch(), /Saved game unavailable/);
console.log('Direct saved-game links and update-resume layout checks passed');

// Ordinary reopening, saved addresses and update snapshots never opt into a dev launch.
store.set('hrp-resume', JSON.stringify(tutorialSave));
for (const suffix of ['', '?scenario=tutorial', '?g=0123456789abcdef01234567', '#g=saved']) {
  globalThis.location = new URL('http://localhost:5202/' + suffix);
  assert.equal(launch.hasAutomaticLaunch(), false, suffix || 'plain reopen');
}
globalThis.location = new URL('http://localhost:5202/?play=1');
assert.equal(launch.hasAutomaticLaunch(), true, 'Development bots explicitly opt in');
globalThis.location = new URL('http://localhost:5202/?play=1&menu=1');
assert.equal(launch.hasAutomaticLaunch(), false, 'Explicit menu takes precedence');
store.clear();
console.log('Menu-first launch policy checks passed');
