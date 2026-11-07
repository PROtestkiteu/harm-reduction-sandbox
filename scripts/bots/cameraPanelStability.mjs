import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { drive, SKIP_WELCOME } from './chrome.mjs';

mkdirSync('/tmp/hrs-camera-stability', { recursive: true });
const steps = [...SKIP_WELCOME];
for (const [width, height] of [[1440, 900], [393, 852], [852, 393]]) {
  steps.push(
    { cdp: 'Emulation.setDeviceMetricsOverride', params: { width, height, deviceScaleFactor: 1, mobile: width < 900 } },
    { eval: `window.__sandbox.sim.tutorial.state.stage='outreach';window.__sandbox.syncEvents();true` },
    { wait: 1800 },
    { eval: `window.cameraBefore=window.__sandbox.camera.projectionMatrix.toArray();true` },
  );
  for (const selector of ['.sandbox-toggle', '.sandbox-toggle', '.money-btn']) {
    steps.push(
      { eval: `document.querySelector(${JSON.stringify(selector)}).click();true` },
      { wait: 400 },
      { eval: `({control:${JSON.stringify(selector)},insets:window.__sandbox.hud.insets(),zoom:window.__sandbox.rig.zoom,size:[innerWidth,innerHeight],delta:Math.max(...window.__sandbox.camera.projectionMatrix.toArray().map((v,i)=>Math.abs(v-cameraBefore[i]))),errors:window.__qaErrors})` },
    );
  }
  steps.push(
    { cdp: 'Input.dispatchKeyEvent', params: { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 } },
    { wait: 400 },
    { eval: `({size:[innerWidth,innerHeight],delta:Math.max(...window.__sandbox.camera.projectionMatrix.toArray().map((v,i)=>Math.abs(v-cameraBefore[i]))),errors:window.__qaErrors})` },
    { shot: `camera-${width}.png` },
  );
}
const results = await drive(process.argv[2] ?? 'http://127.0.0.1:5217/?scenario=tutorial&packs=none&quality=low', steps,
  { size: '1440x900', diagnostics: true, out: '/tmp/hrs-camera-stability', log: () => {} });
console.log(JSON.stringify(results.filter(r => r?.delta !== undefined)));
for (const result of results.filter(r => r?.delta !== undefined)) {
  assert.equal(result.errors.length, 0);
  assert(result.delta < 1e-10, `Panel moved camera at ${result.size}: ${result.delta}`);
}
console.log('Camera stable across Settings and organisation open/close on desktop, portrait and landscape.');
