import { Color, MeshLambertMaterial, MeshPhongMaterial, type Material, type WebGLProgramParametersWithUniforms } from 'three';

/**
 * Weathered surfaces without textures or UVs. Every scene material gets the
 * same small shader patch that varies its colour by world position: large
 * mottled patches with a slight warm/cool drift, vertical rain streaks and
 * grime at the foot of walls, and speckle on ground and roofs. One program
 * cache key for all of them, so no extra shader compiles per colour.
 */
/** Settled snow, 0 to 1, shared by every painted surface; set by the season. */
export const SNOW = { value: 0 };

function paintSurface(shader: WebGLProgramParametersWithUniforms, moving = false): void {
  shader.uniforms.uSnow = SNOW;
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      /* glsl */ `#include <common>
      varying vec3 vPaintPos;
      varying vec3 vPaintN;
      float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float bNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(bHash(i), bHash(i + vec2(1, 0)), u.x), mix(bHash(i + vec2(0, 1)), bHash(i + vec2(1, 1)), u.x), u.y);
      }
      // Nothing in this city is ruler-straight. A smooth, small world-space
      // field nudges every surface; being continuous in space, a window and the
      // wall behind it move together. Ground height stays put.
      vec3 bend(vec3 w) {
        // Kept to a hint: buildings stand plumb, edges are only not ruler-straight,
        // and roof edges sag a touch. Imperfection comes from wear and detail,
        // not from distorting the structure.
        float up = smoothstep(0.25, 1.6, w.y);
        float h = max(w.y, 0.0);
        vec2 lean = vec2(bNoise(w.xz * 0.06) - 0.5, bNoise(w.xz * 0.06 + 17.3) - 0.5) * h * 0.008;
        vec3 wobble = vec3(
          bNoise(w.zy * 0.45 + 3.1) - 0.5,
          bNoise(w.xz * 0.35 + 7.7) - 0.5,
          bNoise(w.xy * 0.45 + 11.9) - 0.5
        ) * vec3(0.035, 0.05, 0.035);
        vec2 ground = vec2(bNoise(w.xz * 0.3 + 31.0) - 0.5, bNoise(w.xz * 0.3 + 47.0) - 0.5) * 0.06;
        return vec3(lean.x, 0.0, lean.y) * up + wobble * up + vec3(ground.x, 0.0, ground.y);
      }`,
    )
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      vPaintN = normalize(mat3(modelMatrix) * objectNormal);
      ${moving
        // Moving things (cars) take their wear and dents from their own
        // space, so the shape holds and grime does not slide as they drive.
        ? 'vPaintPos = transformed * 1.7 + vec3(3.1, 0.0, 7.3); transformed += bend(transformed + vec3(0.0, 1.6, 0.0)) * 0.22;'
        // Scene geometry is merged in world space (or only translated), so the
        // world-space offset applies to the local position as is.
        : 'vPaintPos = (modelMatrix * vec4(transformed, 1.0)).xyz; transformed += bend(vPaintPos);'}`,
    );
  shader.fragmentShader = (moving ? shader.fragmentShader.replace('void main() {', '#define MOVING\nvoid main() {') : shader.fragmentShader)
    .replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `#include <emissivemap_fragment>
      if (uSnow > 0.0 && dot(totalEmissiveRadiance, vec3(1.0)) < 0.001) {
        // Snow settles on what faces up: roofs, ledges, kerbs, car roofs. On
        // the street it is trodden into grey slush.
        float up = smoothstep(0.55, 0.9, vPaintN.y);
        float drifts = smoothstep(0.3, 0.62, pFbm(vPaintPos.xz * 0.55) + uSnow * 0.3);
        float street = 1.0 - smoothstep(0.06, 0.3, vPaintPos.y);
        float cover = up * drifts * uSnow * mix(1.0, 0.5, street);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.8, 0.82, 0.86), vec3(0.46, 0.46, 0.48), street), cover);
      }`,
    )
    .replace(
      '#include <common>',
      /* glsl */ `#include <common>
      varying vec3 vPaintPos;
      varying vec3 vPaintN;
      uniform float uSnow;
      float pHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float pNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(pHash(i), pHash(i + vec2(1, 0)), u.x), mix(pHash(i + vec2(0, 1)), pHash(i + vec2(1, 1)), u.x), u.y);
      }
      float pFbm(vec2 p) { return 0.55 * pNoise(p) + 0.3 * pNoise(p * 2.1 + 7.3) + 0.15 * pNoise(p * 4.3 + 3.1); }`,
    )
    .replace(
      '#include <color_fragment>',
      /* glsl */ `#include <color_fragment>
      {
        vec3 n = abs(vPaintN);
        bool wall = n.y < 0.5;
        // Pick the plane the surface mostly faces, so patterns sit on it.
        vec2 q = wall ? (n.x > n.z ? vPaintPos.zy : vPaintPos.xy) : vPaintPos.xz;
        float mottle = pFbm(q * 0.45) - 0.5;
        vec3 col = diffuseColor.rgb;
        vec3 base = col;
        float lum = dot(base, vec3(0.299, 0.587, 0.114));
        // Surface detail fades out where it would be finer than a pixel, so it
        // never shimmers when zoomed out or on a headset.
        float px = max(fwidth(q.x), fwidth(q.y));
        float detail = 1.0 - smoothstep(0.035, 0.11, px);
        #ifdef MOVING
        // Brick, plaster and paving patterns belong to buildings and streets.
        detail = 0.0;
        #endif
        col *= 1.0 + mottle * 0.32;
        col += vec3(0.02, 0.008, -0.012) * mottle * 2.0;
        bool emissive = dot(totalEmissiveRadiance, vec3(1.0)) > 0.001;
        if (wall) {
          float streak = pNoise(vec2(q.x * 3.2, q.y * 0.35)) - 0.5;
          col *= 1.0 + streak * 0.14;
          // Grime collects at the foot of walls.
          col *= mix(0.72, 1.0, smoothstep(0.1, 1.4, vPaintPos.y));
          if (!emissive && vPaintPos.y > 0.3 && detail > 0.0) {
            if (base.r > base.g * 1.6 && base.r > 0.05) {
              // Brick: staggered courses with mortar lines and the odd spalled brick.
              float row = floor(q.y / 0.16);
              float x = q.x / 0.34 + mod(row, 2.0) * 0.5;
              float mortar = max(smoothstep(0.0, 0.02, abs(fract(q.y / 0.16) - 0.5) - 0.42), smoothstep(0.0, 0.02, abs(fract(x) - 0.5) - 0.45));
              float brick = pHash(vec2(floor(x), row));
              col *= mix(1.0, (0.86 + 0.24 * brick) * (1.0 - 0.32 * mortar), detail);
            } else {
              // Plaster: hairline cracks in places, patched render, darker drips.
              float crackZone = step(pNoise(q * 0.35 + 9.0), 0.38);
              // Thin and broken: a hairline that comes and goes, not a drawn line.
              float crack = (1.0 - smoothstep(0.0, 0.01, abs(pNoise(q * 2.3 + 3.0) - 0.5))) * step(0.45, pNoise(q * 4.0 + 1.0));
              float patchy = step(0.72, pNoise(floor(q * 0.9) + 5.0));
              col *= mix(1.0, (1.0 - 0.35 * crack * crackZone) * (1.0 - 0.08 * patchy), detail);
            }
          }
        } else {
          // What the ground is, from its colour: grass is green, soil warm and dark,
          // asphalt dark and grey, everything else stone (paving, kerbs, concrete).
          float sat = max(base.r, max(base.g, base.b)) - min(base.r, min(base.g, base.b));
          bool grass = base.g > base.r * 1.08 && base.g > base.b * 1.12;
          bool soil = !grass && lum < 0.06 && base.r > base.b * 1.15;
          bool asphalt = !grass && !soil && lum < 0.06;
          #ifdef MOVING
          // Cars are not ground, whatever their paint.
          grass = false; soil = false; asphalt = false;
          #endif
          if (!emissive && vPaintPos.y > 2.0) {
            col *= 1.0 + (pNoise(q * 6.0) - 0.5) * 0.12;
            if (detail > 0.0) {
              // Roofs: tar-paper seams, patches and dark rain stains.
              float seam = smoothstep(0.0, 0.02, abs(fract(q.x / 1.0) - 0.5) - 0.47);
              float patchy = step(0.7, pNoise(floor(q * 0.6) + 2.0));
              float stain = smoothstep(0.55, 0.8, pFbm(q * 0.25 + 13.0));
              col *= mix(1.0, (1.0 - 0.22 * seam) * (1.0 - 0.12 * patchy) * (1.0 - 0.3 * stain), detail);
            }
          } else if (!emissive && grass) {
            // Grass: broad lush and dry patches that read from any distance,
            // darker clumps, bare worn spots, and blades and the odd small
            // flower close up.
            float dry = smoothstep(0.35, 0.75, pFbm(q * 0.12 + 21.0));
            col = mix(col * vec3(0.92, 1.08, 0.9), col * vec3(1.35, 1.18, 0.62), dry);
            float clump = pFbm(q * 1.1 + 5.0);
            col *= 0.78 + 0.4 * clump;
            float bare = smoothstep(0.7, 0.82, pFbm(q * 0.35 + 40.0));
            col = mix(col, vec3(0.05, 0.04, 0.03), bare * 0.7);
            float blades = pNoise(vec2(q.x * 26.0 + pNoise(q * 3.0) * 4.0, q.y * 7.0));
            float speck = pNoise(q * 44.0);
            col *= mix(1.0, (0.82 + 0.3 * blades) * (0.9 + 0.2 * speck), detail);
            vec2 fc = floor(q * 5.0);
            float flower = step(0.985, pHash(fc + 3.0)) * (1.0 - smoothstep(0.08, 0.16, length(fract(q * 5.0) - 0.5))) * (1.0 - bare);
            col = mix(col, pHash(fc) < 0.5 ? vec3(0.3, 0.29, 0.25) : vec3(0.32, 0.25, 0.04), flower * detail * 0.8);
          } else if (!emissive && soil) {
            // Soil: grit, small stones and darker damp patches.
            col *= 0.8 + 0.4 * pFbm(q * 0.8 + 2.0);
            float stone = step(0.9, pHash(floor(q * 14.0))) * (1.0 - smoothstep(0.2, 0.42, length(fract(q * 14.0) - 0.5)));
            col = mix(col, col * 1.9 + 0.01, stone * detail);
            col *= mix(1.0, 0.86 + 0.28 * pNoise(q * 38.0), detail);
          } else if (!emissive && asphalt) {
            // Asphalt: aggregate speckle, crack networks, outlined patch
            // repairs and oil stains; worn lighter where traffic runs.
            col *= 1.0 + (pNoise(q * 6.0) - 0.5) * 0.12;
            float worn = pFbm(q * 0.2 + 7.0);
            col *= 0.9 + 0.22 * worn;
            float grit = pNoise(q * 70.0);
            col *= mix(1.0, 0.8 + 0.42 * grit * grit, detail);
            float net = abs(pFbm(q * 0.7 + 1.0) - 0.5);
            float crack = (1.0 - smoothstep(0.0, 0.018, net)) * step(0.45, pNoise(q * 0.25 + 4.0));
            vec2 cell = floor(q * 0.33);
            float repair = step(0.8, pHash(cell + 8.0));
            vec2 inCell = abs(fract(q * 0.33) - 0.5);
            float edge = repair * smoothstep(0.38, 0.4, max(inCell.x, inCell.y)) * (1.0 - smoothstep(0.42, 0.44, max(inCell.x, inCell.y)));
            float oil = smoothstep(0.62, 0.8, pFbm(q * 0.55 + 31.0)) * step(0.6, pNoise(q * 0.1 + 2.0));
            col *= mix(1.0, (1.0 - 0.5 * crack) * (1.0 - 0.14 * repair) * (1.0 - 0.35 * edge), detail);
            col *= 1.0 - 0.35 * oil;
          } else {
            col *= 1.0 + (pNoise(q * 6.0) - 0.5) * 0.12;
            if (!emissive && detail > 0.0) {
              // Paving: slabs in a running bond, each a slightly different
              // tone, worn at the edges, moss and grime in the joints, the odd
              // cracked slab.
              vec2 g = q / vec2(0.9, 0.6);
              g.x += mod(floor(g.y), 2.0) * 0.5;
              vec2 id = floor(g);
              vec2 f = abs(fract(g) - 0.5);
              float joint = smoothstep(0.0, 0.03, max(f.x, f.y) - 0.455);
              float tone = 0.86 + 0.24 * pHash(id + 11.0);
              float edgeWear = smoothstep(0.32, 0.46, max(f.x, f.y));
              vec3 moss = vec3(0.6, 0.85, 0.45);
              vec3 slab = col * tone * (1.0 - 0.1 * edgeWear) * (0.92 + 0.16 * pNoise(q * 9.0));
              vec3 jointCol = col * mix(vec3(0.45), moss * 0.55, step(0.5, pNoise(q * 1.5 + 6.0)));
              float cracked = step(0.9, pHash(id + 2.0)) * (1.0 - smoothstep(0.0, 0.03, abs(fract(g.x + g.y * 0.6) - 0.5)));
              vec3 paved = mix(slab, jointCol, joint) * (1.0 - 0.35 * cracked);
              col = mix(col, paved, detail);
            }
          }
        }
        diffuseColor.rgb = max(col, vec3(0.0));
      }`,
    );
}

function painted<T extends MeshLambertMaterial>(m: T): T {
  m.onBeforeCompile = (shader) => paintSurface(shader);
  m.customProgramCacheKey = () => 'painted-surface';
  return m;
}

const shared = new Map<number, MeshLambertMaterial>();
const plain = new WeakSet<Material>();

/** Shared material for a palette colour, with painted surface variation. Never mutate the result. */
export function mat(color: number): MeshLambertMaterial {
  let m = shared.get(color);
  if (!m) {
    m = painted(new MeshLambertMaterial({ color, flatShading: true }));
    shared.set(color, m);
    plain.add(m);
  }
  return m;
}

/** True for the plain palette materials from `mat`: same shader, only the colour differs. */
export function isPlain(m: Material): m is MeshLambertMaterial {
  return plain.has(m);
}

let vertexPainted: MeshLambertMaterial | null = null;
/**
 * One material for every plain colour at once: the colour rides on the
 * vertices, so static meshes of many colours merge into a single draw call.
 */
export function vertexColourMat(): MeshLambertMaterial {
  return (vertexPainted ??= painted(new MeshLambertMaterial({ vertexColors: true, flatShading: true })));
}

/**
 * Emissive material owned by one light group (a building's windows, a sign).
 * Callers animate `emissiveIntensity` instead of swapping materials, so the
 * shader programs and light counts never change at runtime.
 */
export function glowMat(color: number, emissive: number, intensity = 1): MeshLambertMaterial {
  return painted(new MeshLambertMaterial({
    color,
    emissive: new Color(emissive),
    emissiveIntensity: intensity,
    flatShading: true,
  }));
}

const softShared = new Map<number, MeshLambertMaterial>();

/** Smooth-shaded variant for rounded natural shapes (foliage), with the same weathering. */
export function softMat(color: number): MeshLambertMaterial {
  let m = softShared.get(color);
  if (!m) {
    m = painted(new MeshLambertMaterial({ color }));
    softShared.set(color, m);
  }
  return m;
}

const vehicleShared = new Map<string, MeshPhongMaterial>();

/**
 * Material for things that move (cars): the same wear, computed in the
 * object's own space. `gloss` 0 is rubber and trim, 1 is paint, 2 is glass;
 * a soft highlight is what lets a curved body read as a car at this scale.
 */
export function vehicleMat(color: number, gloss: 0 | 1 | 2 = 1): MeshPhongMaterial {
  const key = `${color}:${gloss}`;
  let m = vehicleShared.get(key);
  if (!m) {
    m = new MeshPhongMaterial({
      color,
      specular: [0x050505, 0x2a2a2a, 0x6a6a6a][gloss],
      shininess: [4, 38, 110][gloss],
    });
    m.onBeforeCompile = (shader) => paintSurface(shader, true);
    m.customProgramCacheKey = () => 'painted-vehicle';
    vehicleShared.set(key, m);
  }
  return m;
}
