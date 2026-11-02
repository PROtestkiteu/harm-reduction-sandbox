import { t } from '../../i18n';

/**
 * Short things people say as they pass, by who they are. Plain and everyday:
 * nothing glamorises use and nothing mocks anyone. Lines for the crowd's people
 * follow their role; lines for the flavour packs' people follow their voice.
 */
export const LINES: Record<string, readonly string[]> = {
  // The crowd's roles.
  visitor: [t("Is the van here tonight?"), t("They do hot drinks inside."), t("Just need a sit down."), t("Do they have the test strips?"), t("Same time next week?")],
  clubgoer: [t("Who is on after midnight?"), t("Have you got water?"), t("Let's go in before the queue gets worse."), t("I'm pacing myself tonight."), t("Text me if you lose us.")],
  passerby: [t("Lost my lighter again."), t("The night bus is late."), t("Is that shop still open?"), t("It's colder than it looks."), t("Mum, I'm nearly home.")],
  staff: [t("Hi, how are you doing tonight?"), t("Take a card, just in case."), t("Want some water?"), t("No rush, sit down.")],
  police: [t("All quiet over here."), t("Control, show us clear.")],
  resident: [t("They should do something about this street."), t("At least it's lit now."), t("My bins went again.")],
  sleeper: [t("Got any change?"), t("Mind the bag."), t("Is the shelter full?")],
  seller: [t("Fiver."), t("Not here, round the side.")],
  cleaner: [t("One more street and we're done.")],
  bouncer: [t("ID, please."), t("Not tonight, mate.")],
  // The flavour packs' voices.
  dealer: [t("Keep walking, then come back."), t("Not with them watching."), t("Cash only."), t("Quick, quick.")],
  lookout: [t("Car."), t("Wardens, it's fine."), t("Blue lights on the ring road.")],
  buyer: [t("Same as last time."), t("Is it the same stuff?"), t("I only need a bit.")],
  user: [t("Give me a minute."), t("I'm fine, honestly."), t("Watch my bag?"), t("Has anyone got a clean one?")],
  friend: [t("Hey. Hey, stay with me."), t("Breathe, mate, breathe."), t("I'm right here.")],
  guard: [t("Evening. Everything all right?"), t("Need anything? The drop-in is open."), t("We'll write it up."), t("Mind the road, yeah?")],
  guardReport: [t("Which way did they go?"), t("We'll pass it on to the police."), t("Anyone hurt?")],
  vendor: [t("Hot dogs! Two for a fiver."), t("Onions on that?"), t("Last ones, then I'm moving on.")],
  waiting: [t("Is the bus late again?"), t("The app says four minutes."), t("This shelter keeps no rain out.")],
  busker: [t("Any requests?"), t("Thank you, have a good night.")],
  listener: [t("This one is good."), t("Have you got a coin?")],
  smoker: [t("Five minutes, then back in."), t("The DJ isn't bad."), t("Have you got a light?")],
  rider: [t("Order isn't ready yet."), t("Third time this week at this door.")],
  crew: [t("Lift with your knees."), t("Who parked there?")],
  // Who uses what (config/flavour/users.ts).
  nicotine: [t("Got a light?"), t("I'm quitting in January."), t("Is that mango or mint?"), t("Just one, then I'm going in.")],
  opioid: [t("I'm not asleep, I'm resting."), t("Is there naloxone at the van?"), t("Don't call anyone, I'm fine."), t("My legs went funny again.")],
  cannabis: [t("Pass it this way."), t("Nobody's in a rush, man."), t("Anyone got snacks?"), t("Listen to this tune.")],
  clubber: [t("Is there an after-party?"), t("Drink some water, seriously."), t("My jaw is going."), t("Where's my coat?")],
  tripper: [t("Look at the lamps breathing."), t("Can we stay here a while?"), t("It's fine, it's just the trip."), t("The trees are talking.")],
  benzo: [t("Just five more minutes."), t("Where am I?"), t("Don't take my bag."), t("I only had a couple.")],
  stimulant: [t("I'm good, I'm good, I'm good."), t("Three days, no sleep, it's fine."), t("I'm fixing the bike, then I'm off."), t("Who's looking at me?")],
  punk: [t("This house is for people, not for profit."), t("Kettle's on, if you need a brew."), t("The landlord can wait.")],
  angler: [t("Nothing biting tonight."), t("Shh, you'll scare them off.")],
  parent: [t("Hold my hand at the crossing."), t("Nearly home, then bath and bed.")],
  child: [t("Can we get chips?"), t("Look, a cat!"), t("Race you to the corner!")],
  student: [t("Deadline is Friday."), t("Are you coming out tonight?"), t("The library shuts at ten."), t("My rent went up again."), t("Does anyone know if the club does testing?")],
};

/** The easter-egg pioneers' lines (config/flavour/pioneers.ts): their good sense, in their spirit; none is a quotation. */
export const PIONEER_LINES: Record<'hofmann' | 'sabina' | 'leary' | 'grof' | 'shulgin', readonly string[]> = {
  hofmann: [t('Albert Hofmann: A fine evening for a bicycle ride.'), t('Albert Hofmann: Treat it with respect. It is a powerful thing.')],
  sabina: [t('María Sabina: This is medicine, not a game.'), t('María Sabina: Come with a clean heart and a quiet mind.')],
  leary: [t('Timothy Leary: Mind your set and setting.'), t('Timothy Leary: Who you are with matters as much as what you take.')],
  grof: [t('Stanislav Grof: Breathe, and let it unfold.'), t('Stanislav Grof: Hard moments pass. Have someone sober with you.')],
  shulgin: [t('Sasha Shulgin: Start low, go slow, and write it down.'), t('Sasha Shulgin: Test what you have. Know what it is.')],
};
