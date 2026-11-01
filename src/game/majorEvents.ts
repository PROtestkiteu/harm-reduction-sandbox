import type { Simulation } from '../sim/simulation';
import type { EventPlace } from '../config/eventPlaces';
import type { ServiceId } from '../sim/types';
import { CAMP } from '../sim/camp';
import { t } from '../i18n';
import { CONCESSIONS, FAVOUR, type ConcessionId } from '../config/favours';

/**
 * Big turns of fortune that stop the clock and ask for a decision: a hostile
 * new government, a politician's media attack, a court ruling, a donation.
 * Each says what is happening and what each choice costs. ILLUSTRATIVE.
 */
export interface Choice {
  label: string;
  /** Money it costs now; the choice is greyed out when it cannot be paid. */
  cost?: number;
  apply(w: EventWorld): string | void;
}

export interface MajorEvent {
  id: string;
  title: string;
  /** Where it plays out, brought into view when it pops up. */
  place?: EventPlace;
  /** What is already happening on the street as it pops up, before any choice. */
  opening?: (w: EventWorld) => void;
  lines: string[];
  /** Whether it can happen now (for example, relief only after a crackdown). */
  eligible(w: EventWorld): boolean;
  choices: Choice[];
}

/** What events may touch: the simulation and the national context settings. */
export interface EventWorld {
  sim: Simulation;
  /** The option currently chosen for a context setting, by id. */
  factor(id: string): string;
  setFactor(id: string, option: string): void;
  random(): number;
  /** Sends a police car or an ambulance to where a place stands, with a reason for its card. */
  dispatchTo(kind: 'police' | 'ambulance', service: ServiceId, reason: string): void;
  /** Plays an event out on the street, not only in text. */
  show(s: Spectacle): void;
}

/** What an event looks like on the street, for the world to draw. */
export type Spectacle =
  | { kind: 'rave'; theme: 'wixapol' | 'hazel' }
  | { kind: 'raid'; at: ServiceId; hours: number }
  | { kind: 'sweep'; hours: number }
  | { kind: 'alert'; at: ServiceId; hours: number }
  | { kind: 'press'; at: ServiceId; hours: number }
  | { kind: 'coins'; at: ServiceId; count: number }
  /** Police cars posted at the services. */
  | { kind: 'patrol' };

const tire = (w: EventWorld, by: number) => {
  for (const m of w.sim.team.members) m.energy = Math.max(0, m.energy - by);
};

export const MAJOR_EVENTS: readonly MajorEvent[] = [
  {
    id: 'hostileGovernment',
    place: 'dropIn',
    title: t('A new government takes office'),
    lines: [
      t('It won on a tough-on-drugs ticket. Its first order: police to patrol near health services and stop people on their way in.'),
      t('Expect more people to turn back before they reach you.'),
    ],
    eligible: (w) => w.factor('policing') !== 'visible',
    choices: [
      {
        label: t('Brief the team and carry on'),
        apply: (w) => { w.setFactor('policing', 'visible'); w.show({ kind: 'patrol' }); tire(w, 0.1); return t('Police are now posted near the services.'); },
      },
      {
        label: t('Lobby the city for a police agreement'),
        cost: 150,
        apply: (w) => {
          w.sim.org.spend(150, false);
          if (w.random() < 0.5) { w.setFactor('policing', 'agreement'); return t('The city brokered an agreement: patrols keep clear of entrances.'); }
          w.setFactor('policing', 'visible');
          w.show({ kind: 'patrol' });
          return t('The city would not intervene. Police are now posted near the services.');
        },
      },
    ],
  },
  {
    id: 'mediaAttack',
    place: 'dropIn',
    opening: (w) => w.show({ kind: 'press', at: 'dropIn', hours: 1 }),
    title: t('A politician attacks the project in the media'),
    lines: [
      t('A conservative politician calls your drop-in "a drug den" on television and in the papers.'),
      t('Funders hesitate for a while, and the team loses hours answering calls instead of working.'),
    ],
    eligible: () => true,
    choices: [
      {
        label: t('Answer with your data and a statement'),
        cost: 100,
        apply: (w) => { w.sim.org.spend(100, false); w.sim.mediaAttack(0.8, 2, 0.1); w.show({ kind: 'press', at: 'dropIn', hours: 2 }); return t('Your answer took the edge off: funders are a little warier for two nights.'); },
      },
      {
        label: t('Stay out of it'),
        apply: (w) => { w.sim.mediaAttack(0.55, 4, 0.25); w.show({ kind: 'press', at: 'dropIn', hours: 4 }); return t('The story ran unanswered: grant chances are down for four nights and the team is drained.'); },
      },
    ],
  },
  {
    id: 'courtRuling',
    place: 'dropIn',
    title: t('A court rules for the services'),
    lines: [
      t('Judges find that policing the doors of health services breaks patients\' rights.'),
      t('Patrols are pulled back to their usual rounds.'),
    ],
    eligible: (w) => w.factor('policing') === 'visible',
    choices: [{ label: t('Tell the team'), apply: (w) => { w.setFactor('policing', 'neutral'); return t('Police are back to routine patrols.'); } }],
  },
  {
    id: 'campSweep',
    place: 'camp',
    opening: (w) => w.show({ kind: 'sweep', hours: 1 }),
    title: t('The council orders the park camp cleared'),
    lines: [
      t('Neighbours complained about the tents in the park. Council workers and police are due in the morning to clear them.'),
      t('Cleared, people scatter out of sight and out of reach, and the camp comes back.'),
    ],
    eligible: (w) => w.sim.camp.size >= CAMP.sweepAt && w.sim.org.now >= w.sim.campHoldUntil,
    choices: [
      {
        label: t('Negotiate time to find people places'),
        cost: 150,
        apply: (w) => {
          w.sim.org.spend(150, false);
          w.sim.camp.size *= 0.7;
          return t('The council gave you a week: some people moved on to places you found; the rest stay for now.');
        },
      },
      {
        label: t('Stay out of it'),
        apply: (w) => {
          w.sim.camp.size = 0.1;
          w.show({ kind: 'sweep', hours: 3 });
          w.sim.triggerEvent('afterCrackdown');
          return t('The camp was cleared. People scattered to hidden corners, where overdoses go unseen.');
        },
      },
    ],
  },
  {
    id: 'badBatch',
    place: 'drugChecking',
    opening: (w) => w.show({ kind: 'alert', at: 'drugChecking', hours: 1 }),
    title: t('A bad batch is going round'),
    lines: [
      t('Several people have collapsed after using the same supply. Something much stronger than usual is in it.'),
      t('A public alert reaches people you never see; a quiet word reaches only your clients.'),
    ],
    eligible: (w) => !w.sim.events.isActive('opioidContamination'),
    choices: [
      {
        label: t('Put out a public alert and invite people to check'),
        cost: 80,
        apply: (w) => {
          w.sim.org.spend(80, false);
          w.sim.triggerEvent('opioidContamination');
          w.sim.triggerEvent('checkingRush');
          w.show({ kind: 'alert', at: 'drugChecking', hours: 3 });
          return t('The alert is out: more people are bringing samples to check.');
        },
      },
      {
        label: t('Warn your clients quietly'),
        apply: (w) => {
          w.sim.triggerEvent('opioidContamination');
          w.show({ kind: 'alert', at: 'dropIn', hours: 3 });
          for (let i = 0; i < 2; i++) w.dispatchTo('ambulance', w.sim.busiest.service, t('A bad batch: someone collapsed after using.'));
          return t('Your clients know. Everyone else finds out the hard way.');
        },
      },
    ],
  },
  {
    id: 'wixapol',
    place: 'park',
    title: t('Wixapol: a flash rave in the park'),
    lines: [
      t('Speakers on bikes, a few hundred people, dancing until the sun comes up. It spread by word of mouth an hour ago.'),
      t('Pills and powders are going round, and nobody brought water.'),
    ],
    eligible: (w) => w.sim.clockMinutes >= 22 * 60 && w.sim.clockMinutes < 28 * 60 && w.sim.party === null,
    choices: [
      {
        label: t('Send the stand team and the camper over'),
        cost: 80,
        apply: (w) => {
          w.sim.org.spend(80, false);
          w.sim.triggerEvent('popUpParty');
          w.sim.triggerEvent('checkingRush');
          w.show({ kind: 'rave', theme: 'wixapol' });
          return t('Your team hands out water, earplugs and test kits. The night stays a party.');
        },
      },
      {
        label: t('Leave them to it'),
        apply: (w) => {
          w.sim.triggerEvent('popUpParty');
          w.sim.triggerEvent('highDosePills');
          w.show({ kind: 'rave', theme: 'wixapol' });
          return t('The rave goes on without you. Strong pills are going round.');
        },
      },
    ],
  },
  {
    id: 'djHazel',
    place: 'park',
    title: t('DJ Hazel in memoriam'),
    lines: [
      t('Friends of DJ Hazel organise a memorial rave in her honour, with her music, all night.'),
      t('The scene asks for harm reduction on site, the way she would have wanted.'),
    ],
    eligible: (w) => w.sim.party === null,
    choices: [
      {
        label: t('Be there: a stand, checking and water'),
        cost: 100,
        apply: (w) => {
          w.sim.org.spend(100, false);
          w.sim.triggerEvent('popUpParty');
          w.sim.triggerEvent('checkingRush');
          w.show({ kind: 'rave', theme: 'hazel' });
          w.sim.org.budget += 60;
          return t('A night to remember her by. People bring samples to check, and the organisers pass round a hat for you (+60).');
        },
      },
      {
        label: t('Not tonight'),
        apply: (w) => {
          w.sim.triggerEvent('popUpParty');
          w.show({ kind: 'rave', theme: 'hazel' });
          return t('The memorial goes ahead without harm reduction on site.');
        },
      },
    ],
  },
  {
    id: 'raid',
    place: 'busiest',
    opening: (w) => w.show({ kind: 'raid', at: w.sim.busiest.service, hours: 1 }),
    title: t('Police raid'),
    lines: [
      t('Too many people gathered in one place: police cars swarm the area, and officers stop and arrest people who use drugs.'),
      t('For a while fewer people dare come to the services, and hidden use follows.'),
    ],
    // Only where possession is still an offence, without a police agreement or a favour keeping police away, and where people crowd together.
    eligible: (w) =>
      (w.factor('law') === 'criminal' || w.factor('law') === 'discretionary') && w.factor('policing') !== 'agreement' && !w.sim.policeAway &&
      (w.sim.busiest.queue >= 5 || w.sim.camp.outdoors >= 0.5 || w.sim.neighbourhood.state.streetMarket >= 0.5),
    choices: [
      {
        label: t('Send outreach after them, with lawyers\' numbers'),
        cost: 60,
        apply: (w) => {
          w.sim.org.spend(60, false);
          raidCars(w);
          w.sim.raid(2);
          return t('A few arrests. Outreach staff found most people afterwards and kept in touch.');
        },
      },
      {
        label: t('Nothing you can do'),
        apply: (w) => {
          raidCars(w);
          w.sim.raid(4);
          w.sim.triggerEvent('afterCrackdown');
          return t('Several arrests. The rest scattered to hidden corners.');
        },
      },
    ],
  },
  {
    id: 'donation',
    place: 'dropIn',
    title: t('A donation'),
    lines: [t('A local business owner, whose brother was helped by your outreach team, sends a donation.')],
    eligible: () => true,
    choices: [{ label: t('Thank them'), apply: (w) => { w.sim.org.budget += 400; w.show({ kind: 'coins', at: 'dropIn', count: 16 }); return t('400 added to the budget.'); } }],
  },
];

/** Police cars swarm the busiest place, lights on. */
function raidCars(w: EventWorld): void {
  const at = w.sim.busiest.service;
  w.show({ kind: 'raid', at, hours: 1.5 });
  for (let i = 0; i < 3; i++) w.dispatchTo('police', at, t('A raid: too many people gathered here, and the law makes their drug use an offence.'));
}

/** City hall's concession for a favour used, as a pop-up: agree (and earn a favour) or refuse. */
export function concessionEvent(id: ConcessionId): MajorEvent {
  const c = CONCESSIONS[id];
  return {
    id: `concession-${id}`,
    title: c.title,
    lines: [c.ask, t('Agree and you earn your next favour. Refuse and city hall remembers.')],
    eligible: () => true,
    choices: [
      { label: t('Agree'), cost: id === 'cleanUp' ? FAVOUR.cleanUpCost : undefined, apply: (w) => w.sim.answerConcession(id, true) },
      { label: t('Refuse'), apply: (w) => w.sim.answerConcession(id, false) },
    ],
  };
}

/**
 * Money running out: suggestions built from how the places are doing. Close
 * the place that helped fewest people tonight, scale back the most upgraded
 * one, or let a paid worker go. Each saves money and costs something else.
 */
export function budgetEvent(w: EventWorld, serviceName: (id: ServiceId) => string): MajorEvent {
  const { sim } = w;
  const open = (Object.keys(sim.services) as ServiceId[]).filter((id) => !sim.org.closedDown.has(id));
  const weakest = open.sort((a, b) => sim.services[a].metrics.attended - sim.services[b].metrics.attended)[0];
  const upgraded = (Object.keys(sim.upgrades) as ServiceId[]).filter((id) => sim.upgrades[id].level > 1).sort((a, b) => sim.upgrades[b].level - sim.upgrades[a].level)[0];
  const choices: Choice[] = [];
  if (weakest && open.length > 1) {
    choices.push({
      label: t('Close the {place}: fewest people helped there tonight', { place: serviceName(weakest) }),
      apply: (ww) => { ww.sim.closeDownPlace(weakest); return t('Running costs and wages there stop. The people it served now go without, and more will be turned away.'); },
    });
  }
  if (upgraded) {
    choices.push({
      label: t('Scale back the {place} a level', { place: serviceName(upgraded) }),
      apply: (ww) => { ww.sim.downgrade(upgraded); return t('Less upkeep. Fewer places there, so longer queues.'); },
    });
  }
  if (sim.org.paid > 0) {
    choices.push({
      label: t('Let a paid worker go'),
      apply: (ww) => { ww.sim.letGo(); return t('Lower wages. Fewer hands on shift, and the team is shaken.'); },
    });
  }
  choices.push({ label: t('Hold on for now'), apply: () => t('Nothing changes. Look for donations, grants and side income.') });
  return {
    id: 'budget',
    title: t('Money is running out'),
    lines: [t('At this rate the money runs out within hours. Something has to give.')],
    eligible: () => true,
    choices,
  };
}

/** Picks an event that can happen now, weighted towards trouble. */
export function pickEvent(w: EventWorld): MajorEvent | null {
  // Raids are likely whenever they can happen; the raves are rare easter eggs.
  const weights: Record<string, number> = { hostileGovernment: 3, mediaAttack: 3, courtRuling: 2, campSweep: 4, badBatch: 2, raid: 5, wixapol: 0.4, djHazel: 0.3, donation: 1.5 };
  const open = MAJOR_EVENTS.filter((e) => e.eligible(w));
  const total = open.reduce((n, e) => n + (weights[e.id] ?? 1), 0);
  let r = w.random() * total;
  for (const e of open) if ((r -= weights[e.id] ?? 1) <= 0) return e;
  return open[0] ?? null;
}
