import { SEASON_PROFILES, type Season, type SeasonProfile } from '../config/seasons';
import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  DataTexture,
  MeshToonMaterial,
  LinearFilter,
  RedFormat,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { atlasUv, figureAtlas, TILE, type Tile } from './figureAtlas';
import { ACCENT_COLOURS, BOTTOM_COLOURS, HAIR_COLOURS, PALETTE, SKIN_TONES, TOP_COLOURS } from '../config/palette';
import { pick, type Random } from '../sim/random';
import { approach } from '../world/animated';

/** `dance` is drawn as standing by the simple figures. */
export type Pose = 'stand' | 'walk' | 'sit' | 'talk' | 'dance';

/** What the crowd needs from a person's figure, whichever way it is built. */
export interface Figure {
  readonly root: Group;
  readonly look: Appearance;
  update(dt: number, pose: Pose, speed: number): void;
  dispose(): void;
}

/**
 * Light falls on people like paint: a deep shadow side, a long half tone and
 * a lit side, with soft edges between them rather than hard steps or a
 * plastic gradient.
 */
function bandRamp(): DataTexture {
  const t = new DataTexture(new Uint8Array([62, 70, 118, 130, 196, 206, 248, 255]), 8, 1, RedFormat);
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/**
 * One shared vertex-coloured, skinned material for every person. Banded
 * light, cloth that darkens and dirties toward the feet, and a faint mottle
 * taken from the bind pose, so it stays on the clothes as they move.
 */
const figureMaterial = new MeshToonMaterial({ vertexColors: true, gradientMap: bandRamp(), map: figureAtlas() });
figureMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFig;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFig = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vFig;
      float fHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float fNoise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(fHash(i), fHash(i + vec3(1, 0, 0)), f.x), mix(fHash(i + vec3(0, 1, 0)), fHash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(fHash(i + vec3(0, 0, 1)), fHash(i + vec3(1, 0, 1)), f.x), mix(fHash(i + vec3(0, 1, 1)), fHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // Ink: surfaces turning away from the eye darken into a soft drawn contour.
        vec3 eye = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
        float edge = 1.0 - abs(dot(normal, eye));
        diffuseColor.rgb *= mix(1.0, 0.55, smoothstep(0.68, 0.98, edge));
      }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(0.02, 0.85, vFig.y));
      diffuseColor.rgb *= 0.93 + 0.14 * fNoise(vFig * 5.0 + 3.1);`);
};
figureMaterial.customProgramCacheKey = () => 'figure-banded';

/** Worn, sun-faded cloth: colours lose saturation and brightness, never showroom-clean. */
function weather(c: Color, amount: number): void {
  const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15;
  c.lerp(new Color(l * 1.04, l, l * 0.9), amount).multiplyScalar(0.9);
}

// Bones, in the order of the skeleton. Each body part is rigidly bound to one.
const HIPS = 0, SPINE = 1, NECK = 2, HEAD = 3;
const THIGH_L = 4, SHIN_L = 5, THIGH_R = 6, SHIN_R = 7;
const ARM_L = 8, FORE_L = 9, ARM_R = 10, FORE_R = 11;

/** Joint heights in metres for a 1.75 m reference person, standing, facing +z. */
const J = { hip: 0.95, waist: 1.06, shoulder: 1.43, neck: 1.48, head: 1.55, knee: 0.5, elbow: 1.13 };

const lathe = (points: [number, number][], segments = 14) => new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments);

/**
 * Shapes in metres. Tapered limbs, a lathed torso that narrows at the waist,
 * an egg-shaped head: enough to read as a person at street distance.
 */
const SHAPES = {
  // Straight-cut trousers that hang, not leggings.
  // Open at the top: each limb starts inside the part above it, so no end cap shows.
  thigh: new CylinderGeometry(0.08, 0.066, 0.47, 12, 4, true).translate(0, -0.215, 0),
  shin: new CylinderGeometry(0.062, 0.058, 0.44, 12, 4, true).translate(0, -0.2, 0),
  shoe: new CapsuleGeometry(0.043, 0.17, 3, 7).rotateX(Math.PI / 2),
  // Seat of the trousers: waistband to crotch, no ball.
  pelvis: lathe([[0.001, 0.08], [0.128, 0.08], [0.14, 0.0], [0.146, -0.07], [0.128, -0.12], [0.075, -0.142], [0.001, -0.146]], 16),
  // Sloping shoulders that carry the clothes, not a rounded barrel.
  // Clothed shoulders: the shoulder line runs out past the arm joint and
  // drops, so the sleeve hangs from under it instead of a ball socket.
  torso: lathe([[0.001, -0.02], [0.13, -0.02], [0.135, 0.08], [0.158, 0.22], [0.188, 0.31], [0.2, 0.34], [0.188, 0.365], [0.145, 0.39], [0.085, 0.41], [0.001, 0.425]], 16),
  jacket: lathe([[0.2, -0.17], [0.172, -0.02], [0.16, 0.08], [0.176, 0.22], [0.202, 0.31], [0.214, 0.345], [0.2, 0.372], [0.155, 0.398], [0.09, 0.42], [0.001, 0.435]], 16),
  vest: lathe([[0.17, -0.02], [0.16, 0.06], [0.178, 0.2], [0.19, 0.3], [0.17, 0.35]]),
  stripe: new CylinderGeometry(0.185, 0.18, 0.04, 14, 1, true),
  // Sleeves: cloth that hangs nearly straight and opens a little at the cuff.
  upperArm: new CylinderGeometry(0.046, 0.046, 0.33, 10, 4, true).translate(0, -0.15, 0),
  forearm: new CylinderGeometry(0.044, 0.047, 0.29, 10, 3, true).translate(0, -0.125, 0),
  hand: new SphereGeometry(1, 10, 8),
  palm: new BoxGeometry(0.045, 0.085, 0.028),
  neck: new CylinderGeometry(0.048, 0.055, 0.1, 10),
  skull: new SphereGeometry(1, 18, 14),
  nose: new SphereGeometry(0.018, 6, 5),
  hair: new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  longHair: new CapsuleGeometry(0.085, 0.16, 4, 10),
  bun: new SphereGeometry(0.05, 8, 6),
  beanie: new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  rim: new CylinderGeometry(1, 1, 0.045, 16),
  pack: new CapsuleGeometry(0.1, 0.18, 4, 10),
  bag: new SphereGeometry(1, 10, 8),
  strap: new CylinderGeometry(0.012, 0.012, 0.62, 5),
  scarf: new TorusGeometry(0.075, 0.03, 6, 14),
  peak: new BoxGeometry(0.16, 0.02, 0.09),
  // A-line skirt from the waist to the knee, wide enough to clear the stride.
  skirt: lathe([[0.15, 0.0], [0.168, -0.12], [0.2, -0.27], [0.235, -0.4]], 12),
  // Turned-up coat collar, open at the front.
  collar: new CylinderGeometry(0.085, 0.1, 0.1, 10, 1, true, Math.PI * 0.22, Math.PI * 1.56),
  // Lower face, front half: jaw and chin.
  beard: new SphereGeometry(1, 9, 4, Math.PI * 0.5 - 1.05, 2.1, Math.PI * 0.64, Math.PI * 0.3),
  ponytail: new CapsuleGeometry(0.035, 0.14, 3, 6),
  capCrown: new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42),
  // Long coat skirt from the waist to mid-thigh, flaring a little.
  coatTail: lathe([[0.19, 0.0], [0.205, -0.15], [0.225, -0.32], [0.24, -0.46]]),
  brim: new CylinderGeometry(0.15, 0.16, 0.02, 14),
  crown: new CylinderGeometry(0.095, 0.105, 0.1, 12),
  hood: new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
  camera: new BoxGeometry(0.13, 0.09, 0.07),
  case: new BoxGeometry(0.24, 0.5, 0.38),
  handle: new CylinderGeometry(0.012, 0.012, 0.5, 5),
  roll: new CylinderGeometry(0.09, 0.09, 0.56, 10).rotateZ(Math.PI / 2),
  // Tapered wire basket, wider at the top and at the push end.
  basket: new CylinderGeometry(0.44, 0.36, 0.38, 4, 1).rotateY(Math.PI / 4).scale(0.72, 1, 1.05),
  trolleyBase: new BoxGeometry(0.46, 0.04, 0.66),
  castor: new CylinderGeometry(0.05, 0.05, 0.03, 8).rotateZ(Math.PI / 2),
  bar: new CylinderGeometry(0.015, 0.015, 0.5, 5).rotateZ(Math.PI / 2),
  cane: new CylinderGeometry(0.014, 0.012, 0.86, 5),
  briefcase: new BoxGeometry(0.08, 0.28, 0.38),
  carrier: new SphereGeometry(1, 8, 6),
  band: new TorusGeometry(0.04, 0.012, 5, 10),
  stick: new CylinderGeometry(0.016, 0.016, 0.95, 6),
  board: new BoxGeometry(0.56, 0.36, 0.03),
};

/** Which atlas tile each shape wears. */
const TILE_OF = new Map<BufferGeometry, Tile>([
  [SHAPES.skull, TILE.face],
  [SHAPES.hair, TILE.hair], [SHAPES.longHair, TILE.hair], [SHAPES.bun, TILE.hair], [SHAPES.ponytail, TILE.hair], [SHAPES.beard, TILE.hair],
  [SHAPES.torso, TILE.top], [SHAPES.jacket, TILE.jacket], [SHAPES.coatTail, TILE.coat], [SHAPES.collar, TILE.coat],
  [SHAPES.upperArm, TILE.sleeve], [SHAPES.forearm, TILE.sleeve],
  [SHAPES.thigh, TILE.trousers], [SHAPES.shin, TILE.trousers], [SHAPES.pelvis, TILE.trousers], [SHAPES.skirt, TILE.coat],
  [SHAPES.shoe, TILE.shoe], [SHAPES.hand, TILE.skin], [SHAPES.neck, TILE.skin], [SHAPES.nose, TILE.skin],
  [SHAPES.beanie, TILE.sleeve], [SHAPES.hood, TILE.top], [SHAPES.pack, TILE.coat], [SHAPES.bag, TILE.coat], [SHAPES.roll, TILE.coat],
]);

interface Part { geo: BufferGeometry; color: number; bone: number; tile: Tile }

/** Where a child bone meets its parent in the bind pose, and how far the blend reaches. */
interface Joint { parent: number; child: number; x: number; y: number; radius: number }

/** Accumulates rigid parts: each copy is coloured and bound to one bone. */
class Builder {
  readonly parts: Part[] = [];
  /** Colours kept as they are: glow sticks and light-emitting bits. */
  readonly vivid = new Set<number>();
  add(geo: BufferGeometry, color: number, bone: number, x: number, y: number, z: number, scale?: [number, number, number], rot?: [number, number, number], tile?: Tile): void {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    const t = tile ?? TILE_OF.get(geo) ?? TILE.plain;
    if (scale) g.scale(...scale);
    if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); }
    g.translate(x, y, z);
    this.parts.push({ geo: g, color, bone, tile: t });
  }

  /**
   * `joints` lists where bones meet in the bind pose. Vertices near a joint
   * are shared between the two bones, so shoulders, elbows, hips and knees
   * bend as one surface instead of rigid pieces hinged like a puppet.
   */
  build(joints: readonly Joint[] = []): BufferGeometry {
    const c = new Color();
    const geos = this.parts.map(({ geo, color, bone, tile }) => {
      const pos = geo.getAttribute('position');
      const n = pos.count;
      const colors = new Float32Array(n * 3);
      const index = new Uint16Array(n * 4);
      const weight = new Float32Array(n * 4);
      c.setHex(color);
      if (!this.vivid.has(color)) weather(c, 0.38);
      // Each piece a touch lighter or darker than the next: cloth is never one flat colour.
      c.multiplyScalar(0.93 + ((color * 31 + n) % 13) / 100);
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < n; i++) { const y = pos.getY(i); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const near = joints.filter((j) => j.parent === bone || j.child === bone);
      for (let i = 0; i < n; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        // Baked shade: each piece darkens toward its lower end, like light
        // from above falling into folds, under the arms and under the chin.
        const k = 0.8 + 0.2 * (maxY > minY ? (y - minY) / (maxY - minY) : 1);
        colors.set([c.r * k, c.g * k, c.b * k], i * 3);
        index[i * 4] = bone;
        weight[i * 4] = 1;
        let best = 0;
        for (const j of near) {
          const d = Math.hypot(x - j.x, y - j.y, z);
          if (d >= j.radius) continue;
          const w = 0.5 * (1 - d / j.radius);
          if (w > best) {
            best = w;
            index[i * 4 + 1] = j.parent === bone ? j.child : j.parent;
          }
        }
        if (best > 0) {
          weight[i * 4] = 1 - best;
          weight[i * 4 + 1] = best;
        }
      }
      geo.setAttribute('color', new BufferAttribute(colors, 3));
      geo.setAttribute('skinIndex', new BufferAttribute(index, 4));
      geo.setAttribute('skinWeight', new BufferAttribute(weight, 4));
      // Each part's own UVs land on its tile of the shared detail atlas.
      const src = geo.getAttribute('uv');
      const uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) uv.set(atlasUv(tile, src ? src.getX(i) : 0.5, src ? src.getY(i) : 0.5), i * 2);
      geo.setAttribute('uv', new BufferAttribute(uv, 2));
      return geo;
    });
    const merged = mergeGeometries(geos)!;
    for (const g of geos) g.dispose();
    return merged;
  }
}

/** A colour darkened by `f`, for shadowed parts of the same material. */
function shade(hex: number, f: number): number {
  return new Color(hex).multiplyScalar(f).getHex();
}

export interface Appearance {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
  accent: number;
  height: number;
  build: number;
  /** 0 short, 1 long, 2 bun, 3 cropped, 4 beanie, 5 shaved, 6 ponytail, 7 flat cap. */
  hairStyle: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** 0 slight to 1 heavy-set: widens and deepens the body. */
  girth?: number;
  skirt?: boolean;
  beard?: boolean;
  /** Stands with hands in pockets when waiting. */
  pockets?: boolean;
  /** Bare forearms in warm weather. */
  shortSleeves?: boolean;
  extra: 'none' | 'backpack' | 'bag' | 'scarf' | 'jacket';
  staff: boolean;
  /** Walks a small dog on a lead. */
  dog?: boolean;
  /** Hi-vis vest colour for staff (default: harm reduction teal; council cleaners wear orange). */
  vestColour?: number;
  /** Police officer on patrol: navy uniform, reflective band and cap. */
  police?: boolean;
  /** Resident holding a blank placard (neighbourhood opposition context). */
  placard?: boolean;
  /** Who they are on a night out in the city; sets clothing and what they carry. */
  style?: Archetype;
  /** Accessories chosen for the style. */
  kit?: Kit;
}

/**
 * Everyday groups in a city at night. People who use drugs are among all of
 * them; none of these marks anyone as a user, and nothing here caricatures.
 */
export type Archetype = 'everyday' | 'raver' | 'tourist' | 'worker' | 'office' | 'student' | 'older' | 'unhoused';

export interface Kit {
  longCoat?: boolean;
  hood?: 'up' | 'down';
  bucketHat?: boolean;
  glow?: number;
  camera?: boolean;
  suitcase?: boolean;
  briefcase?: boolean;
  carriers?: boolean;
  bedroll?: boolean;
  trolley?: boolean;
  cane?: boolean;
  hiVis?: boolean;
}

const STYLE_TOPS: Record<Archetype, readonly number[]> = {
  everyday: TOP_COLOURS,
  raver: [0xff4fa8, 0x4ff0ff, 0xb8ff4a, 0xf0e040, 0x9a6aff, 0x1a1a22],
  tourist: [0xd8c8a8, 0x8aa0b8, 0xc87a5a, 0xe0e0d8, 0x6a9a7a],
  worker: [0x3a8a8a, 0x5a7ab0, 0x4a4a52, 0x2f4a6a],
  office: [0x2a2e3a, 0x4a4a52, 0x8a7258, 0x3a3a30],
  student: [0x8a3a4a, 0x3a5a8a, 0x5a7a4a, 0xd0a040, 0x6a6a72],
  older: [0x6a5a48, 0x5a6066, 0x7a6a5a, 0x4a5240],
  unhoused: [0x5a4a3a, 0x4a4a40, 0x5a5048, 0x3a4240, 0x6a5a40],
};
const STYLE_BOTTOMS: Record<Archetype, readonly number[]> = {
  everyday: BOTTOM_COLOURS,
  raver: [0x1a1a22, 0x2a2a3a, 0x3a2a4a],
  tourist: [0xb0a080, 0x6a6a5a, 0x4a5a6a],
  worker: [0x2a3a4a, 0x3a8a8a, 0x2a2a30],
  office: [0x1e2028, 0x2e3038, 0x3a3a3a],
  student: [0x2f3445, 0x4a4552, 0x3d4f5f],
  older: [0x3a3a40, 0x4a4238, 0x5a5048],
  unhoused: [0x3a3632, 0x4a4238, 0x2e3030],
};
const NEON = [0xff4fa8, 0x4ff0ff, 0xb8ff4a, 0xf0e040];

/** Everyday variety for anyone in the scene. Nothing marks a person by behaviour. */
export function randomAppearance(random: Random, staff = false, style: Archetype = 'everyday', season: Season = 'autumn'): Appearance {
  const s = staff ? 'everyday' : style;
  const r = () => random();
  const kit: Kit = {};
  switch (s) {
    case 'raver': kit.bucketHat = r() < 0.4; kit.glow = pick(random, NEON); break;
    case 'tourist': kit.camera = r() < 0.7; kit.suitcase = r() < 0.4; break;
    case 'worker': kit.hiVis = r() < 0.5; break;
    case 'office': kit.longCoat = r() < 0.7; kit.briefcase = r() < 0.5; break;
    case 'student': kit.hood = 'down'; break;
    case 'older': kit.longCoat = r() < 0.5; kit.cane = r() < 0.45; break;
    case 'unhoused':
      kit.longCoat = r() < 0.6;
      kit.hood = r() < 0.5 ? 'up' : undefined;
      kit.trolley = r() < 0.25;
      kit.carriers = !kit.trolley && r() < 0.5;
      kit.bedroll = r() < 0.5;
      break;
    case 'everyday': kit.longCoat = r() < 0.15; break;
  }
  const look: Appearance = {
    style: s,
    kit,
    skin: pick(random, SKIN_TONES),
    hair: pick(random, s === 'older' ? [0x9a9a9a, 0xc8c8c0, 0x6a6a68, 0x3b2a22] : HAIR_COLOURS),
    top: pick(random, STYLE_TOPS[s]),
    bottom: pick(random, STYLE_BOTTOMS[s]),
    accent: pick(random, ACCENT_COLOURS),
    height: 1.55 + random() * 0.35,
    build: 0.9 + random() * 0.25,
    hairStyle: (s === 'older' && random() < 0.35 ? 7 : Math.floor(random() * 7)) as Appearance['hairStyle'],
    girth: Math.pow(random(), 1.6),
    skirt: !staff && s !== 'worker' && s !== 'unhoused' && random() < 0.2,
    beard: !staff && random() < (s === 'unhoused' || s === 'older' ? 0.4 : 0.2),
    pockets: random() < (s === 'unhoused' || s === 'student' ? 0.6 : 0.35),
    extra: staff ? 'none'
      : s === 'tourist' || s === 'student' || s === 'unhoused' ? pick(random, ['backpack', 'backpack', 'none', 'scarf'] as const)
      : s === 'office' || s === 'raver' ? 'none'
      : pick(random, ['none', 'none', 'backpack', 'bag', 'scarf', 'jacket'] as const),
    staff,
  };
  if (!staff) dressForSeason(look, random, SEASON_PROFILES[season].clothes);
  return look;
}

/** Coats, hats and hoods in winter; short sleeves and no jackets in summer. */
function dressForSeason(look: Appearance, random: Random, c: SeasonProfile['clothes']): void {
  const kit = look.kit ?? (look.kit = {});
  if (c.coat < 0) kit.longCoat = false;
  else if (random() < c.coat) kit.longCoat = true;
  if (c.hoodUp < 0 && kit.hood === 'up') kit.hood = 'down';
  else if (random() < c.hoodUp && !kit.bucketHat) kit.hood = 'up';
  if (c.hat < 0 && look.hairStyle === 4) look.hairStyle = 0;
  else if (random() < c.hat && look.hairStyle !== 7) look.hairStyle = 4;
  if (c.coat < 0 && (look.extra === 'jacket' || look.extra === 'scarf')) look.extra = 'none';
  if (c.coat > 0 && look.extra === 'none' && random() < c.coat * 0.5) look.extra = 'scarf';
  look.shortSleeves = random() < c.shortSleeves;
}

/**
 * A person with natural proportions, built for a 1.75 m reference and
 * scaled. One skinned mesh over a twelve-bone skeleton (hips, spine, neck,
 * head, thighs, shins, upper arms, forearms): every part is rigidly bound to
 * its bone, so walking, sitting, talking and glancing are bone rotations and
 * each person costs one draw call per pass. Faces local +z; the pivot is
 * between the feet.
 */
export class CharacterRig {
  readonly root = new Group();
  private readonly bones: Bone[];
  private readonly mesh: SkinnedMesh;
  private phase = Math.random() * Math.PI * 2;
  private idleTime = Math.random() * 10;
  private stride = 0;
  private sit = 0;
  /** How much this person stoops: tired, cold, older, or just their way of standing. */
  private readonly slouch: number;
  /** How freely the arms swing when walking. */
  private readonly swing: number;
  /** Head down against the cold or the night. */
  private readonly headDown: number;

  constructor(readonly look: Appearance) {
    const style = look.staff || look.police ? 'staff' : look.style;
    const h = ((look.skin * 7 + look.top * 13 + look.hair) >>> 2) % 101 / 101;
    this.swing = (style === 'older' ? 0.45 : style === 'unhoused' ? 0.5 : style === 'raver' ? 1.0 : 0.65) + h * 0.3;
    this.headDown = style === 'unhoused' || look.kit?.hood === 'up' ? 0.18 : h > 0.8 ? 0.1 : 0;
    this.slouch = 0.05 + (((look.skin ^ look.top) >>> 3) % 97) / 97 * 0.12 + (style === 'older' ? 0.12 : style === 'unhoused' ? 0.07 : 0);
    const b = look.build;
    const hw = 0.09 * b; // hip joint offset
    const sw = 0.19 * b; // shoulder joint offset
    const coat = look.extra === 'jacket' ? look.accent : look.top;
    const f = new Builder();

    // Legs: tapered thigh and shin, shoes pointing forward.
    for (const [side, thigh, shin] of [[-1, THIGH_L, SHIN_L], [1, THIGH_R, SHIN_R]] as const) {
      const x = side * hw;
      // Under a skirt: slim legs in dark tights or bare skin, not trouser tubes.
      const leg = look.skirt ? (look.skin % 2 ? 0x24222a : shade(look.skin, 0.92)) : look.bottom;
      const legTile = look.skirt ? TILE.skin : undefined;
      f.add(SHAPES.thigh, leg, thigh, x, J.hip - 0.03, 0, look.skirt ? [b * 0.7, 1, b * 0.7] : [b, 1, b * 0.9], undefined, legTile);
      f.add(SHAPES.shin, leg, shin, x, J.knee, 0, look.skirt ? [0.66, 1, 0.66] : undefined, undefined, legTile);
      f.add(SHAPES.shoe, look.staff || look.police ? PALETTE.tyre : [0x1e1c1a, 0x3a2a20, 0x2a2a2e, 0x5a4a3a][look.hair % 4], shin, x, 0.05, 0.05, [1.05, 0.85, 1]);
    }

    // Body: pelvis, lathed torso (or jacket over it), optional staff vest.
    const g = look.girth ?? 0;
    f.add(SHAPES.pelvis, look.bottom, HIPS, 0, J.hip, 0, [b * (1 + g * 0.15), 1, 0.72 * (1 + g * 0.3)]);
    f.add(look.extra === 'jacket' ? SHAPES.jacket : SHAPES.torso, coat, SPINE, 0, J.waist, 0, [b * (1 + g * 0.16), 1, 0.66 * (1 + g * 0.38)]);
    if (look.skirt) f.add(SHAPES.skirt, look.bottom, HIPS, 0, J.hip + 0.07, 0, [b * (1 + g * 0.12), 1, 0.85]);
    if (look.extra === 'jacket' || look.kit?.longCoat) f.add(SHAPES.collar, coat, NECK, 0, J.neck - 0.005, -0.005, [b, 1, 0.9], [-0.12, 0, 0]);
    if (look.staff) {
      f.add(SHAPES.vest, look.vestColour ?? PALETTE.staffVest, SPINE, 0, J.waist, 0, [b * 1.04, 1, 0.72]);
      f.add(SHAPES.stripe, 0xf0f0e0, SPINE, 0, J.waist + 0.16, 0, [b * 1.05, 1, 0.73]);
    }
    if (look.police) {
      f.add(SHAPES.vest, PALETTE.policeVest, SPINE, 0, J.waist, 0, [b * 1.04, 1, 0.72]);
      f.add(SHAPES.stripe, PALETTE.policeBand, SPINE, 0, J.waist + 0.2, 0, [b * 1.05, 1.6, 0.73]);
      f.add(SHAPES.stripe, PALETTE.policeBand, SPINE, 0, J.waist + 0.02, 0, [b * 1.05, 1, 0.73]);
    }
    if (look.placard) {
      // Held in the right hand: the stick rides on the forearm, the blank board above the head.
      f.add(SHAPES.stick, PALETTE.timber, FORE_R, sw, J.elbow - 0.05, 0.12);
      f.add(SHAPES.board, PALETTE.canvasCream, FORE_R, sw, J.elbow + 0.55, 0.12);
    }
    if (look.extra === 'backpack') f.add(SHAPES.pack, look.accent, SPINE, 0, J.waist + 0.22, -0.15, [1.1, 1, 0.6]);
    if (look.extra === 'bag') {
      f.add(SHAPES.bag, look.accent, HIPS, sw + 0.02, J.hip - 0.02, 0.02, [0.05, 0.11, 0.12]);
      f.add(SHAPES.strap, 0x3a3230, SPINE, 0, J.waist + 0.17, 0, undefined, [0, 0, 0.7]);
    }
    if (look.extra === 'scarf') f.add(SHAPES.scarf, look.accent, NECK, 0, J.neck - 0.01, 0, [b, 1, 0.85], [Math.PI / 2, 0, 0]);

    // What their night looks like: clothes and the things they carry.
    const k = look.kit ?? {};
    if (k.longCoat) f.add(SHAPES.coatTail, coat, HIPS, 0, J.waist, 0, [b, 1, 0.78]);
    if (k.hiVis) {
      f.add(SHAPES.vest, 0xf08a24, SPINE, 0, J.waist, 0, [b * 1.04, 1, 0.72]);
      f.add(SHAPES.stripe, 0xe8e8d8, SPINE, 0, J.waist + 0.18, 0, [b * 1.05, 1.3, 0.73]);
    }
    if (k.glow) {
      f.vivid.add(k.glow);
      f.add(SHAPES.band, k.glow, NECK, 0, J.neck - 0.02, 0, [1.4, 1.4, 1.2], [Math.PI / 2, 0, 0]);
      for (const [side, fore] of [[-1, FORE_L], [1, FORE_R]] as const) f.add(SHAPES.band, k.glow, fore, side * sw, J.elbow - 0.24, 0, [1, 1, 1], [Math.PI / 2, 0, 0]);
    }
    if (k.camera) {
      f.add(SHAPES.camera, 0x1e1e20, SPINE, 0.04, J.waist + 0.2, 0.13);
      f.add(SHAPES.strap, 0x2a2622, SPINE, 0, J.waist + 0.3, 0.02, [1, 0.6, 1], [0, 0, 0.5]);
    }
    if (k.suitcase) {
      // Rolling case towed at the right side; the hand rests on the handle.
      f.add(SHAPES.case, [0x2a3a5a, 0x5a2a2a, 0x3a3a3a][look.skin % 3], HIPS, sw + 0.24, 0.3, -0.32);
      f.add(SHAPES.handle, 0x8a8a8a, HIPS, sw + 0.24, 0.8, -0.18, undefined, [0.35, 0, 0]);
    }
    if (k.briefcase) f.add(SHAPES.briefcase, 0x2a1e18, FORE_R, sw, J.elbow - 0.42, 0);
    if (k.carriers) {
      for (const [side, fore] of [[-1, FORE_L], [1, FORE_R]] as const) f.add(SHAPES.carrier, side < 0 ? 0xb8b4a8 : 0x5a6a7a, fore, side * (sw + 0.02), J.elbow - 0.5, 0, [0.09, 0.13, 0.05]);
    }
    if (k.bedroll) f.add(SHAPES.roll, [0x4a5a3a, 0x3a4a6a, 0x6a4a3a][look.hair % 3], SPINE, 0, J.waist + 0.43, -0.2);
    if (k.trolley) {
      // A shopping trolley of belongings, pushed with both hands.
      const wire = 0x8a8a86;
      f.add(SHAPES.basket, 0x7a7a76, HIPS, 0, 0.5, 0.8);
      f.add(SHAPES.trolleyBase, wire, HIPS, 0, 0.12, 0.78);
      f.add(SHAPES.bar, wire, HIPS, 0, 0.98, 0.4, [0.9, 1, 1]);
      f.add(SHAPES.carrier, 0x4a5a6a, HIPS, -0.08, 0.86, 0.78, [0.22, 0.14, 0.26]);
      f.add(SHAPES.carrier, 0xd8d4c8, HIPS, 0.12, 0.84, 0.9, [0.14, 0.1, 0.16]);
      for (const x of [-0.2, 0.2]) for (const z of [0.52, 1.04]) f.add(SHAPES.castor, 0x1e1e1e, HIPS, x, 0.05, z);
    }
    if (k.cane) f.add(SHAPES.cane, 0x3a2a1e, FORE_R, sw + 0.03, J.elbow - 0.73, 0.06);

    // Arms: rounded shoulder, tapered upper arm and forearm, hand.
    for (const [side, arm, fore] of [[-1, ARM_L, FORE_L], [1, ARM_R, FORE_R]] as const) {
      const x = side * sw;
      f.add(SHAPES.upperArm, coat, arm, x * 0.97, J.shoulder - 0.035, 0, [1, 1, 0.85]);
      if (look.shortSleeves && !look.kit?.longCoat && look.extra !== 'jacket') f.add(SHAPES.forearm, shade(look.skin, 0.95), fore, x, J.elbow, 0, [0.8, 1, 0.7], undefined, TILE.skin);
      else f.add(SHAPES.forearm, coat, fore, x, J.elbow, 0, [1, 1, 0.85]);
      f.add(SHAPES.hand, shade(look.skin, 0.88), fore, x, J.elbow - 0.31, 0.004, [0.028, 0.05, 0.02], [0, 0, side * 0.12]);
    }

    // Head: neck, egg-shaped skull, a nose so the facing reads, hair or hat.
    f.add(SHAPES.neck, look.skin, NECK, 0, J.neck + 0.03, 0);
    f.add(SHAPES.skull, look.skin, HEAD, 0, J.head + 0.1, 0.005, [0.083, 0.113, 0.097]);
    f.add(SHAPES.nose, look.skin, HEAD, 0, J.head + 0.085, 0.096);
    if (look.beard && !look.skirt) f.add(SHAPES.beard, new Color(look.hair).lerp(new Color(look.skin), 0.3).getHex(), HEAD, 0, J.head + 0.1, 0.008, [0.088, 0.118, 0.1]);

    const crown = J.head + 0.115;
    if (k.bucketHat && !look.police) {
      f.add(SHAPES.crown, look.accent, HEAD, 0, crown + 0.02, 0);
      f.add(SHAPES.brim, look.accent, HEAD, 0, crown + 0.0, 0);
    }
    if (k.hood === 'up') f.add(SHAPES.hood, look.top, HEAD, 0, J.head + 0.08, -0.015, [0.12, 0.15, 0.125], [-0.25, 0, 0]);
    if (k.hood === 'down') f.add(SHAPES.scarf, look.top, NECK, 0, J.neck + 0.02, -0.05, [1.3, 1.1, 1.2], [Math.PI / 2 - 0.4, 0, 0]);
    if (look.police) {
      f.add(SHAPES.beanie, PALETTE.policeVest, HEAD, 0, crown + 0.01, 0, [0.098, 0.08, 0.108]);
      f.add(SHAPES.rim, PALETTE.policeBand, HEAD, 0, crown + 0.015, 0, [0.1, 1, 0.11]);
      f.add(SHAPES.peak, PALETTE.frame, HEAD, 0, crown + 0.01, 0.1);
    } else if (k.hood === 'up' || k.bucketHat) {
      // Hair tucked under the hood or hat.
    } else switch (look.hairStyle) {
      case 0: f.add(SHAPES.hair, look.hair, HEAD, 0, crown, -0.005, [0.095, 0.11, 0.106], [-0.35, 0, 0]); break;
      case 1:
        f.add(SHAPES.hair, look.hair, HEAD, 0, crown, -0.005, [0.096, 0.11, 0.108], [-0.35, 0, 0]);
        f.add(SHAPES.longHair, look.hair, HEAD, 0, J.head + 0.04, -0.06, [1.1, 1, 0.55]);
        break;
      case 2:
        f.add(SHAPES.hair, look.hair, HEAD, 0, crown, -0.005, [0.095, 0.11, 0.106], [-0.35, 0, 0]);
        f.add(SHAPES.bun, look.hair, HEAD, 0, J.head + 0.2, -0.08);
        break;
      case 3: f.add(SHAPES.hair, look.hair, HEAD, 0, crown + 0.01, -0.005, [0.092, 0.08, 0.103], [-0.3, 0, 0]); break;
      case 4:
        f.add(SHAPES.beanie, look.accent, HEAD, 0, crown + 0.005, 0, [0.097, 0.11, 0.108]);
        f.add(SHAPES.rim, look.accent, HEAD, 0, crown + 0.01, 0, [0.099, 1, 0.11]);
        break;
      case 5:
        // Shaved close: a shadow of hair over the skull.
        f.add(SHAPES.hair, new Color(look.skin).lerp(new Color(look.hair), 0.5).getHex(), HEAD, 0, crown - 0.01, -0.004, [0.087, 0.1, 0.1], [-0.3, 0, 0]);
        break;
      case 6:
        f.add(SHAPES.hair, look.hair, HEAD, 0, crown, -0.005, [0.095, 0.11, 0.106], [-0.35, 0, 0]);
        f.add(SHAPES.ponytail, look.hair, HEAD, 0, J.head + 0.12, -0.11, undefined, [0.5, 0, 0]);
        break;
      case 7:
        // Flat cap: a soft crown and a short peak.
        f.add(SHAPES.capCrown, shade(look.bottom, 1.2), HEAD, 0, crown - 0.005, -0.005, [0.1, 0.075, 0.112]);
        f.add(SHAPES.peak, shade(look.bottom, 1.1), HEAD, 0, crown + 0.0, 0.095, [0.85, 1, 0.8], [0.15, 0, 0]);
        break;
    }

    // Skeleton in the bind pose, with joints where the parts were placed.
    const bone = (x: number, y: number, z = 0) => { const bn = new Bone(); bn.position.set(x, y, z); return bn; };
    const hips = bone(0, J.hip);
    const spine = bone(0, J.waist - J.hip);
    const neck = bone(0, J.neck - J.waist);
    const head = bone(0, J.head - J.neck);
    const thighL = bone(-hw, -0.03);
    const shinL = bone(0, J.knee - (J.hip - 0.03));
    const thighR = bone(hw, -0.03);
    const shinR = bone(0, J.knee - (J.hip - 0.03));
    const armL = bone(-sw, J.shoulder - J.waist);
    const foreL = bone(0, J.elbow - J.shoulder);
    const armR = bone(sw, J.shoulder - J.waist);
    const foreR = bone(0, J.elbow - J.shoulder);
    hips.add(spine, thighL, thighR);
    spine.add(neck, armL, armR);
    neck.add(head);
    thighL.add(shinL);
    thighR.add(shinR);
    armL.add(foreL);
    armR.add(foreR);
    this.bones = [hips, spine, neck, head, thighL, shinL, thighR, shinR, armL, foreL, armR, foreR];

    const joints: Joint[] = [
      { parent: HIPS, child: SPINE, x: 0, y: J.waist, radius: 0.1 },
      { parent: SPINE, child: NECK, x: 0, y: J.neck, radius: 0.06 },
      { parent: NECK, child: HEAD, x: 0, y: J.head, radius: 0.05 },
      { parent: SPINE, child: ARM_L, x: -sw, y: J.shoulder, radius: 0.09 },
      { parent: SPINE, child: ARM_R, x: sw, y: J.shoulder, radius: 0.09 },
      { parent: ARM_L, child: FORE_L, x: -sw, y: J.elbow, radius: 0.07 },
      { parent: ARM_R, child: FORE_R, x: sw, y: J.elbow, radius: 0.07 },
      { parent: HIPS, child: THIGH_L, x: -hw, y: J.hip - 0.03, radius: 0.1 },
      { parent: HIPS, child: THIGH_R, x: hw, y: J.hip - 0.03, radius: 0.1 },
      { parent: THIGH_L, child: SHIN_L, x: -hw, y: J.knee, radius: 0.08 },
      { parent: THIGH_R, child: SHIN_R, x: hw, y: J.knee, radius: 0.08 },
    ];
    this.mesh = new SkinnedMesh(f.build(joints), figureMaterial);
    this.mesh.add(hips);
    this.mesh.bind(new Skeleton(this.bones));
    this.mesh.castShadow = true;
    this.root.add(this.mesh);
    this.root.scale.setScalar((look.height / 1.75) * 1.06);
  }

  /** Frees the person's geometry and skeleton once they have left the scene. */
  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.skeleton.dispose();
  }

  /** `speed` in m/s drives stride; poses blend so changes never pop. */
  update(dt: number, pose: Pose, speed: number): void {
    this.idleTime += dt;
    this.sit = approach(this.sit, pose === 'sit' ? 1 : 0, 6, dt);
    if (pose === 'walk') {
      this.phase += dt * speed * 5.2;
      this.stride = approach(this.stride, 1, 8, dt);
    } else {
      this.stride = approach(this.stride, 0, 8, dt);
    }
    const bn = this.bones;
    const s = Math.sin(this.phase) * 0.5 * this.stride;
    const standing = 1 - this.sit;
    // Knees bend as each leg swings through, and fold to sit.
    const kneeL = Math.max(0, Math.sin(this.phase + Math.PI * 0.5)) * 0.75 * this.stride;
    const kneeR = Math.max(0, Math.sin(this.phase - Math.PI * 0.5)) * 0.75 * this.stride;
    bn[THIGH_L].rotation.x = s * standing - 1.45 * this.sit;
    bn[THIGH_R].rotation.x = -s * standing - 1.45 * this.sit;
    bn[SHIN_L].rotation.x = kneeL * standing + 1.45 * this.sit;
    bn[SHIN_R].rotation.x = kneeR * standing + 1.45 * this.sit;
    bn[HIPS].position.y = J.hip + Math.abs(Math.cos(this.phase)) * 0.03 * this.stride - 0.42 * this.sit;
    bn[SPINE].rotation.x = 0.05 * this.stride + this.slouch * 0.5;
    bn[NECK].rotation.x = this.slouch * 0.9;
    bn[HEAD].rotation.x = -this.slouch * 0.7 + this.headDown * this.stride;
    // Weight shifts from foot to foot while standing.
    bn[HIPS].rotation.z = Math.sin(this.idleTime * 0.37 + this.phase) * 0.035 * standing * (1 - this.stride);

    let armL = -s * this.swing;
    let armR = s * this.swing;
    let foreL = -0.15 - 0.2 * this.stride;
    let foreR = -0.15 - 0.2 * this.stride;
    if (pose === 'talk') {
      // Conversational gesture: one hand lifts now and then.
      const g = Math.max(0, Math.sin(this.idleTime * 1.7));
      armR = -0.25 - 0.35 * g;
      foreR = -0.4 - 0.9 * g;
    } else if (pose !== 'walk') {
      const breath = Math.sin(this.idleTime * 1.3) * 0.03;
      const pockets = this.look.pockets && !this.look.staff && !this.look.police ? standing : 0;
      armL = breath - 0.3 * this.sit + 0.14 * pockets;
      armR = -breath - 0.3 * this.sit + 0.14 * pockets;
      foreL = -0.12 - 0.6 * this.sit - 0.3 * pockets;
      foreR = -0.12 - 0.6 * this.sit - 0.3 * pockets;
    }
    const k = this.look.kit;
    if (k?.trolley) {
      // Both hands on the trolley bar.
      armL = -0.75; armR = -0.75; foreL = -0.55; foreR = -0.55;
    } else if (k?.suitcase) {
      armR = 0.12; foreR = -0.05;
    }
    bn[ARM_L].rotation.x = armL;
    bn[ARM_R].rotation.x = armR;
    bn[FORE_L].rotation.x = foreL;
    bn[FORE_R].rotation.x = foreR;
    bn[ARM_L].rotation.z = -0.06;
    bn[ARM_R].rotation.z = 0.06;
    // Idle glance: the head turns occasionally.
    const glance = pose === 'walk' ? 0 : Math.sin(this.idleTime * 0.45) * Math.sin(this.idleTime * 0.17) * 0.8;
    bn[HEAD].rotation.y = approach(bn[HEAD].rotation.y, glance, 3, dt);
  }
}
