import { Groove, Loop, lfo, noiseSource, type Pattern } from './loops';
import * as R from './recipes';
import type { NoiseBank } from './noise';
import type { Channel } from './settings';
import { closeness, place, placeLine, type Listener } from './space';
import { burst, filter, panner } from './synth';

export interface Point { x: number; z: number }

/** Where the city's sound sources are: told once by the game. */
export interface Places {
  clubDoor: Point;
  park: Point;
  /** The river runs along z at this x. */
  riverX: number;
  /** The railway runs along x at this z. */
  railZ: number;
  festival: Point;
  stadium: Point;
  camps: readonly Point[];
  /** The middle of the district's bars and cafes. */
  bars: Point;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** A vehicle on screen as the sound needs it. */
export interface VehicleSound {
  id: number;
  kind: 'ambulance' | 'police' | 'fire' | 'bus' | 'warmingBus';
  x: number;
  z: number;
  /** Driving to a call, lights and sirens on. */
  onCall: boolean;
  /** Stopped (at a light, a stop, the scene). */
  stopped: boolean;
}

/** What is going on in the city, filled by the game a few times a second (one object, reused). */
export interface LifeState {
  /** Minutes since midnight. */
  clock: number;
  night: number;
  /** How busy the street is at this hour, 0 to 1. */
  busy: number;
  season: Season;
  /** Snow falling, 0 to 1. */
  snow: number;
  rain: number;
  /** The festival crowd, 0 to 1, and the home match (0 or 1). */
  festival: number;
  match: number;
  /** How many bars and venues are open, 0 to 1. */
  venues: number;
  /** How big the camps are, 0 to 1. */
  camp: number;
  /** A rave in the park: where, or null. */
  rave: Point | null;
  /** Police on a raid, a sweep or an alert. */
  police: Point[];
  vehicles: VehicleSound[];
  /** The train's ends along x while it is on the line, else null. */
  train: readonly [number, number] | null;
  /** The helicopter while it is up, else null. */
  heli: Point | null;
}

/** Levels at full mood, before the channel's volume. */
const LEVEL = {
  wind: 0.06, river: 0.05, bird: 0.035, owl: 0.03, dog: 0.03, crickets: 0.01, pigeons: 0.05, door: 0.06, shutter: 0.04,
  engine: 0.07, hiss: 0.05, siren: 0.05, train: 0.12, clack: 0.1, squeal: 0.012, scooter: 0.05, horn: 0.04, plane: 0.05, reversing: 0.012, barge: 0.06, boatHorn: 0.05,
  stadium: 3, roar: 1.2, chant: 0.8, festivalCrowd: 0.35, terrace: 0.3, cheers: 0.05, trolley: 0.04, bell: 0.025, alarm: 0.03,
  rave: 0.9, stage: 0.8, radio: 0.05, heli: 0.12, thunder: 0.2,
};

const RAVE: Pattern = {
  bpm: 138, kick: 'x...x...x...x...', hat: '..x...x...x...xx', bass: [55, 55, 0, 55, 65.4, 0, 55, 0], muffle: 900,
};
const STAGE: Pattern = {
  bpm: 122, kick: 'x...x...x...x...', hat: '..x...x...x...x.', bass: [73.4, 0, 73.4, 87.3, 0, 98, 0, 82.4],
  stab: { steps: '...x.....x....x.', notes: [293.7, 349.2, 440] }, muffle: 1500,
};

const between = (r: () => number, a: number, b: number): number => a + (b - a) * r();
/** A smooth bump: 1 inside [a, b] minutes, easing to 0 over `fade` either side; wraps past midnight. */
function hours(clock: number, a: number, b: number, fade = 40): number {
  const c = ((clock % 1440) + 1440) % 1440;
  const inside = (x: number) => Math.max(0, Math.min(1, Math.min(x - a + fade, b + fade - x) / fade));
  return Math.max(inside(c), inside(c + 1440), inside(c - 1440));
}

interface Shot {
  ch: Channel;
  /** Seconds between plays at full weight. */
  every: readonly [number, number];
  left: number;
  /** How likely now, 0 to 1 (0: not at all); scales how often it comes and how loud. */
  weight(s: LifeState, l: Listener): number;
  play(t: number, weight: number, s: LifeState, l: Listener): void;
}

/**
 * The city's life beyond the street bed: weather, districts, traffic, crowds,
 * venues and alerts, placed by where they are against the view and gated by
 * the channels the player can hear. Continuous layers exist only while heard
 * (see Loop); one-shots come on their own random clocks, each varied on
 * every play, and none is made for a channel that is silent.
 */
export class CityLife {
  private readonly k: R.Kit;
  private readonly wind: Loop;
  private readonly river: Loop;
  private readonly stadium: Loop;
  private readonly festivalCrowd: Loop;
  private readonly terrace: Loop;
  private readonly engines: Loop[];
  private readonly sirens: { ambulance: Loop; police: Loop; fire: Loop };
  private readonly train: Loop;
  private readonly squeal: Loop;
  private readonly heli: Loop;
  private readonly rave: Groove;
  private readonly stage: Groove;
  private readonly shots: Shot[];
  private readonly stoppedBefore = new Map<number, boolean>();
  private trainAt: number | null = null;
  private trainSpeed = 0;
  private nextClack = 0;

  constructor(private readonly ctx: BaseAudioContext, private readonly bus: Record<Channel, AudioNode>, private readonly on: (c: Channel) => boolean, noise: NoiseBank, private readonly random: () => number, private readonly places: Places) {
    const r = random;
    this.k = { ctx, white: noise.white, pink: noise.pink, random };

    // Wind: a band of air that gusts and moves in pitch; higher views catch more of it.
    this.wind = new Loop(ctx, bus.weather, (into) => {
      const band = filter(ctx, 'bandpass', 520, 0.9);
      const gust = ctx.createGain();
      gust.gain.value = 0.6;
      const src = noiseSource(ctx, noise.pink, r, 0.8);
      src.connect(band).connect(filter(ctx, 'highpass', 200)).connect(gust).connect(into);
      return [src, lfo(ctx, band.frequency, 0.045 + r() * 0.03, 260), lfo(ctx, gust.gain, 0.09 + r() * 0.05, 0.4)];
    });
    // The river against its banks: dull water whose level ripples at the pace of small waves.
    this.river = new Loop(ctx, bus.city, (into) => {
      const lap = ctx.createGain();
      lap.gain.value = 0.4;
      const waves = ctx.createGain();
      waves.gain.value = 6;
      const mod = noiseSource(ctx, noise.white, r, 0.05);
      mod.connect(filter(ctx, 'lowpass', 3, 0.5)).connect(waves).connect(lap.gain);
      const src = noiseSource(ctx, noise.white, r, 1);
      src.connect(filter(ctx, 'lowpass', 750)).connect(filter(ctx, 'highpass', 180)).connect(lap).connect(into);
      return [mod, src];
    });
    // Crowds: a broad band of many voices whose level surges slowly.
    const crowd = (hz: number, swell: number) => (into: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = 0.7;
      const src = noiseSource(ctx, noise.pink, r, 0.95 + r() * 0.1);
      src.connect(filter(ctx, 'bandpass', hz, 0.55)).connect(filter(ctx, 'highpass', 230)).connect(g).connect(into);
      return [src, lfo(ctx, g.gain, swell, 0.3)];
    };
    this.stadium = new Loop(ctx, bus.people, crowd(850, 0.06));
    this.festivalCrowd = new Loop(ctx, bus.people, crowd(700, 0.035));
    // A bar terrace: chatter with a quicker flicker than a crowd, nearer and brighter.
    this.terrace = new Loop(ctx, bus.people, (into) => {
      const talk = ctx.createGain();
      talk.gain.value = 0.45;
      const syllables = ctx.createGain();
      syllables.gain.value = 8;
      const mod = noiseSource(ctx, noise.white, r, 0.09);
      mod.connect(filter(ctx, 'lowpass', 9, 0.5)).connect(syllables).connect(talk.gain);
      const src = noiseSource(ctx, noise.pink, r, 1.05);
      src.connect(filter(ctx, 'bandpass', 1000, 0.9)).connect(filter(ctx, 'lowpass', 3000)).connect(talk).connect(into);
      return [mod, src];
    });
    // Bus engines: a diesel's buzz (its harmonics, so small speakers play it) under a hiss of fans.
    const engine = (into: AudioNode) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 46 + r() * 8;
      o.connect(filter(ctx, 'bandpass', 300, 1.3)).connect(filter(ctx, 'highpass', 160)).connect(into);
      o.start();
      const fan = ctx.createGain();
      fan.gain.value = 0.3;
      const src = noiseSource(ctx, noise.pink, r, 1);
      src.connect(filter(ctx, 'bandpass', 650, 0.8)).connect(fan).connect(into);
      return [o, src, lfo(ctx, o.frequency, 0.3, 1.5)];
    };
    this.engines = [new Loop(ctx, bus.traffic, engine), new Loop(ctx, bus.traffic, engine)];
    // Sirens: the ambulance's two tones, the police car's wail, the fire engine's lower, slower two tones.
    const siren = (type: OscillatorType, base: number, depth: number, hz: number) => (into: AudioNode) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = base;
      o.connect(filter(ctx, 'lowpass', 2200)).connect(into);
      o.start();
      return [o, lfo(ctx, o.frequency, hz, depth, type)];
    };
    this.sirens = {
      ambulance: new Loop(ctx, bus.events, siren('square', 520, 75, 0.9)),
      police: new Loop(ctx, bus.events, siren('triangle', 900, 330, 0.28)),
      fire: new Loop(ctx, bus.events, siren('square', 410, 60, 0.65)),
    };
    // The train: a rumble of wheels; the clacks over the rail joints come one by one (see update).
    this.train = new Loop(ctx, bus.traffic, (into) => {
      const src = noiseSource(ctx, noise.pink, r, 0.6);
      src.connect(filter(ctx, 'lowpass', 500)).connect(filter(ctx, 'highpass', 150)).connect(into);
      return [src];
    });
    this.squeal = new Loop(ctx, bus.traffic, (into) => {
      const o = ctx.createOscillator();
      o.frequency.value = 2900 + r() * 500;
      o.connect(into);
      o.start();
      return [o, lfo(ctx, o.frequency, 5.5, 40)];
    });
    // The helicopter: a dull roar chopped by the rotor.
    this.heli = new Loop(ctx, bus.events, (into) => {
      const chop = ctx.createGain();
      chop.gain.value = 0.55;
      const src = noiseSource(ctx, noise.pink, r, 0.7);
      src.connect(filter(ctx, 'lowpass', 650)).connect(filter(ctx, 'highpass', 150)).connect(chop).connect(into);
      return [src, lfo(ctx, chop.gain, 5.2, 0.45, 'sawtooth')];
    });
    this.rave = new Groove(ctx, bus.music, noise.white, r, RAVE);
    this.stage = new Groove(ctx, bus.music, noise.white, r, STAGE);
    this.shots = this.makeShots();
  }

  /** Moves every layer towards `s` for the view `l`; `events` false (paused) holds the one-shots. */
  update(s: LifeState, l: Listener, dt: number, level: number, events: boolean, rate: number): void {
    const on = this.on;
    const p = this.places;
    const close = closeness(l);
    const wide = 1 - close;

    // Weather.
    const windy = ({ winter: 0.75, autumn: 0.7, spring: 0.45, summer: 0.2 } as const)[s.season];
    this.wind.set(on('weather') ? LEVEL.wind * level * (windy * (0.55 + 0.45 * wide) + 0.3 * s.snow + 0.25 * s.rain) : 0, 0, dt, 2);

    // The city: the river, nearer as the view comes to it.
    let at = placeLine(l, 'z', p.riverX, 0.8);
    this.river.set(on('city') ? LEVEL.river * level * at.near * (1 - 0.6 * s.snow) : 0, at.pan, dt);

    // Crowds and venues.
    at = place(l, p.stadium.x, p.stadium.z, 2.2);
    this.stadium.set(on('people') ? LEVEL.stadium * level * s.match * at.near : 0, at.pan, dt, 1.5);
    at = place(l, p.festival.x, p.festival.z, 2);
    this.festivalCrowd.set(on('people') ? LEVEL.festivalCrowd * level * s.festival * at.near : 0, at.pan, dt, 1.5);
    this.stage.set(on('music') ? LEVEL.stage * level * Math.max(0, s.festival - 0.3) * at.near : 0, at.pan, dt);
    at = s.rave ? place(l, s.rave.x, s.rave.z, 1.6) : at;
    this.rave.set(on('music') && s.rave ? LEVEL.rave * level * at.near : 0, at.pan, dt);
    at = place(l, p.bars.x, p.bars.z, 0.8);
    const terrace = s.venues * hours(s.clock, 19 * 60, 25 * 60, 60) * (1 - 0.7 * s.rain) * (1 - 0.8 * s.snow) * (s.season === 'winter' ? 0.5 : 1);
    this.terrace.set(on('people') ? LEVEL.terrace * level * terrace * at.near : 0, at.pan, dt, 1.2);

    // Vehicles: the two nearest buses' engines, the nearest siren of each kind.
    this.vehicles(s, l, level, dt, events);
    this.trainUpdate(s, l, level, dt);
    if (s.heli) at = place(l, s.heli.x, s.heli.z, 3);
    this.heli.set(on('events') && s.heli ? LEVEL.heli * level * at.near : 0, at.pan, dt, 0.5);

    if (!events) return;
    for (const shot of this.shots) {
      shot.left -= dt * rate;
      if (shot.left > 0) continue;
      const w = on(shot.ch) ? shot.weight(s, l) : 0;
      shot.left = between(this.random, shot.every[0], shot.every[1]) / Math.max(0.08, w);
      if (w > 0.02) shot.play(this.ctx.currentTime + 0.05 + this.random() * 0.4, w, s, l);
    }
  }

  private vehicles(s: LifeState, l: Listener, level: number, dt: number, events: boolean): void {
    let a = -1, b = -1, an = 0, bn = 0, ap = 0, bp = 0;
    const siren = { ambulance: { near: 0, pan: 0 }, police: { near: 0, pan: 0 }, fire: { near: 0, pan: 0 } };
    for (let i = 0; i < s.vehicles.length; i++) {
      const v = s.vehicles[i];
      const at = place(l, v.x, v.z, v.onCall ? 2.5 : 0.7);
      if (v.kind === 'bus' || v.kind === 'warmingBus') {
        const n = at.near * (v.stopped ? 0.55 : 1);
        if (n > an) { b = a; bn = an; bp = ap; a = i; an = n; ap = at.pan; } else if (n > bn) { b = i; bn = n; bp = at.pan; }
        // A bus pulling up lets its brakes go with a hiss.
        const was = this.stoppedBefore.get(v.id);
        if (events && was === false && v.stopped && this.on('traffic') && at.near > 0.05) {
          burst(this.ctx, panner(this.ctx, this.bus.traffic, at.pan), this.k.white, this.ctx.currentTime + 0.05, { hz: 5000, type: 'highpass', level: LEVEL.hiss * level * at.near, attack: 0.02, decay: 0.25, length: 1.4 }, this.random);
        }
        this.stoppedBefore.set(v.id, v.stopped);
      } else if (v.onCall && at.near > siren[v.kind].near) {
        siren[v.kind].near = at.near;
        siren[v.kind].pan = at.pan;
      }
    }
    if (this.stoppedBefore.size > 64) this.stoppedBefore.clear();
    const t = this.on('traffic') ? LEVEL.engine * level : 0;
    this.engines[0].set(a >= 0 ? t * an : 0, ap, dt, 0.6);
    this.engines[1].set(b >= 0 ? t * bn : 0, bp, dt, 0.6);
    const e = this.on('events') ? LEVEL.siren * level : 0;
    this.sirens.ambulance.set(e * siren.ambulance.near, siren.ambulance.pan, dt, 0.4);
    this.sirens.police.set(e * siren.police.near, siren.police.pan, dt, 0.4);
    this.sirens.fire.set(e * siren.fire.near, siren.fire.pan, dt, 0.4);
  }

  /** The train: a rumble at its middle, clacks over the joints at its speed, a squeal as it brakes into the station. */
  private trainUpdate(s: LifeState, l: Listener, level: number, dt: number): void {
    const span = s.train;
    const on = this.on('traffic');
    if (!span || !on) {
      this.trainAt = null;
      this.train.set(0, 0, dt);
      this.squeal.set(0, 0, dt);
      return;
    }
    const mid = (span[0] + span[1]) / 2;
    const v = this.trainAt === null || dt <= 0 ? 0 : (mid - this.trainAt) / dt;
    this.trainAt = mid;
    const speed = Math.abs(v);
    const braking = speed > 0.5 && speed < 7 && speed < this.trainSpeed - 0.05;
    this.trainSpeed = speed;
    // The nearest point of the train to the view.
    const x = Math.max(span[0], Math.min(span[1], l.x));
    const at = place(l, x, this.places.railZ, 1.6);
    const moving = Math.min(1, speed / 8);
    this.train.set(LEVEL.train * level * at.near * (0.25 + 0.75 * moving), at.pan, dt, 0.5);
    this.squeal.set(braking ? LEVEL.squeal * level * at.near : 0, at.pan, dt, 0.3);
    if (speed < 1.5 || at.near < 0.03) return;
    // Two clacks per joint, a joint every 13 m.
    const now = this.ctx.currentTime;
    if (this.nextClack < now) this.nextClack = now + 0.02;
    const gap = 13 / speed;
    let pan: StereoPannerNode | null = null;
    while (this.nextClack < now + 0.5) {
      pan ??= panner(this.ctx, this.bus.traffic, at.pan);
      for (const d of [0, Math.min(0.12, gap * 0.18)]) {
        burst(this.ctx, pan, this.k.white, this.nextClack + d, { hz: 1300 + this.random() * 500, q: 1.6, level: LEVEL.clack * level * at.near * moving, decay: 0.015 }, this.random);
      }
      this.nextClack += gap * (0.92 + 0.16 * this.random());
    }
  }

  /** Every one-shot the city can make, when it comes, and how loud. */
  private makeShots(): Shot[] {
    const k = this.k;
    const b = this.bus;
    const p = this.places;
    const r = this.random;
    const out = (shot: Omit<Shot, 'left'>): Shot => ({ ...shot, left: between(r, 2, shot.every[1]) });
    const anywhere = () => between(r, -0.8, 0.8);
    const dawn = (s: LifeState) => hours(s.clock, 4.5 * 60, 6.5 * 60, 50);
    const parkNear = (l: Listener) => place(l, p.park.x, p.park.z, 1.4);
    return [
      // The city.
      out({ ch: 'city', every: [1.5, 5], weight: (s, l) => (dawn(s) * (s.season === 'winter' ? 0.4 : 1) + 0.15 * (1 - s.night)) * (0.3 + 0.7 * parkNear(l).near) * (1 - s.rain) * (1 - s.snow * 0.6),
        play: (t, w, _s, l) => R.bird(k, b.city, t, parkNear(l).near > 0.2 ? parkNear(l).pan + between(r, -0.3, 0.3) : anywhere(), LEVEL.bird * Math.min(1, 0.4 + w)) }),
      out({ ch: 'city', every: [35, 80], weight: (s, l) => hours(s.clock, 0, 4 * 60, 45) * parkNear(l).near * 2,
        play: (t, w, _s, l) => R.owl(k, b.city, t, parkNear(l).pan, LEVEL.owl * Math.min(1, w)) }),
      out({ ch: 'city', every: [3, 8], weight: (s, l) => (s.season === 'summer' ? 1 : s.season === 'spring' ? 0.3 : 0) * s.night * parkNear(l).near * 2 * (1 - s.rain),
        play: (t, w, _s, l) => R.crickets(k, b.city, t, parkNear(l).pan + between(r, -0.3, 0.3), LEVEL.crickets * Math.min(1, w)) }),
      out({ ch: 'city', every: [25, 70], weight: (s) => s.night * (1.1 - s.busy) * (1 - 0.5 * s.rain),
        play: (t, w) => R.dog(k, b.city, t, anywhere(), LEVEL.dog * Math.min(1, 0.4 + w)) }),
      out({ ch: 'city', every: [50, 120], weight: (s, l) => (1 - s.night * 0.85) * closeness(l) * (1 - s.rain),
        play: (t) => R.pigeons(k, b.city, t, anywhere(), LEVEL.pigeons) }),
      out({ ch: 'city', every: [20, 50], weight: (s, l) => (0.3 + s.busy) * (0.3 + 0.7 * closeness(l)),
        play: (t) => R.door(k, b.city, t, anywhere(), LEVEL.door * between(r, 0.4, 1)) }),
      out({ ch: 'city', every: [40, 90], weight: (s, l) => (hours(s.clock, 22 * 60, 24 * 60, 30) + hours(s.clock, 6 * 60, 7.5 * 60, 30)) * (0.3 + 0.7 * closeness(l)),
        play: (t) => R.shutter(k, b.city, t, anywhere(), LEVEL.shutter) }),
      out({ ch: 'city', every: [90, 200], weight: (s) => s.night * (0.3 + s.busy),
        play: (t) => R.alarm(k, b.city, t, anywhere(), LEVEL.alarm) }),
      // Traffic.
      out({ ch: 'traffic', every: [14, 35], weight: (s) => s.busy * (1 - 0.5 * s.snow) * (1 - 0.4 * s.rain),
        play: (t, w) => R.scooter(k, b.traffic, t, 0, LEVEL.scooter * Math.min(1, 0.4 + w)) }),
      out({ ch: 'traffic', every: [20, 55], weight: (s) => s.busy ** 1.5 * (0.6 + 0.4 * s.rain),
        play: (t) => R.horn(k, b.traffic, t, anywhere(), LEVEL.horn * between(r, 0.5, 1)) }),
      out({ ch: 'traffic', every: [80, 200], weight: (s) => 1 - hours(s.clock, 1.5 * 60, 5 * 60, 40) * 0.9,
        play: (t) => R.plane(k, b.traffic, t, 0, LEVEL.plane) }),
      out({ ch: 'traffic', every: [40, 100], weight: (s) => hours(s.clock, 5 * 60, 7.5 * 60, 30),
        play: (t) => R.reversing(k, b.traffic, t, anywhere(), LEVEL.reversing) }),
      out({ ch: 'traffic', every: [45, 110], weight: (_s, l) => placeLine(l, 'z', p.riverX, 0.8).near * 2.5,
        play: (t, w, _s, l) => R.barge(k, b.traffic, t, placeLine(l, 'z', p.riverX, 0.8).pan, LEVEL.barge * Math.min(1, w)) }),
      out({ ch: 'traffic', every: [90, 220], weight: (_s, l) => placeLine(l, 'z', p.riverX, 1.5).near * 2,
        play: (t, w, _s, l) => R.boatHorn(k, b.traffic, t, placeLine(l, 'z', p.riverX, 1.5).pan, LEVEL.boatHorn * Math.min(1, w)) }),
      // People.
      out({ ch: 'people', every: [15, 45], weight: (s, l) => s.match * place(l, p.stadium.x, p.stadium.z, 2.2).near * 3,
        play: (t, w, _s, l) => R.roar(k, b.people, t, place(l, p.stadium.x, p.stadium.z, 2.2).pan, LEVEL.roar * Math.min(1, w)) }),
      out({ ch: 'people', every: [25, 60], weight: (s, l) => s.match * place(l, p.stadium.x, p.stadium.z, 2.2).near * 3,
        play: (t, w, _s, l) => R.chant(k, b.people, t, place(l, p.stadium.x, p.stadium.z, 2.2).pan, LEVEL.chant * Math.min(1, w)) }),
      out({ ch: 'people', every: [6, 16], weight: (s, l) => s.venues * hours(s.clock, 19 * 60, 26 * 60, 60) * place(l, p.bars.x, p.bars.z, 0.8).near * closeness(l) * 2.5 * (1 - 0.7 * s.rain),
        play: (t, _w, _s, l) => R.cheers(k, b.people, t, place(l, p.bars.x, p.bars.z, 0.8).pan + between(r, -0.3, 0.3), LEVEL.cheers * between(r, 0.5, 1)) }),
      out({ ch: 'people', every: [30, 80], weight: (s, l) => s.camp * Math.max(...p.camps.map((c) => place(l, c.x, c.z, 1).near)) * 3,
        play: (t) => R.trolley(k, b.people, t, 0, LEVEL.trolley) }),
      out({ ch: 'people', every: [30, 80], weight: (s, l) => (1 - s.night * 0.7) * s.busy * closeness(l) * (1 - s.rain) * (1 - s.snow),
        play: (t) => R.bell(k, b.people, t, anywhere(), LEVEL.bell) }),
      // Weather and alerts.
      out({ ch: 'weather', every: [40, 120], weight: (s) => (s.rain > 0.55 && s.season !== 'winter' ? s.rain : 0),
        play: (t, w) => R.thunder(k, b.weather, t, anywhere(), LEVEL.thunder * Math.min(1, w)) }),
      out({ ch: 'events', every: [5, 14], weight: (s, l) => {
          let n = 0;
          for (const q of s.police) n = Math.max(n, place(l, q.x, q.z, 0.9).near);
          return n * 2;
        },
        play: (t, w, s, l) => {
          const q = s.police[Math.floor(r() * s.police.length)];
          if (q) R.radio(k, b.events, t, place(l, q.x, q.z, 0.9).pan, LEVEL.radio * Math.min(1, w));
        } }),
    ];
  }
}
