// Compresses the people assets in place for slow connections: vertex data
// meshopt-encoded without quantizing (the figures merge body and hair parts
// and measure them, so attribute types and positions must stay as exported).
// The game's loader decodes it. Textures are left as they are (small WebP).
//
//   node scripts/compress-people.mjs
//
// Run once on the original exports; running it again on compressed files is harmless.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

const dir = new URL('../public/people/', import.meta.url).pathname;
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

for (const name of ['male', 'female', 'hair', 'anims']) {
  const file = `${dir}${name}.glb`;
  const before = statSync(file).size;
  const doc = await io.read(file);
  // No pruning: skins and nodes the game looks up by name must stay.
  await doc.transform(reorder({ encoder: MeshoptEncoder }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(file, doc);
  console.log(`${name}: ${(before / 1024).toFixed(0)} KB -> ${(statSync(file).size / 1024).toFixed(0)} KB`);
}
