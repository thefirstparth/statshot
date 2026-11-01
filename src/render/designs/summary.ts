import { drawFitText, drawLogo, fillRoundRect, rgba, setFont, visibleStats, type FontSpec } from '../canvas';
import { measureContext } from '../env';
import { SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import { accentInk } from '../palette';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { drawZoneLegend, drawZoneLine } from '../zone-graph';
import { baseline, drawSportBadge, shortPlace, showsTimeStat, STAT_ICONS } from './shared';
import { drawTimeAxis, hourTicks, legendItems, drawValue, sharedValueSize, titleLines, type ValueStyle } from './trace';

type Ctx = CanvasRenderingContext2D;

const PAD = 64;
const BADGE = 152;
const BADGE_GAP = 36;
const TITLE = 72;
const SUB = 34;
const SUB_GAP = 14;
const HEAD_GAP = 48;
const GAP = 24;
const TILE_TOP = 36;
const TILE_X = 40;
const TILE_BOTTOM = 40;
const LABEL = 30;
const ICON = 40;
const VALUE_GAP = 24;
const VALUE: ValueStyle = { size: 76, unitRatio: 0.45 };
const TILE_H = TILE_TOP + ICON + VALUE_GAP + VALUE.size + TILE_BOTTOM;
const G_TOP = 32;
const G_X = 36;
const G_BOTTOM = 32;
const G_HEAD = 30;
const G_HEAD_GAP = 20;
const G_LINE = 192;
const AXIS = 22;
const AXIS_GAP = 12;
const LEGEND = 24;
const LEGEND_GAP = 20;
const LOGO = 26;

const titleFont: FontSpec = { family: SANS, weight: 700, size: TITLE };
const subFont: FontSpec = { family: SANS, weight: 400, size: SUB };

const colors = (opts: CardOptions) =>
  opts.theme === 'dark'
    ? { canvas: '#0F1012', card: '#1C1D20', tile: '#26282C', ink: '#F1F2F4', muted: '#A7ABB1', faint: '#6B7078' }
    : { canvas: '#F6F7F9', card: '#FFFFFF', tile: '#F1F3F5', ink: '#1A1C1E', muted: '#5B6066', faint: '#9AA0A8' };

function rows(stats: StatItem[]): StatItem[][] {
  const out: StatItem[][] = [];
  for (let i = 0; i < stats.length; i += 2) out.push(stats.slice(i, i + 2));
  return out;
}

/**
 * "Sat 31 Oct · 1:11–4:04 AM", date only when the time-range stat is on the card (R1). A place
 * joins the line when it fits at full size, otherwise it takes a second line.
 */
function subLines(ctx: Ctx, data: CardData, opts: CardOptions, maxW: number): string[] {
  const range = data.stats.timeRange?.value ?? `${data.timeText}–${data.endTimeText}`;
  const main = [`${data.weekday} ${data.shortDate}`, data.sessionsText, showsTimeStat(data, opts) ? '' : range].filter(Boolean).join(' · ');
  const place = shortPlace(data);
  if (!place) return [main];
  const joined = `${main} · ${place}`;
  setFont(ctx, subFont);
  return ctx.measureText(joined).width <= maxW ? [joined] : [main, place];
}

function layout(ctx: Ctx, width: number, data: CardData, opts: CardOptions) {
  const tw = width - PAD * 2 - BADGE - BADGE_GAP;
  const head = titleLines(ctx, data.title, tw, titleFont, 2);
  const sub = subLines(ctx, data, opts, tw);
  const blockH = head.lines.length * head.size * 1.05 + SUB_GAP + sub.length * SUB * 1.25;
  const headH = Math.max(BADGE, blockH);
  const r = rows(visibleStats(data, opts));
  const gridTop = PAD + headH + HEAD_GAP;
  const gridH = r.length * TILE_H + Math.max(0, r.length - 1) * GAP;
  const graph = opts.showGraph && data.hrSeries.length > 1;
  const legend = graph ? legendItems(data, opts) : [];
  const axis = graph && hourTicks(data).length > 0;
  const graphTop = gridTop + gridH + GAP;
  const lineTop = G_TOP + G_HEAD * 1.2 + G_HEAD_GAP;
  const axisTop = lineTop + G_LINE + AXIS_GAP;
  const legendTop = (axis ? axisTop + AXIS * 1.2 : lineTop + G_LINE) + LEGEND_GAP;
  const graphH = (legend.length > 0 ? legendTop + LEGEND * 1.2 : axis ? axisTop + AXIS * 1.2 : lineTop + G_LINE) + G_BOTTOM;
  const afterGraph = graph ? graphTop + graphH : gridTop + gridH;
  const logoTop = afterGraph + 44;
  const h = (opts.showLogo ? logoTop + LOGO * 1.2 : afterGraph) + PAD;
  return { tw, head, sub, blockH, headH, rows: r, gridTop, graph, legend, axis, graphTop, graphH, lineTop, axisTop, legendTop, logoTop, h };
}

export const summary: CardDesign = {
  id: 'summary',
  name: 'Summary',
  blurb: 'Big title, your stats in a tidy grid',
  supportsAccent: true,
  supportsGraph: true,

  background(opts) {
    return colors(opts).canvas;
  },

  measure(width, data, opts) {
    return { h: Math.round(layout(measureContext(), width, data, opts).h) };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(opts);
    const L = layout(ctx, box.w, data, opts);
    const accent = accentInk(opts);
    fillRoundRect(ctx, box.x, box.y, box.w, L.h, 72, c.card);

    // Header: sport sticker, title, date line.
    drawSportBadge(ctx, data, box.x + PAD, box.y + PAD + (L.headH - BADGE) / 2, BADGE, opts);
    const tx = box.x + PAD + BADGE + BADGE_GAP;
    let y = box.y + PAD + (L.headH - L.blockH) / 2;
    for (const line of L.head.lines) {
      drawFitText(ctx, line, tx, baseline(y, L.head.size), L.tw, { ...titleFont, size: L.head.size }, c.ink);
      y += L.head.size * 1.05;
    }
    y += SUB_GAP;
    for (const line of L.sub) {
      drawFitText(ctx, line, tx, baseline(y, SUB), L.tw, subFont, c.muted, 'left', 0.8);
      y += SUB * 1.25;
    }

    // Stat tiles, two per row; a lone last tile spans the row. Every value shares one size.
    const inner = box.w - PAD * 2;
    const half = (inner - GAP) / 2;
    const fits = L.rows.flatMap((row) => row.map((item) => ({ item, maxW: (row.length === 1 ? inner : half) - TILE_X * 2 })));
    const size = sharedValueSize(ctx, fits, VALUE);
    L.rows.forEach((row, ri) => {
      const ty = box.y + L.gridTop + ri * (TILE_H + GAP);
      const w = row.length === 1 ? inner : half;
      row.forEach((item, i) => {
        const x = box.x + PAD + i * (w + GAP);
        fillRoundRect(ctx, x, ty, w, TILE_H, 48, c.tile);
        const maxW = w - TILE_X * 2;
        drawIconPath(ctx, STAT_ICONS[item.key], accent, x + TILE_X, ty + TILE_TOP, ICON);
        drawFitText(ctx, item.label, x + TILE_X + ICON + 14, ty + TILE_TOP + ICON * 0.5 + LABEL * 0.36, maxW - ICON - 14, { family: SANS, weight: 500, size: LABEL }, c.muted, 'left', 0.7);
        drawValue(ctx, item, x + TILE_X, ty + TILE_TOP + ICON + VALUE_GAP + VALUE.size * 0.8, maxW, size, VALUE, c.ink, c.muted);
      });
    });

    if (L.graph) {
      const gx = box.x + PAD;
      const gy = box.y + L.graphTop;
      fillRoundRect(ctx, gx, gy, inner, L.graphH, 48, c.tile);
      drawFitText(ctx, 'Heart rate', gx + G_X, baseline(gy + G_TOP, G_HEAD), inner - G_X * 2, { family: SANS, weight: 500, size: G_HEAD }, c.muted);
      const series = data.hrSeries;
      let lo = Infinity;
      let hi = -Infinity;
      for (const s of series) {
        lo = Math.min(lo, s.bpm);
        hi = Math.max(hi, s.bpm);
      }
      const span = Math.max(12, hi - lo);
      const rect = { x: gx + G_X, y: gy + L.lineTop, w: inner - G_X * 2, h: G_LINE };
      drawZoneLine(ctx, data, rect, opts, { lineWidth: 5, fill: true, scale: { min: lo - span * 0.08, max: hi + span * 0.1 } });
      // Whole hours only: the header already carries the start and end.
      if (L.axis) drawTimeAxis(ctx, data, rect.x, rect.w, baseline(gy + L.axisTop, AXIS), { family: SANS, size: AXIS }, c.faint, false);
      if (L.legend.length > 0) {
        drawZoneLegend(ctx, L.legend, rect.x, baseline(gy + L.legendTop, LEGEND), rect.w, { size: LEGEND, ink: c.ink, muted: c.muted, family: SANS });
      }
    }

    if (opts.showLogo) drawLogo(ctx, box.x + box.w / 2, box.y + L.logoTop + LOGO * 0.6, LOGO, rgba(c.ink, 0.55), 'center');
  },
};
