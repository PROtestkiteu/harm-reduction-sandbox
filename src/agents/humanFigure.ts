import {
  AnimationMixer,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  Matrix4,
  MeshToonMaterial,
  RedFormat,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Group,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PALETTE } from '../config/palette';
import type { Appearance, Pose } from './character';

/**
 * People built from sculpted CC0 base characters (Quaternius), dressed in
 * code. One skinned mesh and one draw call per person: body, eyes, brows and
 * hair are merged per (body, hairstyle, beard) variant and shared; each person
 * has their own skeleton, animation mixer and a small material whose
 * uniforms set their clothes, skin and hair. Clothes are painted by body
 * region, and clothed areas are smoothed and slightly inflated so they read
 * as fabric rather than muscle.
 */

type Sex = 'male' | 'female';
type HairStyle = 'Hair_Buns' | 'Hair_Buzzed' | 'Hair_BuzzedFemale' | 'Hair_Long' | 'Hair_SimpleParted' | 'none';

/** Body regions, stored per vertex. */
/** What each merged part is: the body (dressed per pixel in the shader), the eyes or hair. */
const REGION = { skin: 0, eyes: 7, hair: 8 } as const;

interface BodySource {
  scene: Group;
  body: SkinnedMesh;
  eyes?: SkinnedMesh;
  brows?: SkinnedMesh;
  height: number;
}

export interface PeopleLibrary {
  bodies: Record<Sex, BodySource>;
  hair: Map<string, SkinnedMesh>;
  clips: Map<string, AnimationClip>;
  textures: { body: Record<Sex, Texture>; eyes: Texture; hair: Texture };
}

let library: PeopleLibrary | null = null;

/** One white pixel: stands in for any texture that could not be loaded. */
const WHITE = (() => {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

/** The loaded library, or null while loading or if the assets could not be loaded. */
export function peopleLibrary(): PeopleLibrary | null {
  return library;
}

/** Loads the people assets once; resolves to null (and the crowd keeps its fallback figures) on failure. */
export async function loadPeople(base = `${import.meta.env.BASE_URL}people/`): Promise<PeopleLibrary | null> {
  if (library) return library;
  try {
    const loader = new GLTFLoader();
    const [male, female, hair, anims] = await Promise.all(['male', 'female', 'hair', 'anims'].map((n) => loader.loadAsync(`${base}${n}.glb`)));
    const body = (g: Group): BodySource => {
      let mesh: SkinnedMesh | undefined, eyes: SkinnedMesh | undefined, brows: SkinnedMesh | undefined;
      g.traverse((o) => {
        const m = o as SkinnedMesh;
        if (!m.isSkinnedMesh) return;
        if (/eyebrow/i.test(m.name)) brows = m;
        else if (/eyes/i.test(m.name)) eyes = m;
        else mesh = m;
      });
      g.updateMatrixWorld(true);
      mesh!.geometry.computeBoundingBox();
      return { scene: g, body: mesh!, eyes, brows, height: mesh!.geometry.boundingBox!.max.y };
    };
    const bodies = { male: body(male.scene), female: body(female.scene) };
    for (const b of bodies.male.body.skeleton.bones) BONE_NAMES.add(b.name);
    const hairMap = new Map<string, SkinnedMesh>();
    // Each hairstyle sits in its own scene of the file.
    for (const sc of hair.scenes) {
      sc.updateMatrixWorld(true);
      sc.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) hairMap.set(o.name, o as SkinnedMesh); });
    }
    // A texture that failed to load falls back to plain white, so the shader always compiles.
    const tex = (m: SkinnedMesh | undefined) => (m?.material as MeshToonMaterial | undefined)?.map ?? WHITE;
    const anyHair = [...hairMap.values()][0];
    library = {
      bodies,
      hair: hairMap,
      clips: new Map(anims.animations.map((c) => [c.name, c])),
      textures: {
        body: { male: tex(bodies.male.body), female: tex(bodies.female.body) },
        eyes: tex(bodies.male.eyes),
        hair: tex(anyHair),
      },
    };
    return library;
  } catch (err) {
    console.warn('People assets could not be loaded; using simple figures instead.', err);
    return null;
  }
}

// Building variants

const tmp = new Vector3();

/**
 * A bone's own name: the loader renames repeated names in one file
 * (Head_1, Head_2 for each hairstyle's copy of the skeleton).
 */
const BONE_NAMES = new Set<string>();
function boneName(name: string): string {
  if (BONE_NAMES.has(name)) return name;
  const stripped = name.replace(/_\d+$/, '');
  return BONE_NAMES.has(stripped) ? stripped : name;
}

/** Bind-pose world matrix of each bone, from the skeleton's inverse bind matrices. */
function bindMatrices(mesh: SkinnedMesh): Map<string, Matrix4> {
  const out = new Map<string, Matrix4>();
  mesh.skeleton.bones.forEach((b, i) => out.set(boneName(b.name), mesh.skeleton.boneInverses[i].clone().invert()));
  return out;
}

/** Index of each bone in a skeleton by name. */
function boneIndex(mesh: SkinnedMesh): Map<string, number> {
  return new Map(mesh.skeleton.bones.map((b, i) => [b.name, i]));
}


/**
 * A part's geometry in the body's bind space, with its skin indices remapped
 * to the body's skeleton and a region per vertex.
 */
function prepare(part: SkinnedMesh, body: SkinnedMesh, region: number | null): BufferGeometry {
  const g = part.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name);
  const idx = boneIndex(body);
  const names = part.skeleton.bones.map((b) => boneName(b.name));
  const si = g.getAttribute('skinIndex') as BufferAttribute;
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, idx.get(names[si.getComponent(i, k)]) ?? 0);
  if (part.skeleton !== body.skeleton) {
    // Parts made for another head (hair, beard): move them head to head.
    const from = bindMatrices(part).get('Head')!;
    const to = bindMatrices(body).get('Head')!;
    const m = to.clone().multiply(from.clone().invert());
    g.applyMatrix4(m);
  }
  // Eyes and hair are marked; the body is 0 and gets its clothing per pixel in the shader.
  const regions = new Float32Array(si.count).fill(region ?? REGION.skin);
  g.setAttribute('region', new BufferAttribute(regions, 1));
  return g;
}

/**
 * Ordinary proportions from the athletic base bodies: arms and legs slimmer
 * around their bones, a narrower, shallower chest. Done once in the bind
 * pose, weighted by skinning so everything stays joined.
 */
function ordinary(g: BufferGeometry, body: SkinnedMesh, sex: Sex): void {
  const bind = bindMatrices(body);
  const joint = (name: string) => new Vector3().setFromMatrixPosition(bind.get(name)!);
  const limbs: [string, string, number][] = [];
  for (const s of ['l', 'r']) {
    limbs.push([`upperarm_${s}`, `lowerarm_${s}`, sex === 'male' ? 0.78 : 0.9]);
    limbs.push([`lowerarm_${s}`, `hand_${s}`, sex === 'male' ? 0.85 : 0.94]);
    limbs.push([`thigh_${s}`, `calf_${s}`, sex === 'male' ? 0.88 : 0.93]);
    limbs.push([`calf_${s}`, `foot_${s}`, sex === 'male' ? 0.9 : 0.95]);
  }
  const idx = boneIndex(body);
  const seg = limbs.map(([a, b, f]) => ({ i: idx.get(a)!, a: joint(a), b: joint(b), f }));
  const chest = ['spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'].map((n) => idx.get(n)!);
  const chestW = sex === 'male' ? 0.86 : 0.95;
  const pos = g.getAttribute('position') as BufferAttribute;
  const si = g.getAttribute('skinIndex') as BufferAttribute;
  const sw = g.getAttribute('skinWeight') as BufferAttribute;
  const p = new Vector3(), ab = new Vector3(), q = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const out = p.clone();
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (w <= 0) continue;
      const bi = si.getComponent(i, k);
      const s = seg.find((x) => x.i === bi);
      if (s) {
        ab.subVectors(s.b, s.a);
        const t = Math.min(1, Math.max(0, q.subVectors(p, s.a).dot(ab) / ab.lengthSq()));
        const onAxis = s.a.clone().addScaledVector(ab, t);
        const radial = q.subVectors(p, onAxis);
        out.addScaledVector(radial, (s.f - 1) * w);
      } else if (chest.includes(bi)) {
        out.x += p.x * (chestW - 1) * w;
        out.z += (p.z - 0.0) * (chestW - 1) * 0.8 * w;
      }
    }
    pos.setXYZ(i, out.x, out.y, out.z);
  }
}

/**
 * Smoothed positions and normals for clothed areas: muscle definition is
 * relaxed away so cloth hangs over the body. Vertices split at UV seams are
 * joined by position so the smoothing never tears them apart.
 */
function clothShape(g: BufferGeometry): void {
  const pos = g.getAttribute('position') as BufferAttribute;
  const region = g.getAttribute('region') as BufferAttribute;
  const index = g.getIndex()!;
  const n = pos.count;
  const key = (i: number) => `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
  const groupOf = new Int32Array(n);
  const groups = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = key(i);
    let gI = groups.get(k);
    if (gI === undefined) { gI = groups.size; groups.set(k, gI); }
    groupOf[i] = gI;
  }
  const G = groups.size;
  const neighbours: Set<number>[] = Array.from({ length: G }, () => new Set<number>());
  for (let t = 0; t < index.count; t += 3) {
    const a = groupOf[index.getX(t)], b = groupOf[index.getX(t + 1)], c = groupOf[index.getX(t + 2)];
    neighbours[a].add(b).add(c); neighbours[b].add(a).add(c); neighbours[c].add(a).add(b);
  }
  let cur = new Float32Array(G * 3);
  const clothed = new Uint8Array(G);
  for (let i = 0; i < n; i++) {
    const gI = groupOf[i];
    cur.set([pos.getX(i), pos.getY(i), pos.getZ(i)], gI * 3);
    // Smooth the whole body; the shader only uses the smoothed shape where there are clothes.
    if (region.getX(i) === REGION.skin) clothed[gI] = 1;
  }
  for (let it = 0; it < 8; it++) {
    const next = cur.slice();
    for (let gI = 0; gI < G; gI++) {
      if (!clothed[gI] || neighbours[gI].size === 0) continue;
      let x = 0, y = 0, z = 0;
      for (const nb of neighbours[gI]) { x += cur[nb * 3]; y += cur[nb * 3 + 1]; z += cur[nb * 3 + 2]; }
      const c = 1 / neighbours[gI].size;
      // Relax toward the neighbour average, mostly sideways so the shape keeps its height.
      next[gI * 3] += (x * c - cur[gI * 3]) * 0.6;
      next[gI * 3 + 1] += (y * c - cur[gI * 3 + 1]) * 0.25;
      next[gI * 3 + 2] += (z * c - cur[gI * 3 + 2]) * 0.6;
    }
    cur = next;
  }
  const cloth = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cloth.set(cur.subarray(groupOf[i] * 3, groupOf[i] * 3 + 3), i * 3);
  // Normals of the smoothed shape, averaged across seams.
  const tmpG = new BufferGeometry();
  tmpG.setAttribute('position', new BufferAttribute(cloth, 3));
  tmpG.setIndex(index.clone());
  tmpG.computeVertexNormals();
  const nrm = tmpG.getAttribute('normal') as BufferAttribute;
  const acc = new Float32Array(G * 3);
  for (let i = 0; i < n; i++) { const gI = groupOf[i]; acc[gI * 3] += nrm.getX(i); acc[gI * 3 + 1] += nrm.getY(i); acc[gI * 3 + 2] += nrm.getZ(i); }
  const clothNormal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const gI = groupOf[i];
    tmp.set(acc[gI * 3], acc[gI * 3 + 1], acc[gI * 3 + 2]).normalize();
    clothNormal.set([tmp.x, tmp.y, tmp.z], i * 3);
  }
  g.setAttribute('clothPos', new BufferAttribute(cloth, 3));
  g.setAttribute('clothNormal', new BufferAttribute(clothNormal, 3));
}

/** Body landmarks in the bind pose (T-pose, metres): where clothes start and end. */
interface Landmarks { neck: number; waist: number; knee: number; ankle: number; shoulder: number; elbow: number; wrist: number }

interface Variant {
  scene: Group;
  mesh: SkinnedMesh;
  marks: Landmarks;
}

function landmarks(body: SkinnedMesh): Landmarks {
  const b = bindMatrices(body);
  const at = (n: string) => new Vector3().setFromMatrixPosition(b.get(n)!);
  return {
    neck: at('neck_01').y + 0.02,
    waist: at('pelvis').y + 0.1,
    knee: at('calf_l').y + 0.06,
    ankle: at('foot_l').y + 0.03,
    shoulder: Math.abs(at('upperarm_l').x) + 0.02,
    elbow: Math.abs(at('lowerarm_l').x),
    wrist: Math.abs(at('hand_l').x) - 0.02,
  };
}
const variants = new Map<string, Variant>();

function variant(lib: PeopleLibrary, sex: Sex, hair: HairStyle, beard: boolean): Variant {
  const key = `${sex}|${hair}|${beard}`;
  const cached = variants.get(key);
  if (cached) return cached;
  const src = lib.bodies[sex];
  const parts: BufferGeometry[] = [];
  const bodyG = prepare(src.body, src.body, null);
  ordinary(bodyG, src.body, sex);
  parts.push(bodyG);
  // Body texture slot 0, eyes slot 1, hair and brows slot 2 (see the shader).
  if (src.eyes) parts.push(prepare(src.eyes, src.body, REGION.eyes));
  if (src.brows) parts.push(prepare(src.brows, src.body, REGION.hair));
  const hairMesh = hair !== 'none' ? lib.hair.get(hair) : undefined;
  if (hairMesh) parts.push(prepare(hairMesh, src.body, REGION.hair));
  const beardMesh = beard ? lib.hair.get('Hair_Beard') : undefined;
  if (beardMesh) parts.push(prepare(beardMesh, src.body, REGION.hair));
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  clothShape(merged);
  merged.computeBoundingSphere();

  // A template scene holding only the merged body on the original skeleton.
  const scene = cloneSkinned(src.scene) as Group;
  let mesh: SkinnedMesh | undefined;
  const drop: Object3D[] = [];
  scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    if (m.name === src.body.name) mesh = m;
    else drop.push(m);
  });
  for (const d of drop) d.removeFromParent();
  mesh!.geometry = merged;
  const v = { scene, mesh: mesh!, marks: landmarks(src.body) };
  variants.set(key, v);
  return v;
}

// Material

function bandRamp(): DataTexture {
  const t = new DataTexture(new Uint8Array([70, 82, 132, 146, 204, 214, 250, 255]), 8, 1, RedFormat);
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const RAMP = bandRamp();

/** Per-person look, as shader uniforms. */
interface Dress {
  top: Color;
  sleeve: Color;
  bottom: Color;
  shoes: Color;
  skin: Color;
  hair: Color;
  /** 1: long sleeves, 0: bare forearms. */
  longSleeves: number;
  /** 1: a coat over the thighs. */
  coat: number;
  /** 1: skirt over the thighs, legs in tights or bare below. */
  skirt: number;
  legs: Color;
  /** Reflective band colour on the top (staff, police, hi-vis); black for none. */
  band: Color;
}

function figureMaterial(lib: PeopleLibrary, sex: Sex, dress: Dress, marks: Landmarks): MeshToonMaterial {
  const m = new MeshToonMaterial({ map: lib.textures.body[sex], gradientMap: RAMP });
  const u = {
    uEyes: { value: lib.textures.eyes },
    uHairTex: { value: lib.textures.hair },
    uTop: { value: dress.top },
    uSleeve: { value: dress.sleeve },
    uBottom: { value: dress.bottom },
    uShoes: { value: dress.shoes },
    uSkin: { value: dress.skin },
    uHair: { value: dress.hair },
    uLegs: { value: dress.legs },
    uBand: { value: dress.band },
    uLong: { value: dress.longSleeves },
    uCoat: { value: dress.coat },
    uSkirt: { value: dress.skirt },
    uMarks: { value: [marks.neck, marks.waist, marks.knee, marks.ankle, marks.shoulder, marks.elbow, marks.wrist] },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float region;
        attribute vec3 clothPos;
        attribute vec3 clothNormal;
        uniform float uLong;
        uniform float uCoat;
        uniform float uSkirt;
        varying float vHead;
        varying vec3 vFig;
        uniform float uMarks[7];
        // What a point of the body wears, from where it sits in the bind pose:
        // 0 skin, 1 top, 2 upper sleeve, 3 lower sleeve, 4 trousers, 5 lower leg, 6 shoes, 9 thigh.
        float bodyPart(vec3 p) {
          float ax = abs(p.x);
          if (p.y > uMarks[1] && ax > uMarks[6]) return 0.0;                         // hands
          if (p.y > uMarks[1] && ax > uMarks[4]) return ax < uMarks[5] ? 2.0 : 3.0;   // arms, out in the T-pose
          if (p.y > uMarks[0]) return 0.0;                // neck and head
          if (p.y > uMarks[1]) return 1.0;                // torso
          if (p.y < uMarks[3]) return 6.0;                // feet
          return p.y > uMarks[2] ? 9.0 : 5.0;             // thigh, lower leg
        }
        float clothedAmount(float r) {
          if (r < 0.5 || r > 6.5 && r < 8.5) return 0.0;
          if (r > 2.5 && r < 3.5) return uLong;
          if (r > 4.5 && r < 5.5) return 1.0 - uSkirt;
          return 1.0;
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float part = region > 6.5 ? region : bodyPart(position);
        float cl = clothedAmount(part);
        objectNormal = normalize(mix(objectNormal, clothNormal, cl));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // Cloth sits a little off the skin; a coat or skirt stands out further.
        float loose = (part > 8.5 && (uCoat > 0.5 || uSkirt > 0.5)) || (part > 0.5 && part < 1.5 && uCoat > 0.5) ? 0.03 : 0.012;
        transformed = mix(transformed, clothPos + clothNormal * loose, cl);
        vHead = region;
        // Clothing edges follow the cloth surface that is drawn, so they stay straight.
        vFig = mix(position, clothPos, cl);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uEyes;
        uniform sampler2D uHairTex;
        uniform vec3 uTop, uSleeve, uBottom, uShoes, uSkin, uHair, uLegs, uBand;
        uniform float uLong, uCoat, uSkirt;
        varying float vHead;
        varying vec3 vFig;
        uniform float uMarks[7];
        // What a point of the body wears, from where it sits in the bind pose:
        // 0 skin, 1 top, 2 upper sleeve, 3 lower sleeve, 4 trousers, 5 lower leg, 6 shoes, 9 thigh.
        float bodyPart(vec3 p) {
          float ax = abs(p.x);
          if (p.y > uMarks[1] && ax > uMarks[6]) return 0.0;                         // hands
          if (p.y > uMarks[1] && ax > uMarks[4]) return ax < uMarks[5] ? 2.0 : 3.0;   // arms, out in the T-pose
          if (p.y > uMarks[0]) return 0.0;                // neck and head
          if (p.y > uMarks[1]) return 1.0;                // torso
          if (p.y < uMarks[3]) return 6.0;                // feet
          return p.y > uMarks[2] ? 9.0 : 5.0;             // thigh, lower leg
        }
        float fh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float fn(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(fh(i), fh(i + vec3(1, 0, 0)), f.x), mix(fh(i + vec3(0, 1, 0)), fh(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(fh(i + vec3(0, 0, 1)), fh(i + vec3(1, 0, 1)), f.x), mix(fh(i + vec3(0, 1, 1)), fh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        // Woven cloth: hanging folds, a fine weave and wear.
        vec3 cloth(vec3 c) {
          float folds = fn(vec3(vFig.x * 18.0, vFig.y * 2.5, vFig.z * 18.0));
          float weave = fn(vFig * 160.0);
          float wear = fn(vFig * 6.0 + 4.0);
          return c * (0.8 + 0.22 * folds) * (0.94 + 0.08 * weave) * (0.92 + 0.12 * wear);
        }`)
      .replace('#include <map_fragment>', `
        vec4 base = texture2D(map, vMapUv);
        // Eyes and hair keep their own part; the body is classified per pixel for clean edges.
        float r = vHead > 6.5 ? floor(vHead + 0.5) : bodyPart(vFig);
        vec3 col;
        float lum = dot(base.rgb, vec3(0.3, 0.55, 0.15));
        if (r > 6.5 && r < 7.5) col = texture2D(uEyes, vMapUv).rgb;
        else if (r > 7.5 && r < 8.5) col = uHair * (0.35 + 1.6 * dot(texture2D(uHairTex, vMapUv).rgb, vec3(0.33)));
        else if (r < 0.5 || (r > 2.5 && r < 3.5 && uLong < 0.5)) col = uSkin * (lum / 0.32);
        else if (r > 0.5 && r < 1.5) col = cloth(uTop);
        else if (r < 3.5) col = cloth(uSleeve);
        else if (r > 5.5 && r < 6.5) col = uShoes * (0.85 + 0.3 * fn(vFig * 40.0));
        else if (r > 8.5) col = cloth(uCoat > 0.5 ? uSleeve : uSkirt > 0.5 ? uBottom : uBottom);
        else if (r > 4.5 && r < 5.5 && uSkirt > 0.5) col = uLegs * (0.7 + 0.5 * lum / 0.32);
        else col = cloth(uBottom);
        // A reflective band across the chest and back (staff, police, hi-vis).
        if (r > 0.5 && r < 1.5 && dot(uBand, vec3(1.0)) > 0.01 && abs(vFig.y - 1.32) < 0.035) col = uBand;
        diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => 'human-figure';
  return m;
}

// The figure

const CLIP: Record<Pose | 'push' | 'walkFormal', string> = {
  dance: 'Dance_Loop',
  stand: 'Idle_Loop',
  walk: 'Walk_Loop',
  walkFormal: 'Walk_Formal_Loop',
  sit: 'Sitting_Idle_Loop',
  talk: 'Idle_Talking_Loop',
  push: 'Push_Loop',
};

const HAIR_FOR: Record<number, HairStyle[]> = {
  0: ['Hair_SimpleParted', 'Hair_Buzzed'],
  1: ['Hair_Long'],
  2: ['Hair_Buns'],
  3: ['Hair_Buzzed', 'Hair_BuzzedFemale'],
  4: ['Hair_Buzzed'],
  5: ['Hair_BuzzedFemale', 'Hair_Buzzed'],
  6: ['Hair_Long', 'Hair_Buns'],
  7: ['Hair_Buzzed'],
};

/** Muted, worn version of a colour: cloth is never showroom-clean. */
function worn(hex: number, amount = 0.35): Color {
  const c = new Color(hex);
  const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15;
  return c.lerp(new Color(l * 1.04, l, l * 0.9), amount).multiplyScalar(0.92);
}

/**
 * A person, same interface as the simple figure: `root` to place and pick,
 * `update` to animate, `dispose` when they leave.
 */
export class HumanFigure {
  readonly root: Group;
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  private readonly material: MeshToonMaterial;
  private readonly mesh: SkinnedMesh;

  constructor(lib: PeopleLibrary, readonly look: Appearance) {
    const h = ((look.skin * 7 + look.top * 13 + look.hair) >>> 2) % 1009;
    const sex: Sex = look.skirt || look.hairStyle === 2 || (look.hairStyle === 1 && h % 3 !== 0) ? 'female' : look.beard ? 'male' : h % 2 ? 'male' : 'female';
    const styles = HAIR_FOR[look.hairStyle] ?? ['Hair_SimpleParted'];
    let hair: HairStyle = styles[h % styles.length];
    if (sex === 'male' && hair === 'Hair_BuzzedFemale') hair = 'Hair_Buzzed';
    if (sex === 'female' && hair === 'Hair_Buzzed') hair = 'Hair_BuzzedFemale';
    const v = variant(lib, sex, hair, sex === 'male' && !!look.beard);
    this.root = cloneSkinned(v.scene) as Group;
    let mesh: SkinnedMesh | undefined;
    this.root.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh; });
    this.mesh = mesh!;
    this.mesh.castShadow = true;
    // A fixed sphere around the body (any pose, any height): off-screen people are
    // skipped without recomputing bounds from the skeleton every frame.
    this.mesh.boundingSphere = new Sphere(new Vector3(0, 0.95, 0), 1.35);
    this.mesh.frustumCulled = true;

    const k = look.kit ?? {};
    const vest = look.police ? PALETTE.policeVest : look.staff ? look.vestColour ?? PALETTE.staffVest : k.hiVis ? 0xe07a20 : null;
    const coat = look.extra === 'jacket' ? look.accent : look.top;
    const dress: Dress = {
      top: worn(vest ?? coat),
      sleeve: worn(look.police ? PALETTE.policeVest : coat),
      bottom: worn(look.bottom),
      shoes: worn(look.staff || look.police ? 0x1e1e20 : [0x1e1c1a, 0x3a2a20, 0x2a2a2e, 0x5a4a3a][look.hair % 4], 0.1),
      skin: new Color(look.skin),
      hair: new Color(look.hair),
      longSleeves: look.shortSleeves && !k.longCoat && look.extra !== 'jacket' ? 0 : 1,
      coat: k.longCoat ? 1 : 0,
      skirt: look.skirt ? 1 : 0,
      legs: new Color(look.skin % 2 ? 0x24222a : look.skin),
      band: new Color(look.police ? PALETTE.policeBand : look.staff || k.hiVis ? 0xe8e8d8 : 0x000000),
    };
    this.material = figureMaterial(lib, sex, dress, v.marks);
    this.mesh.material = this.material;

    this.root.scale.setScalar(look.height / lib.bodies[sex].height);
    this.mixer = new AnimationMixer(this.root);
    for (const name of new Set(Object.values(CLIP))) {
      const clip = lib.clips.get(name);
      if (clip) this.actions.set(name, this.mixer.clipAction(clip));
    }
    this.mixer.setTime(Math.random() * 5);
    this.play('stand', 1.1);
  }

  private walkClip(): string {
    if (this.look.kit?.trolley) return CLIP.push;
    return this.look.style === 'office' || this.look.style === 'older' ? CLIP.walkFormal : CLIP.walk;
  }

  private play(pose: Pose, speed: number): void {
    const name = pose === 'walk' ? this.walkClip() : CLIP[pose];
    const next = this.actions.get(name) ?? this.actions.get(CLIP.stand)!;
    if (pose === 'walk') next.timeScale = speed / 1.25;
    if (next === this.current) return;
    next.reset().setEffectiveWeight(1).fadeIn(0.25).play();
    if (this.current) this.current.fadeOut(0.25);
    this.current = next;
  }

  private disposed = false;

  update(dt: number, pose: Pose, speed: number): void {
    if (this.disposed) return;
    this.play(pose, speed);
    this.mixer.update(dt);
  }

  /** Frees the person's material; the shared geometry and clips stay for others. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.material.dispose();
  }
}
