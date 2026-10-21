import { DESIGNS } from '../render/registry';
import { MAX_STATS, STAT_ORDER, type Background, type SizeKey, type StatKey, type Theme } from '../render/types';
import type { DistanceUnit } from '../tcx/stats';

export type Appearance = 'auto' | 'light' | 'dark';

/** Everything persisted. The workout itself is never stored. */
export type Prefs = {
  designId: string;
  favourites: string[]; // design ids, starred order, max MAX_FAVOURITES
  background: Background;
  theme: Theme; // card theme
  size: SizeKey;
  accent: string | null; // null → the design's own default
  stats: StatKey[];
  showGraph: boolean;
  showLogo: boolean;
  recentSports: string[]; // sport ids, most recent first
  age: number | null;
  restingHr: number | null;
  maxHrOverride: number | null;
  hour12: boolean | null; // null → locale default
  distanceUnit: DistanceUnit;
  appearance: Appearance; // app chrome
};

export const MAX_FAVOURITES = 5;
export const MAX_RECENT_SPORTS = 6;

export const DEFAULT_FAVOURITES = ['summary', 'trace', 'pill', 'messages', 'hero'];

export const DEFAULT_PREFS: Prefs = {
  designId: 'summary',
  favourites: DEFAULT_FAVOURITES,
  background: 'transparent', // card only on clear: paste it onto a story or photo
  theme: 'dark',
  size: 'sticker',
  accent: null,
  stats: ['duration', 'energy', 'avgHr'],
  showGraph: true,
  showLogo: true,
  recentSports: [],
  age: null,
  restingHr: null,
  maxHrOverride: null,
  hour12: null,
  distanceUnit: 'km',
  appearance: 'auto',
};

const KEY = 'sweatshot:prefs:v1';
const LEGACY_KEY = 'statshot:prefs:v1';
const SIZES: SizeKey[] = ['story', 'post', 'square', 'sticker'];

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function readRaw(): Record<string, unknown> {
  try {
    const text = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    const parsed: unknown = text ? JSON.parse(text) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Reads stored prefs, keeping only values that still make sense. */
export function loadPrefs(): Prefs {
  const raw = readRaw();
  const ids = new Set(DESIGNS.map((d) => d.id));
  const p: Prefs = { ...DEFAULT_PREFS };
  if (typeof raw.designId === 'string' && ids.has(raw.designId)) p.designId = raw.designId;
  if (Array.isArray(raw.favourites)) {
    p.favourites = [...new Set(raw.favourites.filter((x): x is string => typeof x === 'string' && ids.has(x)))].slice(0, MAX_FAVOURITES);
  }
  if (raw.background === 'transparent' || raw.background === 'solid') p.background = raw.background;
  if (raw.theme === 'light' || raw.theme === 'dark') p.theme = raw.theme;
  if (SIZES.includes(raw.size as SizeKey)) p.size = raw.size as SizeKey;
  if (raw.accent === null || isHex(raw.accent)) p.accent = raw.accent;
  if (Array.isArray(raw.stats)) {
    const stats = (raw.stats as unknown[]).filter((k): k is StatKey => STAT_ORDER.includes(k as StatKey));
    const unique = [...new Set(stats)].slice(0, MAX_STATS);
    if (unique.length > 0) p.stats = unique;
  }
  if (typeof raw.showGraph === 'boolean') p.showGraph = raw.showGraph;
  if (typeof raw.showLogo === 'boolean') p.showLogo = raw.showLogo;
  if (Array.isArray(raw.recentSports)) {
    p.recentSports = raw.recentSports.filter((s): s is string => typeof s === 'string').slice(0, MAX_RECENT_SPORTS);
  }
  if (raw.age === null || isNum(raw.age, 10, 100)) p.age = raw.age;
  if (raw.restingHr === null || isNum(raw.restingHr, 30, 120)) p.restingHr = raw.restingHr;
  if (raw.maxHrOverride === null || isNum(raw.maxHrOverride, 100, 230)) p.maxHrOverride = raw.maxHrOverride;
  if (raw.hour12 === null || typeof raw.hour12 === 'boolean') p.hour12 = raw.hour12;
  if (raw.distanceUnit === 'km' || raw.distanceUnit === 'mi') p.distanceUnit = raw.distanceUnit;
  if (raw.appearance === 'auto' || raw.appearance === 'light' || raw.appearance === 'dark') p.appearance = raw.appearance;
  return p;
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or storage full: preferences just won't persist.
  }
}

export function clearPrefs(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

export function pushRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT_SPORTS);
}

/** Stars or unstars a design. Returns null when starring would exceed the limit. */
export function toggleFavourite(list: string[], id: string): string[] | null {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (list.length >= MAX_FAVOURITES) return null;
  return [...list, id];
}

/** Favourites first (in starred order), then the rest in catalogue order. */
export function orderDesigns<T extends { id: string }>(designs: T[], favourites: string[]): T[] {
  const fav = favourites.map((id) => designs.find((d) => d.id === id)).filter((d): d is T => !!d);
  return [...fav, ...designs.filter((d) => !favourites.includes(d.id))];
}

/** 12h vs 24h from the device locale. */
export function localeHour12(): boolean {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
}
