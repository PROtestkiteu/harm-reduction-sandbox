// Drives the dev page in headless Chrome over the DevTools protocol: no
// dependencies beyond Node 22 (fetch and WebSocket are built in) and a local
// Google Chrome. Used by the bots, the perf check and the clearance check.
//
// As a script:  node scripts/bots/chrome.mjs <url> <steps.json> [outDir] [WxH]
// Steps:        [{ "eval": "js" } | { "wait": ms } | { "shot": "name.png" } | { "profile": ms } | { "heapProfile": ms }]
// SEED=<n> replaces Math.random in the page with a seeded one before any script
// runs, and pins the launch seed (src/config/launch.ts) to it, so the city's
// layout and start date (random per launch) are the same on every run.

import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seeded = (seed) => `(() => { globalThis.__launchSeed = ${Number(seed)} >>> 0; let a = ${Number(seed)} >>> 0; Math.random = () => {
  a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

const PREFIX = 'hrs-chrome-';
/** Chromes this process started and has not closed yet, with their profiles. */
const live = new Set();

/** Resolves true once `child` has exited, or false after `ms`. */
const exited = (child, ms) => (child.exitCode !== null || child.signalCode !== null
  ? Promise.resolve(true)
  : Promise.race([new Promise((r) => child.once('exit', () => r(true))), sleep(ms).then(() => false)]));

/**
 * Closes Chrome the way it expects: Browser.close over the browser's own
 * DevTools socket, so it shuts down cleanly (and macOS removes its code-signing
 * clone). Only if it is still running after 5 s, SIGTERM, then SIGKILL. Then
 * the profile goes.
 */
async function close(run) {
  live.delete(run);
  const { chrome, port, profile } = run;
  if (!(await exited(chrome, 0))) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })).json();
      const ws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((ok, fail) => { ws.addEventListener('open', ok); ws.addEventListener('error', fail); });
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    } catch { /* not answering: the signals below */ }
    if (!(await exited(chrome, 5000))) {
      chrome.kill('SIGTERM');
      if (!(await exited(chrome, 3000))) { chrome.kill('SIGKILL'); await exited(chrome, 2000); }
    }
  }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* left for the next launch's sweep */ }
}

// Interrupted (Ctrl-C, a kill, an uncaught error): close every Chrome cleanly and remove its profile, then exit.
let quitting = false;
const quit = (code) => async (err) => {
  if (quitting) return;
  quitting = true;
  if (err instanceof Error) console.error(err);
  await Promise.all([...live].map(close));
  process.exit(code);
};
process.once('SIGINT', quit(130));
process.once('SIGTERM', quit(143));
process.once('uncaughtException', quit(1));
process.once('unhandledRejection', quit(1));

/**
 * Removes profiles that earlier runs left behind (a crash, a power cut): a
 * folder is stale when its Chrome lock is missing or names a process that is
 * gone, and it is over a minute old (a brand-new folder may not have its lock
 * yet). Runs once per process, at the first launch.
 */
let swept = false;
function sweep() {
  if (swept) return;
  swept = true;
  const dir = tmpdir();
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(PREFIX)) continue;
    const path = join(dir, name);
    try {
      if (Date.now() - statSync(path).mtimeMs < 60_000) continue;
      let alive = false;
      try {
        // The lock is a symlink to "host-pid".
        const pid = Number(readlinkSync(join(path, 'SingletonLock')).split('-').pop());
        if (pid > 0) { process.kill(pid, 0); alive = true; }
      } catch { /* no lock, or its process is gone */ }
      if (!alive) rmSync(path, { recursive: true, force: true });
    } catch { /* gone already, or not ours to read */ }
  }
}

/**
 * Opens `url`, runs `steps` in order and returns what each `eval` step gave
 * back. Page errors are printed to stderr. Screenshots and profiles go to `out`.
 */
export async function drive(url, steps, { out = '.', size = '1280x800', dpr = 1, seed = process.env.SEED, settle = 9000, log = console.log, cpuThrottle = 1, menu = false, colorScheme, reducedMotion, diagnostics = false, touch = false } = {}) {
  if (!menu) { const gameUrl = new URL(url); gameUrl.searchParams.set('play', '1'); url = gameUrl.href; }
  const [w, h] = size.split('x').map(Number);
  const port = 9300 + Math.floor(Math.random() * 500);
  sweep();
  const profile = mkdtempSync(join(tmpdir(), PREFIX));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  const run = { chrome, port, profile };
  live.add(run);
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
    ws.addEventListener('close', () => {
      for (const resolve of waiting.values()) resolve({ error: { message: 'Chrome debugging connection closed' } });
      waiting.clear();
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id;
      waiting.set(n, message => message.error ? reject(new Error(message.error.message)) : resolve(message));
      try { ws.send(JSON.stringify({ id: n, method, params })); }
      catch (error) { waiting.delete(n); reject(error); }
    });
    await send('Runtime.enable');
    await send('Page.enable');
    if (!menu) await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('hrp-tutorials-hidden', JSON.stringify(['welcome','guides']))}catch{}" });
    if (diagnostics) await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason)));` });
    if (colorScheme || reducedMotion !== undefined) await send('Emulation.setEmulatedMedia', { features: [...(colorScheme ? [{name:'prefers-color-scheme',value:colorScheme}] : []), ...(reducedMotion !== undefined ? [{name:'prefers-reduced-motion',value:reducedMotion ? 'reduce' : 'no-preference'}] : [])] });
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 768 });
    if (touch) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    // A weak phone's CPU: every task runs this many times slower (the GPU is not throttled).
    if (cpuThrottle > 1) await send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    if (seed !== undefined) await send('Page.addScriptToEvaluateOnNewDocument', { source: seeded(seed) });
    await send('Page.navigate', { url });
    await sleep(settle);
    for (const s of steps) {
      // Device input and display-mode emulation for the UI regression checks.
      if (s.cdp) {
        const r = await send(s.cdp, s.params ?? {});
        if (r.error) throw new Error(`${s.cdp}: ${r.error.message}`);
      }
      if (s.wait) await sleep(s.wait);
      if (s.ready) {
        const deadline = Date.now() + 120000;
        let ready = false;
        while (!ready && Date.now() < deadline) {
          const state = await send('Runtime.evaluate', { expression: "!!window.__sandbox && !document.getElementById('loading')", returnByValue: true });
          ready = state.result?.result?.value === true;
          if (!ready) await sleep(200);
        }
        if (!ready) {
          const state = await send('Runtime.evaluate', { expression: "JSON.stringify({url:location.href,text:document.body?.innerText.slice(0,900),resources:performance.getEntriesByType('resource').slice(-4).map(r=>r.name)})", returnByValue: true });
          throw new Error('Game did not become ready within 120 seconds: ' + state.result?.result?.value);
        }
      }
      if (s.eval) {
        const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true, userGesture: !!s.userGesture });
        if (r.error) throw new Error(r.error.message);
        const exception = r.result?.exceptionDetails;
        if (exception) throw new Error(exception.exception?.description ?? exception.text);
        results.push(r.result?.result?.value ?? null);
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
      if (s.heapProfile) {
        // Sampling allocation profile: what the page allocates over `heapProfile` ms (garbage included).
        await send('HeapProfiler.enable');
        await send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
        await sleep(s.heapProfile);
        const r = await send('HeapProfiler.stopSampling');
        writeFileSync(join(out, 'heap-profile.json'), JSON.stringify(r.result.profile));
        log('heap profile saved');
      }
      if (s.shot) {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(out, s.shot), Buffer.from(r.result.data, 'base64'));
        log('shot', s.shot);
      }
    }
    ws.close();
  } finally {
    // Chrome writes its profile while it shuts down: close it, wait for it to exit, then remove the folder.
    if (!quitting) await close(run);
  }
  return results;
}

/**
 * Steps that skip the tutorial boxes on a fresh profile: tick "Don't show
 * again" for the welcome and the red-meter guides (the key and ids of
 * src/ui/tutorials.ts), then reload once. A box left open pauses the game.
 */
export const SKIP_WELCOME = [{ eval: "localStorage.setItem('hrp-tutorials-hidden', JSON.stringify(['welcome', 'guides'])); document.querySelectorAll('dialog[open]').forEach(d=>d.close()); 1" }, { wait: 12000, ready: true }];

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
