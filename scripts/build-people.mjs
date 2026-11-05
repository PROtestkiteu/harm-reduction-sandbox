// Prepares the people assets for the browser: CC0 base characters, hair and
// animations by Quaternius, reduced to a phone and headset budget.
//
//   node scripts/build-people.mjs <characters-dir> <animations-glb>
//
// <characters-dir>  the unzipped "Universal Base Characters[Standard]" folder
// <animations-glb>  "Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
//
// Writes public/people/{male,female,hair,anims}.glb and LICENSE.txt. The
// downloaded originals stay outside the repository.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, resample, simplify, textureCompress, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [charDir, animFile] = process.argv.slice(2);
if (!charDir || !animFile) {
  console.error('usage: node scripts/build-people.mjs <characters-dir> <animations-glb>');
  process.exit(1);
}
const out = new URL('../public/people/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

// A 1x1 white PNG, standing in for image files the source .gltf names but the zip lacks.
const BLANK = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XG0WcAAAAASUVORK5CYII=', 'base64');

/** Reads a .gltf whose external files may be missing; absent images become a blank pixel. */
async function read(file) {
  if (!file.endsWith('.gltf')) return io.read(file);
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

/** Simplifies every mesh to about `ratio` of its triangles, keeping UV seams and skin weights. */
async function reduce(doc, ratio) {
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: false }));
}

/** Base colour only, at phone size; normal and roughness maps are not used by the figure shader. */
async function textures(doc, size) {
  for (const material of doc.getRoot().listMaterials()) {
    material.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
  }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }));
}

function triangles(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  return n;
}

// Bodies: the body, eyes and brows, each reduced.
for (const [name, file] of [['male', 'Superhero_Male_FullBody.gltf'], ['female', 'Superhero_Female_FullBody.gltf']]) {
  const doc = await read(join(charDir, 'Base Characters', 'Godot - UE', file));
  const before = triangles(doc);
  await reduce(doc, 0.24);
  await textures(doc, 512);
  await io.write(join(out, `${name}.glb`), doc);
  console.log(`${name}: ${before} -> ${triangles(doc)} triangles`);
}

// Hair: every style in one file, each rigged to the head bone.
{
  const hairDir = join(charDir, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)');
  const styles = ['Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_SimpleParted', 'Hair_Beard'];
  // Each style's meshes and nodes take the style's name, so the game can find them.
  const named = (doc, style) => {
    for (const m of doc.getRoot().listMeshes()) m.setName(style);
    for (const n of doc.getRoot().listNodes()) if (n.getMesh()) n.setName(style);
    return doc;
  };
  const doc = named(await read(join(hairDir, `${styles[0]}.gltf`)), styles[0]);
  for (const s of styles.slice(1)) {
    const other = named(await read(join(hairDir, `${s}.gltf`)), s);
    mergeDocuments(doc, other);
  }
  const before = triangles(doc);
  await reduce(doc, 0.3);
  await textures(doc, 512);
  await doc.transform(unpartition());
  await io.write(join(out, 'hair.glb'), doc);
  console.log(`hair: ${before} -> ${triangles(doc)} triangles, ${doc.getRoot().listMeshes().map((m) => m.getName()).join(', ')}`);
}

// Animations: only the clips the crowd uses, without the mannequin mesh,
// finger tracks or scale tracks, and with positions kept on root and pelvis only.
{
  const keep = new Set(['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Push_Loop', 'Crouch_Idle_Loop', 'Dance_Loop']);
  const doc = await io.read(animFile);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (keep.has(a.getName())) continue;
    // Samplers hold the keyframe data; dispose them with the clip so prune can drop it.
    for (const ch of a.listChannels()) ch.dispose();
    for (const sm of a.listSamplers()) sm.dispose();
    a.dispose();
  }
  const finger = /(index|middle|pinky|ring|thumb)_0\d/;
  for (const a of root.listAnimations()) {
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode();
      const path = ch.getTargetPath();
      const name = node?.getName() ?? '';
      const drop = !node || path === 'scale' || finger.test(name) || (path === 'translation' && name !== 'root' && name !== 'pelvis');
      if (drop) {
        const sm = ch.getSampler();
        ch.dispose();
        if (sm && sm.listParents().every((p) => p.propertyType !== 'AnimationChannel')) sm.dispose();
      }
    }
  }
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const node of root.listNodes()) if (node.getSkin()) node.setSkin(null);
  for (const skin of root.listSkins()) skin.dispose();
  await doc.transform(resample({ tolerance: 0.0015 }), prune({ keepLeaves: true }), dedup(), unpartition());
  await io.write(join(out, 'anims.glb'), doc);
  console.log(`anims: ${root.listAnimations().map((a) => a.getName()).join(', ')}`);
}

writeFileSync(
  join(out, 'LICENSE.txt'),
  `People in Harm Reduction Project are built from CC0 assets by Quaternius:
- Universal Base Characters (Standard): base bodies, eyes, brows and hairstyles
- Universal Animation Library (Standard): animation clips
https://quaternius.com

License: CC0 1.0 Universal (Public Domain Dedication)
https://creativecommons.org/publicdomain/zero/1.0/

Prepared with scripts/build-people.mjs: meshes simplified, textures resized
to 512 px WebP, unused maps, clips, finger and scale tracks removed.
`,
);
