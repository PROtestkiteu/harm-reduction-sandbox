import { Box3, OrthographicCamera, Vector2, Vector3 } from 'three';
import type { RenderFrame } from './frame';

/** Classic isometric view: 45 degrees around, arctan(1/sqrt 2) = 35.264 degrees above the ground. */
export const ISO_AZIMUTH_DEG = 45;
export const ISO_ELEVATION_DEG = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI;

/** Orbit angles in degrees. Azimuth turns around the vertical axis, elevation tilts above the ground. */
export interface ViewAngles { azimuthDeg: number; elevationDeg: number }

export const DEFAULT_VIEW: Readonly<ViewAngles> = { azimuthDeg: ISO_AZIMUTH_DEG, elevationDeg: ISO_ELEVATION_DEG };
export const ELEVATION_LIMITS = [15, 75] as const;

export function isDefaultView(v: ViewAngles): boolean {
  return Math.abs(v.azimuthDeg - DEFAULT_VIEW.azimuthDeg) < 0.01 && Math.abs(v.elevationDeg - DEFAULT_VIEW.elevationDeg) < 0.01;
}

function viewDirection(v: ViewAngles): Vector3 {
  const az = (v.azimuthDeg * Math.PI) / 180;
  const el = (v.elevationDeg * Math.PI) / 180;
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

export function createIsoCamera(): OrthographicCamera {
  return new OrthographicCamera(-1, 1, 1, -1, 1, 200);
}

/** CSS-pixel areas covered by the HUD, kept clear of the framed volume. */
export interface Insets { top: number; right: number; bottom: number; left: number }

export interface Framing { worldPerPixel: number; near: number; far: number }

/**
 * Fit `box` inside the visible canvas minus `insets`, with the frustum snapped
 * so one render pixel equals exactly `worldPerPixel` world units. `zoom` > 1
 * crops the edges evenly, for narrow screens. `focus`, when given, is the
 * world point placed at the centre of the visible area instead of the box
 * centre; combined with a larger `zoom` it frames one location or person.
 * `depth`, when given, is the whole volume that may come into view (a world
 * larger than the fitted box); the depth range then covers all of it, so
 * panning never clips anything. `scaleInsets` can keep zoom independent of panel
 * placement while `insets` still positions the subject in the clear map area.
 *
 * The fit uses the vertical cylinder around the box, which does not change as
 * the view turns, so orbiting never makes the scene pump in and out. At the
 * default 45 degree azimuth it matches a fit of the box corners exactly.
 */
export function frameCamera(
  camera: OrthographicCamera,
  box: Box3,
  frame: RenderFrame,
  insets: Insets,
  zoom = 1,
  view: ViewAngles = DEFAULT_VIEW,
  focus: Vector3 | null = null,
  depth: Box3 | null = null,
  scaleInsets: Insets = insets,
): Framing {
  const center = box.getCenter(new Vector3());
  // Far enough back that the whole depth volume sits in front of the camera.
  const reach = depth ? depth.getSize(new Vector3()).length() / 2 + 10 : 80;
  camera.position.copy(center).addScaledVector(viewDirection(view), Math.max(80, reach));
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);

  const inv = camera.matrixWorldInverse;
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const radius = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  const p = new Vector3();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    for (const y of [box.min.y, box.max.y]) {
      p.set(center.x + Math.cos(a) * radius, y, center.z + Math.sin(a) * radius).applyMatrix4(inv);
      min.min(p);
      max.max(p);
    }
  }

  // Everything below is in render pixels.
  const toLow = frame.dpr / frame.factor;
  const visW = (frame.cssW * frame.dpr) / frame.factor;
  const visH = (frame.cssH * frame.dpr) / frame.factor;
  const availW = Math.max(16, visW - (insets.left + insets.right) * toLow);
  const availH = Math.max(16, visH - (insets.top + insets.bottom) * toLow);
  const margin = 1.04;
  const scaleW = Math.max(16, visW - (scaleInsets.left + scaleInsets.right) * toLow);
  const scaleH = Math.max(16, visH - (scaleInsets.top + scaleInsets.bottom) * toLow);
  const wpp = (Math.max((max.x - min.x) / scaleW, (max.y - min.y) / scaleH) * margin) / zoom;

  let centerX = (min.x + max.x) / 2;
  let centerY = (min.y + max.y) / 2;
  if (focus) {
    p.copy(focus).applyMatrix4(inv);
    centerX = p.x;
    centerY = p.y;
  }
  const ax = insets.left * toLow + availW / 2;
  const ay = insets.bottom * toLow + availH / 2;
  const left = Math.round((centerX - ax * wpp) / wpp) * wpp;
  const bottom = Math.round((centerY - ay * wpp) / wpp) * wpp;
  camera.left = left;
  camera.right = left + frame.lowW * wpp;
  camera.bottom = bottom;
  camera.top = bottom + frame.lowH * wpp;
  if (depth) {
    // Depth range from the corners of the whole volume.
    min.z = Infinity;
    max.z = -Infinity;
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? depth.max.x : depth.min.x, i & 2 ? depth.max.y : depth.min.y, i & 4 ? depth.max.z : depth.min.z).applyMatrix4(inv);
      min.z = Math.min(min.z, p.z);
      max.z = Math.max(max.z, p.z);
    }
  }
  camera.near = Math.max(0.1, -max.z - 4);
  camera.far = -min.z + 4;
  camera.updateProjectionMatrix();
  return { worldPerPixel: wpp, near: camera.near, far: camera.far };
}

/** CSS client position to the NDC of the cropped low-res frame. */
export function clientToNdc(x: number, y: number, frame: RenderFrame, out = new Vector2()): Vector2 {
  const devX = x * frame.dpr;
  const devYFromBottom = (frame.cssH - y) * frame.dpr;
  return out.set((devX / (frame.lowW * frame.factor)) * 2 - 1, (devYFromBottom / (frame.lowH * frame.factor)) * 2 - 1);
}

/** World point to CSS client position, inverse of `clientToNdc`. */
export function worldToClient(point: Vector3, camera: OrthographicCamera, frame: RenderFrame): { x: number; y: number } {
  const ndc = point.clone().project(camera);
  const devX = ((ndc.x + 1) / 2) * frame.lowW * frame.factor;
  const devY = ((ndc.y + 1) / 2) * frame.lowH * frame.factor;
  return { x: devX / frame.dpr, y: frame.cssH - devY / frame.dpr };
}
