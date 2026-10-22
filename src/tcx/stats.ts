import type { ZoneMinutes } from '../render/types';
import type { HrSample, WallClock, Workout } from './parse';

/** Intervals longer than this are treated as gaps (watch off-wrist, paused…). */
export const MAX_GAP_SEC = 30;

/**
 * Heart-rate-reserve zones as Google Health defines them: % of (max − resting) above resting.
 * Light < 40 %, Moderate 40–59 %, Vigorous 60–84 %, Peak ≥ 85 %.
 */
export const HRR_BOUNDS = [0.4, 0.6, 0.85] as const;
export const ZONE_NAMES = ['Light', 'Moderate', 'Vigorous', 'Peak'] as const;
export const ZONE_COLORS = ['#9AA5B1', '#F2B33D', '#EC7A3B', '#D93F5C'] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Time-weighted mean heart rate (trapezoid over each interval), skipping gaps.
 * Falls back to the plain sample mean when no usable interval exists.
 */
export function avgHr(hr: HrSample[]): number | null {
  if (hr.length === 0) return null;
  let area = 0;
  let time = 0;
  for (let i = 0; i < hr.length - 1; i++) {
    const dt = hr[i + 1].t - hr[i].t;
    if (dt <= 0 || dt > MAX_GAP_SEC) continue;
    area += ((hr[i].bpm + hr[i + 1].bpm) / 2) * dt;
    time += dt;
  }
  if (time > 0) return Math.round(area / time);
  return Math.round(hr.reduce((s, p) => s + p.bpm, 0) / hr.length);
}

export function maxHr(hr: HrSample[]): number | null {
  if (hr.length === 0) return null;
  let m = -Infinity;
  for (const p of hr) if (p.bpm > m) m = p.bpm;
  return Math.round(m);
}

export function minHr(hr: HrSample[]): number | null {
  if (hr.length === 0) return null;
  let m = Infinity;
  for (const p of hr) if (p.bpm < m) m = p.bpm;
  return Math.round(m);
}

/** Rounded to the nearest minute, like Google Health: 6651 s → "1h 51m", 2880 s → "48m". */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0s';
  if (sec < 59.5) return `${Math.round(sec)}s`;
  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Whole minutes, for zone and active-minute values. */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  return m < 60 ? `${m}m` : formatDuration(m * 60);
}

export function formatEnergy(kcal: number): string {
  return `${Math.round(kcal)} kcal`;
}

export type DistanceUnit = 'km' | 'mi';

export function formatDistance(meters: number, unit: DistanceUnit): string {
  const v = unit === 'mi' ? meters / 1609.344 : meters / 1000;
  return `${v.toFixed(v < 10 ? 2 : 1)} ${unit}`;
}

/** Max HR = user override, else 220 − age, else unavailable. */
export function resolveMaxHr(age: number | null, override: number | null): number | null {
  if (override !== null && override >= 100 && override <= 230) return Math.round(override);
  if (age !== null && age >= 10 && age <= 100) return 220 - Math.round(age);
  return null;
}

export function validRestingHr(resting: number | null): resting is number {
  return resting !== null && Number.isFinite(resting) && resting >= 30 && resting <= 120;
}

/** Lowest bpm of each zone above Light: [moderate, vigorous, peak]. */
export function hrrZoneStarts(resting: number, maxHrValue: number): number[] {
  return HRR_BOUNDS.map((b) => Math.ceil(resting + b * (maxHrValue - resting)));
}

/** 0 light, 1 moderate, 2 vigorous, 3 peak. */
export function hrrZone(bpm: number, resting: number, maxHrValue: number): number {
  const reserve = Math.max(1, maxHrValue - resting);
  const pct = (bpm - resting) / reserve;
  let z = 0;
  for (let i = 0; i < HRR_BOUNDS.length; i++) if (pct >= HRR_BOUNDS[i]) z = i + 1;
  return z;
}

/**
 * Minutes per HRR zone plus Google-style zone minutes (moderate ×1, vigorous and peak ×2).
 * Each interval counts toward the zone of its starting sample; gaps over 30 s are ignored.
 * Null when there is no usable heart rate, no valid resting HR or no max HR.
 */
export function hrrZoneMinutes(
  hr: HrSample[],
  resting: number | null,
  maxHrValue: number | null,
): ZoneMinutes | null {
  if (hr.length < 2 || !validRestingHr(resting) || maxHrValue === null || maxHrValue <= resting + 10) return null;
  const sec = [0, 0, 0, 0];
  for (let i = 0; i < hr.length - 1; i++) {
    const dt = hr[i + 1].t - hr[i].t;
    if (dt <= 0 || dt > MAX_GAP_SEC) continue;
    sec[hrrZone(hr[i].bpm, resting, maxHrValue)] += dt;
  }
  const [light, moderate, vigorous, peak] = sec.map((v) => v / 60);
  return {
    light,
    moderate,
    vigorous,
    peak,
    zoneMinutes: Math.round(moderate) + 2 * (Math.round(vigorous) + Math.round(peak)),
    restingHr: resting,
    maxHr: maxHrValue,
  };
}

/** Bucket-average down to ≤ maxPoints, then a centred moving average (window 5). */
export function hrSeries(hr: HrSample[], maxPoints = 300, window = 5): HrSample[] {
  let pts: HrSample[] = hr;
  if (hr.length > maxPoints) {
    pts = [];
    for (let b = 0; b < maxPoints; b++) {
      const from = Math.floor((b * hr.length) / maxPoints);
      const to = Math.floor(((b + 1) * hr.length) / maxPoints);
      let t = 0;
      let bpm = 0;
      for (let i = from; i < to; i++) {
        t += hr[i].t;
        bpm += hr[i].bpm;
      }
      const n = to - from;
      if (n > 0) pts.push({ t: t / n, bpm: bpm / n });
    }
  }
  const half = Math.floor(window / 2);
  return pts.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(pts.length - 1, i + half); j++) {
      sum += pts[j].bpm;
      n++;
    }
    return { t: p.t, bpm: sum / n };
  });
}

function weekdayOf(w: WallClock): number {
  // Pure calendar arithmetic on the written date; independent of the device timezone.
  return new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay();
}

/** "20 Oct" */
export function formatShortDate(w: WallClock): string {
  return `${w.d} ${MONTHS[w.mo - 1]}`;
}

/** "20 Oct 2026" */
export function formatFullDate(w: WallClock): string {
  return `${w.d} ${MONTHS[w.mo - 1]} ${w.y}`;
}

/** "Tue, 20 Oct 2026" */
export function formatLongDate(w: WallClock): string {
  return `${WEEKDAYS[weekdayOf(w)]}, ${w.d} ${MONTHS[w.mo - 1]} ${w.y}`;
}

/** Wall-clock time as written in the file: "02:02" or "2:02 AM". */
export function formatTime(w: WallClock, hour12: boolean): string {
  const mm = String(w.mi).padStart(2, '0');
  if (!hour12) return `${String(w.h).padStart(2, '0')}:${mm}`;
  const h = w.h % 12 === 0 ? 12 : w.h % 12;
  return `${h}:${mm} ${w.h < 12 ? 'AM' : 'PM'}`;
}

/** Wall clock `sec` seconds after `w` (date rolls over past midnight). */
export function addSeconds(w: WallClock, sec: number): WallClock {
  const t = new Date(Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) + Math.round(sec / 60) * 60_000);
  return { ...w, y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
}

export function weekday(w: WallClock): string {
  return WEEKDAYS[weekdayOf(w)];
}

/** "2026-10-20" */
export function isoDate(w: WallClock): string {
  return `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

/** Summary HR values, preferring samples and falling back to lap summaries. */
export function hrSummary(w: Workout): { avg: number | null; max: number | null; min: number | null } {
  if (w.hr.length > 0) return { avg: avgHr(w.hr), max: maxHr(w.hr), min: minHr(w.hr) };
  return { avg: w.lapAvgHr, max: w.lapMaxHr, min: null };
}
