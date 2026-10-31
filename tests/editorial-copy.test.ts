import { describe, expect, it } from 'vitest';
import { climbLine, hourSlices, issueLabel } from '../src/render/designs/editorial';
import type { HrSample } from '../src/tcx/parse';

const at = (h: number, m = 0) => h * 60 + m;

describe('Editorial cover copy is literally true', () => {
  it('calls it the late issue only for starts from 9 PM to before 5 AM', () => {
    for (const t of [at(21), at(23, 59), at(0), at(1, 11), at(4, 59)]) expect(issueLabel(t)).toBe('The late issue');
    expect(issueLabel(at(5))).toBe('The morning issue');
    expect(issueLabel(at(11, 59))).toBe('The morning issue');
    expect(issueLabel(at(12))).toBe('The afternoon issue');
    expect(issueLabel(at(16, 59))).toBe('The afternoon issue');
    expect(issueLabel(at(17))).toBe('The evening issue');
    expect(issueLabel(at(20, 59))).toBe('The evening issue');
  });

  it('slices the session into full hours plus a shorter last stretch', () => {
    // 2h 53m, flat 100 / 120 / 140 bpm per hour, one sample every 10 s.
    const dur = 2 * 3600 + 53 * 60;
    const series: HrSample[] = [];
    for (let t = 0; t <= dur; t += 10) series.push({ t, bpm: t < 3600 ? 100 : t < 7200 ? 120 : 140 });
    const slices = hourSlices(series, dur);
    expect(slices.map((s) => s.minutes)).toEqual([60, 60, 53]);
    expect(slices.map((s) => s.avg)).toEqual([100, 120, 140]);
  });

  it('says heart rate climbed every hour only for 2+ full hours, each strictly higher', () => {
    expect(climbLine([{ minutes: 60, avg: 109 }, { minutes: 60, avg: 126 }])?.head).toBe('Heart rate climbed every hour');
    // One full hour is not "every hour"; a tie or a dip is not a climb.
    expect(climbLine([{ minutes: 60, avg: 110 }, { minutes: 50, avg: 130 }])).toBeNull();
    expect(climbLine([{ minutes: 60, avg: 110 }, { minutes: 60, avg: 110 }])).toBeNull();
    expect(climbLine([{ minutes: 60, avg: 110 }, { minutes: 60, avg: 120 }, { minutes: 60, avg: 115 }])).toBeNull();
  });

  it('names a shorter last stretch honestly, or leaves it out', () => {
    const climbs = climbLine([{ minutes: 60, avg: 109 }, { minutes: 60, avg: 126 }, { minutes: 53, avg: 135 }])!;
    expect(climbs.head).not.toMatch(/every hour/);
    expect(climbs.values).toBe('109 → 126 → 135 bpm');
    expect(climbs.note).toMatch(/last 53 min/);
    // The last stretch dipped: the claim covers only the full hours and leaves the dip out.
    const dips = climbLine([{ minutes: 60, avg: 109 }, { minutes: 60, avg: 126 }, { minutes: 40, avg: 120 }])!;
    expect(dips.head).toBe('Heart rate climbed through the first two hours');
    expect(dips.values).toBe('109 → 126 bpm');
  });
});
