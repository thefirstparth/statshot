import type { HrSample } from '../tcx/parse';

export type Rect = { x: number; y: number; w: number; h: number };

export type StatKey =
  | 'duration'
  | 'energy'
  | 'avgHr'
  | 'maxHr'
  | 'minHr'
  | 'zoneMin'
  | 'distance'
  | 'timeRange';

/** Order of the stat stickers in the tray. */
export const STAT_ORDER: StatKey[] = [
  'duration',
  'energy',
  'avgHr',
  'maxHr',
  'minHr',
  'zoneMin',
  'distance',
  'timeRange',
];

/** Most stats a card shows at once. */
export const MAX_STATS = 6;

export type StatItem = {
  key: StatKey;
  label: string; // "Avg heart rate"
  short: string; // "Avg HR" (tight layouts)
  value: string; // "112 bpm"
  number: string; // "112" (big-number layouts)
  unit: string; // "bpm" ("" when the number says it all, e.g. "1h 51m")
  phrase: string; // for sentences: "avg 112 bpm"
};

/** Heart-rate-reserve zones, Google Health style. Minutes per zone. */
export type ZoneMinutes = {
  light: number;
  moderate: number;
  vigorous: number;
  peak: number;
  /** Moderate counts once, vigorous and peak count double. */
  zoneMinutes: number;
  /** Inputs used, so cards can print the bpm ranges. */
  restingHr: number;
  maxHr: number;
};

export type CardData = {
  title: string;
  sportName: string; // "Table tennis"
  sportLower: string; // "table tennis"
  dateText: string; // "Tue, 20 Oct 2026"
  shortDate: string; // "20 Oct"
  fullDate: string; // "20 Oct 2026"
  weekday: string; // "Tue"
  timeText: string; // "02:02"
  endTimeText: string; // "03:53"
  startMin: number; // minutes after midnight, wall clock as written
  sportId: string;
  sportIcon: string; // icon name (see virtual:icons)
  sportColors: { bg: string; fg: string; strong: string };
  location: string; // "" when not set
  stats: Partial<Record<StatKey, StatItem>>;
  hrSeries: HrSample[]; // downsampled + smoothed
  durationSec: number;
  avgHr: number | null;
  maxHr: number | null;
  minHr: number | null;
  distanceText: string | null; // "3.42 km"
  zones: ZoneMinutes | null; // null until resting HR + age (or max HR) are set
  seed: number; // deterministic randomness (receipt edges, noise)
};

export type Theme = 'light' | 'dark';
export type Background = 'transparent' | 'solid';

export type CardOptions = {
  theme: Theme;
  background: Background;
  accent: string; // hex
  stats: StatKey[]; // ordered, user-selected
  showLogo: boolean; // the small Sweatshot mark
  showGraph: boolean;
};

export type IconRequest = { name: string; color: string; size: number };

export interface CardDesign {
  id: string;
  name: string;
  needsHr?: boolean;
  needsZones?: boolean;
  supportsAccent: boolean;
  supportsGraph?: boolean;
  supportsTheme?: boolean; // default true; Receipt is always light
  /** One line for the design picker. */
  blurb: string;
  defaultAccent?: string;
  /** Canvas fill when the background is "solid". */
  background(opts: CardOptions): string;
  /** Icon images this card draws, so they can be decoded before drawing. */
  icons?(data: CardData, opts: CardOptions): IconRequest[];
  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions): void;
  measure(width: number, data: CardData, opts: CardOptions): { h: number };
}

export type SizeKey = 'story' | 'post' | 'square' | 'sticker';
