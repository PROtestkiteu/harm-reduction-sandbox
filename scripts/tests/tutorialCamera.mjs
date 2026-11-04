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
const { Vector3, Scene } = await import('three');
const { CameraRig } = await import('../../src/render/cameraRig.ts');
const { createIsoCamera, frameCamera } = await import('../../src/render/camera.ts');
const { TutorialArea } = await import('../../src/world/tutorialArea.ts');
const { TutorialProgress } = await import('../../src/game/tutorial.ts');
const { cameraArea } = await import('../../src/ui/cameraArea.ts');
const rig = new CameraRig(new Vector3(-10, 0, 75), 66);
const world = { scene: new Scene(), setTutorialActivity() {} };
const area = new TutorialArea(world, rig, TutorialProgress.restore({ version: 1, stage: 'meet' }).capabilities);
for (const stage of ['meet', 'patrol', 'outreach', 'dropIn', 'nightlife']) {
  area.set(TutorialProgress.restore({ version: 1, stage }).capabilities);
  const home = area.frame.getCenter(new Vector3());
  rig.lookAt(home, 1); rig.step(0, true);
  rig.pan(80, -80, true); rig.step(0, true);
  assert(Math.abs(rig.focus.x - home.x - 80) < .001, stage + ': horizontal pan clamped to lesson');
  assert(Math.abs(rig.focus.z - home.z + 80) < .001, stage + ': vertical pan clamped to lesson');
}
for (const [width, height, panels] of [
  [393, 852, [{left:16,top:14,right:145,bottom:64},{left:155,top:10,right:383,bottom:50},{left:10,top:98,right:350,bottom:248},{left:10,top:727,right:383,bottom:842}]],
  [768, 1024, [{left:16,top:14,right:360,bottom:64},{left:464,top:12,right:756,bottom:268},{left:20,top:88,right:360,bottom:255}]],
  [852, 393, [{left:16,top:10,right:260,bottom:64},{left:550,top:12,right:840,bottom:300},{left:12,top:88,right:352,bottom:198}]],
]) {
  const insets = cameraArea({left:0,top:0,right:width,bottom:height}, width, height, panels);
  const camera = createIsoCamera();
  const focus = area.frame.getCenter(new Vector3());
  frameCamera(camera, area.frame, {cssW:width,cssH:height,dpr:1,factor:1,lowW:width,lowH:height}, insets, 1, undefined, focus);
  const p = focus.clone().project(camera);
  const x = (p.x + 1) * width / 2, y = (1 - p.y) * height / 2;
  assert(panels.every(r => !(x > r.left && x < r.right && y > r.top && y < r.bottom)), width + ': focus behind UI');
  assert(width-insets.left-insets.right >= 300 || height-insets.top-insets.bottom >= 250, width + ': usable map squeezed');
}
console.log('Tutorial camera freedom and unobstructed phone, landscape and tablet framing: passed');
