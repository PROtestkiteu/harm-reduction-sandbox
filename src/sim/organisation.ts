import { GRANTS, ORG, RECRUIT, type ApplicationContext, type GrantId, type GrantReward, type RecruitId } from '../config/organisation';
import type { Random } from './random';
import type { ServiceId } from './types';
import { plural, t } from '../i18n';

export const SERVICE_NAMES: Record<ServiceId, string> = { dropIn: t('drop-in centre'), outreach: t('outreach camper'), clubHr: t('club stand'), footPatrol: t('streetworker foot patrol'), drugChecking: t('drug checking service'), shelter: t('shelter and day centre'), clinic: t('clinic and A&E') };

export interface Recruitment {
  id: RecruitId;
  readyAt: number;
}

export type ApplicationState =
  | { status: 'idle' }
  | { status: 'pending'; decidesAt: number }
  | { status: 'approved'; at: number }
  | { status: 'declined'; at: number };

/** Something the organisation wants the player to know, shown in the panel log. */
export interface OrgNotice {
  at: number;
  text: string;
  /** A grant decision whose reward unlocks a context option (applied by the app). */
  unlock?: GrantReward['unlock'];
}

/**
 * The organisation: budget, paid staff and volunteers, recruiting and
 * funding applications. Rendering-free; the simulation decides how many of
 * these people work where, and charges costs as services act.
 */
export class Organisation {
  budget: number = ORG.startBudget;
  paid: number = ORG.startPaid;
  volunteers: number = ORG.startVolunteers;
  /** Income per clock hour from grants won (on top of the national funding option). */
  grantIncome = 0;
  /** Net change per clock hour over the last hour, for the readout. */
  netPerHour = 0;
  readonly recruiting: Recruitment[] = [];
  readonly applications = Object.fromEntries(Object.keys(GRANTS).map((id) => [id, { status: 'idle' }])) as Record<GrantId, ApplicationState>;
  readonly log: OrgNotice[] = [];
  /** Services closed down after the money ran out for too long. They stay closed until relaunched. */
  readonly closedDown = new Set<ServiceId>();
  /** Relaunches under way. */
  readonly reopening: { id: ServiceId; readyAt: number }[] = [];
  /**
   * Minutes since the start, never wrapping. Deadlines (recruits, decisions,
   * relaunches) use it, because the scene clock loops from 06:00 back to 18:00.
   */
  now = 0;
  /** Clock minutes the organisation has been out of money in a row. */
  brokeMinutes = 0;
  steadierVolunteers = false;
  equipment = false;
  private churnCarry = 0;
  private flow = 0;
  private flowMinutes = 0;

  constructor(private readonly random: Random, private readonly onNotice: (n: OrgNotice) => void) {}

  /** Out of money: entered at zero, left only after recovering to `ORG.recoverAt`. */
  broke = false;

  /** People who can work tonight. Without money, paid staff cannot be paid and stay home. */
  get available(): { paid: number; volunteers: number } {
    return { paid: this.broke ? 0 : this.paid, volunteers: this.volunteers };
  }

  canAfford(cost: number): boolean {
    return this.budget >= cost;
  }

  /** Pays a cost if the money is there. Running costs count toward the net-per-hour readout; one-off fees do not. */
  spend(cost: number, running = true): boolean {
    if (this.budget < cost) return false;
    this.budget -= cost;
    if (running) this.flow -= cost;
    return true;
  }

  recruit(id: RecruitId, clock: number): boolean {
    const r = RECRUIT[id];
    if (!this.spend(r.cost, false)) {
      this.notice(clock, id === 'hirePaid' ? t('Not enough money to hire a paid worker.') : t('Not enough money to look for volunteers.'));
      return false;
    }
    this.recruiting.push({ id, readyAt: this.now + r.minutes });
    this.notice(clock, id === 'hirePaid' ? t('Hire a paid worker: started.') : t('Look for volunteers: started.'));
    return true;
  }

  letGo(clock: number): void {
    if (this.paid <= 0) return;
    this.paid--;
    this.notice(clock, t('A paid worker was let go.'));
  }

  /** Clock time (for display) of a deadline held in `now` minutes. */
  clockAt(t: number, clock: number): number {
    return clock + (t - this.now);
  }

  /** The next closure if the money does not come back: which service and at what clock time. */
  nextClosure(clock: number): { service: ServiceId; at: number } | null {
    if (!this.broke) return null;
    const next = ORG.closeDownAfter.find((c) => !this.closedDown.has(c.service));
    return next ? { service: next.service, at: clock + next.minutes - this.brokeMinutes } : null;
  }

  /** Relaunches a closed-down service: costs money and takes time. */
  reopen(id: ServiceId, clock: number): boolean {
    if (!this.closedDown.has(id) || this.reopening.some((r) => r.id === id)) return false;
    if (!this.spend(ORG.reopen.cost, false)) {
      this.notice(clock, t('Not enough money to relaunch the {service}.', { service: SERVICE_NAMES[id] }));
      return false;
    }
    this.reopening.push({ id, readyAt: this.now + ORG.reopen.minutes });
    this.notice(clock, t('Relaunching the {service}: about {hours}.', { service: SERVICE_NAMES[id], hours: plural(Math.round(ORG.reopen.minutes / 60), ['{n} hour', '{n} hours'], ['{n} godzinę', '{n} godziny', '{n} godzin']) }));
    return true;
  }

  apply(id: GrantId, clock: number): boolean {
    const g = GRANTS[id];
    const state = this.applications[id];
    if (state.status === 'pending' || state.status === 'approved') return false;
    if (!this.spend(g.fee, false)) {
      this.notice(clock, t('Not enough money to apply for {grant}.', { grant: g.label.toLowerCase() }));
      return false;
    }
    this.applications[id] = { status: 'pending', decidesAt: this.now + g.minutes };
    this.notice(clock, t('Applied for {grant}.', { grant: g.label.toLowerCase() }));
    return true;
  }

  /**
   * Advances by `dtMinutes` of clock time: income, wages for paid staff on
   * shift, volunteer churn, recruits arriving, applications decided.
   * Returns true when the staff pool changed (the simulation reallocates).
   */
  tick(clock: number, dtMinutes: number, incomePerHour: number, payroll: number, ctx: ApplicationContext, runningPerHour = 0): boolean {
    const hours = dtMinutes / 60;
    this.now += dtMinutes;
    const wasBroke = this.broke;
    const before = this.paid * 1000 + this.volunteers;
    const delta = (incomePerHour + this.grantIncome) * hours - (payroll * ORG.wagePerHour + runningPerHour) * hours;
    this.budget += delta;
    this.flow += delta;
    this.flowMinutes += dtMinutes;
    if (this.flowMinutes >= 60) {
      this.netPerHour = (this.flow * 60) / this.flowMinutes;
      this.flow = 0;
      this.flowMinutes = 0;
    }

    // Volunteers drift away: carry fractional expectation so the rate holds at any step size.
    this.churnCarry += this.volunteers * ORG.volunteerChurnPerHour * (this.steadierVolunteers ? 0.5 : 1) * hours;
    if (this.churnCarry >= 1 && this.volunteers > 0) {
      this.churnCarry -= 1;
      if (this.random() < 0.8) {
        this.volunteers--;
        this.notice(clock, t('A volunteer could not stay on.'));
      }
    }

    for (let i = this.recruiting.length - 1; i >= 0; i--) {
      const r = this.recruiting[i];
      if (this.now < r.readyAt) continue;
      this.recruiting.splice(i, 1);
      const opt = RECRUIT[r.id];
      let found = 0;
      for (let i = 0; i < opt.tries; i++) if (this.random() < opt.chance) found++;
      if (r.id === 'hirePaid') this.paid += found;
      else this.volunteers += found;
      this.notice(clock, found
        ? r.id === 'hirePaid'
          ? plural(found, ['{n} new paid worker joined.', '{n} new paid worker joined.'], ['Dołącza nowa osoba na etacie.', 'Dołączają {n} nowe osoby na etacie.', 'Dołącza {n} nowych osób na etacie.'])
          : plural(found, ['{n} new volunteer joined.', '{n} new volunteers joined.'], ['Dołącza nowa osoba do wolontariatu.', 'Do wolontariatu dołączają {n} nowe osoby.', 'Do wolontariatu dołącza {n} nowych osób.'])
        : r.id === 'hirePaid' ? t('Hire a paid worker: nobody suitable this time.') : t('Look for volunteers: nobody suitable this time.'));
    }

    for (const id of Object.keys(this.applications) as GrantId[]) {
      const state = this.applications[id];
      if (state.status !== 'pending' || this.now < state.decidesAt) continue;
      const g = GRANTS[id];
      const approved = this.random() < g.chance(ctx) * (ctx.reputation ?? 1);
      this.applications[id] = approved ? { status: 'approved', at: clock } : { status: 'declined', at: clock };
      if (approved) this.reward(g.reward);
      this.notice(clock, approved ? t('{grant}: approved. {reward}.', { grant: g.label, reward: g.rewardText }) : t('{grant}: declined. You can apply again.', { grant: g.label }), approved ? g.reward.unlock : undefined);
    }

    if (!this.broke && this.budget < ORG.brokeBelow) this.broke = true;
    else if (this.broke && this.budget >= ORG.recoverAt) this.broke = false;

    // Out of money for too long: services close down for good, one by one.
    let closures = false;
    this.brokeMinutes = this.broke ? this.brokeMinutes + dtMinutes : 0;
    for (const c of ORG.closeDownAfter) {
      if (this.brokeMinutes < c.minutes || this.closedDown.has(c.service)) continue;
      this.closedDown.add(c.service);
      closures = true;
      this.notice(clock, t('The {service} has closed down: no money for {hours}. It stays closed until relaunched.', { service: SERVICE_NAMES[c.service], hours: plural(Math.round(c.minutes / 60), ['{n} hour', '{n} hours'], ['{n} godzinę', '{n} godziny', '{n} godzin']) }));
    }
    for (let i = this.reopening.length - 1; i >= 0; i--) {
      if (this.now < this.reopening[i].readyAt) continue;
      const { id } = this.reopening.splice(i, 1)[0];
      this.closedDown.delete(id);
      closures = true;
      this.notice(clock, t('The {service} has reopened.', { service: SERVICE_NAMES[id] }));
    }
    if (this.broke !== wasBroke) this.notice(clock, this.broke ? t('Out of money: paid staff stay home, kits and checks stop until the budget recovers.') : t('Budget recovered: paid staff can work again.'));
    return closures || this.broke !== wasBroke || before !== this.paid * 1000 + this.volunteers;
  }

  private reward(r: GrantReward): void {
    if (r.incomePerHour) this.grantIncome += r.incomePerHour;
    if (r.oneOff) this.budget += r.oneOff;
    if (r.volunteers) this.volunteers += r.volunteers;
    if (r.steadierVolunteers) this.steadierVolunteers = true;
    if (r.equipment) this.equipment = true;
  }

  notice(at: number, text: string, unlock?: GrantReward['unlock']): void {
    const n: OrgNotice = { at, text, unlock };
    this.log.unshift(n);
    this.log.length = Math.min(this.log.length, 6);
    this.onNotice(n);
  }
}
