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
  student: [t("Deadline is Friday."), t("Are you coming out tonight?"), t("The library shuts at ten."), t("My rent went up again."), t("Does anyone know if the club does testing?")],
};
