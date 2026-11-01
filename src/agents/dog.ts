import { CapsuleGeometry, Group, Mesh, MeshLambertMaterial, SphereGeometry, type Object3D } from 'three';

/** Shared shapes and coats: every dog reuses them. */
const SHAPES = {
  body: new CapsuleGeometry(0.11, 0.3, 4, 10).rotateX(Math.PI / 2),
  head: new SphereGeometry(0.09, 10, 8),
  snout: new CapsuleGeometry(0.04, 0.07, 3, 8).rotateX(Math.PI / 2),
  ear: new SphereGeometry(0.035, 6, 5),
  leg: new CapsuleGeometry(0.028, 0.18, 2, 6).translate(0, -0.1, 0),
  tail: new CapsuleGeometry(0.018, 0.16, 2, 6).translate(0, 0.08, 0),
};
const COATS = [0x8a6a4a, 0x2a2622, 0xc8b08a, 0x5a4a3a, 0xe0d8c8].map((c) => new MeshLambertMaterial({ color: c }));
const DARK = new MeshLambertMaterial({ color: 0x1e1a18 });

/**
 * A small dog trotting at its walker's side: rounded body, head, ears and a
 * tail that wags, legs that swing while walking. A handful of shared meshes;
 * placed by the crowd beside anyone walking a dog.
 */
export class Dog {
  readonly root = new Group();
  private readonly legs: Mesh[] = [];
  private readonly tail: Mesh;
  private phase = Math.random() * 6;

  constructor(seed: number) {
    const coat = COATS[Math.abs(seed) % COATS.length];
    const add = (geo: (typeof SHAPES)[keyof typeof SHAPES], m: MeshLambertMaterial, x: number, y: number, z: number, parent: Object3D = this.root) => {
      const mesh = new Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    add(SHAPES.body, coat, 0, 0.3, 0);
    add(SHAPES.head, coat, 0, 0.42, 0.26);
    add(SHAPES.snout, coat, 0, 0.39, 0.35);
    add(SHAPES.ear, DARK, -0.055, 0.5, 0.24);
    add(SHAPES.ear, DARK, 0.055, 0.5, 0.24);
    for (const [x, z] of [[-0.06, 0.15], [0.06, 0.15], [-0.06, -0.15], [0.06, -0.15]]) this.legs.push(add(SHAPES.leg, coat, x, 0.24, z));
    this.tail = add(SHAPES.tail, coat, 0, 0.36, -0.24);
    this.tail.rotation.x = -0.7;
    // At heel, a little ahead and to the right of the walker.
    this.root.position.set(0.55, 0, 0.25);
  }

  update(dt: number, moving: boolean, still: boolean): void {
    if (still) return;
    this.phase += dt * (moving ? 11 : 2);
    const swing = moving ? Math.sin(this.phase) * 0.6 : 0;
    this.legs.forEach((leg, i) => { leg.rotation.x = (i === 0 || i === 3 ? swing : -swing); });
    this.tail.rotation.z = Math.sin(this.phase * (moving ? 0.9 : 2.5)) * 0.5;
  }
}
