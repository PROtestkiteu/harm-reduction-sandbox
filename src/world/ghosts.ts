import { AdditiveBlending, Group, MeshBasicMaterial, type Object3D, type SkinnedMesh } from 'three';
import { CharacterRig, randomAppearance, type Figure } from '../agents/character';
import { HumanFigure, peopleLibrary } from '../agents/humanFigure';
import { createRandom } from '../sim/random';

/**
 * When someone dies in the city: they lie where they were found, and a pale,
 * see-through likeness of them sits up out of the body and rises into the
 * sky, swaying a little and fading as it goes. The body stays until the
 * ambulance has been, then fades too. With reduced motion the likeness fades
 * where it lies. Rare, so each one builds its two figures and frees them after.
 */

/** Seconds: the likeness sitting up, the climb, the body waiting for the ambulance. */
const RISE = { sitUp: 2.2, climb: 7, height: 9, bodyFor: 45 };

interface Ghost { body: Figure; spirit: Figure; spiritMat: MeshBasicMaterial; t: number; x: number; z: number; still: boolean }

export class Ghosts {
  private readonly root = new Group();
  private readonly live: Ghost[] = [];
  private readonly random = createRandom(6113);

  constructor(scene: Object3D) {
    scene.add(this.root);
  }

  /** Someone died at (x, z), found lying out (sleeping rough, or in the heat). */
  spawn(x: number, z: number, still: boolean): void {
    const look = { ...randomAppearance(this.random, false, 'unhoused'), dog: false };
    const lib = peopleLibrary();
    const make = (): Figure => (lib ? new HumanFigure(lib, look) : new CharacterRig(look));
    const heading = this.random() * Math.PI * 2;
    const body = make();
    // Lying on their back on the ground, as they were found.
    body.root.position.set(x, 0.16, z);
    body.root.rotation.set(-Math.PI / 2, heading, 0, 'YXZ');
    body.update(0, 'stand', 0);
    const spirit = make();
    const spiritMat = new MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
    spirit.root.traverse((o) => {
      const m = o as SkinnedMesh;
      if ((m as { isMesh?: boolean }).isMesh) { m.material = spiritMat; m.castShadow = false; }
    });
    spirit.root.position.copy(body.root.position);
    spirit.root.rotation.copy(body.root.rotation);
    spirit.update(0, 'stand', 0);
    this.root.add(body.root, spirit.root);
    this.live.push({ body, spirit, spiritMat, t: 0, x, z, still });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      g.t += dt;
      const t = g.t;
      const s = g.spirit.root;
      if (g.still) {
        // Reduced motion: it shows where they lie and fades.
        g.spiritMat.opacity = Math.max(0, 0.45 * Math.min(1, t / 0.8) * (1 - Math.max(0, t - 2) / 3));
      } else if (t < RISE.sitUp) {
        // Sitting up out of the body.
        const k = t / RISE.sitUp;
        const e = k * k * (3 - 2 * k);
        s.rotation.x = -Math.PI / 2 * (1 - e);
        s.position.y = 0.16 + e * 0.25;
        g.spiritMat.opacity = 0.5 * Math.min(1, k * 2);
      } else {
        // Up into the sky, swaying, fading as it goes.
        const k = Math.min(1, (t - RISE.sitUp) / RISE.climb);
        s.rotation.x = 0;
        s.position.set(g.x + Math.sin(t * 1.3) * 0.25 * k, 0.41 + RISE.height * k * k * (3 - 2 * k), g.z + Math.cos(t * 1.1) * 0.2 * k);
        s.scale.setScalar(g.body.root.scale.x * (1 + 0.25 * k));
        g.spiritMat.opacity = 0.5 * (1 - k);
      }
      if (g.spiritMat.opacity > 0) g.spirit.update(dt, 'stand', 0);
      s.visible = g.spiritMat.opacity > 0.01;
      // The body lies until the ambulance has taken them, then goes.
      if (t > RISE.bodyFor) {
        g.body.root.visible = false;
        this.root.remove(g.body.root, g.spirit.root);
        g.body.dispose();
        g.spirit.dispose();
        g.spiritMat.dispose();
        this.live.splice(i, 1);
      }
    }
  }
}
