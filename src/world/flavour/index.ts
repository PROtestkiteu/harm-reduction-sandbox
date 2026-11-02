import type { Camera, Object3D } from 'three';
import type { PackId, WeatherMood } from '../../config/flavour/packs';
import type { Season } from '../../sim/calendar';
import { createRandom, type Random } from '../../sim/random';
import type { Traffic } from '../traffic';
import { ActorPool, type Actor, type FigureMaker } from './actors';

/**
 * Runs the flavour packs. Each pack is built the first time it is switched on
 * and only packs that are on are updated, so a pack that is off costs nothing
 * per frame (its objects are hidden, which also takes them out of rendering).
 * The packs share one pool of people and a small board for what they tell each
 * other (who the wardens check on, what the bin crew clears, what is said).
 */

/** What the packs read of the city each frame. Filled by the caller; never written by a pack. */
export interface FlavourContext {
  /** Clock minutes (18:00 = 1080; past midnight runs on past 1440). */
  clock: number;
  night: number;
  day: number;
  season: Season;
  /** Snow on the ground or falling tonight: no rain. */
  snowy: boolean;
  /** Policing level (0 none), from the simulation's context. */
  patrol: number;
  /** The street market the simulation tracks, 0 to 1. */
  market: number;
  /** How full the squat is, 0 to 1. */
  squat: number;
  /** Doors of the squats now, each with the wall's direction (unit, along the wall) and its outward normal. */
  squatDoors: readonly SquatDoor[];
  /** Reduced motion preferred: weather holds still, nothing bobs. */
  still: boolean;
  /** The street scene the simulation tracks (sim/growth.ts), 0 to 1: the chaos pack draws it. */
  street: number;
}

export interface SquatDoor { x: number; z: number; ax: number; az: number; nx: number; nz: number }

export interface Note { x: number; z: number; text: string; voice?: string }

/** What packs tell each other. */
export class Board {
  /** People the wardens stop to check on, while `live` says they are still there. */
  readonly checks: { x: number; z: number; live: () => boolean; voice?: string }[] = [];
  /** Things the bin crew clears as it passes (fly-tipping, broken glass). */
  readonly litter: { x: number; z: number; clear: () => void }[] = [];
  /** Lines said at a spot (a crime's witness, a warden): the lines pack takes them, if on; capped, so they never pile up. */
  readonly notes: Note[] = [];
  /** Incidents the wardens walk over to, while `live`. */
  readonly calls: { x: number; z: number; live: () => boolean }[] = [];
  say(x: number, z: number, text: string): void {
    if (this.notes.length < 8) this.notes.push({ x, z, text });
  }
  /** Someone with this voice says one of its lines at (x, z). */
  speak(x: number, z: number, voice: string): void {
    if (this.notes.length < 8) this.notes.push({ x, z, text: '', voice });
  }
}

export interface PackDeps {
  scene: Object3D;
  pool: ActorPool;
  traffic: Traffic;
  board: Board;
  random: Random;
  camera: Camera;
  canvas: HTMLElement;
  overlay: HTMLElement;
  /** Turns a world point into a position in the overlay, in CSS pixels. */
  toScreen: (x: number, y: number, z: number) => { x: number; y: number };
  /** Raises how wet the streets look (0 none); the season's own wetness still applies. */
  setWetness: (w: number) => void;
  /** Shows or hides the ordinary housing the campus replaces. */
  setCampusSite: (campus: boolean) => void;
  /** Where the buses on the road are now (asked a couple of times a second, not every frame). */
  buses: () => readonly { x: number; z: number }[];
  /** Crowd people in view, for the lines pack: position and role. */
  crowdVoices: () => readonly { voice: string; at: () => { x: number; y: number; z: number } }[];
}

export interface Pack {
  update(dt: number, ctx: FlavourContext): void;
  setEnabled(on: boolean): void;
  /** Optional: a setting of the pack's own (the weather's mood). */
  setMood?(mood: WeatherMood): void;
}

export type PackBuilder = (deps: PackDeps) => Pack;

/** One scene inside a pack (the hot dog cart, the bus stops): its people, and its step. */
export interface Scene {
  actors: readonly Actor[];
  update(dt: number): void;
}

export class FlavourPacks {
  private readonly built = new Map<PackId, Pack>();
  private readonly active: Pack[] = [];
  private readonly pool: ActorPool;
  private readonly board = new Board();
  private readonly deps: PackDeps;
  private mood: WeatherMood = 'auto';
  /** Per visit, so tonight's weather and street life differ from the last visit's. */
  private readonly seed = (Math.random() * 0x7fffffff) | 0;

  constructor(
    deps: Omit<PackDeps, 'pool' | 'board' | 'random'>,
    private readonly builders: Record<PackId, () => Promise<PackBuilder>>,
    budget: number,
  ) {
    this.pool = new ActorPool(deps.scene, budget, createRandom(5303));
    this.deps = { ...deps, pool: this.pool, board: this.board, random: createRandom(1) };
    this.pool.setVisible(false);
  }

  setFigureMaker(make: FigureMaker): void {
    this.pool.setFigureMaker(make);
  }

  setView(x: number, z: number, radius: number, mpp: number): void {
    this.pool.setView(x, z, radius, mpp);
  }

  /** Turns a pack on or off; the first time on, its code is fetched and it is built (in order of calls). */
  private pending = new Map<PackId, boolean>();
  private loading = new Set<PackId>();
  async set(id: PackId, on: boolean): Promise<void> {
    this.pending.set(id, on);
    const pack = this.built.get(id);
    if (pack) return this.apply(id, pack);
    if (!on || this.loading.has(id)) return;
    this.loading.add(id);
    const builder = await this.builders[id]();
    // Each pack its own seeded random, so one pack never shifts another's sequence.
    const made = builder({ ...this.deps, random: createRandom((this.seed + 7919 * (Object.keys(this.builders).indexOf(id) + 1)) | 0) });
    made.setMood?.(this.mood);
    this.built.set(id, made);
    this.loading.delete(id);
    this.apply(id, made);
  }

  private apply(id: PackId, pack: Pack): void {
    const on = this.pending.get(id) ?? false;
    pack.setEnabled(on);
    const i = this.active.indexOf(pack);
    if (on && i < 0) this.active.push(pack);
    if (!on && i >= 0) this.active.splice(i, 1);
    this.pool.setVisible(this.active.length > 0);
    if (!on) this.forget();
  }

  /** Lines waiting to be shown go stale once a pack goes off. Checks and litter stay: their `live` and `clear` know. */
  private forget(): void {
    this.board.notes.length = 0;
  }

  setMood(mood: WeatherMood): void {
    this.mood = mood;
    for (const p of this.built.values()) p.setMood?.(mood);
  }

  /** True while any pack is on: the caller then redraws each frame. */
  get running(): boolean {
    return this.active.length > 0;
  }

  update(dt: number, ctx: FlavourContext): void {
    if (!this.active.length) return;
    for (const p of this.active) p.update(dt, ctx);
    this.pool.update(dt);
  }
}
