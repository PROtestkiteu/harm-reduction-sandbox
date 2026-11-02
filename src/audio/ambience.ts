import { loopNoise } from './noise';

/** What the ambience should sound like now; every value 0 to 1. */
export interface AmbienceMood {
  /** How busy the city is: evening high, the small hours low. */
  busy: number;
  /** Night darkness: the far traffic gets duller after dark. */
  night: number;
  /** The club's thump, already scaled by distance and opening hours. */
  club: number;
  /** Rain on the streets. */
  rain: number;
  /** Overall level: lower while the game is paused. */
  level: number;
}

/** Layer levels at full mood, before the master volume. */
const LEVEL = { hum: 0.32, sub: 0.03, traffic: 0.3, car: 0.22, club: 0.55, rain: 0.16 };
/** The club's tempo: a kick every half second. */
const BEAT = 60 / 120;
/** How far ahead kicks are put on the audio clock; longer than the update interval, so none is missed. */
const LOOKAHEAD = 0.7;

interface CarVoice { gain: GainNode; band: BiquadFilterNode; pan: StereoPannerNode; freeAt: number }

/**
 * Street ambience from noise and a few oscillators. Every node is built once
 * and kept: changes are parameter automation on the audio clock, smoothed with
 * setTargetAtTime, so a mood update allocates nothing. Car passes reuse two
 * voices; the club's kicks reuse one oscillator and one envelope.
 */
export class Ambience {
  private readonly hum: GainNode;
  private readonly humSwell: GainNode;
  private readonly traffic: GainNode;
  private readonly trafficSwell: GainNode;
  private readonly trafficTone: BiquadFilterNode;
  private readonly cars: CarVoice[] = [];
  private readonly club: GainNode;
  private readonly kick: OscillatorNode;
  private readonly kickEnv: GainNode;
  private readonly rain: GainNode;
  private nextBeat = 0;
  private clubOn = false;

  constructor(private readonly ctx: AudioContext, out: AudioNode, noise: { white: AudioBuffer; brown: AudioBuffer }, private readonly random: () => number) {
    /** A slow oscillator moving `into`; returns its depth, a gain to set. */
    const lfo = (hz: number, into: AudioParam): GainNode => {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(into);
      o.start();
      return g;
    };
    const filter = (type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = q;
      return f;
    };
    const silent = (): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      return g;
    };

    // The low hum of a city: deep rumble and a faint sub drone, slowly breathing.
    this.hum = silent();
    loopNoise(ctx, noise.brown, random, 0.8).connect(filter('lowpass', 140)).connect(this.hum);
    const sub = ctx.createOscillator();
    sub.frequency.value = 49;
    const subGain = ctx.createGain();
    subGain.gain.value = LEVEL.sub / LEVEL.hum;
    sub.connect(subGain).connect(filter('lowpass', 90)).connect(this.hum);
    sub.start();
    this.humSwell = lfo(0.045, this.hum.gain);
    this.hum.connect(out);

    // Distant traffic: a band of rumble that swells and settles on two slow, unrelated cycles.
    this.traffic = silent();
    this.trafficTone = filter('lowpass', 800);
    loopNoise(ctx, noise.brown, random, 1.35).connect(filter('bandpass', 320, 0.6)).connect(this.trafficTone).connect(this.traffic);
    this.trafficSwell = lfo(0.07, this.traffic.gain);
    const second = ctx.createOscillator();
    second.frequency.value = 0.113;
    second.connect(this.trafficSwell);
    second.start();
    this.traffic.connect(out);

    // Far car passes: tyre hiss through a moving band, panned across.
    for (let i = 0; i < 2; i++) {
      const band = filter('bandpass', 400, 0.9);
      const gain = silent();
      const pan = ctx.createStereoPanner();
      loopNoise(ctx, noise.white, random, 0.9 + i * 0.15).connect(band).connect(filter('lowpass', 1800)).connect(gain).connect(pan).connect(out);
      this.cars.push({ gain, band, pan, freeAt: 0 });
    }

    // The club through its walls: a low sine kick, its pitch dropping, behind a lowpass.
    this.club = silent();
    this.kick = ctx.createOscillator();
    this.kick.frequency.value = 45;
    this.kickEnv = silent();
    this.kick.connect(this.kickEnv).connect(filter('lowpass', 150)).connect(this.club).connect(out);
    this.kick.start();

    // Rain: bright noise between a high and a low cut.
    this.rain = silent();
    loopNoise(ctx, noise.white, random, 1).connect(filter('highpass', 1300)).connect(filter('lowpass', 7000)).connect(this.rain).connect(out);
  }

  /**
   * Moves the layers towards `m` (called a few times a second). `dt` is the
   * audio time since the last call; `events` allows car passes, which stop
   * while the game is paused; `rate` scales how often they come.
   */
  set(m: AmbienceMood, dt: number, events: boolean, rate: number): void {
    const now = this.ctx.currentTime;
    const hum = LEVEL.hum * m.level * (0.65 + 0.35 * m.busy);
    this.hum.gain.setTargetAtTime(hum, now, 1.5);
    this.humSwell.gain.setTargetAtTime(hum * 0.25, now, 1.5);
    const traffic = LEVEL.traffic * m.level * m.busy * m.busy;
    this.traffic.gain.setTargetAtTime(traffic, now, 2);
    this.trafficSwell.gain.setTargetAtTime(traffic * 0.35, now, 2);
    this.trafficTone.frequency.setTargetAtTime(950 - 350 * m.night, now, 3);
    this.rain.gain.setTargetAtTime(LEVEL.rain * m.level * m.rain, now, 2);

    const club = LEVEL.club * m.level * m.club;
    this.club.gain.setTargetAtTime(club, now, 0.6);
    this.clubOn = club > 0.002;
    if (this.clubOn) this.scheduleKicks(now);

    // Sparse in the small hours, a car every ten seconds or so in the evening.
    if (events && this.random() < (0.012 + 0.09 * m.busy ** 1.5) * rate * dt) this.carPass(now, m.level);
  }

  private scheduleKicks(now: number): void {
    if (this.nextBeat < now) this.nextBeat = now + 0.05;
    const f = this.kick.frequency;
    const g = this.kickEnv.gain;
    while (this.nextBeat < now + LOOKAHEAD) {
      const t = this.nextBeat;
      f.setValueAtTime(95, t);
      f.exponentialRampToValueAtTime(42, t + 0.12);
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(1, t + 0.006);
      g.setTargetAtTime(0, t + 0.02, 0.07);
      this.nextBeat += BEAT;
    }
  }

  private carPass(now: number, level: number): void {
    const v = this.cars.find((c) => c.freeAt <= now);
    if (!v) return;
    const t = now + 0.05;
    const dur = 3 + this.random() * 4;
    const peak = LEVEL.car * level * (0.4 + 0.6 * this.random());
    const dir = this.random() < 0.5 ? -1 : 1;
    const mid = t + dur * (0.4 + this.random() * 0.2);
    const end = t + dur;
    v.freeAt = end + 0.1;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(0, t);
    v.gain.gain.linearRampToValueAtTime(peak, mid);
    v.gain.gain.linearRampToValueAtTime(0, end);
    // A little Doppler: the band rises as it nears and falls as it goes.
    const low = 260 + this.random() * 120;
    v.band.frequency.cancelScheduledValues(t);
    v.band.frequency.setValueAtTime(low, t);
    v.band.frequency.exponentialRampToValueAtTime(low * 2.4, mid);
    v.band.frequency.exponentialRampToValueAtTime(low * 0.85, end);
    v.pan.pan.cancelScheduledValues(t);
    v.pan.pan.setValueAtTime(-0.8 * dir, t);
    v.pan.pan.linearRampToValueAtTime(0.8 * dir, end);
  }
}
