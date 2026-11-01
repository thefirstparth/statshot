import { describe, expect, it } from 'vitest';
import { buildCardData } from '../src/card-data';
import { sessionCuts } from '../src/render/zone-graph';
import { sportById } from '../src/sports';
import { combineProblem, combineSessions, ERR_OVERLAP, ERR_SPREAD, ERR_TOO_MANY, MAX_SESSIONS, uniqueSessions } from '../src/tcx/merge';
import { parseTcx, type Workout } from '../src/tcx/parse';
import { hrSummary } from '../src/tcx/stats';
import { fixture, session } from './helpers';

const card = (w: Workout, hour12 = true) =>
  buildCardData({ workout: w, sport: sportById('table-tennis'), title: '', location: '', hour12, distanceUnit: 'km', age: 30, restingHr: 62, maxHrOverride: null });

describe('combining sessions', () => {
  const a = session('2026-10-31T18:00:00+05:30', 60, 120, 500);
  const b = session('2026-10-31T21:00:00+05:30', 20, 150, 200);

  it('adds up time and energy, and spans first start to last end', () => {
    const w = combineSessions([a, b]);
    expect(w.durationSec).toBe(80 * 60);
    expect(w.calories).toBe(700);
    const d = card(w);
    expect(d.stats.duration!.value).toBe('1h 20m');
    expect(d.timeText).toBe('6:00 PM');
    expect(d.endTimeText).toBe('9:20 PM');
    expect(d.stats.timeRange!.value).toBe('6:00–9:20 PM');
    expect(d.sessionsText).toBe('2 sessions');
  });

  it('averages heart rate over playing time, not per session', () => {
    const { avg, max, min } = hrSummary(combineSessions([a, b]));
    expect(avg).toBe(128); // (60 × 120 + 20 × 150) / 80 = 127.5, not (120 + 150) / 2 = 135
    expect(max).toBe(150);
    expect(min).toBe(120);
  });

  it('ignores the break for zones and keeps the graph to playing time', () => {
    const d = card(combineSessions([a, b]));
    const z = d.zones!;
    expect(Math.round(z.light + z.moderate + z.vigorous + z.peak)).toBe(80);
    expect(d.breaks).toEqual([3600]);
    expect(d.hrSeries[d.hrSeries.length - 1].t).toBeLessThanOrEqual(80 * 60);
    for (let i = 1; i < d.hrSeries.length; i++) expect(d.hrSeries[i].t).toBeGreaterThanOrEqual(d.hrSeries[i - 1].t);
    // No point from the second session is smoothed with the first.
    expect(d.hrSeries.filter((p) => p.t >= 3600).every((p) => p.bpm === 150)).toBe(true);
    expect(d.sessions.map((s) => [s.startText, s.endText, s.activeStart])).toEqual([
      ['6:00 PM', '7:00 PM', 0],
      ['9:00 PM', '9:20 PM', 3600],
    ]);
  });

  it("keeps every graph point inside its own session (a break never belongs to the next one)", () => {
    const noHr = session('2026-10-31T23:00:00+05:30', 30, null, 100);
    const d = card(combineSessions([a, b, noHr]));
    expect(d.breaks).toEqual([3600, 4800]);
    const cuts = sessionCuts(d);
    expect(cuts.map(([from, to]) => to - from).every((n, i) => (i < 2 ? n > 0 : n === 0))).toBe(true);
    d.sessions.forEach((sess, i) => {
      for (const p of d.hrSeries.slice(cuts[i][0], cuts[i][1])) {
        expect(p.t).toBeGreaterThanOrEqual(sess.activeStart);
        expect(p.t).toBeLessThan(sess.activeStart + sess.durationSec);
      }
    });
  });

  it('sorts files picked out of order and drops the same file added twice', () => {
    const { sessions, duplicates } = uniqueSessions([b, a, b]);
    expect(sessions).toEqual([a, b]);
    expect(duplicates).toBe(1);
    expect(combineSessions([b, a, b]).durationSec).toBe(80 * 60);
  });

  it('refuses overlapping sessions, but allows a few seconds of clock drift', () => {
    const overlap = session('2026-10-31T18:30:00+05:30', 30, 130);
    expect(combineProblem(uniqueSessions([a, overlap]).sessions)).toBe(ERR_OVERLAP);
    const touching = session('2026-10-31T18:59:30+05:30', 10, 130);
    expect(combineProblem(uniqueSessions([a, touching]).sessions)).toBeNull();
  });

  it('allows a late-night session after midnight, refuses more than a day apart', () => {
    const late = session('2026-11-01T01:11:00+05:30', 60, 130);
    expect(combineProblem(uniqueSessions([a, late]).sessions)).toBeNull();
    const d = card(combineSessions([a, late]));
    expect(d.weekday).toBe('Sat'); // the card is dated by the first session
    expect(d.sessions[1].startMin).toBe(18 * 60 + 7 * 60 + 11);
    const nextDay = session('2026-11-01T19:00:00+05:30', 30, 130);
    expect(combineProblem(uniqueSessions([a, nextDay]).sessions)).toBe(ERR_SPREAD);
  });

  it(`allows up to ${MAX_SESSIONS} sessions`, () => {
    const many = Array.from({ length: MAX_SESSIONS + 1 }, (_, i) => session(`2026-10-31T${String(8 + i).padStart(2, '0')}:00:00+05:30`, 20, 120));
    expect(combineProblem(many.slice(0, MAX_SESSIONS))).toBeNull();
    expect(combineProblem(many)).toBe(ERR_TOO_MANY);
  });

  it('orders by real time when files were written with different offsets', () => {
    const utc = session('2026-10-31T13:00:00Z', 30, 120); // 6:30 PM in +05:30
    const ist = session('2026-10-31T17:00:00+05:30', 30, 120); // 11:30 UTC, earlier
    expect(uniqueSessions([utc, ist]).sessions).toEqual([ist, utc]);
  });

  it('keeps time and energy from a session without heart rate', () => {
    const noHr = session('2026-10-31T20:00:00+05:30', 30, null, 150);
    const w = combineSessions([a, noHr]);
    expect(w.durationSec).toBe(90 * 60);
    expect(w.calories).toBe(650);
    expect(hrSummary(w).avg).toBe(120);
    const d = card(w);
    expect(d.sessions).toHaveLength(2);
    expect(d.hrSeries.every((p) => p.bpm === 120)).toBe(true);
  });

  it('leaves a single session untouched', () => {
    expect(combineSessions([a])).toBe(a);
    const d = card(a);
    expect(d.sessionsText).toBe('');
    expect(d.breaks).toEqual([]);
  });

  it('reads a multi-workout file as sessions that can be combined within a day', () => {
    const r = parseTcx(fixture('synthetic-multi-activity.tcx'));
    if (!r.ok) throw new Error(r.error);
    // A ride at 6:30 PM and a session at 6:45 AM the next morning: within 24 h, so allowed.
    const { sessions } = uniqueSessions(r.workouts);
    expect(combineProblem(sessions)).toBeNull();
    const w = combineSessions(sessions);
    expect(w.sourceSport).toBe('Other'); // mixed sports never pre-pick one
    expect(w.durationSec).toBe(3600 + 1800);
  });
});
