// Drives the dev page in headless Chrome over the DevTools protocol: no
// dependencies beyond Node 22 (fetch and WebSocket are built in) and a local
// Google Chrome. Used by the bots, the perf check and the clearance check.
//
// As a script:  node scripts/bots/chrome.mjs <url> <steps.json> [outDir] [WxH]
// Steps:        [{ "eval": "js" } | { "wait": ms } | { "shot": "name.png" } | { "profile": ms }]
// SEED=<n> replaces Math.random in the page with a seeded one before any script
// runs, so the city's layout (random per launch) is the same on every run.

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seeded = (seed) => `(() => { let a = ${Number(seed)} >>> 0; Math.random = () => {
  a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

/**
 * Opens `url`, runs `steps` in order and returns what each `eval` step gave
 * back. Page errors are printed to stderr. Screenshots and profiles go to `out`.
 */
export async function drive(url, steps, { out = '.', size = '1280x800', seed = process.env.SEED, settle = 9000, log = console.log } = {}) {
  const [w, h] = size.split('x').map(Number);
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'hrs-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  const results = [];
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
    }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const waiting = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.error('console.error:', m.params.args.map((a) => a.value ?? a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') console.error('exception:', m.params.exceptionDetails.exception?.description);
    });
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
    if (seed !== undefined) await send('Page.addScriptToEvaluateOnNewDocument', { source: seeded(seed) });
    await send('Page.navigate', { url });
    await sleep(settle);
    for (const s of steps) {
      if (s.wait) await sleep(s.wait);
      if (s.eval) {
        const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true });
        results.push(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? null);
      }
      if (s.profile) {
        await send('Profiler.enable');
        await send('Profiler.setSamplingInterval', { interval: 200 });
        await send('Profiler.start');
        await sleep(s.profile);
        const r = await send('Profiler.stop');
        writeFileSync(join(out, 'profile.json'), JSON.stringify(r.result.profile));
        log('profile saved');
      }
      if (s.shot) {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(out, s.shot), Buffer.from(r.result.data, 'base64'));
        log('shot', s.shot);
      }
    }
    ws.close();
  } finally {
    // Chrome writes its profile while it shuts down: wait for it to exit before removing the folder.
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await Promise.race([exited, sleep(5000)]);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* left for the OS to clear from the temp folder */ }
  }
  return results;
}

/** Steps that skip the welcome box on a fresh profile: mark it seen, then reload once. */
export const SKIP_WELCOME = [{ eval: "localStorage.setItem('hrp-welcome-seen','1'); location.reload(); 1" }, { wait: 12000 }];

/** A page-side file (a function expression) called with `args`, as one eval step. */
export const call = (file, ...args) => ({ eval: `(${readFileSync(new URL(file, import.meta.url), 'utf8')})(${args.map((a) => JSON.stringify(a)).join(', ')})` });

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [url, stepsFile, out = '.', size] = process.argv.slice(2);
  if (!url || !stepsFile) {
    console.error('usage: node scripts/bots/chrome.mjs <url> <steps.json> [outDir] [WxH]');
    process.exit(2);
  }
  const results = await drive(url, JSON.parse(readFileSync(stepsFile, 'utf8')), { out, size });
  for (const r of results) console.log(typeof r === 'string' ? r : JSON.stringify(r));
}
