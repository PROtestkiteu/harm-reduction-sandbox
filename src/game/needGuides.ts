import type { Need } from '../config/needs';
import type { LocationId, ServiceId } from '../sim/types';
import { t } from '../i18n';
import type { MajorEvent } from './majorEvents';

/**
 * A short guide when one of the city's meters goes red: what is pressing on it in this game, what
 * eases it, and a reply that takes the player to the place to act. Stops the clock like the big
 * events. Each guide shows the first time its meter goes red, then at most once a game day.
 */
export const GUIDE_AGAIN_MINUTES = 24 * 60;

const GUIDE: Record<Need, { title: string; lines: string[]; show: string }> = {
  police: {
    title: t('The police are stretched'),
    lines: [
      t('Incidents, stops, the camp in the park and people turned away from a bed keep the police busy. A stretched force makes the council lean on your funders.'),
      t('What helps: beds at the night shelter, outreach and the General support camper path to shrink the camp, and a police agreement (the side quest at the police station).'),
    ],
    show: t('Show the shelter'),
  },
  medics: {
    title: t('Ambulances and A&E are stretched'),
    lines: [
      t('Overdoses nobody reached, people harmed outdoors and people turned away from services fill ambulances and A&E. Stretched, fewer of them survive.'),
      t('What helps: naloxone and first aid in the budget mix, more staff where people are turned away, the foot patrol and drug checking, the warming bus or water in bad weather, and working with A&E (the hospital\'s side quest).'),
    ],
    show: t('Show where most are turned away'),
  },
  sobering: {
    title: t('The sobering-up centre is full'),
    lines: [
      t('Drunk club leavers end up in the izba, more of them when the club stand turns people away.'),
      t('What helps: more staff at the club stand, partnering with the new venues as they open, and working with the izba (its side quest).'),
    ],
    show: t('Show the club stand'),
  },
  district: {
    title: t('The district is struggling'),
    lines: [
      t('A crisis and stretched city services wear the district down: fewer people come out, and venues close.'),
      t('What helps: turn fewer people away. Open more services under Services, and add staff and waiting places where queues build.'),
    ],
    show: t('Show where most are turned away'),
  },
};

/**
 * The guide for `need` as a popup: the first reply selects the place to act (`busiest`: the
 * service turning most people away now), the second just closes it.
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
      { label: g.show, apply: () => { select(place); return t('It is selected: its replies are in the panel.'); } },
      { label: t('Got it'), apply: () => '' },
    ],
  };
}
