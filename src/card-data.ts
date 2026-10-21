import { hashString } from './render/canvas';
import { STAT_ORDER, type CardData, type StatItem, type StatKey } from './render/types';
import type { Sport } from './sports';
import type { Workout } from './tcx/parse';
import {
  activeMinutes,
  formatDistance,
  formatDuration,
  formatEnergy,
  formatFullDate,
  formatLongDate,
  formatMinutes,
  formatShortDate,
  formatTime,
  hrSeries,
  hrSummary,
  resolveMaxHr,
  zoneMinutes,
  type DistanceUnit,
} from './tcx/stats';

export type CardInputs = {
  workout: Workout;
  sport: Sport;
  title: string; // empty → sport name
  cardioLoad: number | null;
  hour12: boolean;
  distanceUnit: DistanceUnit;
  age: number | null;
  maxHrOverride: number | null;
};

export function buildCardData(inp: CardInputs): CardData {
  const { workout: w, sport } = inp;
  const hr = hrSummary(w);
  const maxHrValue = resolveMaxHr(inp.age, inp.maxHrOverride);
  const zones = w.hr.length > 1 && maxHrValue !== null ? zoneMinutes(w.hr, maxHrValue) : null;

  const stats: Partial<Record<StatKey, StatItem>> = {};
  const add = (key: StatKey, label: string, value: string, phrase: string) => {
    stats[key] = { key, label, value, phrase };
  };
  const duration = formatDuration(w.durationSec);
  add('duration', 'Duration', duration, duration);
  if (w.calories !== null) add('energy', 'Energy', formatEnergy(w.calories), formatEnergy(w.calories));
  if (hr.avg !== null) add('avgHr', 'Avg HR', `${hr.avg} bpm`, `avg ${hr.avg} bpm`);
  if (hr.max !== null) add('maxHr', 'Max HR', `${hr.max} bpm`, `max ${hr.max} bpm`);
  if (zones) {
    const active = formatMinutes(activeMinutes(zones));
    add('activeMin', 'Active min', active, `${active} active`);
  }
  if (w.distanceM !== null) {
    const d = formatDistance(w.distanceM, inp.distanceUnit);
    add('distance', 'Distance', d, d);
  }
  if (inp.cardioLoad !== null) {
    add('cardioLoad', 'Cardio load', String(inp.cardioLoad), `cardio load ${inp.cardioLoad}`);
  }

  return {
    title: inp.title.trim() || sport.name,
    sportName: sport.name,
    sportLower: sport.lower,
    dateText: formatLongDate(w.start),
    shortDate: formatShortDate(w.start),
    fullDate: formatFullDate(w.start),
    timeText: formatTime(w.start, inp.hour12),
    sportIcon: sport.icon,
    stats,
    hrSeries: hrSeries(w.hr),
    durationSec: w.durationSec,
    avgHr: hr.avg,
    maxHr: hr.max,
    zoneMinutes: zones,
    cardioLoad: inp.cardioLoad ?? undefined,
    seed: hashString(w.start.iso),
  };
}

/** Stat keys with data, in toggle order. */
export function availableStats(data: CardData): StatKey[] {
  return STAT_ORDER.filter((k) => data.stats[k] !== undefined);
}
