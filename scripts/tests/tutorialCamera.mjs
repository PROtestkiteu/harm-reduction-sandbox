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

const { viewportGeometry } = await import('../../src/ui/viewportGeometry.ts');
const metrics = { width:393, height:790, screenHeight:852, installed:true, visual:{left:0,top:0,width:393,height:790,scale:1}, safe:{top:62,right:0,bottom:34,left:0} };
assert.deepEqual(viewportGeometry(metrics), {sceneHeight:852,top:62,left:0,width:393,height:756});
assert.equal(viewportGeometry({...metrics,installed:false}).sceneHeight,790);
assert.equal(viewportGeometry({...metrics,height:852,visual:{...metrics.visual,height:852}}).sceneHeight,852, 'No double extension after WebKit settles');
assert.equal(viewportGeometry({...metrics,visual:{...metrics.visual,height:350}}).height,288, 'Keyboard still limits controls');
assert.deepEqual(viewportGeometry({...metrics,width:852,height:393,screenHeight:393,visual:{left:0,top:0,width:852,height:393,scale:1},safe:{top:0,left:62,right:62,bottom:21}}), {sceneHeight:393,top:0,left:62,width:728,height:372});
const full = {top:0,left:0,right:0,bottom:0};
const camera = createIsoCamera();
const frame = {cssW:852,cssH:393,dpr:1,factor:1,lowW:852,lowH:393};
const crowded = {top:198,left:12,right:310,bottom:21};
const a = frameCamera(camera, area.frame, frame, full, 3.2, undefined, rig.focus, null, full);
const b = frameCamera(camera, area.frame, frame, crowded, 3.2, undefined, rig.focus, null, full);
assert.equal(a.worldPerPixel,b.worldPerPixel,'Landscape panels cannot reduce close zoom');
const c = frameCamera(camera, area.frame, frame, crowded, 1, undefined, rig.focus, null, full);
assert(Math.abs(c.worldPerPixel/b.worldPerPixel-3.2)<.001,'Pinch/wheel zoom retains full magnification');
console.log('PWA full-height, keyboard, landscape safe bounds and panel-independent close zoom: passed');
