import type { Archetype } from '../agents/character';
import type { PersonRole, PersonState } from '../agents/crowd';
import { SERVICE_TEXT } from '../config/places';
import { WALK_IN_SERVICE_IDS, type ServiceId, type WalkInServiceId } from '../sim/types';

/**
 * Plain, neutral wording for a person in the scene: their role and what they
 * are doing right now. Deliberately no names, appearance, substances or
 * behaviour labels; everyone here is an illustrative, anonymous figure.
 */
export interface PersonCard {
  role: PersonRole;
  title: string;
  subtitle: string;
  activity: string;
  inView: boolean;
}

const ROLE_TITLE: Record<PersonRole, string> = {
  staff: 'Staff member',
  visitor: 'Visitor',
  clubgoer: 'Club-goer',
  passerby: 'Passer-by',
  police: 'Police officer',
  resident: 'Resident',
  seller: 'Street seller',
  sleeper: 'Person sleeping rough',
  cleaner: 'Council cleaner',
};

const ROLE_SUBTITLE: Record<Exclude<PersonRole, 'staff'>, string> = {
  visitor: 'Came for local services',
  clubgoer: 'Evening out at the club',
  passerby: 'Passing through',
  police: 'On duty in the neighbourhood',
  resident: 'Lives nearby',
  seller: 'Here because the street has a market',
  sleeper: 'Without stable housing',
  cleaner: 'On the early shift',
};

/** Person-first context for visitors and passers-by; says nothing about drug use. */
const GROUP_SUBTITLE: Record<Exclude<Archetype, 'everyday'>, string> = {
  raver: 'Out for the night',
  tourist: 'Visiting the city',
  worker: 'On the way to or from a night shift',
  office: 'Heading home late from work',
  student: 'Student, out in town',
  older: 'Long-time local',
  unhoused: 'Without stable housing',
};

const placeOf = (id: ServiceId | 'club') => (id === 'club' ? 'the club door' : SERVICE_TEXT[id].place);

/** Walk-in services: queue outside, go in, come out. */
const isWalkIn = (id: ServiceId | undefined): id is WalkInServiceId => !!id && (WALK_IN_SERVICE_IDS as readonly string[]).includes(id);

function staffActivity(p: PersonState): string {
  const service = p.service ?? 'dropIn';
  if (p.mode === 'leaving' || p.goal === 'exit') return 'Going off shift';
  if (p.mode !== 'post') return `Walking to their post at ${placeOf(service)}`;
  if (service === 'dropIn') return p.visible ? 'Welcoming people at the door' : 'Working inside the drop-in centre';
  if (service === 'outreach') return 'Staffing the camper';
  if (isWalkIn(service)) return p.visible ? `Welcoming people at ${placeOf(service)}` : `Working inside ${placeOf(service)}`;
  return 'Staffing the stand';
}

function visitorActivity(p: PersonState): string {
  switch (p.mode) {
    case 'waiting':
      if (p.service === 'dropIn') return p.seated ? 'Seated, waiting to be seen' : 'Waiting to be seen';
      if (p.service === 'outreach') return 'Queuing at the camper';
      if (isWalkIn(p.service)) return `Waiting outside ${placeOf(p.service)}`;
      return 'Queuing at the stand';
    case 'served':
      return p.service === 'outreach' ? 'Talking with outreach staff' : 'Talking with stand staff';
    case 'inside':
      return `Inside ${placeOf(p.service ?? 'dropIn')}`;
    case 'clubQueue':
      return 'Queuing at the club door';
    case 'pausing':
      if (p.goal === 'party') return 'Dancing at the party';
      return p.goal === 'clubHr' ? 'Stand not open, moving on to the club' : 'No place free right now, moving on';
    case 'leaving':
      return p.role === 'passerby' ? 'Walking past' : 'Heading off';
    default:
      // Walking: say where to.
      if (p.goal === 'exit') return 'Heading off';
      if (p.service === 'dropIn') return 'Going inside the drop-in centre';
      if (p.service === 'outreach') return 'Stepping up to the counter';
      if (isWalkIn(p.service)) return `Going inside ${placeOf(p.service)}`;
      if (p.service === 'clubHr') return 'Stepping up to the stand';
      if (p.goal === 'club') return 'Walking to the club queue';
      if (p.goal === 'party') return 'Heading to the party';
      if (p.goal && p.goal !== 'post') return `Walking to ${placeOf(p.goal)}`;
      return 'Walking';
  }
}

/** Officers and residents with placards come from the context factors (policing, neighbourhood). */
function contextActivity(p: PersonState): string {
  if (p.role === 'police') {
    if (p.mode === 'standing') return 'Posted on the street';
    if (p.mode === 'leaving') return 'Leaving the area';
    return 'On patrol';
  }
  if (p.role === 'seller') return p.mode === 'standing' ? 'Standing on the corner' : 'Walking';
  if (p.role === 'sleeper') return p.mode === 'standing' ? 'Sleeping in a doorway' : 'Looking for somewhere to sleep';
  if (p.role === 'cleaner') return p.mode === 'leaving' ? 'Going off shift' : 'Sweeping the park';
  if (p.mode === 'standing') return 'Standing with a blank placard';
  return p.mode === 'leaving' ? 'Heading home' : 'Walking';
}

export function describePerson(p: PersonState): PersonCard {
  const staff = p.role === 'staff';
  if (p.role === 'police' || p.role === 'resident' || p.role === 'seller' || p.role === 'sleeper' || p.role === 'cleaner') {
    return { role: p.role, title: ROLE_TITLE[p.role], subtitle: ROLE_SUBTITLE[p.role], activity: contextActivity(p), inView: p.visible };
  }
  if (p.resting) {
    return { role: p.role, title: 'Person resting', subtitle: GROUP_SUBTITLE.unhoused, activity: 'Resting on a bench with their things', inView: p.visible };
  }
  const group = p.archetype === 'everyday' ? undefined : GROUP_SUBTITLE[p.archetype];
  return {
    role: p.role,
    title: ROLE_TITLE[p.role],
    subtitle: staff ? SERVICE_TEXT[p.service ?? 'dropIn'].team : group ?? ROLE_SUBTITLE[p.role as Exclude<PersonRole, 'staff'>],
    activity: staff ? staffActivity(p) : visitorActivity(p),
    inView: p.visible,
  };
}
