// Pure data: imported by the app and by the build-time icon plugin, so no DOM here.

export type Sport = {
  id: string;
  name: string; // sentence case, shown in the UI and as the default card title
  lower: string; // used mid-sentence ("1h 51m of table tennis")
  icon: string; // Tabler outline icon name, verified at build time
};

/** Grid order in the sport sheet. Icons without an exact Tabler match use the closest one. */
export const SPORTS: Sport[] = [
  { id: 'table-tennis', name: 'Table tennis', lower: 'table tennis', icon: 'ping-pong' },
  { id: 'badminton', name: 'Badminton', lower: 'badminton', icon: 'ball-tennis' },
  { id: 'tennis', name: 'Tennis', lower: 'tennis', icon: 'ball-tennis' },
  { id: 'pickleball', name: 'Pickleball', lower: 'pickleball', icon: 'ping-pong' },
  { id: 'squash', name: 'Squash', lower: 'squash', icon: 'ball-tennis' },
  { id: 'padel', name: 'Padel', lower: 'padel', icon: 'ball-tennis' },
  { id: 'running', name: 'Running', lower: 'running', icon: 'run' },
  { id: 'walking', name: 'Walking', lower: 'walking', icon: 'walk' },
  { id: 'hiking', name: 'Hiking', lower: 'hiking', icon: 'trekking' },
  { id: 'cycling', name: 'Cycling', lower: 'cycling', icon: 'bike' },
  { id: 'swimming', name: 'Swimming', lower: 'swimming', icon: 'swimming' },
  { id: 'strength', name: 'Strength', lower: 'strength training', icon: 'barbell' },
  { id: 'hiit', name: 'HIIT', lower: 'HIIT', icon: 'jump-rope' },
  { id: 'yoga', name: 'Yoga', lower: 'yoga', icon: 'yoga' },
  { id: 'football', name: 'Football', lower: 'football', icon: 'ball-football' },
  { id: 'basketball', name: 'Basketball', lower: 'basketball', icon: 'ball-basketball' },
  { id: 'volleyball', name: 'Volleyball', lower: 'volleyball', icon: 'ball-volleyball' },
  { id: 'cricket', name: 'Cricket', lower: 'cricket', icon: 'cricket' },
  { id: 'dance', name: 'Dance', lower: 'dance', icon: 'music' },
  { id: 'rowing', name: 'Rowing', lower: 'rowing', icon: 'kayak' },
  { id: 'elliptical', name: 'Elliptical', lower: 'elliptical', icon: 'treadmill' },
  { id: 'workout', name: 'Workout', lower: 'workout', icon: 'activity' },
];

export const FALLBACK_ICON = 'activity';

/** Icons used by the app chrome (rendered inline as SVG). */
export const UI_ICONS = [
  'settings',
  'x',
  'search',
  'chevron-down',
  'chevron-right',
  'share',
  'copy',
  'download',
  'file-import',
  'adjustments-horizontal',
  'pencil',
  'lock',
  'check',
  'alert-triangle',
  'heart-rate-monitor',
  'brand-github',
] as const;

export const ICON_NAMES: string[] = [
  ...new Set([...SPORTS.map((s) => s.icon), FALLBACK_ICON, ...UI_ICONS]),
];

const CUSTOM_PREFIX = 'custom:';

export function sportById(id: string): Sport {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const name = id.slice(CUSTOM_PREFIX.length).trim() || 'Workout';
    return { id, name, lower: name, icon: FALLBACK_ICON };
  }
  return SPORTS.find((s) => s.id === id) ?? SPORTS[SPORTS.length - 1];
}

export function customSportId(name: string): string {
  return CUSTOM_PREFIX + name.trim();
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
