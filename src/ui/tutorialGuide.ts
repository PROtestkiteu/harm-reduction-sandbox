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
  patrolOut?(): boolean;
  canDispatchCamp?(): boolean;
}

/** One objective stays reachable on touch screens without hover or a selected map object. */
export class TutorialGuide {
  readonly root = document.createElement('section');
  private readonly step = document.createElement('p');
  private readonly title = document.createElement('h2');
  private readonly toggle = document.createElement('button');
  private readonly text = document.createElement('p');
  private readonly counter = document.createElement('p');
  private readonly actions = document.createElement('div');
  private stage: TutorialStage | null = null;
  private dismissed = false;
  private covered = false;
  private skillsReviewed = false;
  private inspectedCamp = false;
  private published: HTMLButtonElement[] = [];

  constructor(parent: HTMLElement, private readonly callbacks: TutorialGuideActions, private readonly publishActions: (buttons: HTMLButtonElement[]) => void) {
    this.root.className = 'tutorial-guide';
    this.root.setAttribute('aria-label', t('Tutorial objective'));
    this.root.hidden = true;
    this.title.tabIndex = -1;
    this.step.className = 'tutorial-step';
    this.step.setAttribute('role', 'status');
    this.counter.className = 'tutorial-counter';
    this.counter.setAttribute('role', 'status');
    this.actions.className = 'tutorial-actions';
    this.toggle.type = 'button';
    this.toggle.className = 'tutorial-toggle selection-heading';
    this.root.dataset.collapsed = 'true';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.addEventListener('click', () => {
      const folded = this.root.dataset.collapsed !== 'true';
      this.root.dataset.collapsed = String(folded);
      this.toggle.setAttribute('aria-expanded', String(!folded));
    });
    this.title.append(this.toggle);
    this.root.append(this.step, this.title, this.text, this.counter);
    parent.append(this.root);
  }

  setCovered(covered: boolean): void {
    this.covered = covered;
    this.root.hidden = covered || !this.stage || this.dismissed;
  }

  set(progress: TutorialProgress | null): void {
    this.root.hidden = !progress || this.dismissed || this.covered;
    if (!progress || this.dismissed) {
      if (this.published.length) { this.published = []; this.publishActions([]); }
      return;
    }
    const inspectedCamp = progress.snapshot().inspectedCamp;
    if (this.stage !== progress.stage || this.skillsReviewed !== progress.reviewedSkills || this.inspectedCamp !== inspectedCamp) {
      this.inspectedCamp = inspectedCamp;
      this.skillsReviewed = progress.reviewedSkills;
      const restoreFocus = document.activeElement?.classList.contains('tutorial-action');
      this.stage = progress.stage;
      this.actions.replaceChildren();
      this.step.textContent = progress.active ? t('Tutorial: {step} of {total}', { step: TUTORIAL_STAGES.indexOf(progress.stage) + 1, total: 6 }) : t('Tutorial complete');
      this.root.dataset.stage = progress.stage;
      this.renderStage(progress.stage);
      this.toggle.textContent = this.title.textContent;
      this.title.replaceChildren(this.toggle);
      const next = [...this.actions.querySelectorAll('button')];
      if (next.length !== this.published.length || next.some((button, i) => button.textContent !== this.published[i].textContent)) {
        this.published = next;
        this.publishActions(next);
        if (restoreFocus) this.toggle.focus({ preventScroll: true });
      }
    }
    const service = progress.stage === 'outreach' ? (progress.reviewedSkills ? 'outreach' : null) : progress.stage === 'dropIn' ? 'dropIn' : progress.stage === 'nightlife' ? 'clubHr' : null;
    const count = progress.stage === 'patrol' ? t('People reached: {count} of {goal}', { count: Math.min(3, progress.patrolContacts), goal: 3 }) : service ? t('Visits completed: {count} of {goal}', { count: Math.min(5, progress.visits[service] ?? 0), goal: 5 }) : '';
    const progressText = progress.stage === 'patrol' && progress.patrolContacts >= 3 && this.callbacks.patrolOut?.() ? `${count} · ${t('Waiting for patrol to return.')}` : count;
    if (this.counter.textContent !== progressText) this.counter.textContent = progressText;
    if (progress.stage === 'patrol' && this.callbacks.canDispatchCamp) for (const button of this.published) button.disabled = !this.callbacks.canDispatchCamp();
    this.counter.hidden = !count;
  }

  private button(label: string, action: () => void): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'opt tutorial-action';
    button.textContent = label;
    button.addEventListener('click', action);
    this.actions.append(button);
  }

  private renderStage(stage: TutorialStage): void {
    const cb = this.callbacks;
    if (stage === 'meet') {
      this.title.textContent = t('Meet the neighbourhood');
      this.text.textContent = t('Start with the block beside the park. Meet people at the encampment, then open your foot patrol controls. Drag to look around; pause whenever you need.');
      if (!this.inspectedCamp) this.button(t('Visit the encampment'), cb.inspectCamp);
      else this.button(t('Open foot patrol'), cb.openPatrol);
    } else if (stage === 'patrol') {
      this.title.textContent = t('Your first round');
      this.text.textContent = t('Send the team to the park camp. Offer kits, naloxone, a warm drink and a conversation. Reach three people and let the patrol return.');
      this.button(t('Send patrol to the camp'), cb.dispatchCamp);
    } else if (stage === 'outreach') {
      this.title.textContent = this.skillsReviewed ? t('Reach further') : t('Review team skills');
      this.text.textContent = this.skillsReviewed
        ? t('Inspect visitors to see their support needs and suitable team members. Choose {open} in outreach controls and complete five visits. Manual assignments are optional; resume the clock if it is paused.', { open: t('Open up.') })
        : t('Meet your team before opening outreach. Each employee and volunteer has different skills. Review their strengths; automatic placement will put them to work.') + ' ' + t('Opening the team panel completes this review; no assignment changes are required.');
      if (!this.skillsReviewed) this.button(t('Review team skills'), cb.reviewTeam);
      if (this.skillsReviewed) this.button(t('Open outreach controls'), () => cb.selectService('outreach'));
    } else if (stage === 'dropIn') {
      this.title.textContent = t('A place to return');
      this.text.textContent = t('The residential block is now available. Open the drop-in centre and complete five visits. Check staff energy, capacity and maintenance as people arrive.');
      this.button(t('Open drop-in controls'), () => cb.selectService('dropIn'));
    } else if (stage === 'nightlife') {
      this.title.textContent = t('The evening district');
      this.text.textContent = t('The nightlife district is now available. Open the club stand and complete five visits. Its service mix and the stress indicators help you respond to different needs.');
      this.button(t('Open club stand controls'), () => cb.selectService('clubHr'));
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
