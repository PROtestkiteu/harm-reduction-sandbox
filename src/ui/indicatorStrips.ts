import { t } from '../i18n';
import { SKILL_IDS } from '../config/employeeSkills';
import type { Member } from '../sim/team';
import { Team } from '../sim/team';
import type { PersonSupport } from '../sim/personSupport';
import type { Mood } from '../agents/moodIcons';
import { indicatorMetadata, personSummary, workerSummary, type IndicatorKey } from './indicatorCatalog';
import './indicatorStrips.css';

const text = (node: HTMLElement, value: string) => { if (node.textContent !== value) node.textContent = value; };
interface Badge { root: HTMLElement; value: HTMLElement }
/** Stable DOM; decoding never blocks UI and missing images retain a readable label. */
class IndicatorStrip {
  readonly root = document.createElement('div');
  private badges = new Map<IndicatorKey, Badge>();
  constructor(className: string) { this.root.className = `indicator-strip ${className}`; this.root.setAttribute('role', 'list'); }
  protected set(keys: readonly IndicatorKey[], member?: Pick<Member, 'name'>, values?: Readonly<Record<string, number>>): void {
    for (const [key, badge] of this.badges) if (!keys.includes(key)) { badge.root.remove(); this.badges.delete(key); }
    for (const key of keys) {
      const meta = indicatorMetadata(key, member);
      let badge = this.badges.get(key);
      if (!badge) {
        const root = document.createElement('span'); root.className = 'indicator'; root.tabIndex = 0;
        root.setAttribute('role', 'listitem'); root.dataset.category = meta.category; root.dataset.indicator = key;
        const picture = document.createElement('img'); picture.alt = ''; picture.width = picture.height = 32;
        picture.loading = 'lazy'; picture.decoding = 'async';
        picture.srcset = `${meta.asset}-64.webp 1x, ${meta.asset}-128.webp 2x`; picture.src = `${meta.asset}-64.webp`;
        picture.addEventListener('load', () => { picture.hidden = false; root.dataset.ready = 'true'; });
        picture.addEventListener('error', () => { picture.hidden = true; root.dataset.ready = 'false'; });
        const label = document.createElement('span'); label.className = 'indicator-label';
        const value = document.createElement('b'); value.className = 'indicator-value';
        root.append(picture, label, value); badge = { root, value }; this.badges.set(key, badge); this.root.append(root);
      }
      const value = values?.[key.split(':')[1]];
      text(badge.root.querySelector<HTMLElement>('.indicator-label')!, meta.label);
      text(badge.value, value === undefined ? '' : String(value));
      const hint = `${meta.label}${value === undefined ? '' : `: ${t('{value}/20', {value})}`}\n${meta.description}`;
      if (badge.root.dataset.iconHint !== hint) badge.root.dataset.iconHint = hint;
      if (badge.root.getAttribute('aria-label') !== hint) badge.root.setAttribute('aria-label', hint);
    }
    const order = keys.join('|');
    if (this.root.dataset.order !== order) { this.root.append(...keys.map(key => this.badges.get(key)!.root)); this.root.dataset.order = order; }
    if (this.root.hidden !== (keys.length === 0)) this.root.hidden = keys.length === 0;
  }
}
export class TraitStrip extends IndicatorStrip {
  private key = '';
  constructor() { super('trait-strip'); }
  update(member: Member): void { const key = `${member.name}|${member.traits.join(',')}`; if (this.key === key) return; this.key = key; this.set(member.traits.map(id => `trait:${id}` as const).sort((a,b) => ['expertise','personal','learning'].indexOf(indicatorMetadata(a).category) - ['expertise','personal','learning'].indexOf(indicatorMetadata(b).category)), member); }
}
export class SkillStrip extends IndicatorStrip {
  private key = '';
  constructor() { super('skill-strip'); this.root.setAttribute('aria-label', t('Skills')); }
  update(member: Member): void { const summary = workerSummary(member); const key = SKILL_IDS.map(id => summary.skills[id]).join(','); if (key === this.key) return; this.key = key; this.set(SKILL_IDS.map(id => `skill:${id}` as const), member, summary.skills); }
}
export class SupportStrip extends IndicatorStrip {
  private key = '';
  constructor() { super('support-strip'); this.root.setAttribute('aria-label', t('Support priorities')); }
  update(support?: PersonSupport): void { const key = JSON.stringify(support ? personSummary(support).support : []); if (key === this.key) return; this.key = key; this.set(support ? personSummary(support).support.map(id => `support:${id}` as const) : []); }
}
export class ConditionStrip {
  private key: string | null = null;
  readonly root = document.createElement('div');
  private energy = document.createElement('span'); private morale = document.createElement('span'); private state = document.createElement('span');
  constructor() {
    this.root.className = 'condition-strip';
    this.energy.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="m9 1-6 8h4l-1 6 7-9H9z"/></svg><b></b>';
    this.morale.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 14 2 8C-2 3 5-1 8 4c3-5 10-1 6 4z"/></svg><b></b>';
    for (const item of [this.energy, this.morale, this.state]) item.tabIndex = 0;
    this.root.append(this.energy, this.morale, this.state);
  }
  update(member?: Member, mood?: Mood, showAssignedRest = true): void {
    const key = member ? `${Math.round(member.energy*100)}|${Math.round(member.morale*100)}|${member.worn}|${member.assignment}|${Team.shaken(member)}|${showAssignedRest}` : mood ?? '';
    if (key === this.key) return; this.key = key;
    this.root.hidden = !member && !mood; this.energy.hidden = this.morale.hidden = !member;
    if (member) {
      const e = Math.round(member.energy * 100), m = Math.round(member.morale * 100);
      text(this.energy.querySelector('b')!, `${e}%`); text(this.morale.querySelector('b')!, `${m}%`);
      this.energy.dataset.iconHint = t('Energy {pct}%', { pct: e }); this.morale.dataset.iconHint = Team.shaken(member) ? t('shaken, morale {pct}%', {pct:m}) : t('morale {pct}%', { pct: m });
      this.energy.dataset.low = String(e < 30); this.morale.dataset.low = String(Team.shaken(member));
    }
    const value = member ? (member.worn ? t('gone home tired') : member.assignment === 'rest' && showAssignedRest ? t('resting') : '') : mood ? ({ relieved: t('Support received'), unmet: t('Support unmet'), intoxicated: t('Intoxicated'), adverse: t('Adverse reaction') })[mood] : '';
    text(this.state, value); this.state.hidden = !value; this.state.dataset.iconHint = value;
  }
}
