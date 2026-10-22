import { seededRandom } from './render/canvas';
import type { HrSample, Workout } from './tcx/parse';

/**
 * A made-up 52-minute pickleball session so people can try the app without a file.
 * Deterministic, generated on the fly; nothing real about it.
 */
export function sampleWorkout(): Workout {
  const rand = seededRandom(20261020);
  const secs = 52 * 60;
  const hr: HrSample[] = [];
  let drift = 0;
  for (let t = 0; t <= secs; t += 2) {
    const f = t / secs;
    const warm = Math.min(1, f / 0.1);
    const cool = Math.min(1, (1 - f) / 0.08);
    const rally = Math.sin(t / 37) * 0.5 + 0.5;
    drift = drift * 0.92 + (rand() - 0.5) * 3;
    hr.push({ t, bpm: Math.round(88 + (122 - 88) * warm * cool + 26 * rally * warm * cool + drift) });
  }
  return {
    sourceSport: 'Other',
    start: { iso: '2026-10-20T18:30:00+05:30', y: 2026, mo: 10, d: 20, h: 18, mi: 30, offsetMin: 330 },
    durationSec: secs,
    calories: 418,
    distanceM: null,
    hr,
    device: null,
    lapAvgHr: null,
    lapMaxHr: null,
  };
}
