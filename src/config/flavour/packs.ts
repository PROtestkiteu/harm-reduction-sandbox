import { t } from '../../i18n';

/**
 * Flavour packs: street life layered over the simulation. None of them feed
 * the model (no money, no meters, no shared random stream), so a scenario plays
 * the same with any of them on or off. Each is built the first time it is
 * switched on and costs nothing per frame while it is off.
 */
export type PackId = 'street' | 'guard' | 'crime' | 'vignettes' | 'lines' | 'service' | 'weather' | 'campus' | 'chaos' | 'users' | 'thieves' | 'visitors' | 'cycling' | 'pets' | 'decor' | 'sky' | 'river' | 'kids' | 'pioneers' | 'squats';

export interface PackInfo {
  id: PackId;
  label: string;
  hint: string;
}

export const PACKS: readonly PackInfo[] = [
  { id: 'street', label: t('Street drug scene'), hint: t('Dealers, lookouts and buyers; people using at the squat and in the parks.') },
  { id: 'guard', label: t('City guard'), hint: t('Municipal wardens on foot. They check on people and write tickets; nobody moves on when they pass.') },
  { id: 'crime', label: t('Street crime'), hint: t('Phone snatches, shoplifting, smashed shelters and fly-tipping, shown where they happen.') },
  { id: 'vignettes', label: t('Street life'), hint: t('A busker, smokers at the club door, a delivery rider, someone feeding pigeons.') },
  { id: 'lines', label: t('Overheard lines'), hint: t('Short things people say as they pass.') },
  { id: 'service', label: t('Night service traffic'), hint: t('The bin lorry and its crew, a street sweeper, couriers on bikes.') },
  { id: 'weather', label: t('Rain and fog'), hint: t('Rain some evenings and ground fog before dawn.') },
  { id: 'chaos', label: t('Street scene spiralling'), hint: t('Boarded-up shops and tags, burning bins, people slumped in doorways, fights and ambulances, as the street scene grows.') },
  { id: 'campus', label: t('University'), hint: t('A university and its students, on the south-west edge of the district.') },
  { id: 'thieves', label: t('Petty thieves'), hint: t('Pickpockets and shoplifters from the simulation, shown where they strike; shops hit often hire a guard or pull their shutters down early.') },
  { id: 'visitors', label: t('Pickets and clergy'), hint: t('A picket, a priest or a nun at the drop-in some evenings, as likely to be for harm reduction as against it.') },
  { id: 'cycling', label: t('Cycling'), hint: t('Cyclists on the ring road\'s bike lane and bikes parked at racks.') },
  { id: 'pets', label: t('Pets'), hint: t('People walking dogs, and cats in doorways.') },
  { id: 'decor', label: t('Street furniture'), hint: t('Planters, café boards, a post box, a newspaper box and bollards.') },
  { id: 'sky', label: t('Sky'), hint: t('Now and then birds, a light aircraft, a balloon or a glider.') },
  { id: 'river', label: t('River'), hint: t('Boats under the arched bridges, people fishing from the wall.') },
  { id: 'kids', label: t('Children'), hint: t('Families out in the early evening and children walking to school.') },
  { id: 'pioneers', label: t('Pioneers'), hint: t('Easter eggs: five pioneers of psychedelic research out for a walk.') },
  { id: 'squats', label: t('Squats'), hint: t('Anarchist flags, graffiti and a banner on the squats, a punk by the door.') },
  { id: 'users', label: t('Who uses what'), hint: t('Small groups along the inner ring: smokers and vapers, opioid users bent over in the fentanyl fold, cannabis smokers on a bench, clubbers after hours, people tripping, people slumped on benzos and stimulant users pacing.') },
];

/** Weather moods the Rain and fog pack can show; `auto` picks one each evening. */
export type WeatherMood = 'auto' | 'dry' | 'rain' | 'fog' | 'rainFog';

export const WEATHER_MOODS: readonly { id: WeatherMood; label: string }[] = [
  { id: 'auto', label: t('Changes each evening') },
  { id: 'dry', label: t('Dry') },
  { id: 'rain', label: t('Rain') },
  { id: 'fog', label: t('Fog') },
  { id: 'rainFog', label: t('Rain and fog') },
];

export interface PackSettings {
  on: Record<PackId, boolean>;
  weather: WeatherMood;
}

export const defaultPacks = (): PackSettings => ({
  on: { street: true, guard: true, crime: true, vignettes: true, lines: true, service: true, weather: true, campus: true, chaos: true, users: true, thieves: true, visitors: true, cycling: true, pets: true, decor: true, sky: true, river: true, kids: true, pioneers: true, squats: true },
  weather: 'auto',
});

/**
 * Every pack is on, always: they are part of the city, not options. Dev builds
 * only take `?packs=street,lines` (or `none`) and `?weather=rain`, so the
 * frame-cost check and the bots can compare runs with packs off.
 */
export function loadPacks(): PackSettings {
  const out = defaultPacks();
  if (!import.meta.env.DEV || typeof location === 'undefined') return out;
  const q = new URLSearchParams(location.search);
  const forced = q.get('packs');
  if (forced !== null) {
    const ids = new Set(forced.split(','));
    for (const p of PACKS) out.on[p.id] = ids.has(p.id);
  }
  const mood = q.get('weather');
  if (mood && WEATHER_MOODS.some((m) => m.id === mood)) out.weather = mood as WeatherMood;
  return out;
}
