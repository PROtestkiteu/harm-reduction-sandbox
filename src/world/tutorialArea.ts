import { Box3, Mesh, Vector3, Vector4, type Material, type Object3D } from 'three';
import type { CameraRig } from '../render/cameraRig';
import { serviceAt } from '../sim/types';
import type { TutorialCapabilities } from '../game/tutorial';
import type { Target } from '../ui/picking';
import type { Crowd } from '../agents/crowd';
import { cityBuilding } from './cityBuildings';
import type { Rect } from './layout';
import type { World } from './scene';

/** Authored contiguous districts grow north from the park instead of changing a city's identity. */
export { TUTORIAL_AREAS } from '../config/tutorialMap';
import { TUTORIAL_AREAS } from '../config/tutorialMap';

const within = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/**
 * Presentation of the shared domain capabilities. Merged city geometry stays batched: a world-space
 * shader boundary dims the inactive districts. Only a changed stage walks materials, never a frame.
 * Ordinary games do not construct this adapter or acquire its shader branch.
 */
export class TutorialArea {
  readonly frame = new Box3();
  private capabilities: TutorialCapabilities;
  private readonly boundsUniform = { value: new Vector4() };
  private readonly enabledUniform = { value: 1 };
  private readonly materials = new Set<Material>();

  constructor(private readonly world: World, private readonly rig: CameraRig, capabilities: TutorialCapabilities) {
    this.capabilities = capabilities;
    this.set(capabilities, true);
  }

  get bounds(): Rect { return TUTORIAL_AREAS[this.capabilities.district]; }

  set(capabilities: TutorialCapabilities, initial = false): boolean {
    if (!initial && capabilities === this.capabilities) return false;
    this.capabilities = capabilities;
    const b = this.bounds;
    this.boundsUniform.value.set(b.x0, b.x1, b.z0, b.z1);
    const restricted = capabilities.district !== 'city';
    this.enabledUniform.value = restricted ? 1 : 0;
    this.world.setTutorialActivity(capabilities.services, !restricted);
    this.frame.set(new Vector3(b.x0, 0, b.z0), new Vector3(b.x1, 14, b.z1));
    // Lesson bounds limit actions, not the camera. The authored city envelope includes
    // the northern park beyond the original city's radius, plus room to pan past the UI.
    this.rig.setNavigationBounds(TUTORIAL_AREAS.city);
    if (initial && restricted) {
      this.rig.lookAt(this.frame.getCenter(new Vector3()), 1);
      this.rig.step(0, true);
    }
    this.prepareMaterials(this.world.scene);
    return true;
  }

  /** Call after optional scenery arrives; existing materials are never patched twice. */
  prepareMaterials(root: Object3D): void {
    if (!this.enabledUniform.value && this.materials.size === 0) return;
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        if (this.materials.has(material) || material.type === 'ShaderMaterial') continue;
        this.materials.add(material);
        const compile = material.onBeforeCompile;
        const key = material.customProgramCacheKey.bind(material);
        material.onBeforeCompile = (shader: Parameters<Material['onBeforeCompile']>[0], renderer: Parameters<Material['onBeforeCompile']>[1]) => {
          compile.call(material, shader, renderer);
          shader.uniforms.tutorialBounds = this.boundsUniform;
          shader.uniforms.tutorialDim = this.enabledUniform;
          shader.vertexShader = 'varying vec2 tutorialGround;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ntutorialGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
          shader.fragmentShader = 'varying vec2 tutorialGround;\nuniform vec4 tutorialBounds;\nuniform float tutorialDim;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\nfloat tutorialInside = step(tutorialBounds.x, tutorialGround.x) * step(tutorialGround.x, tutorialBounds.y) * step(tutorialBounds.z, tutorialGround.y) * step(tutorialGround.y, tutorialBounds.w);\ngl_FragColor.rgb *= mix(1.0, 0.18 + 0.82 * tutorialInside, tutorialDim);');
        };
        material.customProgramCacheKey = () => key() + ':tutorial-area-v1';
        material.needsUpdate = true;
      }
    });
  }

  allowsTarget(target: Target, crowd: Crowd): boolean {
    if (this.capabilities.fullUi) return true;
    if (target.kind === 'location') return this.capabilities.services.includes(serviceAt(target.id));
    if (target.kind === 'building') {
      if (target.id === this.world.camps.park) return true;
      // Property and institution actions belong to the final coordinated-night lesson.
      if (!this.capabilities.organisation) return false;
      const b = cityBuilding(target.id);
      return !!b && within(this.bounds, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    }
    if (target.kind === 'person') {
      const p = crowd.person(target.id);
      return !!p && within(this.bounds, p.root.position.x, p.root.position.z);
    }
    return false;
  }
}
