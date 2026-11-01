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

/** One recorded session, for cards that show sessions separately (Day dial, Receipt). */
export type SessionInfo = {
  startMin: number; // minutes after the first session's midnight (can pass 1440 after midnight)
  durationSec: number;
  /** Where this session starts on hrSeries' clock (active time: breaks between sessions removed). */
  activeStart: number;
  startText: string;
  endText: string;
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
  /** Downsampled + smoothed, on active time: with several sessions the breaks are cut out. */
  hrSeries: HrSample[];
  /** hrSeries times where a new session starts (empty for a single session). Graphs leave a gap there. */
  breaks: number[];
  /** Always at least one. */
  sessions: SessionInfo[];
  /** "2 sessions" when several were combined, else "". Cards print it once, beside the date. */
  sessionsText: string;
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
  /** The stat Hero and Poster print huge (falls back to duration when the file lacks it). */
  bigStat: StatKey;
};

export type IconRequest = { name: string; color: string; size: number };

export interface CardDesign {
  id: string;
  name: string;
  needsHr?: boolean;
  needsZones?: boolean;
  supportsAccent: boolean;
  supportsGraph?: boolean;
  supportsTheme?: boolean; // default true
  /** One line for the design picker. */
  blurb: string;
  /** Text drawn straight on the background (no panel): gets a soft shadow when see-through. */
  floating?: boolean;
  defaultAccent?: string;
  /** Hero and Poster: the user picks which stat is the big number. */
  supportsBigStat?: boolean;
  /** Canvas fill when the background is "solid". */
  background(opts: CardOptions): string;
  /** Icon images this card draws, so they can be decoded before drawing. */
  icons?(data: CardData, opts: CardOptions): IconRequest[];
  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions): void;
  measure(width: number, data: CardData, opts: CardOptions): { h: number };
}

/** Export sizes: the card cropped tight, or a full 1080×1920 story. */
export type SizeKey = 'story' | 'sticker';
/** Everything canvasLayout can lay out; 'square' is only used for small previews. */
export type CanvasSize = SizeKey | 'square';
