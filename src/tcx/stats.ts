import type { HrSample, WallClock, Workout } from './parse';

/** Intervals longer than this are treated as gaps (watch off-wrist, paused…). */
export const MAX_GAP_SEC = 30;

export const ZONE_BOUNDS = [50, 60, 70, 80, 90] as const; // % of max HR where Z1…Z5 start
export const ZONE_NAMES = ['Warm-up', 'Easy', 'Aerobic', 'Threshold', 'Max'] as const;
export const ZONE_COLORS = ['#8E9AAF', '#4FC3F7', '#81C784', '#FFB74D', '#E57373'] as const;

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
  return `${v.toFixed(1)} ${unit}`;
}

/** Max HR = user override, else 220 − age, else unavailable. */
export function resolveMaxHr(age: number | null, override: number | null): number | null {
  if (override !== null && override >= 80 && override <= 250) return Math.round(override);
  if (age !== null && age >= 5 && age <= 110) return 220 - Math.round(age);
  return null;
}

/** 0–4 for Z1–Z5, or -1 below 50 % of max HR. */
export function zoneIndex(bpm: number, maxHrValue: number): number {
  const pct = (bpm / maxHrValue) * 100;
  for (let z = ZONE_BOUNDS.length - 1; z >= 0; z--) if (pct >= ZONE_BOUNDS[z]) return z;
  return -1;
}

/**
 * Minutes per zone. Each interval between samples counts toward the zone of its starting
 * sample; gaps longer than 30 s are ignored.
 */
export function zoneMinutes(hr: HrSample[], maxHrValue: number): number[] {
  const sec = [0, 0, 0, 0, 0];
  for (let i = 0; i < hr.length - 1; i++) {
    const dt = hr[i + 1].t - hr[i].t;
    if (dt <= 0 || dt > MAX_GAP_SEC) continue;
    const z = zoneIndex(hr[i].bpm, maxHrValue);
    if (z >= 0) sec[z] += dt;
  }
  return sec.map((s) => s / 60);
}

/** Minutes in Z3 and above. */
export function activeMinutes(zones: number[]): number {
  return zones[2] + zones[3] + zones[4];
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

/** "2026-10-20" */
export function isoDate(w: WallClock): string {
  return `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

/** Summary HR values, preferring samples and falling back to lap summaries. */
export function hrSummary(w: Workout): { avg: number | null; max: number | null; min: number | null } {
  if (w.hr.length > 0) return { avg: avgHr(w.hr), max: maxHr(w.hr), min: minHr(w.hr) };
  return { avg: w.lapAvgHr, max: w.lapMaxHr, min: null };
}
