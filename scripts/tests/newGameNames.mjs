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
const storage = new Map([['hrp-names', JSON.stringify({ 'org:name': 'Old organisation', 'location:dropIn': 'Old centre' })], ['hrp-lang', 'pl']]);
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
const { displayName, rename } = await import('../../src/ui/names.ts');
const { setLaunchConfiguration } = await import('../../src/game/launch.ts');
const launch = kind => setLaunchConfiguration({ kind, scenarioId: null, settings: {}, custom: false });
assert.equal(displayName('org', 'name', 'Default'), 'Old organisation');
rename('person', 1, 'Old person');
rename('building', 2, 'Old building');
launch('resume');
assert.equal(displayName('org', 'name', 'Default'), 'Old organisation');
launch('link');
assert.equal(displayName('person', 1, 'Default'), 'Old person');
launch('new');
for (const [kind, id] of [['org', 'name'], ['location', 'dropIn'], ['person', 1], ['building', 2]]) {
  assert.equal(displayName(kind, id, 'Default'), 'Default');
}
assert.equal(storage.has('hrp-names'), false);
assert.equal(storage.get('hrp-lang'), 'pl');
rename('org', 'name', 'Another run');
localStorage.removeItem = () => { throw new Error('Storage blocked'); };
assert.doesNotThrow(() => launch('new'));
assert.equal(displayName('org', 'name', 'Default'), 'Default');
console.log('New game clears all custom names; resume/link, preferences and blocked storage: passed.');
