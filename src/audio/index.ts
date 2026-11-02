import { Ambience, type AmbienceMood } from './ambience';
import { playCue, type UiCue } from './cues';
import { audioRandom, makeNoise } from './noise';
import { loadSoundSettings, saveSoundSettings, type SoundSettings } from './settings';

export type { UiCue } from './cues';
export type { SoundSettings } from './settings';

/** What the game tells the sound, a few times a second at most (one object, reused by the caller). */
export interface SoundState {
  /** Minutes since midnight on the game clock. */
  clock: number;
  /** Night darkness, 0 to 1. */
  night: number;
  /** How near the view is to the club, 0 (far) to 1 (at the door). */
  nearClub: number;
  clubOpen: boolean;
  /** Rain on screen, 0 to 1. */
  rain: number;
  paused: boolean;
  speed: number;
}

/** How busy the street sounds at each hour of the clock: evening high, the small hours low. */
const BUSY = [0.55, 0.45, 0.32, 0.2, 0.15, 0.2, 0.35, 0.55, 0.65, 0.6, 0.55, 0.55, 0.6, 0.6, 0.55, 0.6, 0.7, 0.85, 0.95, 1, 1, 0.95, 0.85, 0.7];
/** Seconds between mood updates. */
const UPDATE_EVERY = 0.25;
/** A cue right after another one is dropped, so one press never sounds twice. */
const CUE_GAP = { tap: 0.09, confirm: 0.15, warn: 0.4 } as const;

function busyAt(clock: number): number {
  const h = (((clock / 60) % 24) + 24) % 24;
  const i = Math.floor(h);
  const k = h - i;
  return BUSY[i] * (1 - k) + BUSY[(i + 1) % 24] * k;
}

/**
 * Generated sound for the game: street ambience and soft interface cues,
 * from the Web Audio API alone (no files). Knows nothing of the game's domain:
 * it is told a clock, a few levels and flags.
 *
 * Nothing is made before the first pointer or key press (autoplay rules), and
 * not even then while muted. Muted or with the tab hidden, the context is
 * suspended, so the audio thread does no work, and `update` and `ui` return at
 * once.
 */
export class Sound {
  readonly settings: SoundSettings = loadSoundSettings();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private ambience: Ambience | null = null;
  private readonly random = audioRandom(0x50da);
  private unlocked = false;
  private visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  private nextUpdate = 0;
  private lastUpdate = 0;
  private suspendTimer = 0;
  private readonly lastCue: Record<UiCue, number> = { tap: -1, confirm: -1, warn: -1 };
  private lastAnyCue = -1;
  private readonly mood: AmbienceMood = { busy: 0, night: 0, club: 0, rain: 0, level: 1 };

  constructor() {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
    window.addEventListener('pointerdown', this.onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', this.onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      this.visible = document.visibilityState !== 'hidden';
      this.applyRunning();
    });
  }

  /** True while sound is playing: a context exists, it is not muted and the tab is shown. */
  get live(): boolean {
    return this.ctx !== null && !this.settings.muted && this.visible;
  }

  /** True when an `update` would do something now; lets the caller skip filling its state. */
  get due(): boolean {
    return this.live && this.ctx!.currentTime >= this.nextUpdate;
  }

  /** For checks: 'none' until the context exists, then its state. */
  get contextState(): AudioContextState | 'none' {
    return this.ctx?.state ?? 'none';
  }

  /** Moves the ambience towards `s`. Returns at once when muted, before the first press, or between updates. */
  update(s: SoundState): void {
    if (!this.live) return;
    const now = this.ctx!.currentTime;
    if (now < this.nextUpdate) return;
    this.nextUpdate = now + UPDATE_EVERY;
    const dt = Math.min(1, now - this.lastUpdate);
    this.lastUpdate = now;
    const m = this.mood;
    m.busy = busyAt(s.clock);
    m.night = s.night;
    m.club = s.clubOpen ? Math.min(1, Math.max(0, s.nearClub)) : 0;
    m.rain = Math.min(1, Math.max(0, s.rain));
    m.level = s.paused ? 0.5 : 1;
    this.ambience!.set(m, dt, !s.paused, 1 + 0.25 * (Math.min(4, Math.max(1, s.speed)) - 1));
  }

  /** Plays an interface cue. Nothing happens while muted or before the first press. */
  ui(cue: UiCue): void {
    if (!this.live) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastCue[cue] < CUE_GAP[cue]) return;
    // A tap that comes with a confirmation or a warning is left to that one.
    if (cue === 'tap' && now - this.lastAnyCue < CUE_GAP.tap) return;
    this.lastCue[cue] = now;
    this.lastAnyCue = now;
    playCue(this.ctx!, this.master!, this.white!, cue, this.random);
  }

  setMuted(muted: boolean): void {
    if (this.settings.muted === muted) return;
    this.settings.muted = muted;
    saveSoundSettings(this.settings);
    this.applyRunning();
  }

  /** `volume` 0 to 100. */
  setVolume(volume: number): void {
    const v = Math.min(100, Math.max(0, Math.round(volume)));
    if (v === this.settings.volume) return;
    this.settings.volume = v;
    saveSoundSettings(this.settings);
    if (this.live) this.master!.gain.setTargetAtTime(this.gain(), this.ctx!.currentTime, 0.05);
  }

  private gain(): number {
    const v = this.settings.volume / 100;
    return v * v;
  }

  private readonly onGesture = (): void => {
    this.unlocked = true;
    this.applyRunning();
  };

  private unbind(): void {
    window.removeEventListener('pointerdown', this.onGesture, { capture: true });
    window.removeEventListener('keydown', this.onGesture, { capture: true });
  }

  /** Brings the context in line with the settings: made on the first unmuted press, resumed or suspended after. */
  private applyRunning(): void {
    const want = !this.settings.muted && this.visible;
    if (!this.ctx) {
      if (want && this.unlocked) this.start();
      return;
    }
    const ctx = this.ctx;
    const master = this.master!;
    window.clearTimeout(this.suspendTimer);
    if (want) {
      this.nextUpdate = 0;
      master.gain.setTargetAtTime(this.gain(), ctx.currentTime, 0.05);
      if (ctx.state !== 'running') {
        // A context made or left outside a press may need a later press to start: keep listening until it runs.
        void ctx.resume().then(() => { if (ctx.state === 'running') this.unbind(); }, () => { /* not allowed yet: the next press tries again */ });
      } else this.unbind();
    } else {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      // Fade first, then stop the audio thread; a change of mind in between cancels it.
      this.suspendTimer = window.setTimeout(() => {
        if (this.settings.muted || !this.visible) void ctx.suspend();
      }, this.visible ? 150 : 0);
    }
  }

  private start(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const noise = makeNoise(ctx, this.random);
    this.white = noise.white;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.ambience = new Ambience(ctx, this.master, noise, this.random);
    this.lastUpdate = ctx.currentTime;
    this.applyRunning();
  }
}
