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
const { C, FACTORS, CHECKING } = await import('../../src/config/contextFactors.ts');
const { NATIONAL_MODELS } = await import('../../src/config/nationalModels.ts');
const { SOURCE_REFERENCES } = await import('../../src/config/publicationReferences.ts');
const citations = [...Object.values(C), ...FACTORS.flatMap(f => f.options.flatMap(o => o.evidence)), ...NATIONAL_MODELS.flatMap(m => m.evidence), ...Object.values(CHECKING).map(v => v.cite)];
const internal = /HR Drug Checking|Chemical Safety|Wiedza|\.(?:pdf|xlsx|docx|png)\b/i;
for (const citation of citations) {
  if (citation.type === 'none') continue;
  const references = SOURCE_REFERENCES[citation.source];
  assert(references?.length, `Missing publication metadata: ${JSON.stringify(citation)}`);
  for (const reference of references) {
    assert(reference.title.trim().length > 12, citation.source);
    assert(!internal.test(reference.title), `Internal locator displayed as title: ${reference.title}`);
    assert(!internal.test(reference.locator ?? ''), `Internal locator leaks through page label: ${reference.locator}`);
    if (reference.url) assert.equal(new URL(reference.url).protocol, 'https:');
  }
}
assert.equal(SOURCE_REFERENCES[C.davis.source][0].url, 'https://doi.org/10.3390/ijerph192315978');
const calafat = Object.entries(SOURCE_REFERENCES).filter(([key]) => key.includes('2010_Calafat')).flatMap(([, refs]) => refs).find(r => r.title.startsWith('¿Para qué'));
assert.equal(calafat.url, 'https://doi.org/10.20882/adicciones.206', 'A DOI in the paper’s bibliography is not its own DOI');
const mislabeled = Object.entries(SOURCE_REFERENCES).filter(([key]) => key.includes('2025_Airth')).flatMap(([, refs]) => refs).find(r => r.title.includes('World Drug Report'));
assert(mislabeled.title.includes('World Drug Report 2024'), 'Cite the document actually held, rather than its misleading filename');
const multiple = Object.values(SOURCE_REFERENCES).find(refs => refs.length >= 3);
assert(multiple?.length >= 3, 'Keep every publication in multi-paper evidence references');
console.log(`Publication metadata coverage passed for ${citations.length} citations, including DOI identity, multiple sources and locator privacy`);
