import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildCardData } from '../src/card-data';
import { availableDesigns } from '../src/render/registry';
import { sportById } from '../src/sports';
import { ERR_DAMAGED, ERR_EMPTY, ERR_NO_ACTIVITIES, ERR_NOT_TCX, parseTcx, parseIsoWallClock, type Workout } from '../src/tcx/parse';
import { formatDuration, formatTime, hrSummary, formatEnergy } from '../src/tcx/stats';
import { fixture, FIXTURES } from './helpers';

function only(text: string): Workout {
  const r = parseTcx(text);
  if (!r.ok) throw new Error(r.error);
  expect(r.workouts).toHaveLength(1);
  return r.workouts[0];
}

describe('parseTcx: synthetic-basic (Google Health shape)', () => {
  const w = only(fixture('synthetic-basic.tcx'));

  it('reads the summary', () => {
    expect(w.sourceSport).toBe('Other');
    expect(w.durationSec).toBe(6651);
    expect(w.calories).toBe(496);
    expect(w.distanceM).toBeNull(); // 0.0 in the file
    expect(w.device).toBe('Synthetic Band');
  });

  it('reads ~2 s heart-rate samples relative to the start', () => {
    expect(w.hr.length).toBe(3325);
    expect(w.hr[0]).toEqual({ t: 0, bpm: 82 });
    expect(w.hr[1].t).toBe(2);
    expect(w.hr[w.hr.length - 1].t).toBe(6648);
  });

  it('keeps the wall-clock time and offset as written', () => {
    expect(w.start).toMatchObject({ y: 2026, mo: 10, d: 20, h: 2, mi: 2, offsetMin: 330 });
    expect(w.start.iso).toBe('2026-10-20T02:02:30.000+05:30');
  });

  it('formats duration and energy like Google Health', () => {
    expect(formatDuration(w.durationSec)).toBe('1h 51m');
    expect(formatEnergy(w.calories!)).toBe('496 kcal');
  });
});

describe('wall-clock time is independent of the device timezone', () => {
  const original = process.env.TZ;
  afterAll(() => {
    process.env.TZ = original;
  });

  const offsets = new Set<number>();
  for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
    it(`shows 02:02 under TZ=${tz}`, () => {
      process.env.TZ = tz;
      offsets.add(new Date(Date.UTC(2026, 9, 20)).getTimezoneOffset());
      const w = only(fixture('synthetic-basic.tcx'));
      expect(w.start.h).toBe(2);
      expect(w.start.mi).toBe(2);
      expect(formatTime(w.start, false)).toBe('02:02');
      expect(formatTime(w.start, true)).toBe('2:02 AM');
      expect(w.hr[1].t).toBe(2);
    });
  }

  it('actually ran under different timezones', () => {
    expect(offsets.size).toBeGreaterThan(1);
  });
});

describe('parseTcx: other fixtures', () => {
  it('sums multiple laps and concatenates trackpoints', () => {
    const w = only(fixture('synthetic-multilap.tcx'));
    expect(w.sourceSport).toBe('Running');
    expect(w.durationSec).toBe(420 + 435 + 410);
    expect(w.calories).toBe(98 + 102 + 95);
    expect(w.distanceM).toBeCloseTo(1609.3 * 3, 1);
    expect(w.start).toMatchObject({ h: 7, mi: 15, offsetMin: -240 });
    // 85 + 88 + 83 samples, 5 s apart, continuous across laps.
    expect(w.hr.length).toBe(85 + 88 + 83);
    for (let i = 1; i < w.hr.length; i++) expect(w.hr[i].t).toBeGreaterThanOrEqual(w.hr[i - 1].t);
    expect(w.hr[w.hr.length - 1].t).toBe(1265);
    expect(w.lapAvgHr).not.toBeNull();
    expect(w.lapMaxHr).toBe(Math.max(...w.hr.map((p) => p.bpm)));
  });

  it('loads a file without heart rate and hides HR stats and designs', () => {
    const w = only(fixture('synthetic-nohr.tcx'));
    expect(w.hr).toHaveLength(0);
    expect(w.durationSec).toBe(2880);
    expect(formatDuration(w.durationSec)).toBe('48m');
    expect(hrSummary(w)).toEqual({ avg: null, max: null, min: null });
    const data = buildCardData({
      workout: w,
      sport: sportById('strength'),
      title: '',
      location: '',
      hour12: false,
      distanceUnit: 'km',
      age: 30,
      restingHr: 60,
      maxHrOverride: null,
    });
    expect(data.stats.avgHr).toBeUndefined();
    expect(data.stats.maxHr).toBeUndefined();
    expect(data.stats.zoneMin).toBeUndefined();
    expect(availableDesigns(false).every((d) => !d.needsHr)).toBe(true);
    expect(availableDesigns(false).map((d) => d.id)).not.toContain('trace');
  });

  it('returns every activity in a multi-activity file', () => {
    const r = parseTcx(fixture('synthetic-multi-activity.tcx'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workouts).toHaveLength(2);
    expect(r.workouts[0].sourceSport).toBe('Biking');
    expect(r.workouts[0].distanceM).toBe(24500);
    expect(r.workouts[1].sourceSport).toBe('Other');
    expect(r.workouts[1].start).toMatchObject({ d: 2, h: 6, mi: 45 });
  });
});

describe('parseTcx: errors never throw', () => {
  const cases: [string, string, string][] = [
    ['an XML file that is not TCX', fixture('not-tcx.xml'), ERR_NOT_TCX],
    ['plain text', 'hello, this is not a workout', ERR_NOT_TCX],
    ['an empty file', '', ERR_EMPTY],
    ['JSON', '{"activities": []}', ERR_NOT_TCX],
    ['truncated XML', '<TrainingCenterDatabase><Activities><Activity Sport="Other">', ERR_DAMAGED],
    ['binary garbage', '\u0000\u0001PK\u0003\u0004ÿþ', ERR_NOT_TCX],
    ['a TCX with no activities', '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities/></TrainingCenterDatabase>', ERR_NO_ACTIVITIES],
    ['an activity without any time', '<TrainingCenterDatabase><Activities><Activity Sport="Other"><Id>nope</Id></Activity></Activities></TrainingCenterDatabase>', ERR_NO_ACTIVITIES],
  ];
  for (const [name, text, error] of cases) {
    it(`rejects ${name}`, () => {
      expect(parseTcx(text)).toEqual({ ok: false, error });
    });
  }

  it('uses the exact user-facing messages', () => {
    expect(ERR_NOT_TCX).toContain('tap Export');
    expect(ERR_NO_ACTIVITIES).toContain('no workouts');
  });
});

describe('parseTcx: tolerance', () => {
  const minimal = (root: string, ns: string) => `<?xml version="1.0"?>
<${root} ${ns}>
  <${root.replace('TrainingCenterDatabase', 'Activities')}>
    <${root.replace('TrainingCenterDatabase', 'Activity')} Sport="Biking">
      <${root.replace('TrainingCenterDatabase', 'Id')}>2026-01-05T18:00:00Z</${root.replace('TrainingCenterDatabase', 'Id')}>
      <${root.replace('TrainingCenterDatabase', 'Lap')} StartTime="2026-01-05T18:00:00Z">
        <${root.replace('TrainingCenterDatabase', 'TotalTimeSeconds')}>600</${root.replace('TrainingCenterDatabase', 'TotalTimeSeconds')}>
      </${root.replace('TrainingCenterDatabase', 'Lap')}>
    </${root.replace('TrainingCenterDatabase', 'Activity')}>
  </${root.replace('TrainingCenterDatabase', 'Activities')}>
</${root}>`;

  it('matches elements by local name regardless of namespace prefix', () => {
    const w = only(minimal('tcx:TrainingCenterDatabase', 'xmlns:tcx="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"'));
    expect(w.sourceSport).toBe('Biking');
    expect(w.durationSec).toBe(600);
    expect(w.calories).toBeNull();
    expect(w.start).toMatchObject({ h: 18, mi: 0, offsetMin: 0 });
  });

  it('works without any namespace and with a BOM', () => {
    const w = only('﻿' + minimal('TrainingCenterDatabase', ''));
    expect(w.durationSec).toBe(600);
  });

  it('parses ISO timestamps with and without offsets', () => {
    expect(parseIsoWallClock('2026-10-20T02:02:30.000+05:30')).toMatchObject({ h: 2, mi: 2, offsetMin: 330 });
    expect(parseIsoWallClock('2026-10-20T02:02:30-0730')).toMatchObject({ offsetMin: -450 });
    expect(parseIsoWallClock('2026-10-20T02:02Z')).toMatchObject({ offsetMin: 0 });
    expect(parseIsoWallClock('20 Oct 2026')).toBeNull();
    const a = parseIsoWallClock('2026-10-20T02:02:30.000+05:30')!;
    const b = parseIsoWallClock('2026-10-19T20:32:30Z')!;
    expect(a.epochMs).toBe(b.epochMs);
  });
});

// Real exports are gitignored in tests/fixtures/private/. When present, parse them and print
// their stats; otherwise this block is skipped silently.
const PRIVATE = path.join(FIXTURES, 'private');
const privateFiles = existsSync(PRIVATE) ? readdirSync(PRIVATE).filter((f) => /\.tcx/i.test(f)) : [];

describe.runIf(privateFiles.length > 0)('private fixtures', () => {
  for (const file of privateFiles) {
    it(`parses ${file}`, () => {
      const r = parseTcx(readFileSync(path.join(PRIVATE, file), 'utf8'));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      for (const w of r.workouts) {
        const hr = hrSummary(w);
        // stdout directly: Vitest hides console.log from passing tests.
        process.stdout.write(
          `  ${file}: ${w.sourceSport} ${w.start.iso} · ${formatDuration(w.durationSec)} · ` +
            `${w.calories ?? '–'} kcal · avg ${hr.avg ?? '–'} · max ${hr.max ?? '–'} · min ${hr.min ?? '–'} · ` +
            `${w.hr.length} HR samples · device ${w.device ?? '–'}\n`,
        );
      }
    });
  }
});
