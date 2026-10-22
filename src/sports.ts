// Pure data: imported by the app and by the build-time icon plugin, so no DOM here.

export type SportCategory = 'racket' | 'move' | 'gym' | 'water' | 'mind' | 'team';

export type Sport = {
  id: string;
  name: string; // sentence case, shown in the UI and as the default card title
  lower: string; // used mid-sentence ("1h 51m of table tennis")
  icon: string; // Material Symbols (rounded) name, or a custom glyph from CUSTOM_ICONS
  cat: SportCategory;
};

/** Sticker colours per category: [background, glyph, strong accent]. */
export const CATEGORY_COLORS: Record<SportCategory, { bg: string; fg: string; strong: string }> = {
  racket: { bg: '#C4EED0', fg: '#0B6B2E', strong: '#1E8E3E' },
  move: { bg: '#B8EAF0', fg: '#00626E', strong: '#0B8A93' },
  gym: { bg: '#FFDCC7', fg: '#7A2E05', strong: '#D35C1A' },
  water: { bg: '#D3E3FD', fg: '#0842A0', strong: '#1A73E8' },
  mind: { bg: '#E8DEF8', fg: '#4A3A7A', strong: '#7E57C2' },
  team: { bg: '#FFE7A3', fg: '#5C4300', strong: '#C99700' },
};

export const CATEGORY_NAMES: Record<SportCategory, string> = {
  racket: 'Racket sports',
  move: 'Walk, run & ride',
  gym: 'Gym & training',
  water: 'Water',
  mind: 'Mind & body',
  team: 'Team sports',
};

export const CATEGORY_ORDER: SportCategory[] = ['racket', 'move', 'gym', 'team', 'water', 'mind'];

/** Sticker outline per category, in a 100×100 box. */
export const CATEGORY_SHAPES: Record<SportCategory, string> = {
  racket: 'M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92Z',
  move: 'M30 6h40a24 24 0 0 1 24 24v40a24 24 0 0 1-24 24H30A24 24 0 0 1 6 70V30A24 24 0 0 1 30 6Z',
  gym: 'M50 3l13 9 16 1 6 15 12 10-4 16 4 16-12 10-6 15-16 1-13 9-13-9-16-1-6-15-12-10 4-16-4-16 12-10 6-15 16-1Z',
  water: 'M50 5c22 22 40 40 40 58a40 40 0 0 1-80 0C10 45 28 27 50 5Z',
  mind: 'M50 4c14 0 18 12 30 16s18 16 14 30 4 26-8 36-26 8-36 10-24-4-34-14S2 58 6 44s10-26 22-32S36 4 50 4Z',
  team: 'M50 4l42 24v44L50 96 8 72V28Z',
};

/** Glyphs Material Symbols doesn't have, in its 0 -960 960 960 viewBox. */
export const CUSTOM_ICONS: Record<string, string> = {
  table_tennis:
    'M140 -560a260 260 0 1 0 520 0a260 260 0 1 0 -520 0Z M619 -419L803 -235L725 -157L541 -341Z M705 -790a85 85 0 1 0 170 0a85 85 0 1 0 -170 0Z',
};

/** Sheet order within each category; ids of the original list are kept for stored recents. */
export const SPORTS: Sport[] = [
  { id: 'table-tennis', name: 'Table tennis', lower: 'table tennis', icon: 'table_tennis', cat: 'racket' },
  { id: 'pickleball', name: 'Pickleball', lower: 'pickleball', icon: 'pickleball', cat: 'racket' },
  { id: 'tennis', name: 'Tennis', lower: 'tennis', icon: 'sports_tennis', cat: 'racket' },
  { id: 'badminton', name: 'Badminton', lower: 'badminton', icon: 'badminton', cat: 'racket' },
  { id: 'padel', name: 'Padel', lower: 'padel', icon: 'padel', cat: 'racket' },
  { id: 'squash', name: 'Squash', lower: 'squash', icon: 'sports_tennis', cat: 'racket' },
  { id: 'walking', name: 'Walking', lower: 'walking', icon: 'directions_walk', cat: 'move' },
  { id: 'running', name: 'Running', lower: 'running', icon: 'directions_run', cat: 'move' },
  { id: 'hiking', name: 'Hiking', lower: 'hiking', icon: 'hiking', cat: 'move' },
  { id: 'cycling', name: 'Cycling', lower: 'cycling', icon: 'directions_bike', cat: 'move' },
  { id: 'nordic-walking', name: 'Nordic walking', lower: 'nordic walking', icon: 'nordic_walking', cat: 'move' },
  { id: 'skating', name: 'Skating', lower: 'skating', icon: 'roller_skating', cat: 'move' },
  { id: 'skiing', name: 'Skiing', lower: 'skiing', icon: 'downhill_skiing', cat: 'move' },
  { id: 'strength', name: 'Strength', lower: 'strength training', icon: 'fitness_center', cat: 'gym' },
  { id: 'hiit', name: 'HIIT', lower: 'HIIT', icon: 'sprint', cat: 'gym' },
  { id: 'workout', name: 'Workout', lower: 'workout', icon: 'exercise', cat: 'gym' },
  { id: 'stairs', name: 'Stair climbing', lower: 'stair climbing', icon: 'stairs', cat: 'gym' },
  { id: 'elliptical', name: 'Elliptical', lower: 'elliptical', icon: 'cardio_load', cat: 'gym' },
  { id: 'martial-arts', name: 'Martial arts', lower: 'martial arts', icon: 'sports_martial_arts', cat: 'gym' },
  { id: 'boxing', name: 'Boxing', lower: 'boxing', icon: 'sports_mma', cat: 'gym' },
  { id: 'football', name: 'Football', lower: 'football', icon: 'sports_soccer', cat: 'team' },
  { id: 'basketball', name: 'Basketball', lower: 'basketball', icon: 'sports_basketball', cat: 'team' },
  { id: 'cricket', name: 'Cricket', lower: 'cricket', icon: 'sports_cricket', cat: 'team' },
  { id: 'volleyball', name: 'Volleyball', lower: 'volleyball', icon: 'sports_volleyball', cat: 'team' },
  { id: 'hockey', name: 'Hockey', lower: 'hockey', icon: 'sports_hockey', cat: 'team' },
  { id: 'rugby', name: 'Rugby', lower: 'rugby', icon: 'sports_rugby', cat: 'team' },
  { id: 'baseball', name: 'Baseball', lower: 'baseball', icon: 'sports_baseball', cat: 'team' },
  { id: 'golf', name: 'Golf', lower: 'golf', icon: 'sports_golf', cat: 'team' },
  { id: 'swimming', name: 'Swimming', lower: 'swimming', icon: 'pool', cat: 'water' },
  { id: 'rowing', name: 'Rowing', lower: 'rowing', icon: 'rowing', cat: 'water' },
  { id: 'kayaking', name: 'Kayaking', lower: 'kayaking', icon: 'kayaking', cat: 'water' },
  { id: 'surfing', name: 'Surfing', lower: 'surfing', icon: 'surfing', cat: 'water' },
  { id: 'yoga', name: 'Yoga', lower: 'yoga', icon: 'self_improvement', cat: 'mind' },
  { id: 'pilates', name: 'Pilates', lower: 'pilates', icon: 'sports_gymnastics', cat: 'mind' },
  { id: 'dance', name: 'Dance', lower: 'dance', icon: 'music_note', cat: 'mind' },
];

export const FALLBACK_ICON = 'exercise';
export const FALLBACK_SPORT_ID = 'workout';

/** Icons used by the app chrome (rendered inline as SVG). Filled variants where they exist. */
export const UI_ICONS = [
  'settings',
  'close',
  'search',
  'arrow_back',
  'keyboard_arrow_down',
  'chevron_right',
  'chevron_left',
  'ios_share',
  'share',
  'content_copy',
  'download',
  'upload_file',
  'edit',
  'lock',
  'check',
  'warning',
  'monitor_heart',
  'star',
  'grid_view',
  'palette',
  'location_on',
  'favorite',
  'wifi_off',
  'cloud_off',
  'person_off',
  'help',
  'add',
  'remove',
  'info',
  'code',
  // Stat icons drawn on cards.
  'timer',
  'local_fire_department',
  'favorite',
  'ecg_heart',
  'heart_minus',
  'monitor_heart',
  'route',
  'schedule',
] as const;

export const ICON_NAMES: string[] = [
  ...new Set([...SPORTS.map((s) => s.icon), FALLBACK_ICON, ...UI_ICONS]),
];

const CUSTOM_PREFIX = 'custom:';

export function sportById(id: string): Sport {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const name = id.slice(CUSTOM_PREFIX.length).trim() || 'Workout';
    return { id, name, lower: name, icon: FALLBACK_ICON, cat: 'gym' };
  }
  return SPORTS.find((s) => s.id === id) ?? SPORTS.find((s) => s.id === FALLBACK_SPORT_ID)!;
}

export function isKnownSport(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX) || SPORTS.some((s) => s.id === id);
}

export function customSportId(name: string): string {
  return CUSTOM_PREFIX + name.trim().slice(0, 40);
}

/** Case- and accent-insensitive match on the name. */
export function searchSports(query: string): Sport[] {
  const q = fold(query);
  if (!q) return SPORTS;
  return SPORTS.filter((s) => fold(s.name).includes(q) || fold(s.lower).includes(q));
}

function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'workout';
}
