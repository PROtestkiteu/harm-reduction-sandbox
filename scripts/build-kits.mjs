// Prepares a small selection of Quaternius's CC0 kits for the browser, at a
// phone budget: only the pieces the city uses, simplified, base colour only,
// textures at 512 px or less as WebP, everything in one GLB per kit.
//
//   node scripts/build-kits.mjs <city-gltf-dir> <nature-gltf-dir>
//
// <city-gltf-dir>    Downtown City MegaKit [Standard]: "Exports/glTF (Godot)"
// <nature-gltf-dir>  Stylized Nature MegaKit [Standard]: "glTF"
//
// Writes public/kits/{city,nature}.glb and LICENSE.txt. The downloaded
// originals (over 300 MB) stay outside the repository.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join as joinPrims, mergeDocuments, prune, quantize, reorder, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [cityDir, natureDir] = process.argv.slice(2);
if (!cityDir || !natureDir) {
  console.error('usage: node scripts/build-kits.mjs <city-gltf-dir> <nature-gltf-dir>');
  process.exit(1);
}
const out = new URL('../public/kits/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

/** The pieces taken, and how far each is simplified (1 keeps every triangle). */
const KITS = {
  city: {
    dir: cityDir,
    texture: 512,
    pieces: {
      Building_Small_1: 0.35,
      Building_Medium_2_001: 0.35,
      Building_Large_2: 0.3,
      Prop_Bollard: 1,
      Prop_Planter_Single: 0.7,
      Prop_ACUnit: 0.7,
    },
  },
  nature: {
    dir: natureDir,
    texture: 256,
    pieces: {
      CommonTree_1: 0.45,
      CommonTree_2: 0.45,
      CommonTree_3: 0.45,
      Pine_1: 0.5,
      Pine_3: 0.5,
      Bush_Common: 0.5,
      Bush_Common_Flowers: 0.5,
      Flower_3_Group: 0.6,
      Flower_4_Group: 0.6,
      Grass_Common_Short: 0.6,
      Rock_Medium_1: 0.6,
      Fern_1: 0.6,
    },
  },
};

const BLANK = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XG0WcAAAAASUVORK5CYII=', 'base64');

/** Reads a .gltf; image files it names but the folder lacks become a blank pixel. */
function read(file) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const resources = {};
  for (const b of json.buffers ?? []) if (b.uri) resources[b.uri] = new Uint8Array(readFileSync(join(dirname(file), decodeURIComponent(b.uri))));
  for (const img of json.images ?? []) {
    if (!img.uri) continue;
    const path = join(dirname(file), decodeURIComponent(img.uri));
    resources[img.uri] = new Uint8Array(existsSync(path) ? readFileSync(path) : BLANK);
  }
  return io.readJSON({ json, resources });
}

function triangles(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  return n;
}

for (const [kit, { dir, texture, pieces }] of Object.entries(KITS)) {
  let doc = null;
  let before = 0;
  for (const [name, ratio] of Object.entries(pieces)) {
    const file = join(dir, `${name}.gltf`);
    if (!existsSync(file)) { console.warn(`missing: ${file}`); continue; }
    const part = await read(file);
    before += triangles(part);
    await part.transform(flatten(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.03 }));
    // One named root per piece, so the game can find it by name.
    const scene = part.getRoot().getDefaultScene() ?? part.getRoot().listScenes()[0];
    const root = part.createNode(name);
    for (const child of scene.listChildren()) { scene.removeChild(child); root.addChild(child); }
    scene.addChild(root);
    if (!doc) doc = part;
    else {
      const map = mergeDocuments(doc, part);
      const merged = map.get(scene);
      for (const child of merged.listChildren()) doc.getRoot().getDefaultScene().addChild(child);
      merged.dispose();
    }
  }
  // Only what the city draws: positions, normals and one set of texture coordinates.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(semantic)) prim.setAttribute(semantic, null);
    }
  }
  // Base colour only: the city's shaders never use normal, roughness or occlusion maps.
  for (const material of doc.getRoot().listMaterials()) {
    material.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
  }
  await doc.transform(joinPrims(), prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texture, texture], quality: 78 }));
  // One buffer for the whole GLB: move every accessor onto the first, then drop the rest.
  const [main, ...extra] = doc.getRoot().listBuffers();
  for (const a of doc.getRoot().listAccessors()) a.setBuffer(main);
  for (const b of extra) b.dispose();
  // Smaller vertices and meshopt compression: the game's loader decodes both.
  await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const file = join(out, `${kit}.glb`);
  await io.write(file, doc);
  console.log(`${kit}: ${before} -> ${triangles(doc)} triangles, ${(statSync(file).size / 1024).toFixed(0)} KB`);
}

writeFileSync(join(out, 'LICENSE.txt'), [
  'Downtown City MegaKit [Standard] and Stylized Nature MegaKit [Standard] by Quaternius (https://quaternius.com).',
  'Licence: CC0 1.0 Universal, public domain dedication (https://creativecommons.org/publicdomain/zero/1.0/).',
  'A small selection, simplified and re-encoded by scripts/build-kits.mjs.',
  '',
].join('\n'));
