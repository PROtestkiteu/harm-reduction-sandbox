import { t } from '../i18n';
import { SKILLS } from '../config/employeeSkills';
import type { PersonSupport } from '../sim/personSupport';
import type { Member } from '../sim/team';
import type { Mood } from '../agents/moodIcons';
import { TraitStrip, SkillStrip, ConditionStrip, SupportStrip } from './indicatorStrips';
import { indicatorMetadata } from './indicatorCatalog';
import type { Substance } from '../config/randomEvents';
import './personSupport.css';

export interface StaffingAdvice { service: string; matches: string; crew: string }
const SUBSTANCES: Record<Substance, string> = {
  opioid: t('Opioids'), stimulant: t('Stimulants'), mdma: t('MDMA'), cocaine: t('Cocaine'),
  cannabis: t('Cannabis'), alcohol: t('Alcohol'), none: t('No substance use recorded'),
};
/** Support requests are facts from the simulation, never inferred identity badges. */
export class PersonSupportView {
  readonly root = document.createElement('section');
  private traits = new TraitStrip(); private skills = new SkillStrip(); private conditions = new ConditionStrip(); private support = new SupportStrip();
  private details = document.createElement('details'); private content = document.createElement('div');
  private key = ''; private compare = false;
  constructor() {
    this.root.className = 'person-support person-summary'; this.root.hidden = true;
    this.root.setAttribute('aria-label', t('Support priorities'));
    this.details.className = 'person-support-details';
    const summary = document.createElement('summary'); summary.textContent = t('Support details');
    this.details.append(summary, this.content);
    this.root.append(this.traits.root, this.skills.root, this.support.root, this.conditions.root, this.details);
  }
  get canCompare(): boolean { return this.compare; }
  set(support: PersonSupport | undefined, advice: StaffingAdvice | null, worker?: Member, mood?: Mood): void {
    this.root.hidden = !support && !worker && !mood; this.compare = !!worker || !!advice;
    this.root.dataset.tutorialFeature = worker ? 'staff' : '';
    this.traits.root.hidden = this.skills.root.hidden = !worker;
    if (worker) { this.traits.update(worker); this.skills.update(worker); }
    this.support.update(worker ? undefined : support); this.conditions.update(worker, mood);
    const key = JSON.stringify([support, advice, worker ? [worker.id, worker.traits, worker.paid] : null]);
    if (key === this.key) return;
    this.key = key; this.content.replaceChildren();
    const line = (value: string) => { const p = document.createElement('p'); p.textContent = value; this.content.append(p); };
    if (worker) {
      line(worker.paid ? t('Paid staff') : t('Volunteer'));
      for (const id of worker.traits) { const info = indicatorMetadata(`trait:${id}`, worker); line(`${info.label}: ${info.description}`); }
    } else if (support) {
      line(t('Substance context: {context}', { context: SUBSTANCES[support.substance] }));
      line(t('Helpful skills: {skills}', { skills: support.skills.map(id => SKILLS[id].label).join(', ') }));
      if (!support.needs.length && !support.injects) line(t('General support and a conversation'));
    }
    if (advice) {
      line(t('Team matches for {place}: {names}', { place: advice.service, names: advice.matches }));
      line(t('On shift: {names}', { names: advice.crew }));
    }
    this.details.hidden = !this.content.childElementCount;
  }
}
