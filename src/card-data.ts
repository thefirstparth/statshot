import { hashString } from './render/canvas';
import { STAT_ORDER, type CardData, type StatItem, type StatKey } from './render/types';
import { CATEGORY_COLORS, type Sport } from './sports';
import type { Workout } from './tcx/parse';
import {
  addSeconds,
  formatDistance,
  formatDuration,
  formatFullDate,
  formatLongDate,
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
export const MAX_LOCATION = 40;

export function buildCardData(inp: CardInputs): CardData {
  const { workout: w, sport } = inp;
  const hr = hrSummary(w);
  const zones = hrrZoneMinutes(w.hr, inp.restingHr, resolveMaxHr(inp.age, inp.maxHrOverride));
  const end = addSeconds(w.start, w.durationSec);
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
    const z = String(zones.zoneMinutes);
    add('zoneMin', { label: 'Zone minutes', short: 'Zone min', value: `${z} min`, number: z, unit: 'zone min', phrase: `${z} zone minutes` });
  }
  const distanceText = w.distanceM !== null ? formatDistance(w.distanceM, inp.distanceUnit) : null;
  if (distanceText) {
    const [num, unit] = distanceText.split(' ');
    add('distance', { label: 'Distance', short: 'Distance', value: distanceText, number: num, unit, phrase: distanceText });
  }
  const range = `${startText}–${endText}`;
  add('timeRange', { label: 'Time of day', short: 'Time', value: range, number: range, unit: '', phrase: `from ${startText} to ${endText}` });

  return {
    title: inp.title.trim().slice(0, MAX_TITLE) || sport.name,
    sportName: sport.name,
    sportLower: sport.lower,
    dateText: formatLongDate(w.start),
    shortDate: formatShortDate(w.start),
    fullDate: formatFullDate(w.start),
    weekday: weekday(w.start),
    timeText: startText,
    endTimeText: endText,
    startMin: w.start.h * 60 + w.start.mi,
    sportId: sport.id,
    sportIcon: sport.icon,
    sportColors: CATEGORY_COLORS[sport.cat],
    location: inp.location.trim().slice(0, MAX_LOCATION),
    stats,
    hrSeries: hrSeries(w.hr),
    durationSec: w.durationSec,
    avgHr: hr.avg,
    maxHr: hr.max,
    minHr: hr.min,
    distanceText,
    zones,
    seed: hashString(w.start.iso),
  };
}

/** Stat keys with data, in tray order. */
export function availableStats(data: CardData): StatKey[] {
  return STAT_ORDER.filter((k) => data.stats[k] !== undefined);
}
