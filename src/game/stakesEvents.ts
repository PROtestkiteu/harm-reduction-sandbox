import { STORM, STORM_TEXT, type StormKind } from '../config/storm';
import { t } from '../i18n';
import { formatClock } from '../sim/clock';
import type { RunOverCause } from '../sim/stakes';
import type { MajorEvent } from './majorEvents';

/**
 * The boxes the stakes bring up (sim/stakes.ts): the warning before the big
 * crisis, and the end of the run when the project folds. Built on the same
 * pop-up as the other big events.
 */
export function stormWarning(kind: StormKind, openOrg: () => void): MajorEvent {
  const s = STORM_TEXT[kind];
  return {
    id: `storm-${kind}`,
    // The freeze is felt first by people sleeping out in the park; the bad batch where the crowd is.
    place: kind === 'freeze' ? 'camp' : 'busiest',
    title: kind === 'freeze' ? t('A deep freeze is coming') : t('A bad batch is coming'),
    lines: [
      s.warning,
      t('You have until then to get ready: emergency beds, a warning on the street, volunteers on call, a full shelf and a rested team. The Organisation sheet has it all.'),
      t('A first time unprepared, it can break the project.'),
    ],
    eligible: () => true,
    choices: [
      { label: t('Get ready now'), apply: () => { openOrg(); } },
      { label: t('Later'), apply: () => t('The storm comes at {time} tomorrow night.', { time: formatClock(STORM.from) }) },
    ],
  };
}

export function runOver(cause: RunOverCause, nights: number, helped: number, deaths: number, restart: () => void, carryOn: () => void): MajorEvent {
  return {
    id: 'runOver',
    title: t('The project has folded'),
    lines: [
      cause === 'team'
        ? t('The last of the team has walked out. Nobody is left to open the doors.')
        : t('Every place you started with has closed for lack of money.'),
      t('Nights: {nights}, people helped: {helped}, deaths: {deaths}.', { nights, helped, deaths }),
      t('Try again: rest the team before the hard nights, stock up ahead, and do not leave people at the door.'),
    ],
    eligible: () => true,
    choices: [
      { label: t('Start again'), apply: () => { restart(); } },
      { label: t('Carry on as a sandbox run (off the leaderboard)'), apply: () => { carryOn(); return t('The run carries on as a sandbox: no more endings.'); } },
    ],
  };
}
