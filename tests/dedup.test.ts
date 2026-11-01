import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { buildCardData } from '../src/card-data';
import { prepareCard } from '../src/render/render';
import { DESIGNS, resolveAccent } from '../src/render/registry';
import type { CardData, CardDesign, CardOptions, StatKey } from '../src/render/types';
import { sportById } from '../src/sports';
import { parseTcx } from '../src/tcx/parse';
import { combineSessions } from '../src/tcx/merge';
import { fixture, session } from './helpers';

/** Draws a card into a context that records every string it prints. */
function drawnText(design: CardDesign, data: CardData, opts: CardOptions): string[] {
  const canvas = createCanvas(1000, 4000);
  const real = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  const texts: string[] = [];
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === 'fillText' || prop === 'strokeText') {
        return (text: string, ...rest: number[]) => {
          texts.push(String(text));
          return (target[prop] as (t: string, ...r: number[]) => void).call(target, text, ...rest);
        };
      }
      const v = Reflect.get(target, prop, target) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target);
    },
  });
  const h = design.measure(920, data, opts).h;
  design.draw(ctx, { x: 0, y: 0, w: 920, h }, data, opts);
  return texts;
}

/** How often `token` appears as a whole value (not inside a longer number or word). */
function count(texts: string[], token: string): number {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00A0]');
  const re = new RegExp(`(?<![\\w:.])${esc}(?![\\w:])`, 'g');
  return texts.reduce((n, t) => n + (t.match(re)?.length ?? 0), 0);
}

const clock = (t: string) => t.replace(/\s?[AP]M$/, '');

const STAT_SETS: StatKey[][] = [
  ['duration', 'energy', 'avgHr'],
  ['duration', 'energy', 'avgHr', 'maxHr', 'zoneMin', 'timeRange'],
  ['energy', 'avgHr', 'minHr', 'timeRange'],
];

describe('no value is printed twice on a card', () => {
  const r = parseTcx(fixture('synthetic-basic.tcx'));
  if (!r.ok) throw new Error(r.error);
  // One session, then the same day played as two and three separate sessions.
  const wave = (base: number) => (t: number) => base + 25 * Math.sin(t / 240);
  const days = [
    { name: '1 session', workout: r.workouts[0] },
    { name: '2 sessions', workout: combineSessions([session('2026-10-31T18:02:00+05:30', 52, wave(118)), session('2026-10-31T21:15:00+05:30', 38, wave(132))]) },
    {
      name: '3 sessions',
      workout: combineSessions([
        session('2026-10-31T07:10:00+05:30', 25, wave(110)),
        session('2026-10-31T18:00:00+05:30', 60, wave(125)),
        session('2026-11-01T00:40:00+05:30', 45, wave(140)),
      ]),
    },
  ];
  for (const [hour12, day] of [false, true].flatMap((h) => days.map((d) => [h, d] as const))) {
    const data = buildCardData({ workout: day.workout, sport: sportById('table-tennis'), title: '', location: '', hour12, distanceUnit: 'km', age: 30, restingHr: 62, maxHrOverride: null });
    for (const design of DESIGNS) {
      for (const stats of STAT_SETS) {
        const bigs: StatKey[] = design.supportsBigStat ? ['duration', 'energy', 'avgHr', 'maxHr'] : ['duration'];
        for (const bigStat of bigs) {
          it(`${design.id} · ${day.name} · ${stats.join('+')} · big ${bigStat} · ${hour12 ? '12h' : '24h'}`, async () => {
            const opts: CardOptions = { theme: 'dark', background: 'solid', accent: resolveAccent(design, null), stats, showLogo: true, showGraph: true, bigStat };
            await prepareCard(design, data, opts);
            const texts = drawnText(design, data, opts);
            const tokens = new Set<string>([clock(data.timeText), clock(data.endTimeText), data.shortDate]);
            if (data.sessionsText) tokens.add(data.sessionsText);
            for (const k of stats) {
              const s = data.stats[k];
              if (s && k !== 'timeRange') tokens.add(s.number);
            }
            // Several sessions: the card says so (Receipt by one SERVED line per session).
            if (data.sessionsText) {
              if (design.id === 'receipt') expect(texts.filter((t) => t.startsWith('SERVED')).length).toBe(data.sessions.length);
              else expect(count(texts.map((t) => t.toLowerCase()), data.sessionsText), `drawn: ${JSON.stringify(texts)}`).toBe(1);
            }
            const repeated = [...tokens].filter((t) => count(texts, t) > 1);
            expect(repeated, `drawn: ${JSON.stringify(texts)}`).toEqual([]);
          });
        }
      }
    }
  }
});
