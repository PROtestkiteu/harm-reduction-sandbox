import { t } from '../i18n';
import { CAMPER_PATH, type CamperPath } from '../config/camperPaths';
import { HUSTLE } from '../config/hustles';
import { GRANTS, ORG, RECRUIT, recruitChance, type GrantId, type RecruitId } from '../config/organisation';
import { ACTIVITY, type Activity } from '../config/serviceMix';
import { stageCount, stageOf } from '../config/serviceStages';
import { SERVICE_NAMES } from '../sim/organisation';
import { PROPERTY } from '../sim/property';
import { INVEST } from '../sim/simulation';
import type { ServiceId } from '../sim/types';
import { price } from '../ui/money';

/**
 * A decision that costs money, as the confirm box shows it: what it is, what
 * it brings and when, its chance when it may fail, and the price. The labels
 * on the replies stay short; the detail lives here.
 */
export interface Decision {
  title: string;
  lines: string[];
  cost: number;
  /** 0..1 when the outcome is uncertain. */
  chance?: number;
}

const hours = (minutes: number) => Math.round(minutes / 6) / 10;

export function recruitDecision(id: RecruitId): Decision {
  const r = RECRUIT[id];
  return id === 'hirePaid'
    ? { title: t('Hire a paid worker'), cost: r.cost, chance: recruitChance(id), lines: [t('An advert and interviews: about {h} h to find someone.', { h: hours(r.minutes) }), t('Then {wage} an hour in wages for as long as they stay.', { wage: price(ORG.wagePerHour) })] }
    : { title: t('Look for volunteers'), cost: r.cost, chance: recruitChance(id), lines: [t('About {h} h of asking around; up to {n} people may come.', { h: hours(r.minutes), n: r.tries }), t('Unpaid, but volunteers drift away over the night.')] };
}

export function driveDecision(): Decision {
  return {
    title: t('Donation drive'),
    cost: HUSTLE.driveCost,
    lines: [
      t('{h} h of collecting on the street; donation boxes bring in double meanwhile.', { h: HUSTLE.driveHours }),
      t('At the end the tins bring {min} to {max}: more with a good name, less in a crisis.', { min: price(HUSTLE.driveMin), max: price(HUSTLE.driveMax) }),
    ],
  };
}

export function grantDecision(id: GrantId, chance: number): Decision {
  const g = GRANTS[id];
  return { title: g.label, cost: g.fee, chance, lines: [t('Decision in about {h} h.', { h: hours(g.minutes) }), t('If approved: {reward}.', { reward: g.rewardText }), g.odds] };
}

export function relaunchDecision(service: ServiceId): Decision {
  return { title: t('Relaunch the {service}', { service: SERVICE_NAMES[service] }), cost: ORG.reopen.cost, lines: [t('Back in about {h} h.', { h: hours(ORG.reopen.minutes) })] };
}

export function investDecision(service: ServiceId, level: number, progress: number): Decision | null {
  if (level >= stageCount(service)) return null;
  const next = stageOf(service, level + 1);
  const steps = Math.max(1, Math.ceil((1 - progress) / INVEST.step - 1e-9));
  return {
    title: t('Invest: towards {stage}', { stage: next.label }),
    cost: INVEST.cost,
    lines: [next.does, steps > 1 ? t('About {n} more investments build it.', { n: steps }) : t('This investment builds it.'), t('Each stage beyond the usual size costs {upkeep} an hour to keep up.', { upkeep: price(INVEST.upkeepPerLevelHour) })],
  };
}

export function camperDecision(): Decision {
  return { title: t('Send another camper'), cost: PROPERTY.camperCost, lines: [t('A second van at another kerb spot, with its own places.'), t('Then {rent} an hour to run.', { rent: price(PROPERTY.camperPerHour) })] };
}

export function pathDecision(path: CamperPath): Decision {
  const p = CAMPER_PATH[path];
  return { title: t('Specialise the camper: {path}', { path: p.label }), cost: p.cost, lines: [p.does, t('Changing later costs again.')] };
}

export function setupDecision(activity: Activity): Decision {
  const a = ACTIVITY[activity];
  return { title: t('Set up {activity}', { activity: a.label.toLowerCase() }), cost: a.setup ?? 0, lines: [a.does] };
}
