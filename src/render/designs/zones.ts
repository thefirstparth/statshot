import { BRAND, drawFitText, fillRoundRect, fitText, roundRectPath } from '../canvas';
import { DISPLAY, SANS } from '../font-faces';
import { formatDuration, hrrZoneStarts, ZONE_COLORS, ZONE_NAMES } from '../../tcx/stats';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, drawSportBadge, metaLine } from './shared';

const PAD = 64;
const BADGE = 120;
const BIG = 220;
const BAR_H = 84;
const ROW_H = 84;

const colors = (opts: CardOptions) =>
  opts.theme === 'dark'
    ? { canvas: '#0F1012', card: '#1C1D20', ink: '#F1F2F4', muted: '#A7ABB1', line: '#2E3034', empty: '#3A3C40' }
    : { canvas: '#F6F7F9', card: '#FFFFFF', ink: '#1A1C1E', muted: '#5B6066', line: '#ECEEF1', empty: '#E3E5E8' };

const H = PAD + BADGE + 44 + BIG * 0.85 + 44 + BAR_H + 44 + ROW_H * 4 + 40 + 34 + PAD;

function ranges(data: CardData): string[] {
  if (!data.zones) return ['', '', '', ''];
  const [m, v, p] = hrrZoneStarts(data.zones.restingHr, data.zones.maxHr);
  return [`under ${m}`, `${m}–${v - 1}`, `${v}–${p - 1}`, `${p}+ bpm`];
}

export const zones: CardDesign = {
  id: 'zones',
  name: 'Zones',
  blurb: 'Minutes in each heart-rate zone',
  needsHr: true,
  needsZones: true,
  supportsAccent: false,

  background(opts) {
    return colors(opts).canvas;
  },

  measure() {
    return { h: H };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(opts);
    const z = data.zones;
    const x = box.x + PAD;
    const w = box.w - PAD * 2;
    fillRoundRect(ctx, box.x, box.y, box.w, H, 64, c.card);

    drawSportBadge(ctx, data, x, box.y + PAD, BADGE, opts.theme === 'dark');
    const tx = x + BADGE + 28;
    const tw = w - BADGE - 28;
    const ts = fitText(ctx, data.title, tw, { family: SANS, weight: 700, size: 64 }, 0.6).size;
    const top = box.y + PAD + (BADGE - (ts * 1.05 + 8 + 34 * 1.2)) / 2;
    drawFitText(ctx, data.title, tx, baseline(top, ts), tw, { family: SANS, weight: 700, size: 64 }, c.ink, 'left', 0.6);
    drawFitText(ctx, metaLine(data), tx, baseline(top + ts * 1.05 + 8, 34), tw, { family: SANS, weight: 400, size: 34 }, c.muted);

    // Headline: zone minutes.
    let y = box.y + PAD + BADGE + 44;
    const big = z ? String(z.zoneMinutes) : '–';
    const numW = drawFitText(ctx, big, x - 4, y + BIG * 0.8, w * 0.55, { family: DISPLAY, weight: 800, size: BIG }, c.ink, 'left', 0.5);
    const lx = x + numW + 28;
    drawFitText(ctx, 'zone minutes', lx, y + BIG * 0.8 - 52, w - (lx - x), { family: SANS, weight: 700, size: 44 }, c.ink);
    drawFitText(ctx, `Moderate or harder, of ${formatDuration(data.durationSec)}`, lx, y + BIG * 0.8, w - (lx - x), { family: SANS, weight: 400, size: 30 }, c.muted);
    y += BIG * 0.85 + 44;

    // Proportional bar.
    const mins = z ? [z.light, z.moderate, z.vigorous, z.peak] : [1, 1, 1, 1];
    const total = mins.reduce((a, b) => a + b, 0) || 1;
    const visible = mins.map((m, i) => ({ m, i })).filter((e) => e.m > 0);
    const gaps = (visible.length - 1) * 8;
    ctx.save();
    roundRectPath(ctx, x, y, w, BAR_H, BAR_H / 2);
    ctx.clip();
    let bx = x;
    for (const { m, i } of visible) {
      const bw = ((w - gaps) * m) / total;
      ctx.fillStyle = z ? ZONE_COLORS[i] : c.empty;
      ctx.fillRect(bx, y, bw, BAR_H);
      bx += bw + 8;
    }
    ctx.restore();
    y += BAR_H + 44;

    // Zone rows.
    const r = ranges(data);
    for (let i = 3; i >= 0; i--) {
      const row = 3 - i;
      const ry = y + row * ROW_H;
      fillRoundRect(ctx, x, ry + ROW_H / 2 - 16, 32, 32, 10, z ? ZONE_COLORS[i] : c.empty);
      drawFitText(ctx, ZONE_NAMES[i], x + 56, ry + ROW_H / 2 + 14, 300, { family: SANS, weight: 600, size: 40 }, c.ink);
      drawFitText(ctx, r[i], x + w - 170, ry + ROW_H / 2 + 11, 300, { family: SANS, weight: 400, size: 30 }, c.muted, 'right');
      drawFitText(ctx, z ? `${Math.round(mins[i])}m` : '–', x + w, ry + ROW_H / 2 + 15, 150, { family: SANS, weight: 800, size: 44 }, c.ink, 'right');
      if (row < 3) {
        ctx.fillStyle = c.line;
        ctx.fillRect(x, ry + ROW_H - 1, w, 2);
      }
    }
    y += ROW_H * 4 + 40;

    const note = z
      ? `Resting heart rate ${z.restingHr} bpm${opts.showLogo ? ` · ${BRAND}` : ''}`
      : 'Add resting heart rate and age in Settings';
    drawFitText(ctx, note, x, baseline(y, 28), w, { family: SANS, weight: 400, size: 28 }, c.muted);
  },
};
