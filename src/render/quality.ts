/**
 * How much the device and the connection can take, decided once at start.
 * Weak phones (little memory, few cores) render at a lower pixel density, with
 * a smaller shadow map and fewer detailed people; slow or data-saving
 * connections skip the optional 2 MB of scenery kits. `?quality=low` or
 * `?quality=high` in the address overrides the guess.
 */
export interface Quality {
  /** Weak device: everything that costs frame time is trimmed. */
  low: boolean;
  /** Slow or data-saving connection: optional downloads are skipped. */
  slowNet: boolean;
  /** Highest device pixel ratio rendered. */
  maxDpr: number;
  /** Shadow map size in texels per side. */
  shadowMap: number;
  /** Most detailed figures for the people out in the city. */
  figures: number;
  /** Lowest render scale dynamic resolution may drop to. */
  minScale: number;
  /** Fetch the scenery kits after start. */
  kits: boolean;
}

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

function detect(): Quality {
  const forced = new URLSearchParams(location.search).get('quality');
  const nav = navigator as Navigator & NavigatorHints;
  const conn = nav.connection;
  const slow = !!conn && (conn.saveData === true || /2g|3g/.test(conn.effectiveType ?? ''));
  const coarse = matchMedia('(pointer: coarse)').matches;
  const weak = (nav.deviceMemory ?? 8) <= 3 || (coarse && (navigator.hardwareConcurrency ?? 8) <= 4);
  const low = forced === 'low' || (forced !== 'high' && weak);
  const slowNet = forced === 'low' || (forced !== 'high' && slow);
  return {
    low,
    slowNet,
    maxDpr: low ? 1.25 : coarse ? 1.75 : 2,
    shadowMap: low ? 1024 : 2048,
    figures: low ? 10 : 28,
    minScale: low ? 0.5 : 0.6,
    kits: !low && !slowNet,
  };
}

export const QUALITY: Quality = detect();
