import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { buildCardData } from '../src/card-data';
import { prepareCard } from '../src/render/render';
import { DESIGNS, resolveAccent } from '../src/render/registry';
import type { CardData, CardDesign, CardOptions, StatKey } from '../src/render/types';
import { sportById } from '../src/sports';
import { parseTcx } from '../src/tcx/parse';
import { fixture } from './helpers';

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
  for (const hour12 of [false, true]) {
    const data = buildCardData({ workout: r.workouts[0], sport: sportById('table-tennis'), title: '', location: '', hour12, distanceUnit: 'km', age: 30, restingHr: 62, maxHrOverride: null });
    for (const design of DESIGNS) {
      for (const stats of STAT_SETS) {
        const bigs: StatKey[] = design.supportsBigStat ? ['duration', 'energy', 'avgHr', 'maxHr'] : ['duration'];
        for (const bigStat of bigs) {
          it(`${design.id} · ${stats.join('+')} · big ${bigStat} · ${hour12 ? '12h' : '24h'}`, async () => {
            const opts: CardOptions = { theme: 'dark', background: 'solid', accent: resolveAccent(design, null), stats, showLogo: true, showGraph: true, bigStat };
            await prepareCard(design, data, opts);
            const texts = drawnText(design, data, opts);
            const tokens = new Set<string>([clock(data.timeText), clock(data.endTimeText), data.shortDate]);
            for (const k of stats) {
              const s = data.stats[k];
              if (s && k !== 'timeRange') tokens.add(s.number);
            }
            const repeated = [...tokens].filter((t) => count(texts, t) > 1);
            expect(repeated, `drawn: ${JSON.stringify(texts)}`).toEqual([]);
          });
        }
      }
    }
  }
});
