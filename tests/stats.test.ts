import { beforeEach, describe, expect, it } from 'vitest';
import { availableStats, buildCardData } from '../src/card-data';
import { exportFilename } from '../src/export/export';
import { splitRows, statRows, visibleStats } from '../src/render/canvas';
import { statSentence } from '../src/render/designs/messages';
import type { CardOptions, StatItem } from '../src/render/types';
import { slugify, sportById, customSportId } from '../src/sports';
import { DEFAULT_PREFS, loadPrefs, orderDesigns, pushRecent, savePrefs, toggleFavourite } from '../src/state/store';
import { parseTcx, type HrSample, type Workout } from '../src/tcx/parse';
import {
  avgHr,
  formatDistance,
  formatDuration,
  formatLongDate,
  formatMinutes,
  formatTime,
  hrSeries,
  isoDate,
  maxHr,
  minHr,
  resolveMaxHr,
  hrrZone,
  hrrZoneMinutes,
} from '../src/tcx/stats';
import { fixture } from './helpers';

function basic(): Workout {
  const r = parseTcx(fixture('synthetic-basic.tcx'));
  if (!r.ok) throw new Error(r.error);
  return r.workouts[0];
}

describe('durations', () => {
  it.each([
    [6651, '1h 51m'],
    [2880, '48m'],
    [45, '45s'],
    [59.6, '1m'],
    [3600, '1h'],
    [3629, '1h'],
    [3631, '1h 1m'],
    [0, '0s'],
  ])('%s s → %s', (sec, text) => {
    expect(formatDuration(sec)).toBe(text);
  });

  it('formats zone minutes in whole minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(37.6)).toBe('38m');
    expect(formatMinutes(75)).toBe('1h 15m');
  });
});

describe('heart rate', () => {
  it('matches the synthetic fixture: avg 112, max 135, min 82', () => {
    const w = basic();
    expect(avgHr(w.hr)).toBe(112);
    expect(maxHr(w.hr)).toBe(135);
    expect(minHr(w.hr)).toBe(82);
    // The plain sample mean agrees within ±1.
    const plain = w.hr.reduce((s, p) => s + p.bpm, 0) / w.hr.length;
    expect(Math.abs(plain - 112)).toBeLessThanOrEqual(1);
  });

  it('is time-weighted', () => {
    const hr: HrSample[] = [
      { t: 0, bpm: 100 },
      { t: 10, bpm: 100 },
      { t: 12, bpm: 200 },
    ];
    // (100·10 + 150·2) / 12 = 108.3; a plain mean would say 133.
    expect(avgHr(hr)).toBe(108);
  });

  it('ignores gaps longer than 30 s', () => {
    const hr: HrSample[] = [
      { t: 0, bpm: 100 },
      { t: 2, bpm: 100 },
      { t: 100, bpm: 200 },
      { t: 102, bpm: 200 },
    ];
    expect(avgHr(hr)).toBe(150);
  });

  it('handles empty and single-sample series', () => {
    expect(avgHr([])).toBeNull();
    expect(maxHr([])).toBeNull();
    expect(avgHr([{ t: 0, bpm: 90 }])).toBe(90);
  });
});

describe('zones', () => {
  it('resolves max HR from override, then age', () => {
    expect(resolveMaxHr(30, null)).toBe(190);
    expect(resolveMaxHr(30, 185)).toBe(185);
    expect(resolveMaxHr(null, 178)).toBe(178);
    expect(resolveMaxHr(null, null)).toBeNull();
  });

  it('assigns heart-rate-reserve zones (40/60/85 % of reserve)', () => {
    // resting 60, max 190 → reserve 130: 40 % = 112, 60 % = 138, 85 % = 170.5
    expect(hrrZone(100, 60, 190)).toBe(0);
    expect(hrrZone(112, 60, 190)).toBe(1);
    expect(hrrZone(137, 60, 190)).toBe(1);
    expect(hrrZone(138, 60, 190)).toBe(2);
    expect(hrrZone(170, 60, 190)).toBe(2);
    expect(hrrZone(171, 60, 190)).toBe(3);
    expect(hrrZone(230, 60, 190)).toBe(3);
  });

  it('counts zone minutes like Google Health and skips gaps', () => {
    // resting 60, max 190
    const hr: HrSample[] = [
      { t: 0, bpm: 90 }, // light
      { t: 30, bpm: 120 }, // moderate
      { t: 60, bpm: 150 }, // vigorous
      { t: 90, bpm: 150 }, // vigorous
      { t: 120, bpm: 180 }, // peak
      { t: 150, bpm: 180 }, // 60 s gap follows: ignored
      { t: 210, bpm: 150 },
    ];
    const z = hrrZoneMinutes(hr, 60, 190)!;
    expect([z.light, z.moderate, z.vigorous, z.peak]).toEqual([0.5, 0.5, 1, 0.5]);
    expect(z.zoneMinutes).toBe(Math.round(z.moderate) + 2 * (Math.round(z.vigorous) + Math.round(z.peak)));
  });

  it('needs a valid resting HR and max HR', () => {
    const w = basic();
    expect(hrrZoneMinutes(w.hr, null, 190)).toBeNull();
    expect(hrrZoneMinutes(w.hr, 62, null)).toBeNull();
    expect(hrrZoneMinutes(w.hr, 10, 190)).toBeNull();
    expect(hrrZoneMinutes([], 62, 190)).toBeNull();
  });

  it('adds up to the recorded time for the fixture', () => {
    const w = basic();
    const z = hrrZoneMinutes(w.hr, 62, 190)!;
    const total = z.light + z.moderate + z.vigorous + z.peak;
    expect(total).toBeLessThanOrEqual(6648 / 60 + 1e-9);
    expect(z.zoneMinutes).toBeGreaterThan(0);
  });
});

describe('graph series', () => {
  it('downsamples to ≤ 300 points and smooths', () => {
    const w = basic();
    const s = hrSeries(w.hr);
    expect(s.length).toBeLessThanOrEqual(300);
    expect(s.length).toBeGreaterThan(250);
    for (let i = 1; i < s.length; i++) expect(s[i].t).toBeGreaterThan(s[i - 1].t);
    const max = Math.max(...s.map((p) => p.bpm));
    expect(max).toBeLessThan(135); // averaging flattens the single peak
  });

  it('keeps short series as they are', () => {
    const hr = [0, 1, 2, 3].map((t) => ({ t, bpm: 100 }));
    expect(hrSeries(hr)).toEqual(hr);
  });
});

describe('formatting', () => {
  it('formats distance with two decimals under 10, one above', () => {
    expect(formatDistance(4827.9, 'km')).toBe('4.83 km');
    expect(formatDistance(12345, 'km')).toBe('12.3 km');
    expect(formatDistance(4827.9, 'mi')).toBe('3.00 mi');
  });

  it('formats 12h and 24h times', () => {
    const w = { iso: '', y: 2026, mo: 1, d: 1, h: 0, mi: 5, offsetMin: 0 };
    expect(formatTime(w, false)).toBe('00:05');
    expect(formatTime(w, true)).toBe('12:05 AM');
    expect(formatTime({ ...w, h: 12 }, true)).toBe('12:05 PM');
    expect(formatTime({ ...w, h: 14 }, true)).toBe('2:05 PM');
  });

  it('formats dates from the written calendar date', () => {
    const w = basic();
    expect(formatLongDate(w.start)).toBe('Tue, 20 Oct 2026');
    expect(isoDate(w.start)).toBe('2026-10-20');
  });

  it('builds the export filename', () => {
    expect(exportFilename(slugify('table-tennis'), '2026-10-20')).toBe('sweatshot-table-tennis-2026-10-20.png');
    expect(slugify('Bouldering & Co')).toBe('bouldering-co');
    expect(slugify('Ωμέγα')).toBe('workout');
  });
});

describe('card data', () => {
  const data = buildCardData({
    workout: basic(),
    sport: sportById('table-tennis'),
    title: '',
    location: '',
    hour12: false,
    distanceUnit: 'km',
    age: null,
    restingHr: null,
    maxHrOverride: null,
  });

  it('formats the stat values', () => {
    expect(data.title).toBe('Table tennis');
    expect(data.timeText).toBe('02:02');
    expect(data.stats.duration?.value).toBe('1h 51m');
    expect(data.stats.energy?.value).toBe('496 kcal');
    expect(data.stats.avgHr?.value).toBe('112 bpm');
    expect(data.stats.maxHr?.value).toBe('135 bpm');
    expect(data.endTimeText).toBe('03:53');
    expect(data.stats.timeRange?.value).toBe('02:02–03:53');
    expect(data.zones).toBeNull(); // no zone settings yet
    expect(availableStats(data)).toEqual(['duration', 'energy', 'avgHr', 'maxHr', 'minHr', 'timeRange']);
  });

  it('builds the Messages sentence', () => {
    const opts = { stats: ['duration', 'energy', 'avgHr'] } as CardOptions;
    expect(statSentence(data, visibleStats(data, opts))).toBe('1h 51m of table tennis, 496 kcal, avg 112 bpm');
  });

  it('uses custom sports and titles', () => {
    const custom = sportById(customSportId('Bouldering'));
    expect(custom.name).toBe('Bouldering');
    expect(custom.icon).toBe('exercise');
  });

  it('splits stat rows so any count looks intentional', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => ({ key: 'duration', label: `${i}`, short: '', value: '', number: '', unit: '', phrase: '' }) as StatItem);
    expect(statRows(items(3)).map((r) => r.length)).toEqual([3]);
    expect(statRows(items(4)).map((r) => r.length)).toEqual([2, 2]);
    expect(statRows(items(5)).map((r) => r.length)).toEqual([3, 2]);
    expect(statRows(items(6)).map((r) => r.length)).toEqual([3, 3]);
    expect(splitRows(items(5), 2).map((r) => r.length)).toEqual([2, 2, 1]);
  });
});

describe('preferences', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through localStorage', () => {
    savePrefs({ ...DEFAULT_PREFS, designId: 'receipt', age: 41, accent: '#3DDC97' });
    const p = loadPrefs();
    expect(p.designId).toBe('receipt');
    expect(p.age).toBe(41);
    expect(p.accent).toBe('#3DDC97');
  });

  it('ignores corrupt or out-of-range values', () => {
    localStorage.setItem('sweatshot:prefs:v1', '{not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    localStorage.setItem(
      'sweatshot:prefs:v1',
      JSON.stringify({ designId: 'nope', age: -3, restingHr: 5, stats: [], size: 'huge', accent: 'red', favourites: 'x', appearance: 'neon' }),
    );
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('reads settings saved under the old Statshot key', () => {
    localStorage.setItem('statshot:prefs:v1', JSON.stringify({ age: 33, designId: 'glass' }));
    const p = loadPrefs();
    expect(p.age).toBe(33);
    expect(p.designId).toBe(DEFAULT_PREFS.designId); // retired design falls back
  });

  it('keeps the last 6 recent sports, newest first', () => {
    let r: string[] = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'b', 'g']) r = pushRecent(r, id);
    expect(r).toEqual(['g', 'b', 'f', 'e', 'd', 'c']);
  });

  it('stars up to 5 designs and orders favourites first', () => {
    expect(toggleFavourite(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleFavourite(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleFavourite(['a', 'b', 'c', 'd', 'e'], 'f')).toBeNull();
    const d = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    expect(orderDesigns(d, ['c', 'a']).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});
