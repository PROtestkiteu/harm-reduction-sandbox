import type { Object3D } from 'three';

/** Render layers the scene pipeline draws into its highlight mask. Layer 0 is the normal scene. */
export const HOVER_LAYER = 1;
export const SELECT_LAYER = 2;
/** Flat overlays (mood badges) drawn in the main pass only, never in the highlight mask. */
export const OVERLAY_LAYER = 3;

/**
 * Tracks which subtree is hovered and which is selected by toggling a render
 * layer on its objects. Changing a target walks that subtree once; the
 * pipeline then draws a soft rim around whatever carries the layer.
 */
export class Highlight {
  private hovered: Object3D | null = null;
  private selected: Object3D | null = null;

  get hoverTarget(): Object3D | null { return this.hovered; }
  get selectTarget(): Object3D | null { return this.selected; }

  /** Returns true when the target changed and the frame needs a redraw. */
  setHover(target: Object3D | null): boolean {
    if (target === this.hovered) return false;
    setLayer(this.hovered, HOVER_LAYER, false);
    this.hovered = target;
    setLayer(target, HOVER_LAYER, true);
    return true;
  }

  setSelected(target: Object3D | null): boolean {
    if (target === this.selected) return false;
    setLayer(this.selected, SELECT_LAYER, false);
    this.selected = target;
    setLayer(target, SELECT_LAYER, true);
    return true;
  }
}

function setLayer(root: Object3D | null, layer: number, on: boolean): void {
  root?.traverse((o) => (on ? o.layers.enable(layer) : o.layers.disable(layer)));
}
