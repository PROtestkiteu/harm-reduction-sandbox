// Checks the Polish catalogue: t() and plural keys missing from it, placeholder mismatches, em dashes.
//   node scripts/check-i18n.mjs . [file filter substring]
// Reports t()/plural keys missing from the Polish catalogue, placeholder mismatches, and em dashes.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const app = process.argv[2];
const filter = process.argv[3] ?? '';
const src = join(app, 'src');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const strLit = String.raw`'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"`;
const unq = (s) => (s[0] === "'" ? JSON.parse('"' + s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"') : JSON.parse(s));
// Catalogue: pl.ts plus parts, parsed as `'key': 'value',` pairs.
const cat = new Map();
const catFiles = [join(src, 'i18n/pl.ts'), ...(existsSync(join(src, 'i18n/parts')) ? readdirSync(join(src, 'i18n/parts')).map((f) => join(src, 'i18n/parts', f)) : [])];
const pairRe = new RegExp(`(${strLit})\\s*:\\s*(${strLit})`, 'g');
for (const f of catFiles) for (const m of readFileSync(f, 'utf8').matchAll(pairRe)) cat.set(unq(m[1]), unq(m[2]));
const keyRe = new RegExp(`\\bt\\(\\s*(${strLit})`, 'g');
const tplRe = /\bt\(\s*`/g;
let missing = 0, bad = 0, used = new Set();
for (const f of walk(src)) {
  if (f.includes('/i18n/')) continue;
  const rel = relative(app, f);
  if (filter && !rel.includes(filter)) continue;
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(tplRe)) { console.log(`TEMPLATE  ${rel}: t(\` at ${m.index}`); bad++; }
  for (const m of text.matchAll(keyRe)) {
    const k = unq(m[1]); used.add(k);
    if (!cat.has(k)) { console.log(`MISSING   ${rel}: ${k}`); missing++; continue; }
    const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
    if (ph(k) !== ph(cat.get(k))) { console.log(`PLACEHOLD ${rel}: ${k}  =>  ${cat.get(k)}`); bad++; }
  }
}
for (const [k, v] of cat) if (/[—]/.test(v) || /[—]/.test(k)) { console.log(`EMDASH    ${k} => ${v}`); bad++; }
console.log(`catalogue ${cat.size} entries, ${used.size} distinct keys used, ${missing} missing, ${bad} other problems`);
if (!filter) { const unused = [...cat.keys()].filter((k) => !used.has(k)); console.log(`unused catalogue entries: ${unused.length}`); if (process.argv.includes('--unused')) unused.forEach((k) => console.log('UNUSED    ' + k)); }
