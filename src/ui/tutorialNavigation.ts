import type { TutorialProgress } from '../game/tutorial';
import type { ServiceId } from '../sim/types';
import { SERVICE_TEXT } from '../config/places';
import { t } from '../i18n';

type Destination =
  | { kind: 'camp' }
  | { kind: 'team'; purpose: 'review' | 'staffing' }
  | { kind: 'dispatch'; open: boolean }
  | { kind: 'clock'; resume: boolean; reason: 'patrol-return' | 'patrol-ready' | 'patrol-funds' | 'operating' | 'network' }
  | { kind: 'placement'; confirm: boolean }
  | { kind: 'service'; service: ServiceId; open: boolean };
export type TutorialNavigation = Destination & { instruction: string };
export interface TutorialNavigationContext {
  patrolAway: boolean;
  patrolReady: boolean;
  canAffordPatrol: boolean;
  placing: boolean;
  placementReady: boolean;
  manuallyPaused: boolean;
  selectedCamp: boolean;
  selectedService: ServiceId | null;
  servicesOpen: boolean;
  running(service: ServiceId): boolean;
  needsStaff(service: ServiceId): boolean;
}

/** Resolve the next pending action from mission and UI state without executing it. */
export function tutorialNavigation(progress: TutorialProgress, c: TutorialNavigationContext): TutorialNavigation | null {
  const team = (instruction: string, purpose: 'review' | 'staffing' = 'staffing'): TutorialNavigation => ({ kind: 'team', instruction, purpose });
  const clock = (instruction: string, reason: Extract<Destination, {kind: 'clock'}>['reason']): TutorialNavigation => ({ kind: 'clock', resume: c.manuallyPaused, instruction, reason });
  const service = (id: ServiceId): TutorialNavigation => {
    const open = c.selectedService === id;
    return { kind: 'service', service: id, open,
      instruction: open ? SERVICE_TEXT[id].label + ' → ' + t('Open up.') : t('Services') + ' → ' + SERVICE_TEXT[id].label };
  };
  if (progress.stage === 'complete') return null;
  if (c.placing) return { kind: 'placement', confirm: c.placementReady,
    instruction: c.placementReady ? t('Open here') : t('Next site') + ' → ' + t('Open here') };
  if (progress.stage === 'meet') return { kind: 'camp', instruction: t('Select the camp on the map.') };
  if (progress.stage === 'patrol') {
    if (c.patrolAway) return clock(t('Keep time running until both patrol workers return.'), 'patrol-return');
    if (!c.running('footPatrol')) return service('footPatrol');
    if (c.needsStaff('footPatrol')) return team(t('Your portrait') + ' → ' + t('Your team'));
    if (!c.patrolReady) return clock(t('Keep time running until the team reaches the stand.'), 'patrol-ready');
    if (!c.canAffordPatrol) return clock(t('Not enough money to send the foot patrol out.'), 'patrol-funds');
    return { kind: 'dispatch', open: c.selectedCamp, instruction: c.selectedCamp ? t('Camp in the park') + ' → ' + t('Send patrol to the camp') : t('Select the camp on the map.') };
  }
  if (progress.stage === 'outreach' && !progress.reviewedSkills) return team(t('Your portrait') + ' → ' + t('Your team'), 'review');
  const services: ServiceId[] = progress.stage === 'night' ? ['outreach', 'dropIn', 'clubHr'] : [progress.stage === 'outreach' ? 'outreach' : progress.stage === 'dropIn' ? 'dropIn' : 'clubHr'];
  const off = services.find(id => !c.running(id));
  if (off) return service(off);
  if (services.some(id => c.needsStaff(id))) return team(t('Your portrait') + ' → ' + t('Your team'));
  return clock(progress.stage === 'night' ? t('Keep all three services staffed until the night report.') : t('Keep time running while people arrive and receive support.'), progress.stage === 'night' ? 'network' : 'operating');
}

export interface TutorialBriefing { id: string; context: string }

/** Every task has a reading step before its normal controls receive visual clues. */
export function tutorialBriefing(next: TutorialNavigation | null): TutorialBriefing {
  if (!next) return { id: 'complete', context: t('Your network is ready. Keep playing this city with all controls available.') };
  switch (next.kind) {
    case 'camp': return { id: 'camp', context: t('Select the park camp to learn where people need support.') };
    case 'dispatch': return { id: 'dispatch', context: t('Send a foot patrol from the camp panel. Follow the team out and back.') };
    case 'team': return next.purpose === 'review'
      ? { id: 'team-review', context: t('Open your team and compare their skills before setting up outreach.') }
      : { id: 'staffing', context: t('The service needs staff. Open your team to review assignments.') };
    case 'service': return { id: 'service-' + next.service, context: t('Use Services to open and manage {service}.', { service: SERVICE_TEXT[next.service].label }) };
    case 'placement': return { id: 'placement', context: t('Choose a site, then use Open here. The service appears only after you confirm.') };
    case 'clock': {
      switch (next.reason) {
        case 'patrol-return': return { id: next.reason, context: t('The team is on its way. Let time run until both workers return to the stand.') };
        case 'patrol-ready': return { id: next.reason, context: t('Keep time running until the team reaches the stand.') };
        case 'patrol-funds': return { id: next.reason, context: t('Let time run for tutorial funding before sending the patrol.') };
        case 'network': return { id: next.reason, context: t('Keep all three services staffed until the night report.') };
        case 'operating': return { id: next.reason, context: t('The service is set up. Let time run and watch people arrive and receive support.') };
      }
    }
  }
}
