import { parseIsoWallClock, type HrSample, type Session, type Workout } from './parse';

export const MAX_SESSIONS = 6;
/** Sessions further apart than this (first start → last end) aren't one day of play. */
export const MAX_SPAN_SEC = 24 * 3600;
/** Clocks and exports disagree by a few seconds; only a real overlap counts as one. */
const OVERLAP_SLACK_SEC = 60;

export const ERR_OVERLAP = "These sessions overlap in time, so they can't be added together. Remove one and try again.";
export const ERR_SPREAD = 'These sessions are more than a day apart. Combine sessions from the same day.';
export const ERR_TOO_MANY = `Up to ${MAX_SESSIONS} sessions fit on one card.`;
export const NOTE_DUPLICATE = 'This session is already added.';

export function startEpochMs(w: Workout): number {
  return parseIsoWallClock(w.start.iso)?.epochMs ?? Date.UTC(w.start.y, w.start.mo - 1, w.start.d, w.start.h, w.start.mi) - w.start.offsetMin * 60_000;
}

const sameSession = (a: Workout, b: Workout) => startEpochMs(a) === startEpochMs(b) && Math.round(a.durationSec) === Math.round(b.durationSec);

/** Sorted by start, with exact repeats (the same export added twice) dropped. */
export function uniqueSessions(list: Workout[]): { sessions: Workout[]; duplicates: number } {
  const sorted = [...list].sort((a, b) => startEpochMs(a) - startEpochMs(b));
  const sessions: Workout[] = [];
  for (const w of sorted) if (!sessions.some((s) => sameSession(s, w))) sessions.push(w);
  return { sessions, duplicates: list.length - sessions.length };
}

/** Why these sessions can't be one card, or null when they can (expects uniqueSessions output). */
export function combineProblem(sessions: Workout[]): string | null {
  if (sessions.length > MAX_SESSIONS) return ERR_TOO_MANY;
  for (let i = 1; i < sessions.length; i++) {
    const prevEnd = startEpochMs(sessions[i - 1]) / 1000 + sessions[i - 1].durationSec;
    if (startEpochMs(sessions[i]) / 1000 < prevEnd - OVERLAP_SLACK_SEC) return ERR_OVERLAP;
  }
  if (sessions.length > 1) {
    const last = sessions[sessions.length - 1];
    const span = (startEpochMs(last) - startEpochMs(sessions[0])) / 1000 + last.durationSec;
    if (span > MAX_SPAN_SEC) return ERR_SPREAD;
  }
  return null;
}

const sumOrNull = (values: (number | null)[]): number | null => {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
};

/**
 * One workout from several sessions: earliest start, durations, energy and distance added up,
 * heart-rate samples on one clock (real seconds from the first start, so breaks stay breaks).
 * A single session comes back unchanged. Call combineProblem first.
 */
export function combineSessions(list: Workout[]): Workout {
  const { sessions } = uniqueSessions(list);
  if (sessions.length === 1) return sessions[0];
  const t0 = startEpochMs(sessions[0]);
  const parts: Session[] = sessions.map((w) => ({ offsetSec: (startEpochMs(w) - t0) / 1000, durationSec: w.durationSec }));
  const hr: HrSample[] = [];
  sessions.forEach((w, i) => {
    // A session's samples stop where the next one starts, so the two never interleave.
    const limit = i + 1 < parts.length ? parts[i + 1].offsetSec : Infinity;
    for (const s of w.hr) {
      const t = parts[i].offsetSec + s.t;
      if (t < limit) hr.push({ t, bpm: s.bpm });
    }
  });
  const lapAvg = sessions.filter((w) => w.lapAvgHr !== null);
  const lapTime = lapAvg.reduce((a, w) => a + w.durationSec, 0);
  const lapMax = sessions.map((w) => w.lapMaxHr).filter((v): v is number => v !== null);
  const sports = new Set(sessions.map((w) => w.sourceSport));
  return {
    sourceSport: sports.size === 1 ? sessions[0].sourceSport : 'Other',
    start: sessions[0].start,
    durationSec: sessions.reduce((a, w) => a + w.durationSec, 0),
    calories: sumOrNull(sessions.map((w) => w.calories)),
    distanceM: sumOrNull(sessions.map((w) => w.distanceM)),
    hr,
    device: sessions.find((w) => w.device)?.device ?? null,
    lapAvgHr: lapTime > 0 ? Math.round(lapAvg.reduce((a, w) => a + w.lapAvgHr! * w.durationSec, 0) / lapTime) : null,
    lapMaxHr: lapMax.length ? Math.max(...lapMax) : null,
    sessions: parts,
  };
}
