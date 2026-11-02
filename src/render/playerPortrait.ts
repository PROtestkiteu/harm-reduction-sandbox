import { randomAppearance } from '../agents/character';
import { CharacterRig } from '../agents/character';
import { HumanFigure, peopleLibrary } from '../agents/humanFigure';
import { PLAYER } from '../config/player';
import { createRandom } from '../sim/random';
import type { Season } from '../sim/calendar';
import { PORTRAIT_H, PORTRAIT_W, type PortraitStudio } from './portraitStudio';

/**
 * Paints the coordinator (config/player) once: their figure is built apart
 * from the crowd, painted in the same studio as everyone else, then thrown
 * away. Returns the picture and a data URL for the dialogs that show it.
 */
export function paintPlayer(studio: PortraitStudio, season: Season): { image: ImageData; url: string } {
  const look = { ...randomAppearance(createRandom(PLAYER.seed), false, 'everyday', season), ...PLAYER.look };
  const lib = peopleLibrary();
  const figure = lib ? new HumanFigure(lib, look) : new CharacterRig(look);
  figure.update(0, 'stand', 0);
  figure.root.updateMatrixWorld(true);
  const canvas = Object.assign(document.createElement('canvas'), { width: PORTRAIT_W, height: PORTRAIT_H });
  const ctx = canvas.getContext('2d')!;
  studio.portrait(figure.root, look.height, PLAYER.seed, ctx);
  figure.dispose();
  return { image: ctx.getImageData(0, 0, PORTRAIT_W, PORTRAIT_H), url: canvas.toDataURL('image/png') };
}
