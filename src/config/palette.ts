/**
 * Muted dusk palette in the spirit of painted port towns: weathered ochres,
 * grey-greens and brick under sodium light, with teal-blue shadows. Every
 * world material draws from these entries so the scene keeps one family of hues.
 */
export const PALETTE = {
  // Ground and street
  soil: 0x3a332d,
  soilDark: 0x26221f,
  asphalt: 0x3a3d40,
  asphaltLine: 0xc4b896,
  kerb: 0x8c877c,
  pavement: 0x7d786c,
  pavementAlt: 0x706b60,
  grass: 0x55663f,
  grassDark: 0x435234,
  gravel: 0x8a7d68,

  // Buildings
  plaster: 0xbfa98a,
  plasterShade: 0x9a8670,
  brick: 0x8c5a4e,
  brickDark: 0x6e443d,
  concrete: 0x8e8a80,
  roof: 0x4a4540,
  roofTrim: 0x5c564c,
  frame: 0x2c2a2a,
  glassDark: 0x2c3a44,
  clubWall: 0x35304a,
  clubTrim: 0x4a4263,
  centerAccent: 0x5f8f7f,
  timber: 0x7a5a45,

  // Light colours (emissive)
  warmWindow: 0xffc47a,
  warmWindowDim: 0x6a5240,
  coolWindow: 0x9fb8e0,
  clubMagenta: 0xd06aa8,
  clubTeal: 0x58c2b8,
  lampGlow: 0xffd9a0,
  outreachGlow: 0xffe2b0,

  // Vehicles
  camperBody: 0xe8e2d6,
  camperStripe: 0x4f8f86,
  tyre: 0x232027,
  carRed: 0x9a4a4a,
  carBlue: 0x4a5f8a,
  carGrey: 0x7d7f88,

  // Props
  bench: 0x6b4f3e,
  metal: 0x4f4c5a,
  bin: 0x3f5e57,
  foliage: 0x4b7351,
  foliageLight: 0x638a5e,
  foliageDark: 0x3a5a43,
  trunk: 0x5a4234,
  canvasTeal: 0x4f9a90,
  canvasCream: 0xe0d2b4,
  staffVest: 0x5fb3a3,
  policeVest: 0x3a4a86,
  policeBand: 0xeee27a,

  // Sky gradient used by the finishing pass
  skyTop: 0x1e2a36,
  skyMid: 0x4f5058,
  skyHorizon: 0xc98a58,
  // Deep-night sky the dusk bands blend towards as the clock runs on.
  skyTopNight: 0x0c1218,
  skyMidNight: 0x1a2028,
  skyHorizonNight: 0x3a3430,
} as const;

/** Clothing and appearance pools. Varied, everyday, no coding by behaviour. */
export const SKIN_TONES = [0xf1c9a5, 0xe0ac85, 0xc68863, 0xa86b4a, 0x8a5538, 0x6b3f2a, 0x4e2e20];
export const HAIR_COLOURS = [0x1f1a1c, 0x3b2a22, 0x6b4a32, 0xa47a4a, 0xc9b28a, 0x9a9a9a, 0x5a2e2a];
export const TOP_COLOURS = [0x7a8fa6, 0xb5654f, 0x5c7a5a, 0xd2b36a, 0x8a6a9a, 0x3f4a66, 0xc7c0b2, 0x9a4f62, 0x4f8a8a, 0xe0d6c4];
export const BOTTOM_COLOURS = [0x2f3445, 0x4a4552, 0x5a4a3c, 0x3d4f5f, 0x6b6475, 0x2a2a30];
export const ACCENT_COLOURS = [0xd0a050, 0x6a8fb0, 0xa05a5a, 0x5a9a7a, 0xc07a9a];
