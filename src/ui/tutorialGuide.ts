import { panelDismiss } from './panelDismiss';
import { draggableWindow } from './draggableWindow';
import { t } from '../i18n';
import { TUTORIAL_STAGES, type TutorialProgress, type TutorialStage } from '../game/tutorial';
import { SERVICE_TEXT } from '../config/places';
import './tutorialGuide.css';

export interface TutorialGuideActions {
  onPopupChange?(open: boolean): void;
  onGuidanceChange?(): void;
  continueCity(): void;
  instruction(): string;
  chapter(): { id: string; context: string } | null;
  patrolOut?(): boolean;
}

/** One objective stays reachable on touch screens without hover or a selected map object. */
export class TutorialGuide {
  readonly root = document.createElement('section');
  private readonly step = document.createElement('p');
  private readonly title = document.createElement('h2');
  private readonly toggle = document.createElement('button');
  private readonly text = document.createElement('p');
  private readonly counter = document.createElement('p');
  private readonly context = document.createElement('p');
  private readonly shownChapters = new Set<string>();
  private readonly acknowledgedChapters = new Set<string>();
  private chapterId: string | null = null;
  private chapterAvailable = false;
  private readonly minimize = document.createElement('button');
  private readonly close = panelDismiss(() => { this.acknowledge(); this.toggle.focus({ preventScroll: true }); });
  get cluesAllowed(): boolean { return this.chapterAvailable && !!this.chapterId && this.acknowledgedChapters.has(this.chapterId); }
  private promptRevision = 0;
  get revision(): number { return this.promptRevision; }
  private readonly actions = document.createElement('div');
  private stage: TutorialStage | null = null;
  private dismissed = false;
  private skillsReviewed = false;
  private readonly popupHost: HTMLElement;
  private readonly dragging: ReturnType<typeof draggableWindow>;
  private popupReported = false;

  constructor(parent: HTMLElement, private readonly callbacks: TutorialGuideActions, private readonly dock: HTMLElement = parent) {
    this.popupHost = parent;
    this.root.className = 'tutorial-guide';
    this.dragging = draggableWindow(this.root, '.tutorial-step, .tutorial-toggle', () => this.root.dataset.collapsed === 'false');
    this.root.setAttribute('aria-label', t('Tutorial objective'));
    this.root.hidden = true;
    this.title.tabIndex = -1;
    this.title.id = 'tutorial-objective-title';
    this.root.setAttribute('aria-labelledby', this.title.id);
    this.step.className = 'tutorial-step';
    this.step.setAttribute('role', 'status');
    this.text.className = 'tutorial-instruction';
    this.context.className = 'tutorial-context';
    this.context.hidden = true;
    this.counter.className = 'tutorial-counter';
    this.counter.setAttribute('role', 'status');
    this.actions.className = 'tutorial-actions tutorial-reply';
    this.toggle.type = 'button';
    this.toggle.className = 'tutorial-toggle selection-heading';
    this.minimize.type = 'button';
    this.minimize.className = 'tutorial-minimize';
    this.minimize.setAttribute('aria-label', t('Minimize tutorial'));
    this.minimize.dataset.iconHint = t('Minimize tutorial');
    this.minimize.textContent = '−';
    this.minimize.addEventListener('click', () => { this.setFolded(true); this.toggle.focus({ preventScroll: true }); });
    this.close.classList.add('tutorial-close');
    this.close.setAttribute('aria-label', t('Close briefing'));
    this.close.dataset.iconHint = t('Close briefing');
    this.toggle.addEventListener('click', () => this.setFolded(this.root.dataset.collapsed !== 'true'));
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.root.dataset.collapsed === 'false') {
        event.preventDefault();
        event.stopPropagation();
        this.acknowledge();
        this.toggle.focus({ preventScroll: true });
      }
    });
    this.title.append(this.toggle);
    this.root.append(this.step, this.title, this.minimize, this.close, this.context, this.text, this.counter, this.actions);
    this.setFolded(false);
  }

  private syncPopupPause(): void {
    const open = !!this.stage && !this.dismissed && this.root.dataset.collapsed === 'false';
    if (open === this.popupReported) return;
    this.popupReported = open;
    this.callbacks.onPopupChange?.(open);
  }

  /** The same card moves between the central prompt and its contextual dock. */
  private setFolded(folded: boolean): void {
    this.dragging.reset();
    this.root.dataset.collapsed = String(folded);
    this.toggle.setAttribute('aria-expanded', String(!folded));
    this.minimize.hidden = folded;
    this.close.hidden = folded;
    this.root.dataset.briefing = folded ? (this.chapterId && this.acknowledgedChapters.has(this.chapterId) ? 'closed' : 'minimized') : 'reading';
    if (folded) this.root.removeAttribute('role');
    else this.root.setAttribute('role', 'dialog');
    const host = folded ? this.dock : this.popupHost;
    if (this.root.parentElement !== host) {
      const focused = this.root.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (folded) host.prepend(this.root);
      else host.append(this.root);
      if (focused && !this.root.hidden) focused.focus({ preventScroll: true });
    }
    this.syncPopupPause();
    this.callbacks.onGuidanceChange?.();
  }

  /** Other panels coexist with the guide; they never hide or acknowledge it. */
  setCompanion(open: boolean): void { this.root.dataset.companion = String(open); }

  set(progress: TutorialProgress | null): void {
    this.root.hidden = !progress || this.dismissed;
    if (!progress || this.dismissed) {
      if (this.stage) {
        this.actions.replaceChildren();
        this.stage = null;
        this.syncPopupPause();
      }
      return;
    }
    const previousChapter = this.chapterId;
    const chapter = this.callbacks.chapter();
    this.chapterAvailable = chapter !== null;
    if (chapter) this.chapterId = chapter.id;
    if (this.stage !== progress.stage || this.skillsReviewed !== progress.reviewedSkills) {
      if (!chapter) this.chapterId = null;
      this.skillsReviewed = progress.reviewedSkills;
      this.shownChapters.clear();
      this.acknowledgedChapters.clear();
      this.promptRevision++;
      const restoreFocus = this.root.contains(document.activeElement);
      this.stage = progress.stage;
      this.actions.replaceChildren();
      this.step.textContent = progress.active ? t('Tutorial: {step} of {total}', { step: TUTORIAL_STAGES.indexOf(progress.stage) + 1, total: 6 }) : t('Tutorial complete');
      this.root.dataset.stage = progress.stage;
      this.renderStage(progress.stage);
      this.toggle.textContent = this.title.textContent;
      this.title.replaceChildren(this.toggle);
      this.actions.hidden = this.actions.childElementCount === 0;
      this.root.dataset.displaced = 'false';
      // A new briefing waits until the player leaves the panel they were asked to inspect.
      this.setFolded(chapter === null);
      if (restoreFocus) this.toggle.focus({ preventScroll: true });
    }
    if (chapter) {
      if (this.context.textContent !== chapter.context) this.context.textContent = chapter.context;
      this.context.hidden = !chapter.context;
      if (!this.shownChapters.has(chapter.id) || (previousChapter !== chapter.id && !this.acknowledgedChapters.has(chapter.id))) {
        this.shownChapters.add(chapter.id);
        this.promptRevision++;
        this.root.dataset.chapter = chapter.id;
        this.root.dataset.displaced = 'false';
        this.setFolded(false);
      }
    }
    const service = progress.stage === 'outreach' ? (progress.reviewedSkills ? 'outreach' : null) : progress.stage === 'dropIn' ? 'dropIn' : progress.stage === 'nightlife' ? 'clubHr' : null;
    const count = progress.stage === 'patrol' ? t('People reached: {count} of {goal}', { count: Math.min(3, progress.patrolContacts), goal: 3 }) : service ? t('Visits completed: {count} of {goal}', { count: Math.min(5, progress.visits[service] ?? 0), goal: 5 }) : '';
    const patrolOut = progress.stage === 'patrol' && !!this.callbacks.patrolOut?.();
    const progressText = patrolOut ? `${count} · ${progress.patrolContacts >= 3 ? t('Waiting for patrol to return.') : t('Out on patrol')}` : count;
    if (this.counter.textContent !== progressText) this.counter.textContent = progressText;
    this.counter.hidden = !count;
    const hint = this.callbacks.instruction();
    if (this.text.textContent !== hint) this.text.textContent = hint;
    const repeated = String(!!hint.trim() && hint.trim() === this.context.textContent?.trim());
    if (this.root.dataset.repeatedInstruction !== repeated) this.root.dataset.repeatedInstruction = repeated;
  }

  /** A real UI action acknowledges the prompt; it never completes an objective. */
  acknowledge(revision = this.promptRevision): void {
    if (revision !== this.promptRevision || !this.chapterId) return;
    this.acknowledgedChapters.add(this.chapterId);
    if (this.stage && this.root.dataset.collapsed === 'false') this.setFolded(true);
  }

  private button(label: string, action: () => void): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tutorial-action';
    button.textContent = label;
    button.addEventListener('click', () => {
      this.setFolded(true);
      action();
    });
    this.actions.append(button);
  }

  private renderStage(stage: TutorialStage): void {
    if (stage === 'meet') {
      this.title.textContent = t('Meet the neighbourhood');
      this.text.textContent = t('Select the camp on the map.');
    } else if (stage === 'patrol') {
      this.title.textContent = t('Your first round');
      this.text.textContent = t('Camp in the park') + ' → ' + t('Send patrol to the camp');
    } else if (stage === 'outreach') {
      this.title.textContent = this.skillsReviewed ? t('Complete five outreach visits') : t('Review team skills');
      this.text.textContent = this.skillsReviewed ? t('Services') + ' → ' + SERVICE_TEXT.outreach.label : t('Your portrait') + ' → ' + t('Your team');
    } else if (stage === 'dropIn') {
      this.title.textContent = t('A place to return');
      this.text.textContent = t('Services') + ' → ' + SERVICE_TEXT.dropIn.label;
    } else if (stage === 'nightlife') {
      this.title.textContent = t('The evening district');
      this.text.textContent = t('Services') + ' → ' + SERVICE_TEXT.clubHr.label;
    } else if (stage === 'night') {
      this.title.textContent = t('Your first coordinated night');
      this.text.textContent = t('Keep all three services staffed until the night report.');
    } else {
      this.title.textContent = t('The city is yours');
      this.text.textContent = t('Tutorial complete');
      this.button(t('Close tutorial'), () => { this.dismissed = true; this.root.hidden = true; this.callbacks.continueCity(); });
    }
  }
}
