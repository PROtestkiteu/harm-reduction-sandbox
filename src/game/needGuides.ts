import type { Need } from '../config/needs';
import type { LocationId, ServiceId } from '../sim/types';
import { t } from '../i18n';
import type { MajorEvent } from './majorEvents';

/**
 * A short guide when one of the city's meters goes red: what is pressing on it in this game, what
 * eases it, and a reply that selects the place to act. Stops the clock like the big events. Each
 * guide shows the first time its meter goes red, then at most once a game day.
 */
export const GUIDE_AGAIN_MINUTES = 24 * 60;

const GUIDE: Record<Need, { title: string; lines: string[]; show: string }> = {
  police: {
    title: t('The police are stretched'),
    lines: [
      t('The police are kept busy by incidents, stop-and-search, the camp in the park and people who found no bed for the night. When they are stretched, the council leans on your funders.'),
      t('More beds at the night shelter ease it. Outreach shrinks the camp, and so does the camper on the General support path. The police station\'s side quest ends in an agreement with them.'),
    ],
    show: t('Go to the shelter'),
  },
  medics: {
    title: t('Ambulances and A&E are stretched'),
    lines: [
      t('Ambulances and A&E fill up with overdoses nobody reached in time, people hurt outdoors and people your services had to turn away. The fuller they are, the fewer people survive.'),
      t('Put naloxone and first aid in the budget mix, and add staff wherever people are turned away. The foot patrol and drug checking catch trouble early. In bad weather, send the warming bus or hand out water. The hospital\'s side quest gets A&E working with you.'),
    ],
    show: t('Go to the busiest service'),
  },
  sobering: {
    title: t('The sobering-up centre is full'),
    lines: [
      t('People who leave the club drunk end up in the izba, and more of them do when your club stand has to turn people away.'),
      t('Add staff at the club stand and partner with new venues as they open. The izba\'s side quest gets them working with you.'),
    ],
    show: t('Go to the club stand'),
  },
  district: {
    title: t('The district is struggling'),
    lines: [
      t('A crisis and overstretched city services wear the district down. Fewer people go out, and venues start to close.'),
      t('Turn fewer people away. Open more services under Services, and add staff and waiting places where queues build up.'),
    ],
    show: t('Go to the busiest service'),
  },
};

/**
 * The guide for `need` as a popup: the first reply selects the place to act (`busiest`: the
 * service turning most people away now) and closes on its panel; the second just closes.
 */
export function needGuide(need: Need, busiest: ServiceId, select: (id: LocationId) => void): MajorEvent {
  const g = GUIDE[need];
  const place: LocationId = need === 'police' ? 'shelter' : need === 'sobering' ? 'club' : busiest === 'clubHr' ? 'club' : busiest;
  return {
    id: `guide-${need}`,
    title: g.title,
    lines: g.lines,
    place,
    eligible: () => true,
    choices: [
      { label: g.show, apply: () => { select(place); return ''; } },
      { label: t('Got it'), apply: () => '' },
    ],
  };
}
