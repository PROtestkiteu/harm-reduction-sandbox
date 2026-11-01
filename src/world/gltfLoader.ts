import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * The glTF loader with its meshopt decoder, fetched only when the optional models load (the city
 * kits, the people). The game starts without them, so they stay out of the first download: on a
 * slow connection, where the models are skipped, they are never fetched at all.
 */
export async function gltfLoader(): Promise<GLTFLoader> {
  const [{ GLTFLoader: Loader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  return new Loader().setMeshoptDecoder(MeshoptDecoder);
}
