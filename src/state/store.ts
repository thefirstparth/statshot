import { DESIGNS } from '../render/registry';
import { STAT_ORDER, type Background, type SizeKey, type StatKey, type Theme } from '../render/types';
import type { DistanceUnit } from '../tcx/stats';

/** Everything persisted. The workout itself is never stored. */
export type Prefs = {
  designId: string;
  background: Background;
  theme: Theme;
  size: SizeKey;
  accent: string | null; // null → the design's own default
  stats: StatKey[];
  showGraph: boolean;
  showLogo: boolean;
  recentSports: string[]; // sport ids, most recent first (max 4)
  age: number | null;
  maxHrOverride: number | null;
  hour12: boolean | null; // null → locale default
  distanceUnit: DistanceUnit;
};

export const DEFAULT_PREFS: Prefs = {
  designId: 'glass',
  background: 'solid',
  theme: 'dark',
  size: 'story',
  accent: null,
  stats: ['duration', 'energy', 'avgHr'],
  showGraph: true,
  showLogo: true,
  recentSports: [],
  age: null,
  maxHrOverride: null,
  hour12: null,
  distanceUnit: 'km',
};

const KEY = 'statshot:prefs:v1';
const SIZES: SizeKey[] = ['story', 'post', 'square', 'sticker'];

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Reads stored prefs, keeping only values that still make sense. */
export function loadPrefs(): Prefs {
  let raw: Record<string, unknown> = {};
  try {
    const text = localStorage.getItem(KEY);
    if (text) raw = JSON.parse(text) ?? {};
  } catch {
    raw = {};
  }
  const p = { ...DEFAULT_PREFS };
  if (typeof raw.designId === 'string' && DESIGNS.some((d) => d.id === raw.designId)) p.designId = raw.designId;
  if (raw.background === 'transparent' || raw.background === 'solid') p.background = raw.background;
  if (raw.theme === 'light' || raw.theme === 'dark') p.theme = raw.theme;
  if (SIZES.includes(raw.size as SizeKey)) p.size = raw.size as SizeKey;
  if (raw.accent === null || isHex(raw.accent)) p.accent = raw.accent;
  if (Array.isArray(raw.stats)) {
    const stats = STAT_ORDER.filter((k) => (raw.stats as unknown[]).includes(k));
    if (stats.length > 0) p.stats = stats;
  }
  if (typeof raw.showGraph === 'boolean') p.showGraph = raw.showGraph;
  if (typeof raw.showLogo === 'boolean') p.showLogo = raw.showLogo;
  if (Array.isArray(raw.recentSports)) {
    p.recentSports = raw.recentSports.filter((s): s is string => typeof s === 'string').slice(0, 4);
  }
  if (raw.age === null || isNum(raw.age, 5, 110)) p.age = raw.age;
  if (raw.maxHrOverride === null || isNum(raw.maxHrOverride, 80, 250)) p.maxHrOverride = raw.maxHrOverride;
  if (raw.hour12 === null || typeof raw.hour12 === 'boolean') p.hour12 = raw.hour12;
  if (raw.distanceUnit === 'km' || raw.distanceUnit === 'mi') p.distanceUnit = raw.distanceUnit;
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
  } catch {
    // ignore
  }
}

export function pushRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, 4);
}

/** 12h vs 24h from the device locale. */
export function localeHour12(): boolean {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
}
