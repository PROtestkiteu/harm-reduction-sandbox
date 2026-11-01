import { OVERLAY_LAYER } from '../render/highlight';
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type Camera,
} from 'three';

/** States the crowd shows around a person. Each comes from a simulation outcome. */
export type Mood = 'relieved' | 'unmet' | 'intoxicated' | 'adverse';

/** One hue per state: served, need unmet, visibly intoxicated, the adverse placeholder. */
const HUES: Record<Mood, string> = {
  relieved: '63,196,122',
  unmet: '74,111,208',
  intoxicated: '240,168,32',
  adverse: '224,80,60',
};

/** A soft radial glow in one hue, transparent at the edge. */
function glowTexture(rgb: string, tall: boolean): CanvasTexture {
  const w = 64;
  const h = tall ? 128 : 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, h / w, 0, 0);
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, `rgba(${rgb},0.55)`);
  g.addColorStop(0.55, `rgba(${rgb},0.2)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const auraGeo = new PlaneGeometry(1.0, 2.2).translate(0, 1.0, 0);
const poolGeo = new PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2);

/**
 * A soft hue around a person instead of a badge: a glow they stand in front
 * of, and a matching pool of colour at their feet. Pooled per agent, shared
 * materials per state.
 */
export class MoodIcons {
  private readonly auraMats = {} as Record<Mood, MeshBasicMaterial>;
  private readonly poolMats = {} as Record<Mood, MeshBasicMaterial>;
  private readonly active = new Map<number, Group>();
  private readonly spare: Group[] = [];
  private readonly behind = new Vector3();
  private camera: Camera | null = null;

  constructor(private readonly parent: Group) {
    for (const mood of Object.keys(HUES) as Mood[]) {
      const common = { transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false } as const;
      this.auraMats[mood] = new MeshBasicMaterial({ map: glowTexture(HUES[mood], true), ...common });
      this.poolMats[mood] = new MeshBasicMaterial({ map: glowTexture(HUES[mood], false), ...common });
    }
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /** `at` is the person's feet; `height` is unused now (kept for the crowd's call). */
  show(id: number, mood: Mood, at: Vector3, _height: number): void {
    let g = this.active.get(id);
    if (!g) {
      g = this.spare.pop() ?? this.make();
      this.parent.add(g);
      this.active.set(id, g);
    }
    const [aura, pool] = g.children as [Mesh, Mesh];
    if (aura.material !== this.auraMats[mood]) {
      aura.material = this.auraMats[mood];
      pool.material = this.poolMats[mood];
    }
    pool.position.set(at.x, at.y + 0.03, at.z);
    if (this.camera) {
      // The aura stands just behind the person as seen from the camera, facing it.
      this.camera.getWorldDirection(this.behind).multiplyScalar(0.35);
      aura.position.set(at.x + this.behind.x, at.y, at.z + this.behind.z);
      aura.quaternion.copy(this.camera.quaternion);
    }
  }

  release(id: number): void {
    const g = this.active.get(id);
    if (!g) return;
    this.active.delete(id);
    this.parent.remove(g);
    this.spare.push(g);
  }

  private make(): Group {
    const g = new Group();
    const aura = new Mesh(auraGeo);
    const pool = new Mesh(poolGeo);
    for (const m of [aura, pool]) {
      m.layers.set(OVERLAY_LAYER);
      m.castShadow = false;
      m.renderOrder = 3;
    }
    g.add(aura, pool);
    return g;
  }
}
