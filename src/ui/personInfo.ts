import type { Member } from '../sim/team';
import type { PersonSupport } from '../sim/personSupport';
import type { Archetype } from '../agents/character';
import type { PersonRole, PersonState } from '../agents/crowd';
import type { Mood } from '../agents/moodIcons';
import { SERVICE_TEXT } from '../config/places';
import { displayName } from './names';
import { LANG, t } from '../i18n';
import { PROFILES_BY_GOAL, PROFILES_BY_GROUP, USE_PROFILES, type UseProfile } from '../config/useProfiles';
import { WALK_IN_SERVICE_IDS, type ServiceId, type WalkInServiceId } from '../sim/types';

/**
 * Plain wording for a person in the scene: their role, what they are doing
 * right now and, for people who use drugs, an archetype drawn from research
 * (see config/useProfiles). No names; everyone here is illustrative.
 */
export interface PersonCard {
  role: PersonRole;
  title: string;
  subtitle: string;
  activity: string;
  inView: boolean;
  profile?: UseProfile;
  support?: PersonSupport;
  worker?: Member;
  /** The state their glow on the map shows, so the card's name can share its hue. */
  mood?: Mood;
}

/** A stable 0..1 number per person, so their archetype never changes while watched. */
const unit = (id: number, salt: number) => (((id * 2654435761) ^ (salt * 40503)) >>> 0) / 4294967296;

/** Share of passers-by given an archetype; most people out are not using anything. */
const PASSERBY_SHARE = 0.25;

function profileFor(p: PersonState): UseProfile | undefined {
  const roll = unit(p.id, 1);
  let list: readonly string[] | undefined;
  if (p.role === 'sleeper' || p.resting) list = PROFILES_BY_GROUP.unhoused;
  else if (p.role === 'visitor' || p.role === 'clubgoer') list = PROFILES_BY_GOAL[p.service ?? p.goal ?? ''] ?? PROFILES_BY_GOAL[p.goal ?? ''];
  else if (p.role === 'passerby' && roll < PASSERBY_SHARE) list = PROFILES_BY_GROUP[p.archetype];
  if (!list?.length) return undefined;
  return USE_PROFILES[list[Math.floor(unit(p.id, 2) * list.length)] as keyof typeof USE_PROFILES];
}

const ROLE_TITLE: Record<PersonRole, string> = {
  staff: t('Staff member'),
  visitor: t('Visitor'),
  clubgoer: t('Club-goer'),
  passerby: t('Passer-by'),
  police: t('Police officer'),
  resident: t('Resident'),
  seller: t('Street seller'),
  sleeper: t('Person sleeping rough'),
  cleaner: t('Council cleaner'),
  bouncer: t('Bouncer'),
};

const ROLE_SUBTITLE: Record<Exclude<PersonRole, 'staff'>, string> = {
  visitor: t('Came for local services'),
  clubgoer: t('Evening out at the club'),
  passerby: t('Passing through'),
  police: t('On duty in the neighbourhood'),
  resident: t('Lives nearby'),
  seller: t('Here because the street has a market'),
  sleeper: t('Without stable housing'),
  cleaner: t('On the early shift'),
  bouncer: t('On the club door'),
};

/** Person-first context for visitors and passers-by; says nothing about drug use. */
const GROUP_SUBTITLE: Record<Exclude<Archetype, 'everyday'>, string> = {
  raver: t('Out for the night'),
  tourist: t('Visiting the city'),
  worker: t('On the way to or from a night shift'),
  office: t('Heading home late from work'),
  student: t('Student, out in town'),
  older: t('Long-time local'),
  unhoused: t('Without stable housing'),
  technoBlack: t('Dressed for a techno night, all in black'),
  punk: t('Punk, maybe on the way to a hardcore show'),
  goth: t('Goth, dressed for a dark wave night'),
  hiphop: t('Out for a hip-hop night'),
  queerRave: t('Heading to a queer rave'),
  metal: t('Metal fan, out for a gig'),
};

/** A place in a sentence. Polish needs it in the case the sentence asks for. */
type PlaceCase = 'to' | 'at' | 'outside';

/** Polish forms per place: genitive after "do", locative with its own preposition, instrumental after "przed". */
const PLACE_PL: Record<ServiceId | 'club', Record<PlaceCase, string>> = {
  dropIn: { to: 'punktu drop-in', at: 'w punkcie drop-in', outside: 'punktem drop-in' },
  outreach: { to: 'kampera streetworkingowego', at: 'przy kamperze streetworkingowym', outside: 'kamperem streetworkingowym' },
  clubHr: { to: 'stoiska redukcji szkód', at: 'przy stoisku redukcji szkód', outside: 'stoiskiem redukcji szkód' },
  footPatrol: { to: 'patrolu streetworkerów', at: 'przy patrolu streetworkerów', outside: 'patrolem streetworkerów' },
  drugChecking: { to: 'punktu testowania substancji', at: 'w punkcie testowania substancji', outside: 'punktem testowania substancji' },
  shelter: { to: 'noclegowni', at: 'w noclegowni', outside: 'noclegownią' },
  clinic: { to: 'poradni', at: 'w poradni', outside: 'poradnią' },
  club: { to: 'drzwi klubu', at: 'przy drzwiach klubu', outside: 'drzwiami klubu' },
};

const placeOf = (id: ServiceId | 'club', form: PlaceCase) =>
  LANG === 'pl' ? PLACE_PL[id][form] : id === 'club' ? t('the club door') : SERVICE_TEXT[id].place;

/** Walk-in services: queue outside, go in, come out. */
const isWalkIn = (id: ServiceId | undefined): id is WalkInServiceId => !!id && (WALK_IN_SERVICE_IDS as readonly string[]).includes(id);

function staffActivity(p: PersonState): string {
  const service = p.service ?? 'dropIn';
  if (p.mode === 'leaving' || p.goal === 'exit') return t('Going off shift');
  if (p.mode !== 'post') return t('Walking to their post at {place}', { place: placeOf(service, 'to') });
  if (service === 'dropIn') return p.visible ? t('Welcoming people at the door') : t('Working inside the drop-in centre');
  if (service === 'outreach') return t('Staffing the camper');
  if (isWalkIn(service)) return p.visible ? t('Welcoming people at {place}', { place: placeOf(service, 'at') }) : t('Working inside {place}', { place: placeOf(service, 'at') });
  return t('Staffing the stand');
}

function visitorActivity(p: PersonState): string {
  switch (p.mode) {
    case 'waiting':
      if (p.service === 'dropIn') return p.seated ? t('Seated, waiting to be seen') : t('Waiting to be seen');
      if (p.service === 'outreach') return t('Queuing at the camper');
      if (isWalkIn(p.service)) return t('Waiting outside {place}', { place: placeOf(p.service, 'outside') });
      return t('Queuing at the stand');
    case 'served':
      return p.service === 'outreach' ? t('Talking with outreach staff') : t('Talking with stand staff');
    case 'inside':
      return t('Inside {place}', { place: placeOf(p.service ?? 'dropIn', 'at') });
    case 'clubQueue':
      return t('Queuing at the club door');
    case 'pausing':
      if (p.goal === 'party') return t('Dancing at the party');
      if (p.crowding) return t('No place at {place} right now; waiting outside in case that changes', { place: placeOf(p.crowding, 'at') });
      return p.goal === 'clubHr' ? t('Stand not open, moving on to the club') : t('No place free right now, moving on');
    case 'leaving':
      return p.role === 'passerby' ? t('Walking past') : t('Heading off');
    default:
      // Walking: say where to.
      if (p.goal === 'exit') return t('Heading off');
      if (p.service === 'dropIn') return t('Going inside the drop-in centre');
      if (p.service === 'outreach') return t('Stepping up to the counter');
      if (isWalkIn(p.service)) return t('Going inside {place}', { place: placeOf(p.service, 'to') });
      if (p.service === 'clubHr') return t('Stepping up to the stand');
      if (p.goal === 'club') return t('Walking to the club queue');
      if (p.goal === 'party') return t('Heading to the party');
      if (p.goal && p.goal !== 'post') return t('Walking to {place}', { place: placeOf(p.goal, 'to') });
      return t('Walking');
  }
}

/**
 * For a posted officer: until when they stand here and why, and what would move them. Set by the
 * app from the simulation (sim.policeStatus, favours, the police quest); null before it is wired.
 */
let policeLine: (() => string | null) | null = null;
export function setPoliceLine(line: () => string | null): void {
  policeLine = line;
}

/** Officers and residents with placards come from the context factors (policing, neighbourhood). */
function contextActivity(p: PersonState): string {
  if (p.role === 'police') {
    // Posted (or on the way to their post): say till when and what would move them.
    const line = p.mode === 'leaving' ? null : policeLine?.() ?? null;
    if (line) return line;
    if (p.mode === 'standing') return t('Posted on the street');
    if (p.mode === 'leaving') return t('Leaving the area');
    return t('On patrol');
  }
  if (p.role === 'seller') return p.mode === 'standing' ? t('Standing on the corner') : t('Walking');
  if (p.role === 'sleeper') return p.mode === 'standing' ? t('Sleeping in a doorway') : t('Looking for somewhere to sleep');
  if (p.role === 'bouncer') return t('Watching the door');
  if (p.role === 'cleaner') return p.mode === 'leaving' ? t('Going off shift') : t('Sweeping the park');
  if (p.mode === 'standing') return t('Standing with a blank placard');
  return p.mode === 'leaving' ? t('Heading home') : t('Walking');
}

export function describePerson(p: PersonState): PersonCard {
  // A name the player gave this person, if any, stands in for the role.
  const card = describeRole(p);
  return { ...card, title: displayName('person', p.id, card.title), mood: p.mood, support: p.support, worker: p.worker };
}

function describeRole(p: PersonState): PersonCard {
  const staff = p.role === 'staff';
  if (p.role === 'police' || p.role === 'resident' || p.role === 'seller' || p.role === 'sleeper' || p.role === 'cleaner') {
    return { role: p.role, title: ROLE_TITLE[p.role], subtitle: ROLE_SUBTITLE[p.role], activity: contextActivity(p), inView: p.visible, profile: profileFor(p) };
  }
  if (p.resting) {
    return { role: p.role, title: t('Person resting'), subtitle: GROUP_SUBTITLE.unhoused, activity: t('Resting on a bench with their things'), inView: p.visible, profile: profileFor(p) };
  }
  const group = p.archetype === 'everyday' ? undefined : GROUP_SUBTITLE[p.archetype];
  return {
    role: p.role,
    title: p.worker?.name ?? ROLE_TITLE[p.role],
    subtitle: staff ? SERVICE_TEXT[p.service ?? 'dropIn'].team : group ?? ROLE_SUBTITLE[p.role as Exclude<PersonRole, 'staff'>],
    activity: staff ? staffActivity(p) : visitorActivity(p),
    inView: p.visible,
    profile: staff ? undefined : profileFor(p),
    support: p.support,
    worker: p.worker,
  };
}
