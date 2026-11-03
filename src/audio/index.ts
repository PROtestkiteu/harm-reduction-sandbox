import { Ambience, type AmbienceMood } from './ambience';
import { playCue, type UiCue } from './cues';
import { CityLife, type LifeState, type Places } from './life';
import { audioRandom, makeNoise } from './noise';
import { loadRecordings, type Recordings } from './recordings';
import { CHANNELS, PRESETS, loadSoundSettings, saveSoundSettings, type Channel, type PresetId, type SoundSettings } from './settings';
import { closeness, place, type Listener } from './space';
import { filter } from './synth';

export type { UiCue } from './cues';
export type { Places, VehicleSound, Season, Point } from './life';
export type { Listener } from './space';
export { CHANNELS, PRESETS, presetOf, type Channel, type PresetId, type SoundSettings } from './settings';

/** What the game tells the sound, a few times a second at most (one object, reused by the caller). */
export interface SoundState extends Omit<LifeState, 'busy'> {
  /** Where the player is looking. */
  view: Listener;
  clubOpen: boolean;
  paused: boolean;
  speed: number;
}

/** The buses whose top end snow muffles. */
const MUFFLED: readonly Channel[] = ['city', 'traffic', 'people'];

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

/** Gain of a channel at `volume` 0 to 100: 70 (about the standard mix) is unity, 100 is +6 dB. */
const channelGain = (volume: number): number => 2 * (volume / 100) ** 2;

/**
 * Sound for the game: a recorded night street (CC0) under generated street
 * life, weather, venues and alerts, and soft interface cues, mixed in seven
 * channels the player sets. Knows nothing of the game's domain: it is told a
 * clock, a view, a few levels, places and flags.
 *
 * Nothing is made before the first pointer or key press (autoplay rules), and
 * not even then while muted. Muted, with every channel silent, or with the tab
 * hidden, the context is suspended, so the audio thread does no work, and
 * `update` and `ui` return at once. A silent channel makes no events and its
 * continuous layers are let go (see loops.ts).
 */
export class Sound {
  readonly settings: SoundSettings = loadSoundSettings();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private ambience: Ambience | null = null;
  private life: CityLife | null = null;
  private places: Places | null = null;
  private bus: Record<Channel, GainNode> | null = null;
  private tone: Partial<Record<Channel, BiquadFilterNode>> = {};
  private recordings: Recordings | null = null;
  private readonly random = audioRandom(0x50da);
  private unlocked = false;
  private visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  private nextUpdate = 0;
  private lastUpdate = 0;
  private suspendTimer = 0;
  private readonly lastCue: Record<UiCue, number> = { tap: -1, confirm: -1, warn: -1 };
  private lastAnyCue = -1;
  private readonly mood: AmbienceMood = { busy: 0, night: 0, club: 0, rain: 0, clubPan: 0, close: 0, level: 1 };
  private readonly lifeState = { busy: 0 } as LifeState;
  private snow = -1;
  /** Some channel can be heard (kept on each change, so the per-frame check stays one comparison). */
  private anyOn = true;
  /** Whether `c` can be heard now; the layers ask before making anything for it. */
  private readonly on = (c: Channel): boolean => !this.settings.mix[c].muted && this.settings.mix[c].volume > 0;

  constructor() {
    this.anyOn = CHANNELS.some(this.on);
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
    window.addEventListener('pointerdown', this.onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', this.onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      this.visible = document.visibilityState !== 'hidden';
      this.applyRunning();
    });
  }

  /** True while sound is playing: a context exists, it is not muted, some channel is on and the tab is shown. */
  get live(): boolean {
    return this.ctx !== null && this.wanted();
  }

  /** The city's fixed sound sources (the river, the park, the stadium...); before or after the sound starts. */
  setPlaces(p: Places): void {
    this.places = p;
    if (this.ctx && !this.life) this.makeLife();
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
    const rate = 1 + 0.25 * (Math.min(4, Math.max(1, s.speed)) - 1);
    m.busy = busyAt(s.clock);
    m.night = s.night;
    const club = this.places ? place(s.view, this.places.clubDoor.x, this.places.clubDoor.z, 0.8) : null;
    m.club = s.clubOpen && club ? club.near : 0;
    m.clubPan = club?.pan ?? 0;
    m.close = closeness(s.view);
    m.rain = Math.min(1, Math.max(0, s.rain));
    m.level = s.paused ? 0.5 : 1;
    this.ambience!.set(m, dt, !s.paused, rate);
    if (this.life) {
      const l = Object.assign(this.lifeState, s);
      l.busy = m.busy;
      l.rain = m.rain;
      this.life.update(l, s.view, dt, m.level, !s.paused, rate);
    }
    // Snow takes the top off the street, the traffic and the voices.
    if (s.snow !== this.snow) {
      this.snow = s.snow;
      for (const c of MUFFLED) this.tone[c]?.frequency.setTargetAtTime(16000 - 13000 * s.snow, now, 2);
    }
  }

  /** Plays an interface cue. Nothing happens while muted or before the first press. */
  ui(cue: UiCue): void {
    if (!this.live || !this.on('ui')) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastCue[cue] < CUE_GAP[cue]) return;
    // A tap that comes with a confirmation or a warning is left to that one.
    if (cue === 'tap' && now - this.lastAnyCue < CUE_GAP.tap) return;
    this.lastCue[cue] = now;
    this.lastAnyCue = now;
    playCue(this.ctx!, this.bus!.ui, this.white!, cue, this.random, this.recordings?.cues[cue]);
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

  /** Sets one channel's volume (0 to 100) and/or mute. */
  setChannel(c: Channel, change: { volume?: number; muted?: boolean }): void {
    const ch = this.settings.mix[c];
    const volume = change.volume === undefined ? ch.volume : Math.min(100, Math.max(0, Math.round(change.volume)));
    const muted = change.muted ?? ch.muted;
    if (volume === ch.volume && muted === ch.muted) return;
    ch.volume = volume;
    ch.muted = muted;
    saveSoundSettings(this.settings);
    this.applyChannel(c);
    this.anyOn = CHANNELS.some(this.on);
    this.applyRunning();
  }

  /** Sets every channel's volume to a preset's (mutes and master are kept). */
  applyPreset(id: PresetId): void {
    for (const c of CHANNELS) this.settings.mix[c].volume = PRESETS[id][c];
    saveSoundSettings(this.settings);
    for (const c of CHANNELS) this.applyChannel(c);
    this.anyOn = CHANNELS.some(this.on);
    this.applyRunning();
  }

  private applyChannel(c: Channel): void {
    if (!this.ctx || !this.bus) return;
    this.bus[c].gain.setTargetAtTime(this.on(c) ? channelGain(this.settings.mix[c].volume) : 0, this.ctx.currentTime, 0.05);
  }

  private gain(): number {
    const v = this.settings.volume / 100;
    return v * v;
  }

  /** Sound is wanted when not muted, the tab is shown and at least one channel can be heard. */
  private wanted(): boolean {
    return !this.settings.muted && this.visible && this.anyOn;
  }

  private noise: ReturnType<typeof makeNoise> | null = null;

  private makeLife(): void {
    this.life = new CityLife(this.ctx!, this.bus!, this.on, this.noise!, this.random, this.places!);
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
    const want = this.wanted();
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
        if (!this.wanted()) void ctx.suspend();
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
    // Nothing useful lives below 70 Hz on the speakers this is played on, and a limiter keeps
    // a busy moment (a car passing the club in the rain) from ever clipping.
    const floor = ctx.createBiquadFilter();
    floor.type = 'highpass';
    floor.frequency.value = 70;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -14;
    limit.knee.value = 6;
    limit.ratio.value = 8;
    limit.attack.value = 0.004;
    limit.release.value = 0.25;
    // A little make-up gain into the limiter: the channels sit at unity around 70, so the mix keeps headroom.
    const makeup = ctx.createGain();
    makeup.gain.value = 2;
    this.master.connect(floor).connect(makeup).connect(limit).connect(ctx.destination);
    const bus = {} as Record<Channel, GainNode>;
    for (const c of CHANNELS) {
      const g = ctx.createGain();
      g.gain.value = this.on(c) ? channelGain(this.settings.mix[c].volume) : 0;
      if (MUFFLED.includes(c)) {
        const tone = filter(ctx, 'lowpass', 16000, 0.5);
        this.tone[c] = tone;
        g.connect(tone).connect(this.master);
      } else g.connect(this.master);
      bus[c] = g;
    }
    this.bus = bus;
    this.ambience = new Ambience(ctx, bus, noise, this.random, this.on);
    this.noise = noise;
    if (this.places) this.makeLife();
    // The recordings come after the sound has started: until then, and if they fail, all of it is generated.
    void loadRecordings(ctx).then((r) => {
      this.recordings = r;
      if (r.city) this.ambience?.useRecording(r.city);
    });
    this.lastUpdate = ctx.currentTime;
    this.applyRunning();
  }
}
