import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIsoWallClock, type Workout } from '../src/tcx/parse';

export const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES, name), 'utf8');
}

/** A session starting at `iso`, `min` minutes long, sampled every 2 s at `bpm(t)`. */
export function session(iso: string, min: number, bpm: number | ((t: number) => number) | null, kcal: number | null = min * 8): Workout {
  const start = parseIsoWallClock(iso)!;
  const durationSec = min * 60;
  const f = typeof bpm === 'function' ? bpm : () => bpm ?? 0;
  const hr = bpm === null ? [] : Array.from({ length: durationSec / 2 + 1 }, (_, i) => ({ t: i * 2, bpm: f(i * 2) }));
  return { sourceSport: 'Other', start, durationSec, calories: kcal, distanceM: null, hr, device: null, lapAvgHr: null, lapMaxHr: null };
}

