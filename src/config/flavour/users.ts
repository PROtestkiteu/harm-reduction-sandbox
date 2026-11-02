import type { Appearance, Archetype, BodyState, Kit, Pose } from '../../agents/character';
import type { P } from './street';

/**
 * Who uses what, as data: small groups of people out at night, each showing
 * what a substance looks like from across the street, after what outreach
 * workers describe. ILLUSTRATIVE: the places are picked so each group reads
 * on screen, away from the crowd's walking lines (checked by
 * `npm run clearance`), and the hours are rough. Nothing here mocks anyone:
 * these are people the services in the game are there for.
 *
 * - Nicotine, the most used of all: cigarettes and vapes, outside every
 *   bar and bus stop, all evening.
 * - Opioids (fentanyl, often cut with xylazine): standing bent over at the
 *   waist for minutes at a time, the "fentanyl fold", and nodding off.
 * - Cannabis: a few friends smoking on a bench, slow and talkative.
 * - Club drugs (MDMA, ketamine) after the club shuts: still dancing on the
 *   pavement, someone standing very still in a ketamine hole.
 * - Psychedelics (psilocybin, LSD): sitting on the grass looking up, turning
 *   their heads slowly, one moving to music nobody else hears.
 * - Benzodiazepines, often with alcohol: slumped against a wall, swaying when
 *   they stand, sometimes lying down with a friend nearby.
 * - Stimulants (methamphetamine, cathinones like mephedrone): pacing fast,
 *   talking a lot, jaw and hands busy, up long after everyone else.
 */
export type UserKind = 'nicotine' | 'opioid' | 'cannabis' | 'club' | 'psychedelic' | 'benzo' | 'stimulant';

export interface UserSpot {
  at: P;
  /** Faces this way (radians, as Object3D.rotation.y). */
  face: number;
  pose: Pose;
  /** What the substance does to how they hold themselves (agents/character.ts). */
  body: BodyState;
  /** Paces between `at` and here (stimulants) or sways in place when absent. */
  pace?: P;
  /** A light at the hand and smoke now and then; a vape's light and bigger clouds. */
  smokes?: 'ember' | 'flame' | 'vape';
  /** Lies down now and then (a friend stays near). */
  liesDown?: boolean;
}

export interface UserGroup {
  kind: UserKind;
  style: Archetype;
  kit?: Kit;
  /** Laid over the figure's seeded look (colours, hair). */
  dress?: Partial<Appearance>;
  /** Clock minutes they are out (18:00 = 1080; past midnight runs on past 1440). */
  hours: readonly [number, number];
  /** Kept out under heavy policing (the scene moves, it does not end). */
  stubborn?: boolean;
  /** What they might say (config/flavour/lines.ts). */
  voice: string;
  spots: readonly UserSpot[];
}

/** The inner ring's pavements (no crowd walks them, the camera sees them): east at x 46.2, south at z 46.2. */
const E = 46.2;
const S = 46.2;

export const USER_GROUPS: readonly UserGroup[] = [
  {
    kind: 'nicotine', style: 'everyday', hours: [1080, 2100], stubborn: true, voice: 'nicotine',
    spots: [
      { at: { x: 18.0, z: 45.4 }, face: Math.PI, pose: 'stand', body: 'normal', smokes: 'ember' },
      { at: { x: 19.1, z: 46.6 }, face: -Math.PI * 0.8, pose: 'talk', body: 'normal', smokes: 'vape' },
      { at: { x: 20.4, z: 45.6 }, face: Math.PI * 0.9, pose: 'stand', body: 'normal', smokes: 'vape' },
      { at: { x: 21.5, z: 46.8 }, face: -Math.PI * 0.7, pose: 'stand', body: 'normal', smokes: 'ember' },
    ],
  },
  {
    kind: 'opioid', style: 'unhoused', hours: [1320, 1980], stubborn: true, voice: 'opioid',
    spots: [
      { at: { x: E, z: 26.0 }, face: Math.PI / 2, pose: 'stand', body: 'nod' },
      { at: { x: E + 0.2, z: 27.4 }, face: Math.PI * 0.6, pose: 'stand', body: 'nod' },
      { at: { x: 45.5, z: 28.8 }, face: Math.PI / 2, pose: 'crouch', body: 'nod', liesDown: true },
    ],
  },
  {
    kind: 'cannabis', style: 'everyday', hours: [1140, 1560], voice: 'cannabis',
    // A knitted tam in red, gold and green, a loose top: one look among the friends.
    dress: { hairStyle: 4, top: 0x2e6a36, accent: 0xc9a227, bottom: 0x3a3228 },
    spots: [
      { at: { x: -14.0, z: 45.6 }, face: Math.PI, pose: 'sit', body: 'normal', smokes: 'ember' },
      { at: { x: -13.1, z: 45.6 }, face: Math.PI, pose: 'sit', body: 'normal' },
      { at: { x: -12.2, z: 46.7 }, face: -Math.PI * 0.75, pose: 'talk', body: 'normal', smokes: 'ember' },
    ],
  },
  {
    kind: 'club', style: 'raver', hours: [1620, 1860], voice: 'clubber',
    spots: [
      { at: { x: 30.0, z: S }, face: Math.PI, pose: 'dance', body: 'normal' },
      { at: { x: 31.2, z: S + 0.6 }, face: -Math.PI * 0.8, pose: 'dance', body: 'normal' },
      { at: { x: 32.6, z: S - 0.3 }, face: Math.PI * 0.9, pose: 'stand', body: 'trip' },
    ],
  },
  {
    kind: 'psychedelic', style: 'everyday', hours: [1260, 1740], voice: 'tripper',
    // Long hair and a beard on some, colours that do not match.
    dress: { hairStyle: 1, beard: true, top: 0xb4508a, accent: 0xe0b040 },
    spots: [
      { at: { x: -3.0, z: S - 0.5 }, face: Math.PI, pose: 'sit', body: 'trip' },
      { at: { x: -1.9, z: S + 0.3 }, face: -Math.PI * 0.7, pose: 'sit', body: 'trip' },
      { at: { x: -4.4, z: S + 0.5 }, face: Math.PI * 0.6, pose: 'dance', body: 'trip' },
    ],
  },
  {
    kind: 'benzo', style: 'unhoused', kit: { hood: 'down' }, hours: [1380, 1920], voice: 'benzo',
    spots: [
      { at: { x: -22.0, z: 45.3 }, face: Math.PI, pose: 'sit', body: 'nod', liesDown: true },
      { at: { x: -20.8, z: S }, face: -Math.PI / 2, pose: 'stand', body: 'drunk' },
    ],
  },
  {
    kind: 'stimulant', style: 'hiphop', hours: [1320, 1860], stubborn: true, voice: 'stimulant',
    spots: [
      { at: { x: E, z: 7.0 }, face: 0, pose: 'walk', body: 'wired', pace: { x: E, z: 12.5 } },
      { at: { x: 45.6, z: 9.6 }, face: Math.PI / 2, pose: 'talk', body: 'wired', smokes: 'flame' },
    ],
  },
];

export const USERS = {
  /** Brisk pacing speed (m/s), and seconds between turns. */
  paceSpeed: 1.9,
  /** Chance per minute that someone who lies down does, and how long they stay down (seconds). */
  lieDownPerMinute: 0.25,
  lieFor: [20, 45] as const,
  /** Police level at which all but the stubborn groups move off. */
  scatterAt: 2,
  /** The busier the street market, the more of each group is out: share out at market 0. */
  quietShare: 0.5,
} as const;
