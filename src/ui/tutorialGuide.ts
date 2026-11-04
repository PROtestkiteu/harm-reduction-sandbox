import { t } from '../i18n';
import { TUTORIAL_STAGES, type TutorialProgress, type TutorialStage } from '../game/tutorial';
import type { ServiceId } from '../sim/types';
import './tutorialGuide.css';

export interface TutorialGuideActions {
  inspectCamp(): void;
  openPatrol(): void;
  dispatchCamp(): void;
  selectService(id: ServiceId): void;
  reviewTeam(): void;
  continueCity(): void;
}

/** One objective stays reachable on touch screens without hover or a selected map object. */
export class TutorialGuide {
  readonly root = document.createElement('section');
  private readonly step = document.createElement('p');
  private readonly title = document.createElement('h2');
  private readonly text = document.createElement('p');
  private readonly counter = document.createElement('p');
  private readonly actions = document.createElement('div');
  private stage: TutorialStage | null = null;
  private dismissed = false;
  private covered = false;
  private skillsReviewed = false;

  constructor(parent: HTMLElement, private readonly callbacks: TutorialGuideActions) {
    this.root.className = 'tutorial-guide';
    this.root.setAttribute('aria-label', t('Tutorial objective'));
    this.root.hidden = true;
    this.title.tabIndex = -1;
    this.step.className = 'tutorial-step';
    this.step.setAttribute('role', 'status');
    this.counter.className = 'tutorial-counter';
    this.counter.setAttribute('role', 'status');
    this.actions.className = 'tutorial-actions';
    this.root.append(this.step, this.title, this.text, this.counter, this.actions);
    parent.append(this.root);
  }

  setCovered(covered: boolean): void {
    this.covered = covered;
    this.root.hidden = covered || !this.stage || this.dismissed;
  }

  set(progress: TutorialProgress | null): void {
    this.root.hidden = !progress || this.dismissed || this.covered;
    if (!progress || this.dismissed) return;
    if (this.stage !== progress.stage || this.skillsReviewed !== progress.reviewedSkills) {
      this.skillsReviewed = progress.reviewedSkills;
      const restoreFocus = this.actions.contains(document.activeElement);
      this.stage = progress.stage;
      this.actions.replaceChildren();
      this.step.textContent = progress.active ? t('Tutorial: {step} of {total}', { step: TUTORIAL_STAGES.indexOf(progress.stage) + 1, total: 6 }) : t('Tutorial complete');
      this.root.dataset.stage = progress.stage;
      this.renderStage(progress.stage);
      if (restoreFocus) (this.actions.querySelector('button') ?? this.title).focus({ preventScroll: true });
    }
    const service = progress.stage === 'outreach' ? (progress.reviewedSkills ? 'outreach' : null) : progress.stage === 'dropIn' ? 'dropIn' : progress.stage === 'nightlife' ? 'clubHr' : null;
    const count = progress.stage === 'patrol' ? t('People reached: {count} of {goal}', { count: Math.min(3, progress.patrolContacts), goal: 3 }) : service ? t('Visits completed: {count} of {goal}', { count: Math.min(5, progress.visits[service] ?? 0), goal: 5 }) : '';
    if (this.counter.textContent !== count) this.counter.textContent = count;
    this.counter.hidden = !count;
  }

  private button(label: string, action: () => void): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    this.actions.append(button);
  }

  private renderStage(stage: TutorialStage): void {
    const cb = this.callbacks;
    if (stage === 'meet') {
      this.title.textContent = t('Meet the neighbourhood');
      this.text.textContent = t('Start with the block beside the park. Meet people at the encampment, then open your foot patrol controls. Drag to look around; pause whenever you need.');
      this.button(t('Visit the encampment'), cb.inspectCamp);
      this.button(t('Open foot patrol'), cb.openPatrol);
    } else if (stage === 'patrol') {
      this.title.textContent = t('Your first round');
      this.text.textContent = t('Send the team to the park camp. Offer kits, naloxone, a warm drink and a conversation. Reach three people and let the patrol return.');
      this.button(t('Send patrol to the camp'), cb.dispatchCamp);
      this.button(t('Open foot patrol'), cb.openPatrol);
    } else if (stage === 'outreach') {
      this.title.textContent = this.skillsReviewed ? t('Reach further') : t('Review team skills');
      this.text.textContent = this.skillsReviewed
        ? t('Inspect visitors to see their support needs and suitable team members. Skills improve with practice, and automatic placement considers people waiting. Open outreach and complete five visits; manual assignments are optional.')
        : t('Meet your team before opening outreach. Each employee and volunteer has different skills. Review their strengths; automatic placement will put them to work.');
      this.button(t('Review team skills'), cb.reviewTeam);
      this.button(t('Open outreach controls'), () => cb.selectService('outreach'));
    } else if (stage === 'dropIn') {
      this.title.textContent = t('A place to return');
      this.text.textContent = t('The residential block is now available. Open the drop-in centre and complete five visits. Check staff energy, capacity and maintenance as people arrive.');
      this.button(t('Open drop-in controls'), () => cb.selectService('dropIn'));
      this.button(t('Review team skills'), cb.reviewTeam);
    } else if (stage === 'nightlife') {
      this.title.textContent = t('The evening district');
      this.text.textContent = t('The nightlife district is now available. Open the club stand and complete five visits. Its service mix and the stress indicators help you respond to different needs.');
      this.button(t('Open club stand controls'), () => cb.selectService('clubHr'));
      this.button(t('Review team skills'), cb.reviewTeam);
    } else if (stage === 'night') {
      this.title.textContent = t('Your first coordinated night');
      this.text.textContent = t('The whole city is now available. Keep outreach, the drop-in centre and the club stand staffed and operational until the next night report. Explore funding and organisation when you are ready.');
    } else {
      this.title.textContent = t('The city is yours');
      this.text.textContent = t('You built a connected service network, from a foot patrol to a city-wide project. Continue this city with all controls and ordinary consequences. This learning run stays outside the leaderboard.');
      this.button(t('Continue this city'), () => { this.dismissed = true; this.root.hidden = true; cb.continueCity(); });
    }
  }
}
