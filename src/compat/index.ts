/**
 * Stand-ins for the few web APIs the game uses that older supported browsers lack (Safari 15.4 to
 * 15.8, iPadOS 15; see README, Browser support). Each is detected first and fetched only where it
 * is missing, before the game's chunk runs; a browser that has them all pays one check each.
 */
export function loadCompat(): Promise<unknown> {
  const missing: Promise<unknown>[] = [];
  // Canvas roundRect: Safari 16.
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) missing.push(import('./roundRect'));
  return Promise.all(missing);
}
