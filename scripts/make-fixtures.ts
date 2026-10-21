/**
 * Generates the synthetic TCX fixtures in tests/fixtures/ (deterministic, seeded).
 * Run: npm run fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seededRandom } from '../src/render/canvas.ts';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');

type Point = { t: number; hr?: number; dist?: number; lat?: number; lon?: number; alt?: number; speed?: number };
type Lap = { start: number; seconds: number; distance: number; calories: number; avgHr?: number; maxHr?: number; points: Point[] };
type Activity = { sport: 'Running' | 'Biking' | 'Other'; wallStart: [number, number, number, number, number, number]; offset: string; laps: Lap[] };

/** Formats `start + t` seconds as a wall-clock ISO string with the given offset. */
function iso(wall: Activity['wallStart'], t: number, offset: string): string {
  const [y, mo, d, h, mi, s] = wall;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s) + Math.round(t * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}.${p(date.getUTCMilliseconds(), 3)}${offset}`
  );
}

function tcx(activities: Activity[]): string {
  const acts = activities
    .map((a) => {
      const laps = a.laps
        .map((lap) => {
          const points = lap.points
            .map((p) => {
              const parts = [`            <Time>${iso(a.wallStart, p.t, a.offset)}</Time>`];
              if (p.lat !== undefined && p.lon !== undefined) {
                parts.push(`            <Position><LatitudeDegrees>${p.lat.toFixed(6)}</LatitudeDegrees><LongitudeDegrees>${p.lon.toFixed(6)}</LongitudeDegrees></Position>`);
              }
              if (p.alt !== undefined) parts.push(`            <AltitudeMeters>${p.alt.toFixed(1)}</AltitudeMeters>`);
              if (p.dist !== undefined) parts.push(`            <DistanceMeters>${p.dist.toFixed(1)}</DistanceMeters>`);
              if (p.hr !== undefined) parts.push(`            <HeartRateBpm><Value>${p.hr}</Value></HeartRateBpm>`);
              if (p.speed !== undefined) {
                parts.push(`            <Extensions><ns3:TPX><ns3:Speed>${p.speed.toFixed(2)}</ns3:Speed></ns3:TPX></Extensions>`);
              }
              return `          <Trackpoint>\n${parts.join('\n')}\n          </Trackpoint>`;
            })
            .join('\n');
          const hrSummary =
            (lap.avgHr !== undefined ? `\n        <AverageHeartRateBpm><Value>${lap.avgHr}</Value></AverageHeartRateBpm>` : '') +
            (lap.maxHr !== undefined ? `\n        <MaximumHeartRateBpm><Value>${lap.maxHr}</Value></MaximumHeartRateBpm>` : '');
          return `      <Lap StartTime="${iso(a.wallStart, lap.start, a.offset)}">
        <TotalTimeSeconds>${lap.seconds.toFixed(1)}</TotalTimeSeconds>
        <DistanceMeters>${lap.distance.toFixed(1)}</DistanceMeters>
        <Calories>${lap.calories}</Calories>${hrSummary}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${points}
        </Track>
      </Lap>`;
        })
        .join('\n');
      return `    <Activity Sport="${a.sport}">
      <Id>${iso(a.wallStart, 0, a.offset)}</Id>
${laps}
      <Creator xsi:type="Device_t" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Name>Synthetic Band</Name><UnitId>0</UnitId><ProductID>0</ProductID>
      </Creator>
    </Activity>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities>
${acts}
  </Activities>
</TrainingCenterDatabase>
`;
}

/**
 * Heart-rate series with an exact integer mean, a single minimum and maximum.
 * The shape: warm-up, rallies with rests, one peak, cool-down.
 */
function hrSeries(n: number, opts: { seed: number; mean: number; min: number; max: number }): number[] {
  const rand = seededRandom(opts.seed);
  const raw: number[] = [];
  let wobble = 0;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const warm = Math.min(1, f / 0.06);
    const cool = Math.min(1, (1 - f) / 0.05);
    const rally = Math.sin(i / 23) * 7 + Math.sin(i / 71) * 5 + Math.sin(i / 9.3) * 2;
    wobble = wobble * 0.92 + (rand() - 0.5) * 2.4;
    raw.push(opts.min + (opts.mean + 3 - opts.min) * warm * cool + rally * warm * cool + wobble);
  }
  const shift = opts.mean - raw.reduce((a, b) => a + b, 0) / n;
  const v = raw.map((x) => Math.round(Math.min(opts.max - 1, Math.max(opts.min + 1, x + shift))));
  const peak = Math.floor(n * 0.62);
  v[0] = opts.min;
  v[peak] = opts.max;
  let diff = opts.mean * n - v.reduce((a, b) => a + b, 0);
  while (diff !== 0) {
    const i = 1 + Math.floor(rand() * (n - 1));
    if (i === peak) continue;
    if (diff > 0 && v[i] < opts.max - 1) {
      v[i]++;
      diff--;
    } else if (diff < 0 && v[i] > opts.min + 1) {
      v[i]--;
      diff++;
    }
  }
  return v;
}

function basic(): string {
  const seconds = 6651;
  const n = Math.floor(seconds / 2); // samples 2 s apart from t = 0
  const hr = hrSeries(n, { seed: 20261020, mean: 112, min: 82, max: 135 });
  return tcx([
    {
      sport: 'Other',
      wallStart: [2026, 10, 20, 2, 2, 30],
      offset: '+05:30',
      laps: [{ start: 0, seconds, distance: 0, calories: 496, points: hr.map((bpm, i) => ({ t: i * 2, hr: bpm })) }],
    },
  ]);
}

function multilap(): string {
  const rand = seededRandom(314);
  const lapSecs = [420, 435, 410];
  const lapDist = 1609.34;
  const laps: Lap[] = [];
  let t = 0;
  let dist = 0;
  lapSecs.forEach((secs, li) => {
    const points: Point[] = [];
    const hrs: number[] = [];
    for (let s = 0; s <= secs; s += 5) {
      const bpm = Math.round(140 + li * 6 + Math.sin((t + s) / 40) * 6 + rand() * 4);
      hrs.push(bpm);
      points.push({
        t: t + s,
        hr: bpm,
        dist: dist + (lapDist * s) / secs,
        lat: 40.7128 + (t + s) * 0.00001,
        lon: -74.006 + (t + s) * 0.00001,
        alt: 12 + Math.sin((t + s) / 60) * 3,
        speed: lapDist / secs,
      });
    }
    laps.push({
      start: t,
      seconds: secs,
      distance: lapDist,
      calories: [98, 102, 95][li],
      avgHr: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
      maxHr: Math.max(...hrs),
      points,
    });
    t += secs;
    dist += lapDist;
  });
  return tcx([{ sport: 'Running', wallStart: [2026, 3, 14, 7, 15, 0], offset: '-04:00', laps }]);
}

function noHr(): string {
  const points: Point[] = [];
  for (let t = 0; t <= 2880; t += 10) points.push({ t });
  return tcx([
    { sport: 'Other', wallStart: [2026, 6, 2, 18, 40, 0], offset: '+01:00', laps: [{ start: 0, seconds: 2880, distance: 0, calories: 210, points }] },
  ]);
}

function multiActivity(): string {
  const rand = seededRandom(77);
  const series = (secs: number, base: number) => {
    const pts: Point[] = [];
    for (let t = 0; t <= secs; t += 4) pts.push({ t, hr: Math.round(base + Math.sin(t / 50) * 10 + rand() * 5) });
    return pts;
  };
  return tcx([
    { sport: 'Biking', wallStart: [2026, 9, 1, 18, 30, 0], offset: '+02:00', laps: [{ start: 0, seconds: 3600, distance: 24500, calories: 640, points: series(3600, 128) }] },
    { sport: 'Other', wallStart: [2026, 9, 2, 6, 45, 0], offset: '+02:00', laps: [{ start: 0, seconds: 1800, distance: 0, calories: 220, points: series(1800, 118) }] },
  ]);
}

const NOT_TCX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="statshot-tests" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Not a TCX file</name></trk>
</gpx>
`;

mkdirSync(OUT, { recursive: true });
const files: Record<string, string> = {
  'synthetic-basic.tcx': basic(),
  'synthetic-multilap.tcx': multilap(),
  'synthetic-nohr.tcx': noHr(),
  'synthetic-multi-activity.tcx': multiActivity(),
  'not-tcx.xml': NOT_TCX,
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(path.join(OUT, name), content);
  console.log(`wrote tests/fixtures/${name} (${(content.length / 1024).toFixed(0)} KB)`);
}
