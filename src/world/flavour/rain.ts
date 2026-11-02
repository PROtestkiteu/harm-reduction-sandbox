import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WeatherMood } from '../../config/flavour/packs';
import { FOG, FOG_CHANCE, FOG_HOURS, RAIN, RAIN_CHANCE } from '../../config/flavour/weather';
import type { Pack, PackDeps } from './index';

/**
 * Rain and ground fog. The rain is one mesh of thin streaks animated wholly on
 * the GPU: each frame only a time and the view's middle change. Streets get
 * wetter while it rains (the image pipeline's own wetness, so the existing
 * puddle and reflection work does the rest). The fog is a few soft layers near
 * the ground, one mesh, drifting. In the automatic mood each evening rolls its
 * weather from the season's chances; snow nights stay dry.
 */
const RAIN_VERTEX = /* glsl */ `
  attribute vec3 seed;
  attribute float corner;
  uniform float uTime;
  uniform vec2 uCenter;
  uniform vec3 uRight;
  uniform float uReach;
  uniform float uHeight;
  uniform float uFall;
  uniform float uAmount;
  uniform float uWidth;
  varying float vFade;
  void main() {
    float span = uReach * 2.0;
    // Each drop has a fixed place in a box that follows the view, wrapped so drops never pop.
    vec2 p = mod(seed.xy * span - uCenter + uReach, span) - uReach + uCenter;
    float y = uHeight - mod(seed.z * uHeight + uTime * uFall * (0.85 + seed.x * 0.3), uHeight);
    float len = 0.9;
    float side = mod(corner, 2.0) - 0.5;
    float top = step(1.5, corner);
    vec3 world = vec3(p.x, y + top * len, p.y) + uRight * side * uWidth;
    // Fewer drops in light rain: the ones past the amount sink below ground.
    if (fract(seed.x * 7.13 + seed.z * 3.71) > uAmount) world.y -= 1000.0;
    vFade = smoothstep(0.0, 2.0, y) * (0.35 + 0.65 * top);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;
const RAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(uColour, 0.5 * vFade);
  }
`;

function fogTexture(): CanvasTexture {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  // Soft blobs, tiled: a cloud that wraps at the edges.
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = 14 + rnd() * 30;
    for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) {
      const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function buildWeather({ scene, random, camera, setWetness, pool }: PackDeps): Pack {
  // Rain: four corners a drop.
  const n = RAIN.drops;
  const seeds = new Float32Array(n * 4 * 3);
  const corners = new Float32Array(n * 4);
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = random();
    const b = random();
    const c = random();
    for (let k = 0; k < 4; k++) {
      seeds.set([a, b, c], (i * 4 + k) * 3);
      corners[i * 4 + k] = k;
    }
    const o = i * 4;
    index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 4 * 3), 3));
  geo.setAttribute('seed', new BufferAttribute(seeds, 3));
  geo.setAttribute('corner', new BufferAttribute(corners, 1));
  geo.setIndex(index);
  const u = {
    uTime: { value: 0 },
    uCenter: { value: new Vector2() },
    uRight: { value: new Vector3(1, 0, 0) },
    uReach: { value: RAIN.reach },
    uHeight: { value: RAIN.height },
    uFall: { value: RAIN.fall },
    uAmount: { value: 0 },
    uWidth: { value: 0.04 },
    uColour: { value: new Color(0xb8c4d0) },
  };
  const rain = new Mesh(geo, new ShaderMaterial({ uniforms: u, vertexShader: RAIN_VERTEX, fragmentShader: RAIN_FRAGMENT, transparent: true, depthWrite: false, side: DoubleSide }));
  rain.frustumCulled = false;
  rain.renderOrder = 3;
  rain.raycast = () => {};
  rain.visible = false;
  scene.add(rain);

  // Fog: soft layers just above the ground, merged into one mesh.
  const tex = fogTexture();
  const layers = Array.from({ length: FOG.banks }, (_, i) => {
    const w = 30 + random() * 30;
    const p = new PlaneGeometry(w, w * (0.5 + random() * 0.4)).rotateX(-Math.PI / 2);
    p.translate((random() - 0.5) * FOG.reach * 2, 0.3 + (i % 4) * 0.35, (random() - 0.5) * FOG.reach * 2);
    const uv = p.getAttribute('uv') as BufferAttribute;
    const ox = random();
    const oy = random();
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 1.5 + ox, uv.getY(k) * 1.5 + oy);
    return p;
  });
  const fogDay = new Color(FOG.dayColour);
  const fogNight = new Color(FOG.nightColour);
  const fogMat = new MeshBasicMaterial({ map: tex, color: FOG.nightColour, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const fog = new Mesh(mergeGeometries(layers), fogMat);
  fog.renderOrder = 2;
  fog.raycast = () => {};
  fog.visible = false;
  scene.add(fog);

  let mood: WeatherMood = 'auto';
  let enabled = false;
  let rainAmount = 0;
  let fogAmount = 0;
  let lastClock = -1;
  let tonight = { rain: false, fog: false };
  const centre = new Vector2();
  const right = new Vector3();

  const roll = (season: keyof typeof RAIN_CHANCE) => {
    tonight = { rain: random() < RAIN_CHANCE[season], fog: random() < FOG_CHANCE[season] };
  };

  return {
    setMood(m) {
      mood = m;
    },
    setEnabled(on) {
      enabled = on;
      if (!on) {
        rain.visible = fog.visible = false;
        rainAmount = fogAmount = 0;
        setWetness(0);
      }
    },
    update(dt, ctx) {
      if (lastClock < 0 || ctx.clock < lastClock) roll(ctx.season);
      lastClock = ctx.clock;
      const fogHours = ctx.clock >= FOG_HOURS[0] && ctx.clock < FOG_HOURS[1];
      const wantRain = !ctx.snowy && (mood === 'rain' || mood === 'rainFog' || (mood === 'auto' && tonight.rain));
      const wantFog = mood === 'fog' || mood === 'rainFog' || (mood === 'auto' && tonight.fog && fogHours);
      // Weather comes and goes over several seconds.
      rainAmount = Math.min(1, Math.max(0, rainAmount + (wantRain ? dt : -dt) / 8));
      fogAmount = Math.min(1, Math.max(0, fogAmount + (wantFog ? dt : -dt) / 12));
      rain.visible = enabled && rainAmount > 0.01;
      fog.visible = enabled && fogAmount > 0.01;
      setWetness(RAIN.wetness * rainAmount);
      if (!rain.visible && !fog.visible) return;
      // Both follow the middle of the view, from what the camera looks at.
      camera.getWorldDirection(right);
      const dist = camera.position.y / Math.max(0.2, -right.y);
      centre.set(camera.position.x + right.x * dist, camera.position.z + right.z * dist);
      if (rain.visible) {
        if (!ctx.still) u.uTime.value += dt;
        u.uCenter.value.copy(centre);
        u.uRight.value.set(right.z, 0, -right.x).normalize();
        u.uAmount.value = rainAmount * 0.999;
        // A pixel wide at any zoom: thinner vanishes in the pixel image, wider reads as rods.
        u.uWidth.value = Math.max(0.03, pool.metresPerPixel * 0.6);
      }
      if (fog.visible) {
        fog.position.set(Math.round(centre.x / 20) * 20, 0, Math.round(centre.y / 20) * 20);
        if (!ctx.still) tex.offset.x += dt * FOG.drift * 0.004;
        fogMat.opacity = FOG.opacity * fogAmount;
        fogMat.color.copy(fogNight).lerp(fogDay, Math.max(ctx.day, 1 - ctx.night) * 0.8);
      }
    },
  };
}
