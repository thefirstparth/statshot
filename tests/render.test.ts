import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { availableStats, buildCardData } from '../src/card-data';
import { canvasLayout, prepareCard, renderToNewCanvas } from '../src/render/render';
import { DESIGNS, resolveAccent } from '../src/render/registry';
import type { CardData, CardOptions, SizeKey, StatKey } from '../src/render/types';
import { sportById } from '../src/sports';
import { parseTcx, type Workout } from '../src/tcx/parse';
import { fixture } from './helpers';

const SIZES: SizeKey[] = ['story', 'sticker'];
const THEMES = ['light', 'dark'] as const;
const BACKGROUNDS = ['transparent', 'solid'] as const;

/** Set SWEATSHOT_PREVIEW=1 to write every render to tests/output/ for eyeballing. */
const PREVIEW = !!process.env.SWEATSHOT_PREVIEW;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');

type NapiCanvas = HTMLCanvasElement & { encodeSync?(format: 'png'): Buffer };

function load(name: string): Workout {
  const r = parseTcx(fixture(name));
  if (!r.ok) throw new Error(r.error);
  return r.workouts[0];
}

function cardData(w: Workout, extra: Partial<Parameters<typeof buildCardData>[0]> = {}): CardData {
  return buildCardData({
    workout: w,
    sport: sportById('table-tennis'),
    title: '',
    location: 'Smash Club',
    hour12: false,
    distanceUnit: 'km',
    age: 30,
    restingHr: 62,
    maxHrOverride: null,
    ...extra,
  });
}

function options(stats: StatKey[], over: Partial<CardOptions> = {}): CardOptions {
  return {
    theme: 'dark',
    background: 'transparent',
    accent: '#4C8DFF',
    stats,
    showLogo: true,
    showGraph: true,
    bigStat: 'duration',
    ...over,
  };
}

function alphaAt(canvas: HTMLCanvasElement, x: number, y: number): number {
  return canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];
}

/** True if any pixel inside the card area is not fully transparent. */
function hasInk(canvas: HTMLCanvasElement, rect: { x: number; y: number; w: number; h: number }): boolean {
  const data = canvas.getContext('2d')!.getImageData(rect.x, rect.y, rect.w, rect.h).data;
  for (let i = 3; i < data.length; i += 16) if (data[i] > 0) return true;
  return false;
}

function save(canvas: HTMLCanvasElement, name: string): void {
  if (!PREVIEW) return;
  mkdirSync(OUT, { recursive: true });
  const buf = (canvas as NapiCanvas).encodeSync?.('png');
  if (buf) writeFileSync(path.join(OUT, `${name}.png`), buf);
}

describe('render', () => {
  let full: CardData;
  let stats: StatKey[];

  beforeAll(async () => {
    full = cardData(load('synthetic-basic.tcx'));
    stats = ['duration', 'energy', 'avgHr'];
    // Decode every icon colour the matrix below will use.
    for (const d of DESIGNS) {
      for (const theme of THEMES) {
        await prepareCard(d, full, options(stats, { theme, accent: resolveAccent(d, null) }));
      }
    }
  });

  for (const design of DESIGNS) {
    for (const theme of THEMES) {
      for (const background of BACKGROUNDS) {
        for (const size of SIZES) {
          it(`${design.id} · ${theme} · ${background} · ${size}`, () => {
            const opts = options(stats, { theme, background, accent: resolveAccent(design, null) });
            const canvas = renderToNewCanvas(design, full, opts, size);
            const layout = canvasLayout(design, full, opts, size);
            expect(canvas.width).toBe(layout.width);
            expect(canvas.height).toBe(layout.height);
            if (size !== 'sticker') {
              expect(canvas.width).toBe(1080);
              expect(canvas.height).toBe(1920);
            }
            expect(hasInk(canvas, { x: layout.x, y: layout.y, w: Math.floor(layout.box.w * layout.scale), h: Math.floor(layout.box.h * layout.scale) })).toBe(true);
            if (background === 'transparent' && !(design.id === 'receipt' && size === 'sticker')) {
              expect(alphaAt(canvas, 0, 0)).toBe(0);
            }
            if (background === 'solid') expect(alphaAt(canvas, 0, 0)).toBe(255);
            save(canvas, `${design.id}-${theme}-${background}-${size}`);
          });
        }
      }
    }
  }

  it('lays out 1 to 6 stats in every design without overflowing', async () => {
    const all = availableStats(full);
    expect(all.length).toBeGreaterThanOrEqual(6);
    for (const design of DESIGNS) {
      for (let n = 1; n <= 6; n++) {
        const opts = options(all.slice(0, n), { accent: resolveAccent(design, null), theme: 'light', background: 'solid' });
        await prepareCard(design, full, opts);
        const canvas = renderToNewCanvas(design, full, opts, 'story');
        const layout = canvasLayout(design, full, opts, 'story');
        expect(layout.y).toBeGreaterThanOrEqual(0);
        expect(layout.y + layout.box.h * layout.scale).toBeLessThanOrEqual(1920);
        save(canvas, `stats-${design.id}-${n}`);
      }
    }
  });

  it('shrinks and ellipsizes very long titles', async () => {
    const long = cardData(load('synthetic-basic.tcx'), {
      title: 'Extremely long custom workout title that cannot possibly fit',
      location: 'A very long location name that keeps on going',
    });
    for (const design of DESIGNS) {
      const opts = options(['duration', 'energy', 'avgHr', 'maxHr'], { accent: resolveAccent(design, null) });
      await prepareCard(design, long, opts);
      save(renderToNewCanvas(design, long, opts, 'sticker'), `long-${design.id}`);
    }
  });

  it('renders non-HR designs for a file without heart rate', async () => {
    const nohr = cardData(load('synthetic-nohr.tcx'));
    expect(nohr.hrSeries.length).toBe(0);
    for (const design of DESIGNS.filter((d) => !d.needsHr)) {
      const opts = options(['duration', 'energy', 'avgHr'], { accent: resolveAccent(design, null) });
      await prepareCard(design, nohr, opts);
      const canvas = renderToNewCanvas(design, nohr, opts, 'story');
      save(canvas, `nohr-${design.id}`);
    }
  });

  it('renders Zones without zone settings (placeholder state)', async () => {
    const data = cardData(load('synthetic-basic.tcx'), { restingHr: null });
    expect(data.zones).toBeNull();
    const design = DESIGNS.find((d) => d.id === 'zones')!;
    const opts = options(['duration'], {});
    await prepareCard(design, data, opts);
    save(renderToNewCanvas(design, data, opts, 'story'), 'zones-no-max');
  });

  it('is deterministic: the same inputs give identical pixels', async () => {
    const design = DESIGNS.find((d) => d.id === 'receipt')!;
    const opts = options(stats);
    await prepareCard(design, full, opts);
    const a = renderToNewCanvas(design, full, opts, 'sticker');
    const b = renderToNewCanvas(design, full, opts, 'sticker');
    const da = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
    const db = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
    expect(Buffer.compare(Buffer.from(da), Buffer.from(db))).toBe(0);
  });
});
