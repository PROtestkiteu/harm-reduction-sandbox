import { t } from '../i18n';

/**
 * You, at the head of a report or a guide: your painted portrait (made once
 * by render/playerPortrait), your role and what you make of it, like the
 * speaker's portrait beside a line in Disco Elysium. The picture is fetched
 * only when a box first opens, and it is decoration: the words carry it.
 */
export type PlayerPicture = () => { url: string; org: string };

export function playerBadge(picture: PlayerPicture, said: string): HTMLElement {
  const { url, org } = picture();
  const box = Object.assign(document.createElement('div'), { className: 'player-badge' });
  const img = Object.assign(document.createElement('img'), { src: url, alt: '', width: 60, height: 75, className: 'player-face' });
  const words = Object.assign(document.createElement('p'), { className: 'player-said' });
  words.append(Object.assign(document.createElement('span'), { className: 'player-who', textContent: t('You, coordinator of {org}', { org }) }), document.createTextNode(said));
  box.append(img, words);
  return box;
}
