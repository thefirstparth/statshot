import type { HrSample } from '../tcx/parse';

export type Rect = { x: number; y: number; w: number; h: number };

export type StatKey =
  | 'duration'
  | 'energy'
  | 'avgHr'
  | 'maxHr'
  | 'activeMin'
  | 'distance'
  | 'cardioLoad';

/** Fixed order of the stat toggles (and of stats on the card). */
export const STAT_ORDER: StatKey[] = [
  'duration',
  'energy',
  'avgHr',
  'maxHr',
  'activeMin',
  'distance',
  'cardioLoad',
];

export type StatItem = {
  key: StatKey;
  label: string; // "Avg HR"
  value: string; // "112 bpm"
  phrase: string; // for sentences: "avg 112 bpm"
};

export type CardData = {
  title: string;
  sportName: string; // "Table tennis"
  sportLower: string; // "table tennis"
  dateText: string; // "Tue, 20 Oct 2026"
  shortDate: string; // "20 Oct"
  fullDate: string; // "20 Oct 2026"
  timeText: string; // "02:02"
  sportIcon: string; // Tabler icon name
  stats: Partial<Record<StatKey, StatItem>>;
  hrSeries: HrSample[]; // downsampled + smoothed
  durationSec: number;
  avgHr: number | null;
  maxHr: number | null;
  zoneMinutes: number[] | null; // null when max HR is unknown
  cardioLoad?: number;
  seed: number; // deterministic randomness (receipt edges, noise)
};

export type Theme = 'light' | 'dark';
export type Background = 'transparent' | 'solid';

export type CardOptions = {
  theme: Theme;
  background: Background;
  accent: string; // hex
  stats: StatKey[]; // ordered, user-selected
  showLogo: boolean;
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
  defaultAccent?: string;
  /** Canvas fill when the background is "solid". */
  background(opts: CardOptions): string;
  /** Icon images this card draws, so they can be decoded before drawing. */
  icons?(data: CardData, opts: CardOptions): IconRequest[];
  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions): void;
  measure(width: number, data: CardData, opts: CardOptions): { h: number };
}

export type SizeKey = 'story' | 'post' | 'square' | 'sticker';
