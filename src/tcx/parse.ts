export type SourceSport = 'Running' | 'Biking' | 'Other';

export type WallClock = {
  iso: string;
  y: number;
  mo: number; // 1–12
  d: number;
  h: number;
  mi: number;
  offsetMin: number; // UTC offset as written in the file (0 when absent)
};

export type HrSample = { t: number; bpm: number }; // t = seconds since start

export type Workout = {
  sourceSport: SourceSport;
  start: WallClock;
  durationSec: number; // sum of TotalTimeSeconds
  calories: number | null;
  distanceM: number | null; // null if 0/missing
  hr: HrSample[];
  device: string | null;
  /** Lap summary values, used only when the file has no per-sample heart rate. */
  lapAvgHr: number | null;
  lapMaxHr: number | null;
};

export type ParseResult =
  | { ok: true; workouts: Workout[] }
  | { ok: false; error: string };

export const ERR_NOT_TCX =
  "This file isn't a .tcx workout file. In Google Health, open your workout, tap the three dots (⋯), tap Export, and open that file here.";
export const ERR_EMPTY = 'This file is empty. Export the workout from Google Health again and open the new file.';
export const ERR_DAMAGED =
  'This workout file is damaged or cut off. Export the workout from Google Health again and open the new file.';
export const ERR_NO_ACTIVITIES = 'This file has no workouts in it. Export a single workout from Google Health and try again.';
export const NOTE_NO_HR = 'No heart-rate data in this file.';

const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/** Parses an ISO timestamp keeping the wall-clock fields exactly as written. */
export function parseIsoWallClock(text: string): (WallClock & { epochMs: number }) | null {
  const iso = text.trim();
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const s = m[6] ? Number(m[6]) : 0;
  const ms = m[7] ? Math.round(Number(`0.${m[7]}`) * 1000) : 0;
  let offsetMin = 0;
  const off = m[8];
  if (off && off.toUpperCase() !== 'Z') {
    const sign = off[0] === '-' ? -1 : 1;
    const digits = off.slice(1).replace(':', '');
    offsetMin = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || '0'));
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  // Computed from the fields, so the device timezone never matters.
  const epochMs = Date.UTC(y, mo - 1, d, h, mi, s, ms) - offsetMin * 60_000;
  return { iso, y, mo, d, h, mi, offsetMin, epochMs };
}

// Namespace-tolerant DOM helpers: match on localName only.
function childEls(parent: Element, name: string): Element[] {
  const out: Element[] = [];
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if (c.localName === name) out.push(c);
  }
  return out;
}

function childEl(parent: Element, name: string): Element | null {
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if (c.localName === name) return c;
  }
  return null;
}

function descendants(parent: Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

function num(el: Element | null): number | null {
  if (!el) return null;
  const v = Number((el.textContent ?? '').trim());
  return Number.isFinite(v) ? v : null;
}

/** `<HeartRateBpm><Value>82</Value></HeartRateBpm>`-style values. */
function bpmOf(parent: Element, name: string): number | null {
  const el = childEl(parent, name);
  if (!el) return null;
  const v = num(childEl(el, 'Value') ?? el);
  return v !== null && v > 0 ? v : null;
}

function parseActivity(activity: Element): Workout | null {
  const sportAttr = activity.getAttribute('Sport');
  const sourceSport: SourceSport =
    sportAttr === 'Running' ? 'Running' : sportAttr === 'Biking' ? 'Biking' : 'Other';

  const laps = childEls(activity, 'Lap');
  const firstTrackTime = descendants(activity, 'Trackpoint')
    .map((tp) => childEl(tp, 'Time')?.textContent ?? '')
    .find((t) => t.trim() !== '');
  const start =
    parseIsoWallClock(childEl(activity, 'Id')?.textContent ?? '') ??
    (laps[0] ? parseIsoWallClock(laps[0].getAttribute('StartTime') ?? '') : null) ??
    (firstTrackTime ? parseIsoWallClock(firstTrackTime) : null);
  if (!start) return null;

  let durationSec = 0;
  let calories = 0;
  let sawCalories = false;
  let lapDistance = 0;
  let maxTrackDistance = 0;
  let lapMaxHr: number | null = null;
  let avgWeighted = 0;
  let avgWeight = 0;
  const hr: HrSample[] = [];
  let lastT = -Infinity;

  for (const lap of laps) {
    const lapTime = num(childEl(lap, 'TotalTimeSeconds')) ?? 0;
    durationSec += Math.max(0, lapTime);
    const cal = num(childEl(lap, 'Calories'));
    if (cal !== null) {
      sawCalories = true;
      calories += Math.max(0, cal);
    }
    lapDistance += Math.max(0, num(childEl(lap, 'DistanceMeters')) ?? 0);
    const lapAvg = bpmOf(lap, 'AverageHeartRateBpm');
    if (lapAvg !== null) {
      const w = lapTime > 0 ? lapTime : 1;
      avgWeighted += lapAvg * w;
      avgWeight += w;
    }
    const lapMax = bpmOf(lap, 'MaximumHeartRateBpm');
    if (lapMax !== null) lapMaxHr = Math.max(lapMaxHr ?? 0, lapMax);

    for (const track of childEls(lap, 'Track')) {
      for (const tp of childEls(track, 'Trackpoint')) {
        const time = parseIsoWallClock(childEl(tp, 'Time')?.textContent ?? '');
        const dist = num(childEl(tp, 'DistanceMeters'));
        if (dist !== null && dist > maxTrackDistance) maxTrackDistance = dist;
        const bpm = bpmOf(tp, 'HeartRateBpm');
        if (!time || bpm === null) continue;
        const t = (time.epochMs - start.epochMs) / 1000;
        if (t < lastT) continue; // keep the series monotonic
        lastT = t;
        hr.push({ t, bpm });
      }
    }
  }

  if (durationSec <= 0 && hr.length > 1) durationSec = hr[hr.length - 1].t - hr[0].t;

  const distance = lapDistance > 0 ? lapDistance : maxTrackDistance;
  const creator = childEl(activity, 'Creator');
  const device = creator ? (childEl(creator, 'Name')?.textContent ?? '').trim() || null : null;
  const { epochMs: _epoch, ...wallClock } = start;

  return {
    sourceSport,
    start: wallClock,
    durationSec,
    calories: sawCalories && calories > 0 ? Math.round(calories) : null,
    distanceM: distance > 0 ? distance : null,
    hr,
    device,
    lapAvgHr: avgWeight > 0 ? Math.round(avgWeighted / avgWeight) : null,
    lapMaxHr,
  };
}

/** TCX → workouts. Validates by content, never by file name. Never throws. */
export function parseTcx(text: string): ParseResult {
  try {
    const src = text.replace(/^﻿/, '').trimStart();
    if (src === '') return { ok: false, error: ERR_EMPTY };
    if (!src.startsWith('<')) return { ok: false, error: ERR_NOT_TCX };
    const looksLikeTcx = /<(\w+:)?TrainingCenterDatabase[\s>]/.test(src.slice(0, 2000));
    const doc = new DOMParser().parseFromString(src, 'application/xml');
    const root = doc.documentElement;
    if (!root || doc.getElementsByTagName('parsererror').length > 0) {
      return { ok: false, error: looksLikeTcx ? ERR_DAMAGED : ERR_NOT_TCX };
    }
    if (root.localName !== 'TrainingCenterDatabase') return { ok: false, error: ERR_NOT_TCX };
    const workouts = descendants(root, 'Activity')
      .map(parseActivity)
      .filter((w): w is Workout => w !== null);
    if (workouts.length === 0) return { ok: false, error: ERR_NO_ACTIVITIES };
    return { ok: true, workouts };
  } catch {
    return { ok: false, error: ERR_NOT_TCX };
  }
}
