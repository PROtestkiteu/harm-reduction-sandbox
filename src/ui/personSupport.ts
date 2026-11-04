import { memberTraitLabel } from './personWording';
import { Team, type Member } from '../sim/team';
import { t } from '../i18n';
import { NEEDS } from '../config/matching';
import { SKILLS, SKILL_IDS } from '../config/employeeSkills';
import type { PersonSupport } from '../sim/personSupport';
import type { Substance } from '../config/randomEvents';
import './personSupport.css';

export interface StaffingAdvice { service: string; matches: string; crew: string }
const SUBSTANCES: Record<Substance, string> = {
  opioid: t('Opioids'), stimulant: t('Stimulants'), mdma: t('MDMA'), cocaine: t('Cocaine'),
  cannabis: t('Cannabis'), alcohol: t('Alcohol'), none: t('No substance use recorded'),
};

/** The same support data drives the visit and the inspector; details never depend on appearance. */
export class PersonSupportView {
  readonly root = document.createElement('section');
  private readonly title = document.createElement('h3');
  private readonly workerFacts = document.createElement('dl');
  private readonly context = document.createElement('p');
  private readonly needs = document.createElement('p');
  private readonly strengths = document.createElement('p');
  private readonly advice = document.createElement('p');
  private readonly crew = document.createElement('p');
  private readonly button = document.createElement('button');
  private key = '';

  constructor(onTeam: () => void) {
    this.root.className = 'person-support';
    this.strengths.dataset.tutorialFeature = 'staff';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', t('Support priorities'));
    this.button.type = 'button'; this.button.className = 'btn person-team';
    this.button.textContent = t('Compare team skills');
    this.button.addEventListener('click', onTeam);
    this.title.textContent = t('Support priorities');
    this.workerFacts.className = 'employee-skills';
    this.root.append(this.title, this.workerFacts, this.context, this.needs, this.strengths, this.advice, this.crew, this.button);
  }

  set(support: PersonSupport | undefined, advice: StaffingAdvice | null, worker?: Member): void {
    this.root.hidden = !support && !worker;
    this.root.dataset.tutorialFeature = worker ? 'staff' : '';
    if (!support && !worker) { this.key = ''; return; }
    const key = JSON.stringify([support, advice, worker ? [worker.id, SKILL_IDS.map(id => Math.round(Team.skill(worker, id))), worker.traits, Math.round(worker.energy*100), Math.round(worker.morale*100)] : null]);
    if (key === this.key) return;
    this.key = key;
    this.title.textContent = worker ? t('Skills') : t('Support priorities');
    this.root.setAttribute('aria-label', this.title.textContent);
    this.workerFacts.hidden = !worker;
    if (worker) {
      this.workerFacts.replaceChildren(...SKILL_IDS.map(id => {
        const item = document.createElement('div'); item.className = 'employee-skill';
        item.append(Object.assign(document.createElement('dt'), { textContent: SKILLS[id].label }), Object.assign(document.createElement('dd'), { textContent: t('{value}/20', { value: Math.round(Team.skill(worker, id)) }) }));
        return item;
      }));
      this.context.textContent = worker.paid ? t('Paid staff') : t('Volunteer');
      this.needs.textContent = worker.traits.map(id => memberTraitLabel(worker, id)).join(', ');
      this.strengths.textContent = `${t('Energy {pct}%', { pct: Math.round(worker.energy*100) })} · ${t('morale {pct}%', { pct: Math.round(worker.morale*100) })}`;
      this.advice.hidden = this.crew.hidden = true;
      this.button.hidden = false;
      return;
    }
    if (!support) return;
    this.context.textContent = t('Substance context: {context}', { context: SUBSTANCES[support.substance] });
    const needs = support.needs.map(id => NEEDS[id].label);
    if (support.injects) needs.push(t('sterile injecting equipment'));
    this.needs.textContent = needs.length ? t('Requested support: {needs}', { needs: needs.join(', ') }) : t('General support and a conversation');
    this.strengths.textContent = t('Helpful skills: {skills}', { skills: support.skills.map(id => SKILLS[id].label).join(', ') });
    this.advice.textContent = advice ? t('Team matches for {place}: {names}', { place: advice.service, names: advice.matches }) : '';
    this.advice.hidden = !advice;
    this.crew.textContent = advice ? t('On shift: {names}', { names: advice.crew }) : '';
    this.crew.hidden = !advice;
    this.button.hidden = !advice;
  }
}
