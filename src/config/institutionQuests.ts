import { t } from '../i18n';
import { C, type Citation } from './contextFactors';

/**
 * Side quests at the city's own institutions: what, in the library, turns a
 * police station, city hall, the hospital or the sobering-up centre from an
 * obstacle into an ally. Each step costs money (and sometimes needs the
 * street in a state to allow it) and teaches what the research found, with
 * its source. The last step changes how the institution works with you.
 * Costs and effects are ILLUSTRATIVE; the direction follows the cited work.
 */
export type InstitutionId = 'police' | 'cityHall' | 'hospital' | 'sobering';

export interface QuestStep {
  label: string;
  short: string;
  cost: number;
  /** What this step shows, from the research. */
  lesson: string;
  evidence: Citation | null;
}

export interface Quest {
  title: string;
  /** What the quest is after, one line. */
  goal: string;
  /** What changes once it is done. */
  done: string;
  steps: QuestStep[];
}

const NONE: Citation = { ref: 'No evidence in library', type: 'none', note: 'Searched; no study in the library covers this step. Its effect is illustrative only.', source: 'Chemical Safety/Wiedza (searched)' };

export const QUESTS: Record<InstitutionId, Quest> = {
  police: {
    title: t('Make the police an ally'),
    goal: t('Police that keep clear of your doors, by agreement.'),
    done: t('An agreement: patrols keep clear of entrances, and officers call your team for overdoses.'),
    steps: [
      {
        label: t('Meet the district commander'), short: t('Meet.'), cost: 50,
        lesson: t('Stance matters more than law: where local police kept a heavy presence near services, people stayed away; where they were neutral or supportive, services worked.'),
        evidence: C.emcdda,
      },
      {
        label: t('Run joint training on overdose and stigma'), short: t('Train.'), cost: 120,
        lesson: t('Staff say agreements that protect clients from over-policing, together with confidentiality, matter most for people to come.'),
        evidence: C.pocuca,
      },
      {
        label: t('Sign a no-targeting and referral agreement'), short: t('Agree.'), cost: 0,
        lesson: t('Asked, 94% would stay away if arrest were possible; 97% would use a service police kept clear of.'),
        evidence: C.barratt17,
      },
    ],
  },
  cityHall: {
    title: t('Win over city hall'),
    goal: t('A council that backs the services instead of tolerating them.'),
    done: t('The council backs the services: no curfew, no fight over the camper\'s permit.'),
    steps: [
      {
        label: t('Show councillors your numbers'), short: t('Brief.'), cost: 60,
        lesson: t('Local responses ran from welcoming to oppositional, following local politics, councils and mayors.'),
        evidence: C.hutchison,
      },
      {
        label: t('Bring residents and shopkeepers to a public meeting'), short: t('Meet.'), cost: 80,
        lesson: t('Most people in a national survey supported drug checking; support was higher in cities. Neighbours in the room count.'),
        evidence: C.caluzzi,
      },
      {
        label: t('Propose a local harm reduction strategy'), short: t('Propose.'), cost: 150,
        lesson: t('Under one national law, a city with a harm reduction policy responded very differently from a zero-tolerance one: city policy shapes what services can do.'),
        evidence: C.pires,
      },
    ],
  },
  hospital: {
    title: t('Partner with A&E'),
    goal: t('A hospital that hears your warnings and sends people your way.'),
    done: t('A&E gets your alerts and refers people to you: ambulances and beds are freed up sooner.'),
    steps: [
      {
        label: t('Share your drug alerts with A&E'), short: t('Share.'), cost: 40,
        lesson: t('A national monitoring system turned checking results into warnings about dangerous tablets: shared alerts travel further than one service.'),
        evidence: C.brunt,
      },
      {
        label: t('Set up referrals from A&E to your services'), short: t('Refer.'), cost: 100,
        lesson: t('Most people who came to a national checking service had never been in touch with drug services before: a door into care.'),
        evidence: C.verdenik26,
      },
    ],
  },
  sobering: {
    title: t('Work with the sobering-up centre'),
    goal: t('An izba that hands on leaflets and naloxone and calls your team.'),
    done: t('Your team visits at closing time and the izba passes on your leaflets: fewer people are brought in twice.'),
    steps: [
      { label: t('Leave leaflets and naloxone at the izba'), short: t('Leaflets.'), cost: 40, lesson: t('A first contact: staff there see people the services rarely meet.'), evidence: NONE },
      { label: t('Send staff at club closing time'), short: t('Visit.'), cost: 80, lesson: t('A regular visit when it is busiest builds a working relationship.'), evidence: NONE },
    ],
  },
};
