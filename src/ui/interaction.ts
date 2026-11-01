import { Vector3, type Object3D, type OrthographicCamera } from 'three';
import type { Crowd } from '../agents/crowd';
import type { CameraRig } from '../render/cameraRig';
import type { Highlight } from '../render/highlight';
import type { RenderFrame } from '../render/frame';
import { LOCATION_IDS, type LocationId } from '../sim/types';
import type { World } from '../world/scene';
import type { Hud } from './hud';
import { describePerson } from './personInfo';
import { ScenePicker, sameTarget, type Target } from './picking';
import { cityBuilding } from '../world/cityBuildings';
import type { BuildingCard } from './hud';
import type { SelectionMarker } from './selection';
import { t } from '../i18n';

export interface InteractionDeps {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  camera: OrthographicCamera;
  frame(): RenderFrame;
  world: World;
  crowd: Crowd;
  rig: CameraRig;
  hud: Hud;
  highlight: Highlight;
  marker: SelectionMarker;
  reducedMotion: MediaQueryList;
  /** The card for an ordinary building: its figures and the neighbourhood's. */
  buildingCard(id: number): BuildingCard;
  /** The card for a police car or ambulance: why it is out; undefined once it has gone. */
  vehicleCard(id: number): BuildingCard | undefined;
  /** Right-click or long press: open the action menu for what is now selected. */
  openMenu(x: number, y: number): void;
}

const PERSON_ZOOM = 2.6;
const TAP_SLOP = 10;
/** How long a still finger must rest before it counts as a long press. */
const LONG_PRESS_MS = 520;
const DOUBLE_MS = 380;
const DOUBLE_SLOP = 28;

/**
 * Pointer, touch and keyboard interaction: hover highlight and tooltip,
 * selecting locations and people, following a selected person, focus zoom,
 * orbiting. Owns the selection; the HUD and highlight only reflect it.
 *
 * Work triggered by pointer moves is coalesced into the next frame, and every
 * per-frame check re-reads the crowd, so a person who leaves mid-hover or
 * mid-follow can never leave a stale selection behind.
 */
export class Interaction {
  private readonly picker: ScenePicker;
  private readonly tooltip: HTMLElement;
  private readonly tipTitle: HTMLElement;
  private readonly tipBody: HTMLElement;
  private selection: Target | null = null;
  private following = false;
  /** Title of a person who has left, kept so the card can say so. */
  private leftTitle: string | null = null;
  private hover: Target | null = null;
  private placing: { targets: () => readonly { id: number; root: Object3D }[]; onPick(id: number): void; onEnd(): void } | null = null;
  private pointer: { x: number; y: number; coarse: boolean } | null = null;
  private hoverPending = false;
  private tooltipText = '';
  private tooltipPos = '';
  private redraw = false;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private orbit: { x: number; y: number; az: number; el: number; pointer: number | 'touch' } | null = null;
  private down: { x: number; y: number; id: number; time: number } | null = null;
  private drag: { id: number; x: number; y: number; active: boolean } | null = null;
  /** Finger spread at the last two-finger move, for pinch zoom; 0 when not pinching. */
  private pinch = 0;
  private wheel = 0;
  private suppressTap = false;
  private longPress = 0;
  private rightDown: { x: number; y: number } | null = null;
  private lastTap: { time: number; x: number; y: number; target: Target | null } | null = null;
  private readonly scratch = new Vector3();
  private readonly sceneRadius: number;

  constructor(private readonly d: InteractionDeps) {
    this.picker = new ScenePicker(d.world.locations, d.crowd, () => d.world.pickables(), () => d.world.vehicles());
    const size = d.world.frame.full.getSize(new Vector3());
    this.sceneRadius = Math.hypot(size.x, size.z) / 2;
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'scene-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.hidden = true;
    this.tipTitle = document.createElement('span');
    this.tipTitle.className = 'tip-title';
    this.tipBody = document.createElement('span');
    this.tipBody.className = 'tip-body';
    this.tooltip.append(this.tipTitle, this.tipBody);
    d.overlay.append(this.tooltip);
    this.bindPointer();
    this.bindKeys();
    this.bindLabels();
  }

  /** Flags for the render pipeline's highlight mask. */
  get highlightFlags(): { hover: boolean; select: boolean } {
    return { hover: this.d.highlight.hoverTarget !== null, select: this.d.highlight.selectTarget !== null };
  }

  // Selection

  selectLocation(id: LocationId | null): void {
    this.select(id ? { kind: 'location', id } : null);
  }

  /** What is selected now (for the portrait), or null. */
  get selected(): Target | null {
    return this.selection;
  }

  select(target: Target | null): void {
    const { hud, marker, highlight, rig, world, crowd } = this.d;
    this.leftTitle = null;
    if (target?.kind === 'location') target = { kind: 'location', id: target.id };
    if (target?.kind === 'person' && !crowd.person(target.id)) target = null;
    const wasFocused = rig.focused;
    this.selection = target;
    this.following = false;
    if (!target) {
      marker.show(null);
      highlight.setSelected(null);
      hud.showLocation(null);
      if (wasFocused) rig.release();
    } else if (target.kind === 'building') {
      const b = cityBuilding(target.id)!;
      marker.show({ footprint: { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, rx: (b.x1 - b.x0) / 2 + 0.4, rz: (b.z1 - b.z0) / 2 + 0.4 } });
      highlight.setSelected(null);
      hud.showBuilding(this.d.buildingCard(target.id));
      if (wasFocused) rig.release();
    } else if (target.kind === 'vehicle') {
      const card = this.d.vehicleCard(target.id);
      if (!card) { this.select(null); return; }
      marker.show(null);
      highlight.setSelected(this.vehicleRoot(target.id));
      hud.showBuilding(card);
      if (wasFocused) rig.release();
    } else if (target.kind === 'location') {
      marker.show(world.locations[target.id]);
      // A red rim around the whole building, like a selected person.
      highlight.setSelected(world.locations[target.id].root);
      hud.showLocation(target.id);
      // Already zoomed in: carry the zoom over to the new location.
      if (wasFocused) this.focusLocation(target.id);
    } else {
      marker.show(null);
      highlight.setSelected(crowd.person(target.id)!.root);
      this.following = true;
      this.updatePersonCard();
    }
    this.syncFocusButton();
    this.redraw = true;
  }

  /** Zoom onto the selection, or back out to the overview. */
  toggleFocus(): void {
    const sel = this.selection;
    if (!sel) return;
    if (sel.kind === 'building' || sel.kind === 'vehicle') return;
    if (sel.kind === 'location') {
      if (this.d.rig.focused) this.d.rig.release();
      else this.focusLocation(sel.id);
    } else {
      this.following = !this.following;
      if (!this.following) this.d.rig.release();
      this.updatePersonCard();
    }
    this.syncFocusButton();
  }

  resetView(): void {
    if (this.following) {
      this.following = false;
      this.updatePersonCard();
    }
    this.d.rig.reset();
    this.syncFocusButton();
  }

  private focusLocation(id: LocationId): void {
    const f = this.d.world.locations[id].footprint;
    const zoom = (this.sceneRadius / Math.max(f.rx, f.rz)) * 0.42;
    this.d.rig.focusOn(this.scratch.set(f.x, 1.2, f.z), Math.max(1.6, zoom));
  }

  private syncFocusButton(): void {
    const sel = this.selection;
    const focused = sel?.kind === 'person' ? this.following : this.d.rig.focused;
    this.d.hud.setFocused(focused, sel?.kind === 'person');
  }

  private updatePersonCard(): void {
    if (this.selection?.kind !== 'person') return;
    const p = this.d.crowd.person(this.selection.id);
    const card = p ? describePerson(p) : null;
    this.d.hud.showPerson(card, this.following, this.leftTitle ?? undefined);
    this.syncFocusButton();
  }

  // Per-frame work, called by the main loop after the crowd moved.

  /** Returns true when something visual changed and the frame needs a redraw. */
  frame(): boolean {
    const { crowd, rig, highlight } = this.d;
    const sel = this.selection;
    if (sel?.kind === 'person') {
      const p = crowd.person(sel.id);
      if (!p) {
        // They walked off the edge: keep the card open, saying so, and drop the follow.
        const title = this.leftTitle ?? t('Person');
        this.selection = null;
        highlight.setSelected(null);
        if (this.following && rig.focused) rig.release();
        this.following = false;
        this.d.hud.showPerson(null, false, title);
        this.syncFocusButton();
        this.redraw = true;
      } else {
        this.leftTitle = describePerson(p).title;
        if (this.following) {
          const r = p.root.position;
          rig.focusOn(this.scratch.set(r.x, r.y + 0.9, r.z), PERSON_ZOOM);
        }
      }
    }
    if (this.hover?.kind === 'person' && !crowd.person(this.hover.id)) this.setHover(null);
    if (this.hoverPending) {
      this.hoverPending = false;
      this.updateHover();
    }
    const r = this.redraw;
    this.redraw = false;
    return r;
  }

  private vehicleRoot(id: number): Object3D | null {
    return this.d.world.vehicles().find((v) => v.id === id)?.root ?? null;
  }

  /** Slower refresh alongside the HUD: card text and tooltip status. */
  refresh(): void {
    this.updatePersonCard();
    const sel = this.selection;
    if (sel?.kind === 'vehicle') {
      // Gone off the map: let go of it. Otherwise keep its card current.
      const card = this.d.vehicleCard(sel.id);
      if (!card) this.select(null);
      else this.d.hud.showBuilding(card);
    }
    if (this.pointer && !this.orbit) this.hoverPending = true;
  }

  /** Camera moved: the same pointer may now be over something else. */
  viewChanged(): void {
    if (this.pointer && !this.orbit) this.hoverPending = true;
  }

  // Hover

  private updateHover(): void {
    const ptr = this.pointer;
    const target = ptr ? this.picker.pick(ptr.x, ptr.y, this.d.camera, this.d.frame(), ptr.coarse) : null;
    this.setHover(target);
    this.updateTooltip();
  }

  private setHover(target: Target | null): void {
    if (!sameTarget(target, this.hover)) {
      this.hover = target;
      let root = null;
      if (target?.kind === 'person') root = this.d.crowd.person(target.id)?.root ?? null;
      else if (target?.kind === 'vehicle') root = this.vehicleRoot(target.id);
      else if (target?.kind === 'location') {
        const loc = this.d.world.locations[target.id].root;
        root = target.part === 'stand' ? loc.getObjectByName('clubStand') ?? loc : loc;
      }
      if (this.d.highlight.setHover(root)) this.redraw = true;
      this.d.canvas.style.cursor = this.orbit ? 'grabbing' : this.placing ? 'crosshair' : target ? 'pointer' : 'default';
    }
    if (!target) this.updateTooltip();
  }

  private updateTooltip(): void {
    const hov = this.hover;
    const ptr = this.pointer;
    // Two lines: a name in capitals tinted by status or role, then the detail.
    let tip: { title: string; body: string; status?: string; role?: string } | null = null;
    if (hov && ptr && !ptr.coarse && !this.orbit) {
      if (hov.kind === 'location') {
        const loc = this.d.hud.tooltipFor(hov.id, hov.part);
        if (loc) tip = { title: loc.title, body: loc.body, status: loc.status };
      } else if (hov.kind === 'building') {
        const card = this.d.buildingCard(hov.id);
        tip = { title: card.title, body: card.said };
      } else if (hov.kind === 'vehicle') {
        const card = this.d.vehicleCard(hov.id);
        if (card) tip = { title: card.title, body: card.said };
      } else {
        const p = this.d.crowd.person(hov.id);
        if (p) {
          const card = describePerson(p);
          tip = { title: card.title, body: card.activity, role: card.role };
        }
      }
    }
    const text = tip ? `${tip.title}|${tip.body}|${tip.status ?? tip.role}` : '';
    if (text !== this.tooltipText) {
      this.tooltipText = text;
      this.tooltip.hidden = !tip;
      if (tip) {
        this.tipTitle.textContent = tip.title;
        this.tipBody.textContent = tip.body;
        if (tip.status) this.tooltip.dataset.status = tip.status;
        else delete this.tooltip.dataset.status;
        if (tip.role) this.tooltip.dataset.role = tip.role;
        else delete this.tooltip.dataset.role;
      }
    }
    if (!text || !ptr) return;
    // Keep the tooltip beside the pointer and on screen.
    const w = this.tooltip.offsetWidth;
    const x = Math.min(window.innerWidth - w - 8, ptr.x + 14);
    const y = Math.max(8, ptr.y - 52);
    const pos = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (pos !== this.tooltipPos) {
      this.tooltipPos = pos;
      this.tooltip.style.transform = pos;
    }
  }

  // Input wiring

  /** Selects what is under a point and opens its action menu there. */
  private menuAt(x: number, y: number, coarse: boolean): void {
    const target = this.picker.pick(x, y, this.d.camera, this.d.frame(), coarse);
    this.select(target?.kind === 'location' ? { kind: 'location', id: target.id } : target);
    this.d.openMenu(x, y);
  }

  private cancelLongPress(): void {
    if (this.longPress) clearTimeout(this.longPress);
    this.longPress = 0;
  }

  private bindPointer(): void {
    const c = this.d.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        c.setPointerCapture(e.pointerId);
        this.cancelLongPress();
        if (this.touches.size === 1) {
          // A finger held still is the touch twin of a right-click.
          const at = { x: e.clientX, y: e.clientY };
          this.longPress = window.setTimeout(() => {
            this.longPress = 0;
            this.down = null;
            this.drag = null;
            this.suppressTap = true;
            this.menuAt(at.x, at.y, true);
          }, LONG_PRESS_MS);
        }
        if (this.touches.size === 2) {
          // Second finger: drag orbits and pinch zooms; the gesture is no longer a tap or pan.
          this.down = null;
          this.drag = null;
          this.suppressTap = true;
          this.pinch = spread(this.touches);
          this.startOrbit(centroid(this.touches), 'touch');
          return;
        }
      }
      if (e.button === 2) {
        c.setPointerCapture(e.pointerId);
        this.rightDown = { x: e.clientX, y: e.clientY };
        this.startOrbit({ x: e.clientX, y: e.clientY }, e.pointerId);
        return;
      }
      if (e.button === 0 && this.touches.size <= 1) {
        this.down = { x: e.clientX, y: e.clientY, id: e.pointerId, time: performance.now() };
        this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.orbit?.pointer === 'touch') {
          this.moveOrbit(centroid(this.touches));
          const d = spread(this.touches);
          if (this.pinch > 0 && d > 0) this.d.rig.zoomBy(d / this.pinch, true);
          this.pinch = d;
          this.releaseFollow();
          return;
        }
      }
      if (this.orbit && this.orbit.pointer === e.pointerId) {
        this.moveOrbit({ x: e.clientX, y: e.clientY });
        return;
      }
      const drag = this.drag;
      if (drag && drag.id === e.pointerId) {
        // A press that travels becomes a pan: the ground follows the pointer.
        if (!drag.active && Math.hypot(e.clientX - this.down!.x, e.clientY - this.down!.y) > TAP_SLOP) {
          drag.active = true;
          this.cancelLongPress();
          c.setPointerCapture(e.pointerId);
          this.d.canvas.style.cursor = 'grabbing';
          this.tooltipText = '';
          this.tooltip.hidden = true;
          this.releaseFollow();
        }
        if (drag.active) {
          this.panByScreen(e.clientX - drag.x, e.clientY - drag.y, true);
          drag.x = e.clientX;
          drag.y = e.clientY;
          return;
        }
      }
      if (e.pointerType === 'mouse') {
        this.pointer = { x: e.clientX, y: e.clientY, coarse: false };
        this.hoverPending = true;
      }
    });
    const lift = (e: PointerEvent, cancelled: boolean) => {
      if (e.pointerType === 'touch') this.cancelLongPress();
      if (this.drag?.id === e.pointerId) {
        const panned = this.drag.active;
        this.drag = null;
        if (panned) {
          this.down = null;
          this.d.canvas.style.cursor = this.hover ? 'pointer' : 'default';
          if (e.pointerType === 'touch') this.touches.delete(e.pointerId);
          return;
        }
      }
      if (e.pointerType === 'touch') {
        this.touches.delete(e.pointerId);
        if (this.orbit?.pointer === 'touch' && this.touches.size < 2) {
          this.endOrbit();
          this.pinch = 0;
        }
        if (this.touches.size === 0 && this.suppressTap) {
          this.suppressTap = false;
          this.down = null;
          return;
        }
      } else if (this.orbit && this.orbit.pointer === e.pointerId) {
        this.endOrbit();
        // A right-click that did not turn the view opens the action menu.
        const r = this.rightDown;
        this.rightDown = null;
        if (!cancelled && r && Math.hypot(e.clientX - r.x, e.clientY - r.y) <= TAP_SLOP) this.menuAt(e.clientX, e.clientY, false);
        return;
      }
      const down = this.down;
      this.down = null;
      if (cancelled || !down || down.id !== e.pointerId || e.button !== 0) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP) return;
      this.activate(e.clientX, e.clientY, e.pointerType !== 'mouse');
    };
    // Some input paths report a double-click without two separate pointer taps.
    c.addEventListener('dblclick', (e) => {
      const target = this.picker.pick(e.clientX, e.clientY, this.d.camera, this.d.frame(), false);
      if (target?.kind !== 'location') return;
      if (this.selection?.kind !== 'location' || this.selection.id !== target.id) this.select(target);
      if (!this.d.rig.focused) this.focusLocation(target.id);
      this.syncFocusButton();
    });
    c.addEventListener('pointerup', (e) => lift(e, false));
    c.addEventListener('pointercancel', (e) => lift(e, true));
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse' || this.orbit || this.drag?.active) return;
      this.pointer = null;
      this.hoverPending = true;
    });
    // Wheel and trackpad: whole zoom steps rather than a continuous drift.
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += e.deltaY * (e.deltaMode === 1 ? 33 : 1);
      if (Math.abs(this.wheel) < 60) return;
      this.releaseFollow();
      this.d.rig.zoomStep(this.wheel < 0 ? 1 : -1);
      this.wheel = 0;
      this.syncFocusButton();
    }, { passive: false });
  }

  /** Any manual camera move ends following and the focus lock. */
  private releaseFollow(): void {
    if (this.following) {
      this.following = false;
      this.updatePersonCard();
    }
    this.syncFocusButton();
  }

  /**
   * Pans by a screen-space offset in CSS pixels: as a drag, the ground under
   * the pointer moves with it. Converts through the camera's right and up
   * axes, with up stretched onto the ground plane by the view's elevation.
   */
  private panByScreen(dx: number, dy: number, immediate: boolean): void {
    const cam = this.d.camera;
    const f = this.d.frame();
    const perCss = ((cam.right - cam.left) / f.lowW) * (f.dpr / f.factor);
    const m = cam.matrixWorld.elements;
    // Columns 0 and 1 of the camera matrix: its right and up axes in world space.
    const rx = m[0], rz = m[2];
    let ux = m[4], uz = m[6];
    const ul = Math.hypot(ux, uz) || 1;
    ux /= ul;
    uz /= ul;
    const sinEl = Math.max(0.25, Math.sin((this.d.rig.view.elevationDeg * Math.PI) / 180));
    const along = (dy * perCss) / sinEl;
    // Both axes grab the ground: drag left and the city moves left, drag up and it moves up.
    this.d.rig.pan(-rx * dx * perCss + ux * along, -rz * dx * perCss + uz * along, immediate);
  }

  /** A tap or click: select what is under it; a second one on the same thing zooms in. */
  /**
   * Placement mode: the next click on the map picks one of `targets` (by its
   * id), or cancels when it lands anywhere else. Escape cancels too.
   */
  startPlacing(targets: () => readonly { id: number; root: Object3D }[], onPick: (id: number) => void, onEnd: () => void): void {
    this.placing?.onEnd();
    this.placing = { targets, onPick, onEnd };
    this.d.canvas.style.cursor = 'crosshair';
    this.redraw = true;
  }

  private endPlacing(): void {
    const p = this.placing;
    this.placing = null;
    this.d.canvas.style.cursor = 'default';
    this.redraw = true;
    p?.onEnd();
  }

  private activate(x: number, y: number, coarse: boolean): void {
    if (this.placing) {
      const id = this.picker.pickAmong(x, y, this.d.camera, this.d.frame(), this.placing.targets());
      const pick = this.placing.onPick;
      this.endPlacing();
      if (id !== null) pick(id);
      return;
    }
    const target = this.picker.pick(x, y, this.d.camera, this.d.frame(), coarse);
    const now = performance.now();
    const last = this.lastTap;
    const normal = target?.kind === 'location' ? { kind: 'location' as const, id: target.id } : target;
    const double = !!last && !!normal && now - last.time < DOUBLE_MS && Math.hypot(x - last.x, y - last.y) < DOUBLE_SLOP && sameTarget(normal, last.target);
    this.lastTap = double ? null : { time: now, x, y, target: normal };
    if (double && normal?.kind === 'location') {
      if (!this.d.rig.focused) this.focusLocation(normal.id);
      this.syncFocusButton();
      return;
    }
    if (double) return; // Double on a person: the first tap already follows them.
    this.select(normal);
  }

  private startOrbit(at: { x: number; y: number }, pointer: number | 'touch'): void {
    const v = this.d.rig.view;
    this.orbit = { x: at.x, y: at.y, az: v.azimuthDeg, el: v.elevationDeg, pointer };
    this.d.canvas.style.cursor = 'grabbing';
    this.tooltipText = '';
    this.tooltip.hidden = true;
  }

  private moveOrbit(at: { x: number; y: number }): void {
    const o = this.orbit!;
    this.d.rig.setView({ azimuthDeg: o.az - (at.x - o.x) * 0.35, elevationDeg: o.el + (at.y - o.y) * 0.25 });
  }

  private endOrbit(): void {
    this.orbit = null;
    this.d.canvas.style.cursor = this.hover ? 'pointer' : 'default';
    this.hoverPending = true;
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Form controls (sandbox sliders and selects) keep their own keys.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      const onLabel = e.target instanceof HTMLElement && e.target.classList.contains('loc-label');
      const onOtherControl = e.target instanceof HTMLButtonElement && !onLabel;
      if (e.key === 'Escape') {
        if (this.placing) { this.endPlacing(); return; }
        if (this.selection || this.leftTitle !== null) this.select(null);
        else if (this.d.rig.focused) {
          this.d.rig.release();
          this.syncFocusButton();
        }
        return;
      }
      if (onOtherControl) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const PAN = 48;
      if (k === 'r') this.resetView();
      else if (k === 'f') this.toggleFocus();
      else if (k === 'ArrowUp' || k === 'w') this.keyPan(e, 0, PAN);
      else if (k === 'ArrowDown' || k === 's') this.keyPan(e, 0, -PAN);
      else if (k === 'ArrowLeft' || k === 'a') this.keyPan(e, PAN, 0);
      else if (k === 'ArrowRight' || k === 'd') this.keyPan(e, -PAN, 0);
      else if (k === '+' || k === '=') {
        this.releaseFollow();
        this.d.rig.zoomStep(1);
      } else if (k === '-' || k === '_') {
        this.releaseFollow();
        this.d.rig.zoomStep(-1);
      } else if (k === ']' || k === '[') {
        // Step through the places; keyboard focus follows so Enter and Tab continue from here.
        const step = k === ']' ? 1 : -1;
        const current = this.selection?.kind === 'location' ? LOCATION_IDS.indexOf(this.selection.id) : step > 0 ? -1 : 0;
        const next = LOCATION_IDS[(current + step + LOCATION_IDS.length) % LOCATION_IDS.length];
        this.selectLocation(next);
        if (!this.d.rig.focused) this.focusLocation(next);
        this.syncFocusButton();
        if (onLabel || document.activeElement === document.body) this.d.hud.labelFor(next).focus({ preventScroll: true });
      }
    });
  }

  private keyPan(e: KeyboardEvent, dx: number, dy: number): void {
    e.preventDefault();
    this.releaseFollow();
    this.panByScreen(dx, dy, false);
  }

  /** Labels highlight their building on hover and keyboard focus. */
  private bindLabels(): void {
    for (const id of LOCATION_IDS) {
      const label = this.d.hud.labelFor(id);
      const on = () => {
        if (!this.pointer) this.setHover({ kind: 'location', id });
      };
      const off = () => {
        if (!this.pointer && this.hover?.kind === 'location' && this.hover.id === id) this.setHover(null);
      };
      label.addEventListener('focus', on);
      label.addEventListener('blur', off);
      label.addEventListener('pointerenter', () => {
        this.pointer = null;
        on();
      });
      label.addEventListener('pointerleave', off);
    }
  }
}

function spread(points: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...points.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function centroid(points: Map<number, { x: number; y: number }>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of points.values()) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.size, y: y / points.size };
}
