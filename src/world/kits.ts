import { Color, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Object3D, Vector3, type Material, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { gltfLoader } from './gltfLoader';
import { dynamic } from './mergeStatic';
import { SNOW } from './materials';
import type { Season } from '../config/seasons';

/**
 * Quaternius's CC0 kits (a small selection, see scripts/build-kits.mjs),
 * loaded in the background after the game starts so they never hold up the
 * first frame. Until they arrive, and if they never do, the city keeps its
 * own procedural trees and buildings.
 */
export interface Kits {
  /** A kit piece by name (for example 'CommonTree_1'), or undefined. */
  piece(name: string): Object3D | undefined;
}

export async function loadKits(): Promise<Kits | null> {
  const url = (file: string) => new URL(`kits/${file}`, document.baseURI).toString();
  try {
    const loader = await gltfLoader();
    const [city, nature] = await Promise.all([loader.loadAsync(url('city.glb')), loader.loadAsync(url('nature.glb'))]);
    const pieces = new Map<string, Object3D>();
    for (const gltf of [city, nature]) {
      for (const child of gltf.scene.children) pieces.set(child.name, child);
      // Matte, like the rest of the city: Lambert keeps the shader count and cost down.
      gltf.scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const swap = (src: Material) => {
          const s = src as MeshStandardMaterial;
          return seasonal(new MeshLambertMaterial({ color: s.color, map: s.map, alphaTest: s.alphaTest, transparent: false, side: s.side }), src.name);
        };
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
      });
    }
    return { piece: (name) => pieces.get(name) };
  } catch {
    return null;
  }
}

/** What a kit material is, for the seasons: tree crowns, bushes, low plants, blossom, or the rest. */
type Part = 'crown' | 'pine' | 'bush' | 'plant' | 'grass' | 'flowers' | 'other';
const PART: Record<string, Part> = {
  Leaves_NormalTree: 'crown',
  Leaves_Pine: 'pine',
  Leaves_TwistedTree: 'bush',
  Leaves: 'plant',
  Grass: 'grass',
  Flowers: 'flowers',
};

/** Colour each part takes in each season (a multiplier on its texture); null hides it. */
const SEASON_TINT: Record<Season, Partial<Record<Part, [number, number, number] | null>>> = {
  spring: { crown: [1.05, 1.18, 0.82], bush: [1.05, 1.15, 0.85], plant: [1.05, 1.15, 0.85], grass: [1.0, 1.12, 0.85] },
  summer: {},
  autumn: { crown: [1.7, 0.92, 0.38], bush: [1.35, 0.85, 0.45], plant: [1.2, 0.9, 0.5], grass: [1.2, 1.0, 0.62], flowers: null },
  winter: { crown: null, bush: [0.75, 0.72, 0.62], plant: [0.7, 0.68, 0.6], grass: [0.85, 0.85, 0.78], pine: [0.82, 0.88, 0.85], flowers: null },
};

const seasonals: { material: MeshLambertMaterial; part: Part; tint: { value: Color } }[] = [];
let currentSeason: Season = 'summer';

/**
 * The kit's matte material with the season on it: crowns turn and drop,
 * grass and bushes fade, blossom goes, and snow settles on whatever faces up
 * (instance by instance, so every tree gets its own white top).
 */
function seasonal(material: MeshLambertMaterial, name: string): MeshLambertMaterial {
  const tint = { value: new Color(1, 1, 1) };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uKitTint = tint;
    shader.uniforms.uSnow = SNOW;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKitN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 kitN = objectNormal;
        #ifdef USE_INSTANCING
          kitN = mat3(instanceMatrix) * kitN;
        #endif
        vKitN = normalize(mat3(modelMatrix) * kitN);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKitN;\nuniform vec3 uKitTint;\nuniform float uSnow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= uKitTint;
        float kitUp = smoothstep(0.3, 0.8, normalize(vKitN).y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.92), kitUp * uSnow * 0.9);`);
  };
  material.customProgramCacheKey = () => 'kit-seasonal';
  const part = PART[name] ?? 'other';
  seasonals.push({ material, part, tint });
  applySeason(seasonals[seasonals.length - 1], currentSeason);
  return material;
}

function applySeason(e: (typeof seasonals)[number], season: Season): void {
  const t = SEASON_TINT[season][e.part];
  e.material.visible = t !== null;
  e.tint.value.setRGB(...(t ?? [1, 1, 1]));
}

/** Puts the kit's plants in the season; kits that load later pick it up too. */
export function setKitSeason(season: Season): void {
  currentSeason = season;
  for (const e of seasonals) applySeason(e, season);
}

/** Where to put one copy: position, turn about y, uniform scale. */
export interface Placement { x: number; y: number; z: number; rot: number; scale: number }

/**
 * Many copies of one kit piece as instanced meshes: one draw call per
 * material of the piece, however many copies. Added to `parent`.
 */
export function instance(parent: Object3D, piece: Object3D, at: readonly Placement[], shadows = false): Object3D {
  const holder = dynamic(new Object3D());
  parent.add(holder);
  if (!at.length) return holder;
  piece.updateMatrixWorld(true);
  const toPiece = new Matrix4().copy(piece.matrixWorld).invert();
  const place = new Matrix4();
  const local = new Matrix4();
  const m = new Matrix4();
  const k = new Vector3();
  piece.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    local.multiplyMatrices(toPiece, mesh.matrixWorld);
    const inst = new InstancedMesh(mesh.geometry, mesh.material, at.length);
    at.forEach((p, i) => {
      place.makeRotationY(p.rot).scale(k.setScalar(p.scale)).setPosition(p.x, p.y, p.z);
      inst.setMatrixAt(i, m.multiplyMatrices(place, local));
    });
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    holder.add(inst);
  });
  return holder;
}
