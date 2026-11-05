import { MATCHING, NEED_IDS, NEEDS, type NeedId } from '../config/matching';
import { STANDING, TIER_NAMES, UNLOCK_NAMES, UNLOCK_TIER, type Unlock } from '../config/standing';
import { STORM, STORM_TEXT, type StormPrep } from '../config/storm';
import { SUPPLIES, SUPPLY_IDS, type SupplyId } from '../config/supplies';
import { INTRO, type IntroId } from '../config/intro';
import { ORG } from '../config/organisation';
import { t } from '../i18n';
import type { Season } from './calendar';
import type { Organisation } from './organisation';
import { createRandom, type Random } from './random';
import { Standing } from './standing';
import { Storm, type StormReport } from './storm';
import { Supplies } from './supplies';
import { Team, type Blow, type Member } from './team';
import type { ServiceId } from './types';
import { supportFit, type PersonSupport } from './personSupport';

/**
 * What is at stake: the team's morale, the project's standing, supplies on the
 * shelf, the big crisis, matching people to the right worker, and the run
 * ending when the project folds. Rendering-free, with its own random stream so
 * it never shifts the simulation's draws. The simulation calls its hooks as
 * people are helped, turned away or harmed, and its `tick` every step.
 */
export type RunOverCause = 'team' | 'shut';

export type StakesNews =
  | { kind: 'stormWarned' }
  | { kind: 'stormStarted' }
  | { kind: 'stormEnded'; report: StormReport }
  | { kind: 'gift'; amount: number }
  | { kind: 'stormDeaths'; died: number; saved: number }
  | { kind: 'runOver'; cause: RunOverCause }
  | { kind: 'introduced'; what: IntroId };

/** Where people in danger in a storm can be served and kept safe. */
const LOW_THRESHOLD: readonly ServiceId[] = ['dropIn', 'outreach', 'footPatrol', 'shelter', 'clinic'];

const WHY: Record<Blow, string> = {
  turnedAway: t('too many people turned away'),
  overdose: t('overdoses nobody reached in time'),
  death: t('the deaths'),
  overwork: t('too many shifts without rest'),
  unpaid: t('wages that did not come'),
};

export class Stakes {
  readonly standing = new Standing();
  readonly supplies = new Supplies();
  readonly storm = new Storm();
  /**
   * Scenario failure rules: the project can fold (the whole team gone, or every starting place shut too long).
   * Off in an ordinary game, which is about growth: the city spirals instead, and play goes on.
   * Enabled by scenarios and retained for legacy URLs/saves under the original field name.
   */
  hardcore = false;
  /** The project has folded: when and why. Null while it runs (and always in an ordinary game). */
  runOver: { cause: RunOverCause; at: number } | null = null;
  /** People whose need found no matching skill on shift, tonight, by need. */
  readonly unmatched = Object.fromEntries(NEED_IDS.map((id) => [id, 0])) as Record<NeedId, number>;
  matchedTonight = 0;
  /** Deaths of people turned away in a storm. */
  deaths = 0;
  private readonly random: Random;
  /** Nights survived, as last told: which systems are in play yet (config/intro.ts). */
  private nights = 0;
  private hourCarry = 0;
  /** People served at the low-threshold places in the storm's running hour, and its minutes so far. */
  private stormServed = 0;
  private stormMinutes = 0;
  /** Clock minutes with every starting service shut in a row. */
  private shutMinutes = 0;
  private readonly unpaidSaid = new Set<SupplyId>();

  constructor(seed: number, private readonly team: Team, private readonly org: Organisation, private readonly notice: (text: string) => void) {
    this.random = createRandom(seed ^ 0x57a4e5);
  }

  /** The peer programme's steadier volunteers feel blows less. */
  private get steadier(): boolean {
    return this.org.steadierVolunteers;
  }

  /** Whether a system is in play yet (config/intro.ts). */
  introduced(id: IntroId): boolean {
    return this.nights >= INTRO[id];
  }

  /** Donations against the usual: the standing's, once standing is in play. */
  get giving(): number {
    return this.introduced('standing') ? this.standing.giving : 1;
  }

  /** Whether the standing opens `u`: anything goes until standing is in play. */
  allows(u: Unlock): boolean {
    return !this.introduced('standing') || this.standing.allows(u);
  }

  /** The tier a grant application needs now (none until standing is in play). */
  needsTier(tier: number): boolean {
    return this.introduced('standing') && this.standing.tier < tier;
  }

  private addStanding(amount: number): void {
    const before = this.standing.tier;
    const tier = this.standing.add(amount);
    if (tier === null || !this.introduced('standing')) return;
    if (tier > before) {
      const opened = (Object.keys(UNLOCK_TIER) as Unlock[]).filter((u) => UNLOCK_TIER[u] === tier).map((u) => UNLOCK_NAMES[u]);
      this.notice(t('Your standing in the city has risen: {tier}. People give more and more often.', { tier: TIER_NAMES[tier] }) + (opened.length ? ' ' + t('Now open: {list}.', { list: opened.join(', ') }) : ''));
    } else this.notice(t('Your standing in the city has fallen: {tier}. People give less, and some doors close.', { tier: TIER_NAMES[tier] }));
  }

  /**
   * Someone is admitted at `service`: draws what they need, if anything, and
   * looks for a worker on shift there who can meet it. Returns the visit-time
   * factor (quicker with the right worker, much slower without).
   */
  admitted(service: ServiceId, crisis: number, support?: PersonSupport): number {
    this.team.helpedAt(service);
    this.storm.note('helped');
    if (this.storm.phase === 'peak' && LOW_THRESHOLD.includes(service)) this.stormServed++;
    // A visible person's disclosed priorities apply immediately, including in the tutorial.
    // Anonymous/legacy callers retain their original staged random matching below.
    if (support !== undefined) {
      if (!support.needs.length && !support.skills.length) {
        this.addStanding(STANDING.helped);
        return 1;
      }
      let best: Member | undefined;
      let fit = 0;
      for (const member of this.team.members) if (member.workingAt === service) {
        const candidate = supportFit(member, support);
        if (!best || candidate > fit) { best = member; fit = candidate; }
      }
      const time = MATCHING.unmatchedTime - fit * (MATCHING.unmatchedTime - MATCHING.matchedTime);
      const matched = !!best && time <= 1;
      if (matched) {
        this.team.matched(best!);
        this.matchedTonight++;
      } else for (const need of support.needs) this.unmatched[need]++;
      this.addStanding(STANDING.helped + (matched ? STANDING.matched : 0));
      return time;
    }
    if (!this.introduced('matching')) {
      this.addStanding(STANDING.helped);
      return 1;
    }
    let u = this.random();
    let need: NeedId | null = null;
    for (const id of NEED_IDS) {
      const share = (NEEDS[id].share[service] ?? 0) + (id === 'crisis' ? MATCHING.crisisShare * crisis : 0);
      if (u < share) { need = id; break; }
      u -= share;
    }
    if (!need) {
      this.addStanding(STANDING.helped);
      return 1;
    }
    const traits = NEEDS[need].traits;
    const who = this.team.members.find((m) => m.workingAt === service && m.traits.some((x) => traits.includes(x)));
    if (who) {
      this.team.matched(who);
      this.matchedTonight++;
      this.addStanding(STANDING.helped + STANDING.matched);
      return MATCHING.matchedTime;
    }
    this.unmatched[need]++;
    this.addStanding(STANDING.helped);
    return MATCHING.unmatchedTime;
  }

  /** Someone was turned away at `service`: those there feel it most, more so in a storm. */
  turnedAway(service: ServiceId): void {
    this.team.turnedAwayAt(service, this.steadier, this.storm.phase === 'peak' ? STORM.moraleBlow : 1);
    this.addStanding(-STANDING.turnedAway);
    this.storm.note('turnedAway');
  }

  /**
   * One clock hour of the storm's peak: people in danger across the city, less
   * those served at the low-threshold places this hour; outreach with the
   * right stock catches some of the rest; the rest risk dying.
   */
  private stormHour(outreachOnStreet: boolean): { died: number; saved: number } {
    const danger = Math.max(0, Math.round(STORM.atRiskPerHour * this.storm.severity) - this.stormServed);
    this.stormServed = 0;
    const stock = STORM_TEXT[this.storm.kind ?? 'freeze'].stock;
    let died = 0;
    let saved = 0;
    for (let i = 0; i < danger; i++) {
      if (this.random() >= this.storm.risk) continue;
      if (outreachOnStreet && this.supplies.use(stock) && this.random() < STORM.outreachSaves) { saved++; this.storm.note('saved'); continue; }
      died++;
      this.deaths++;
      this.storm.note('deaths');
      this.death();
    }
    return { died, saved };
  }

  /** An overdose nobody reached in time. */
  overdoseAlone(): void {
    this.team.blow('overdose', this.steadier);
    this.addStanding(-STANDING.overdoseAlone);
  }

  /** Someone died. */
  death(): void {
    this.team.blow('death', this.steadier);
    this.addStanding(-STANDING.death);
  }

  /** A new night: tonight's matching counts start again. */
  nightBegins(): void {
    for (const id of NEED_IDS) this.unmatched[id] = 0;
    this.matchedTonight = 0;
  }

  /** What the player can do to prepare for the storm, once warned. */
  prepare(p: StormPrep): boolean {
    if (this.storm.phase === 'none' || this.storm.prepared.has(p)) return false;
    const ok = p === 'warn' ? this.supplies.take('leaflets', STORM.prepare.warn.leaflets) : this.org.spend(STORM.prepare[p].cost, false);
    if (!ok) {
      this.notice(p === 'warn' ? t('Not enough leaflets to warn the street: {n} needed.', { n: STORM.prepare.warn.leaflets }) : t('Not enough money for that.'));
      return false;
    }
    this.storm.prepared.add(p);
    this.notice(p === 'beds' ? t('Emergency beds are set up at the drop-in for the storm.')
      : p === 'warn' ? t('Outreach is out with leaflets: the street knows what is coming and where to go.')
      : t('Volunteers are on call for the storm night.'));
    // On-call volunteers join at once if the storm is already on.
    if (p === 'standby' && this.storm.phase === 'peak') this.org.volunteers += STORM.prepare.standby.volunteers;
    return true;
  }

  order(id: SupplyId): boolean {
    const ok = this.supplies.order(id, this.org.now, (c) => this.org.spend(c, false));
    if (!ok && this.supplies.arriving[id] === undefined) this.notice(t('Not enough money to order {item}.', { item: SUPPLIES[id].label.toLowerCase() }));
    return ok;
  }

  /**
   * Advances by `dtMinutes` of clock time. Returns whether the rota must be
   * drawn up again (someone quit, on-call volunteers came or went) and news
   * for the simulation to pass on.
   */
  tick(dtMinutes: number, at: { nights: number; clock: number; season: Season; shut: boolean; outreachOnStreet: boolean }): { rota: boolean; news: StakesNews[]; extraPlaces: boolean } {
    const news: StakesNews[] = [];
    let rota = false;
    if (at.nights !== this.nights) {
      const before = this.nights;
      this.nights = at.nights;
      // Only a night that just ended brings something new; a loaded save does not replay them all.
      if (at.nights === before + 1) for (const id of Object.keys(INTRO) as IntroId[]) if (INTRO[id] === at.nights) news.push({ kind: 'introduced', what: id });
    }
    let extraPlaces = false;
    const pay = (c: number) => this.org.spend(c);
    const { arrived, unpaid } = this.supplies.tick(this.org.now, pay);
    for (const id of arrived) this.unpaidSaid.delete(id);
    for (const id of unpaid) {
      if (this.unpaidSaid.has(id)) continue;
      this.unpaidSaid.add(id);
      this.notice(t('No money for the standing order of {item}: the shelf will run empty.', { item: SUPPLIES[id].label.toLowerCase() }));
    }
    for (const id of SUPPLY_IDS) if (this.supplies.stock[id] > 0) this.unpaidSaid.delete(id);

    if (this.storm.phase === 'peak') {
      this.stormMinutes += dtMinutes;
      while (this.stormMinutes >= 60) {
        this.stormMinutes -= 60;
        const h = this.stormHour(at.outreachOnStreet);
        if (h.died || h.saved) news.push({ kind: 'stormDeaths', ...h });
      }
    }
    const s = this.storm.tick(at.nights, at.clock, at.season);
    if (s?.what === 'warn') news.push({ kind: 'stormWarned' });
    else if (s?.what === 'start') {
      this.stormServed = 0;
      this.stormMinutes = 0;
      news.push({ kind: 'stormStarted' });
      if (this.storm.prepared.has('standby')) { this.org.volunteers += STORM.prepare.standby.volunteers; rota = true; }
      extraPlaces = true;
    } else if (s?.what === 'end') {
      news.push({ kind: 'stormEnded', report: s.report });
      if (this.storm.prepared.has('standby')) { this.org.volunteers = Math.max(0, this.org.volunteers - STORM.prepare.standby.volunteers); rota = true; }
      this.storm.prepared.clear();
      extraPlaces = true;
    }

    this.hourCarry += dtMinutes;
    while (this.hourCarry >= 60) {
      this.hourCarry -= 60;
      const r = this.team.review();
      for (const g of r.grew) {
        this.notice(g.what === 'experienced'
          ? t('{name} is no longer new to the work.', { name: g.m.name })
          : t('{name} has specialised: much better at the {place} now.', { name: g.m.name, place: placeName(g.what) }));
      }
      for (const m of r.low) this.notice(t('{name} is close to quitting: {why}. Rest helps; so does helping people.', { name: m.name, why: WHY[worst(m)] }));
      for (const { m, why } of r.quit) {
        if (m.paid) this.org.paid = Math.max(0, this.org.paid - 1);
        else this.org.volunteers = Math.max(0, this.org.volunteers - 1);
        this.notice(t('{name} has quit: {why}.', { name: m.name, why: WHY[why] }));
        rota = true;
      }
      const chance = this.introduced('standing') ? STANDING.giftsPerHour[this.standing.tier] : 0;
      if (chance > 0 && this.random() < chance) {
        const amount = Math.round(STANDING.gift.min + this.random() * (STANDING.gift.max - STANDING.gift.min));
        this.org.budget += amount;
        news.push({ kind: 'gift', amount });
        this.notice(t('Someone who heard about your work dropped in with a gift: {amount}.', { amount }));
      }
    }

    this.shutMinutes = at.shut ? this.shutMinutes + dtMinutes : 0;
    if (this.hardcore && !this.runOver) {
      const gone = this.org.paid + this.org.volunteers === 0 && this.team.members.length === 0;
      const cause: RunOverCause | null = gone ? 'team' : this.shutMinutes >= ORG.foldAfterShut ? 'shut' : null;
      if (cause) {
        this.runOver = { cause, at: this.org.now };
        news.push({ kind: 'runOver', cause });
      }
    }
    return { rota, news, extraPlaces };
  }

  snapshot(): { standing: ReturnType<Standing['snapshot']>; supplies: ReturnType<Supplies['snapshot']>; storm: ReturnType<Storm['snapshot']>; deaths: number; runOver: Stakes['runOver']; hardcore: boolean } {
    return { standing: this.standing.snapshot(), supplies: this.supplies.snapshot(), storm: this.storm.snapshot(), deaths: this.deaths, runOver: this.runOver ? { ...this.runOver } : null, hardcore: this.hardcore };
  }

  restore(s: Partial<ReturnType<Stakes['snapshot']>> | undefined): void {
    if (!s) return;
    this.standing.restore(s.standing);
    this.supplies.restore(s.supplies);
    this.storm.restore(s.storm);
    if (typeof s.deaths === 'number' && Number.isFinite(s.deaths)) this.deaths = Math.max(0, Math.round(s.deaths));
    if (typeof s.hardcore === 'boolean') this.hardcore = s.hardcore;
    this.runOver = this.hardcore && s.runOver && (s.runOver.cause === 'team' || s.runOver.cause === 'shut') && Number.isFinite(s.runOver.at) ? { cause: s.runOver.cause, at: s.runOver.at } : null;
  }
}

function worst(m: Member): Blow {
  return (Object.entries(m.blows) as [Blow, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

const PLACES: Record<ServiceId, string> = { dropIn: t('drop-in centre'), outreach: t('outreach camper'), clubHr: t('club stand'), footPatrol: t('foot patrol'), drugChecking: t('drug checking service'), shelter: t('shelter'), clinic: t('clinic') };
const placeName = (id: ServiceId) => PLACES[id];
