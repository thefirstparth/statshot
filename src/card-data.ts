import { hashString } from './render/canvas';
import { STAT_ORDER, type CardData, type SessionInfo, type StatItem, type StatKey } from './render/types';
import { CATEGORY_COLORS, type Sport } from './sports';
import type { HrSample, Session, Workout } from './tcx/parse';
import {
  addSeconds,
  formatDistance,
  formatDuration,
  formatFullDate,
  formatLongDate,
  formatMinutes,
  formatShortDate,
  formatTime,
  hrSeries,
  hrSummary,
  hrrZoneMinutes,
  resolveMaxHr,
  weekday,
  type DistanceUnit,
} from './tcx/stats';

export type CardInputs = {
  workout: Workout;
  sport: Sport;
  title: string; // empty → sport name
  location: string;
  hour12: boolean;
  distanceUnit: DistanceUnit;
  age: number | null;
  restingHr: number | null;
  maxHrOverride: number | null;
};

export const MAX_TITLE = 40;

/** Removes invisible direction overrides that would flip text on the card. */
export function cleanText(text: string): string {
  return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim();
}

/** First `max` characters, counting an emoji as one. */
function clip(text: string, max: number): string {
  return Array.from(text).slice(0, max).join('');
}

export const MAX_LOCATION = 40;

export function buildCardData(inp: CardInputs): CardData {
  const { workout: w, sport } = inp;
  const hr = hrSummary(w);
  const zones = hrrZoneMinutes(w.hr, inp.restingHr, resolveMaxHr(inp.age, inp.maxHrOverride));
  // Several sessions: the card spans first start → last end, while the duration is time played.
  const parts = w.sessions ?? [{ offsetSec: 0, durationSec: w.durationSec }];
  const lastPart = parts[parts.length - 1];
  const end = addSeconds(w.start, lastPart.offsetSec + lastPart.durationSec);
  const startText = formatTime(w.start, inp.hour12);
  const endText = formatTime(end, inp.hour12);

  const stats: Partial<Record<StatKey, StatItem>> = {};
  const add = (key: StatKey, item: Omit<StatItem, 'key'>) => {
    stats[key] = { key, ...item };
  };
  const duration = formatDuration(w.durationSec);
  add('duration', { label: 'Duration', short: 'Time', value: duration, number: duration, unit: '', phrase: duration });
  if (w.calories !== null) {
    const kcal = String(Math.round(w.calories));
    add('energy', { label: 'Energy', short: 'Energy', value: `${kcal} kcal`, number: kcal, unit: 'kcal', phrase: `${kcal} kcal` });
  }
  if (hr.avg !== null) {
    add('avgHr', { label: 'Avg heart rate', short: 'Avg HR', value: `${hr.avg} bpm`, number: String(hr.avg), unit: 'bpm', phrase: `avg ${hr.avg} bpm` });
  }
  if (hr.max !== null) {
    add('maxHr', { label: 'Peak heart rate', short: 'Peak HR', value: `${hr.max} bpm`, number: String(hr.max), unit: 'bpm', phrase: `peak ${hr.max} bpm` });
  }
  if (hr.min !== null) {
    add('minHr', { label: 'Lowest heart rate', short: 'Low HR', value: `${hr.min} bpm`, number: String(hr.min), unit: 'bpm', phrase: `lowest ${hr.min} bpm` });
  }
  if (zones) {
    // Real time at moderate effort or harder: comparable with the duration, unlike Google-style
    // zone minutes (which count vigorous minutes twice and so can't be read as time).
    const effort = formatMinutes(zones.moderate + zones.vigorous + zones.peak);
    add('zoneMin', { label: 'Moderate or harder', short: 'Moderate+', value: effort, number: effort, unit: '', phrase: `${effort} at moderate or harder` });
  }
  const distanceText = w.distanceM !== null ? formatDistance(w.distanceM, inp.distanceUnit) : null;
  if (distanceText) {
    const [num, unit] = distanceText.split(' ');
    add('distance', { label: 'Distance', short: 'Distance', value: distanceText, number: num, unit, phrase: distanceText });
  }
  // "2:02–3:53 AM" rather than "2:02 AM–3:53 AM" when both halves share the suffix.
  const sameHalf = inp.hour12 && startText.slice(-2) === endText.slice(-2);
  const range = sameHalf ? `${startText.slice(0, -3)}–${endText}` : `${startText}–${endText}`;
  add('timeRange', { label: 'Time of day', short: 'Time', value: range, number: range, unit: '', phrase: `from ${startText} to ${endText}` });

  return {
    title: clip(cleanText(inp.title), MAX_TITLE) || sport.name,
    sportName: sport.name,
    sportLower: sport.lower,
    dateText: formatLongDate(w.start),
    shortDate: formatShortDate(w.start),
    fullDate: formatFullDate(w.start),
    weekday: weekday(w.start),
    timeText: startText,
    endTimeText: endText,
    startMin: w.start.h * 60 + w.start.mi,
    sessions: sessionInfo(w, parts, inp.hour12),
    sessionsText: parts.length > 1 ? `${parts.length} sessions` : '',
    sportId: sport.id,
    sportIcon: sport.icon,
    sportColors: CATEGORY_COLORS[sport.cat],
    location: clip(cleanText(inp.location), MAX_LOCATION),
    stats,
    ...activeSeries(w, parts),
    durationSec: w.durationSec,
    avgHr: hr.avg,
    maxHr: hr.max,
    minHr: hr.min,
    distanceText,
    zones,
    seed: hashString(w.start.iso),
  };
}

/** Each session's clock time and where it sits on the active-time graph. */
function sessionInfo(w: Workout, parts: Session[], hour12: boolean): SessionInfo[] {
  let active = 0;
  return parts.map((p) => {
    const start = addSeconds(w.start, p.offsetSec);
    const info = {
      startMin: w.start.h * 60 + w.start.mi + p.offsetSec / 60,
      durationSec: p.durationSec,
      activeStart: active,
      startText: formatTime(start, hour12),
      endText: formatTime(addSeconds(start, p.durationSec), hour12),
    };
    active += p.durationSec;
    return info;
  });
}

/**
 * The graph series. One session: as before. Several: each session is smoothed on its own (so the
 * smoothing never blends across a break) and laid end to end on active time, with the joins in
 * `breaks`.
 */
function activeSeries(w: Workout, parts: Session[]): { hrSeries: HrSample[]; breaks: number[] } {
  if (parts.length === 1) return { hrSeries: hrSeries(w.hr), breaks: [] };
  const total = parts.reduce((a, p) => a + p.durationSec, 0);
  const out: HrSample[] = [];
  const breaks: number[] = [];
  let active = 0;
  parts.forEach((p, i) => {
    const next = i + 1 < parts.length ? parts[i + 1].offsetSec : Infinity;
    const own = w.hr
      .filter((s) => s.t >= p.offsetSec && s.t < next)
      // Kept just inside the session, so a sample never lands on the next session's start.
      .map((s) => ({ t: active + Math.min(p.durationSec - 0.5, s.t - p.offsetSec), bpm: s.bpm }));
    if (i > 0) breaks.push(active);
    const points = Math.max(12, Math.round((300 * p.durationSec) / Math.max(1, total)));
    out.push(...hrSeries(own, points));
    active += p.durationSec;
  });
  return { hrSeries: out, breaks };
}

/** Stat keys with data, in tray order. */
export function availableStats(data: CardData): StatKey[] {
  return STAT_ORDER.filter((k) => data.stats[k] !== undefined);
}
