import { BufferAttribute, CircleGeometry, Color, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, type Object3D } from 'three';
import type { Random } from '../sim/random';

/**
 * Puddles that mirror the sky and the nearest street lamp. No second render
 * pass: each puddle knows its lamp (a vertex attribute), and the shader finds
 * where that lamp's mirror image lands for the current view, drawn as a soft
 * streak stretched towards the viewer, as on a wet street. One material for
 * all of them, so they merge into a single draw call; a few multiplies per
 * pixel, cheap enough for weak phones.
 */
const uniforms = UniformsUtils.merge([
  UniformsLib.fog,
  {
    uView: { value: new Vector3(-0.577, -0.577, -0.577) },
    uSky: { value: new Color(0x1c2230) },
    uRim: { value: new Color(0x3a4458) },
    uLamp: { value: new Color(0, 0, 0) },
    uTime: { value: 0 },
    uWet: { value: 0.7 },
    /** Daylight dries the puddles down: 0 at night, 1 in full day. */
    uDry: { value: 0 },
  },
]);

const material = new ShaderMaterial({
  uniforms,
  fog: true,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  vertexShader: /* glsl */ `
    #include <common>
    #include <fog_pars_vertex>
    attribute vec4 puddle;
    varying vec2 vLocal;
    varying vec3 vWorld;
    varying vec4 vPuddle;
    void main() {
      vLocal = uv * 2.0 - 1.0;
      vPuddle = puddle;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    #include <common>
    #include <fog_pars_fragment>
    uniform vec3 uView;
    uniform vec3 uSky;
    uniform vec3 uRim;
    uniform vec3 uLamp;
    uniform float uTime;
    uniform float uWet;
    uniform float uDry;
    varying vec2 vLocal;
    varying vec3 vWorld;
    varying vec4 vPuddle;
    void main() {
      // A ragged edge, different for each puddle; by day each dries down to a third or two thirds of its size.
      float s = vPuddle.w * 6.2832;
      float a = atan(vLocal.y, vLocal.x);
      float size = mix(1.0, 0.3 + 0.4 * vPuddle.w, uDry);
      float edge = (0.86 + 0.08 * sin(a * 3.0 + s) + 0.05 * sin(a * 5.0 + s * 1.7)) * size;
      float r = length(vLocal);
      float mask = 1.0 - smoothstep(edge - 0.14 * size, edge, r);
      if (mask <= 0.0) discard;
      // Faint ripples: two slow crossing waves.
      float rip = sin(dot(vWorld.xz, vec2(5.3, 3.7)) + uTime * 1.3) * sin(dot(vWorld.xz, vec2(-2.9, 6.1)) - uTime * 0.9);
      // The sky, catching a little more light towards the edge.
      vec3 col = mix(uSky, uRim, smoothstep(0.2, edge, r) * 0.6) * (1.0 + 0.07 * rip);
      // The lamp's mirror image: follow the view ray below the surface to the lamp's depth.
      float glow = 0.0;
      if (vPuddle.y > 0.0) {
        float h = vPuddle.y - vWorld.y;
        vec2 q = vWorld.xz + uView.xz * (h / max(-uView.y, 0.2)) - vPuddle.xz;
        vec2 dir = normalize(uView.xz + vec2(1e-4));
        float along = dot(q, dir);
        float across = dot(q, vec2(-dir.y, dir.x));
        glow = exp(-(across * across / 0.06 + along * along / 1.1)) * (1.0 + 0.3 * rip);
      }
      gl_FragColor = vec4(col + uLamp * glow, mask * clamp(uWet + glow * 0.5, 0.0, 1.0));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `,
});

const baseGeo = new CircleGeometry(1, 20).rotateX(-Math.PI / 2);

/**
 * River water, sharing the puddles' sky, view and time: deeper in the middle,
 * paler by the stone banks, ripples drifting downstream (towards +z), the sky
 * catching more at a glancing angle, and the promenade lamps (a row at
 * `lampX`, every `step` metres from `z0`, `height` up) shimmering as streaks
 * after dark. The mesh's uv runs across (x, 0 to 1) and along (y) the river.
 */
export function riverMaterial(lampX: number, z0: number, step: number, height: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...UniformsUtils.clone(UniformsLib.fog),
      uView: material.uniforms.uView,
      uSky: material.uniforms.uSky,
      uRim: material.uniforms.uRim,
      uLamp: material.uniforms.uLamp,
      uTime: material.uniforms.uTime,
      uLamps: { value: new Vector3(lampX, z0, step) },
      uLampH: { value: height },
    },
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uView;
      uniform vec3 uSky;
      uniform vec3 uRim;
      uniform vec3 uLamp;
      uniform float uTime;
      uniform vec3 uLamps;
      uniform float uLampH;
      varying vec2 vUv;
      varying vec3 vWorld;
      // A sin-free hash: stays random at large world coordinates on phone GPUs.
      float hash(vec2 q) {
        vec3 h = fract(vec3(q.xyx) * 0.1031);
        h += dot(h, h.yzx + 33.33);
        return fract((h.x + h.y) * h.z);
      }
      float vnoise(vec2 q) {
        vec2 i = floor(q), u = fract(q);
        u = u * u * (3.0 - 2.0 * u);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        // Ripples: crossing waves of a few sizes, the whole pattern drifting downstream.
        float w = sin(p.x * 1.7 + p.y * 0.6 - t * 1.4) * 0.5
                + sin(p.x * -0.9 + p.y * 1.3 - t * 1.9) * 0.35
                + sin(p.x * 3.1 - p.y * 2.3 - t * 2.6) * 0.2
                + sin(p.y * 0.35 - t * 0.8) * 0.4;
        // Deep in the middle, shallower and paler by the banks.
        float edge = min(vUv.x, 1.0 - vUv.x);
        // Linear colours: these come out about three times brighter on screen.
        vec3 deep = mix(vec3(0.006, 0.016, 0.022), vec3(0.012, 0.03, 0.036), smoothstep(0.0, 0.25, 0.5 - edge));
        vec3 shallow = vec3(0.022, 0.042, 0.046);
        vec3 col = mix(shallow, deep, smoothstep(0.0, 0.18, edge));
        // Ripples for the sky's image: smooth random noise, stretched along the flow and drifting
        // downstream, so a bright day sky shows no repeating pattern. Two octaves, cheap on phones.
        vec2 r = vec2(p.x * 1.6, p.y * 0.55 - t * 0.35);
        float f = vnoise(r) * 0.65 + vnoise(r * 2.3 + vec2(5.2, -t * 0.4)) * 0.35;
        f = f * 2.0 - 1.0;
        // The sky in the surface, more of it at a glancing angle and where the ripples tilt towards the viewer.
        float sheen = 0.35 + 0.25 * (1.0 - clamp(-uView.y, 0.0, 1.0)) + 0.08 * f;
        col = mix(col, mix(uSky, uRim, 0.5 + 0.3 * f) * 0.6, clamp(sheen, 0.0, 0.8) * 0.4);
        // Lamp images: follow the view ray down to the lamps' depth, then find the nearest lamp in the row.
        float h = uLampH - vWorld.y;
        vec2 q = p + uView.xz * (h / max(-uView.y, 0.2));
        float k = floor((q.y - uLamps.y) / uLamps.z + 0.5);
        vec2 d = q - vec2(uLamps.x, uLamps.y + k * uLamps.z);
        vec2 dir = normalize(uView.xz + vec2(1e-4));
        float along = dot(d, dir);
        float across = dot(d, vec2(-dir.y, dir.x)) + 0.25 * w;
        float glow = exp(-(across * across / 0.12 + along * along / 6.0)) * (0.75 + 0.35 * w);
        col += uLamp * glow * 0.9;
        // A pale line where the water laps the stone.
        col += vec3(0.04, 0.05, 0.05) * (1.0 - smoothstep(0.0, 0.012, edge)) * (0.6 + 0.4 * sin(p.y * 2.0 - t * 2.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

/** A lamp head a puddle can mirror, in world coordinates. */
export interface LampHead { x: number; y: number; z: number }

/**
 * Adds a puddle at (x, y, z) mirroring `lamp` when given. The parent must sit
 * at the world origin: the lamp position is stored as is.
 */
export function addPuddle(parent: Object3D, x: number, z: number, y: number, random: Random, lamp?: LampHead | null): void {
  const geo = baseGeo.clone();
  const n = geo.attributes.position.count;
  const data = new Float32Array(n * 4);
  const seed = random();
  for (let i = 0; i < n; i++) data.set(lamp ? [lamp.x, lamp.y, lamp.z, seed] : [0, -1, 0, seed], i * 4);
  geo.setAttribute('puddle', new BufferAttribute(data, 4));
  const m = new Mesh(geo, material);
  m.scale.set(0.5 + random() * 1.2, 1, 0.3 + random() * 0.7);
  m.rotation.y = random() * Math.PI;
  m.position.set(x, y + 0.006, z);
  m.renderOrder = 1;
  parent.add(m);
}

/** The nearest of `lamps` within `reach` metres (on the ground), or null. */
export function nearestLamp(lamps: readonly LampHead[], x: number, z: number, reach = 9): LampHead | null {
  let best: LampHead | null = null;
  let d = reach * reach;
  for (const l of lamps) {
    const e = (l.x - x) ** 2 + (l.z - z) ** 2;
    if (e < d) { d = e; best = l; }
  }
  return best;
}

const SKY_DAY = new Color(0x8c9cb0);
const RIM_DAY = new Color(0xc4d0dc);
const SKY_DUSK = new Color(0x3c3846);
const RIM_DUSK = new Color(0x6e6a7a);
const SKY_NIGHT = new Color(0x121826);
const RIM_NIGHT = new Color(0x2a3448);
const LAMP = new Color(1.0, 0.72, 0.38);

/** Sky and lamp light by time of day: lamps mirror only after dark. */
export function setPuddleLight(night: number, day: number): void {
  const u = material.uniforms;
  (u.uSky.value as Color).copy(SKY_DUSK).lerp(SKY_NIGHT, night).lerp(SKY_DAY, day);
  (u.uRim.value as Color).copy(RIM_DUSK).lerp(RIM_NIGHT, night).lerp(RIM_DAY, day);
  (u.uLamp.value as Color).copy(LAMP).multiplyScalar(1.5 * (1 - day) * (0.4 + 0.6 * night));
  u.uWet.value = 0.55 + 0.2 * night;
  u.uDry.value = day;
}

/** The camera's forward direction, so the lamp images move as the view turns. */
export function setPuddleView(forward: Vector3): void {
  (material.uniforms.uView.value as Vector3).copy(forward);
}

/** Ripple time; leave it unchanged to hold the water still (reduced motion). */
export function tickPuddles(dt: number): void {
  material.uniforms.uTime.value += dt;
}
