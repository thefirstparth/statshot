import { drawFitText, drawLogo, fillRoundRect, rgba, roundRectPath, setFont, visibleStats, wrapText, type FontSpec } from '../canvas';
import { measureContext } from '../env';
import { SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import { accentInk } from '../palette';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { drawZoneLegend, drawZoneLine, zoneItems, type ZoneItem } from '../zone-graph';
import { baseline, metaLine, showsStat, showsTimeStat } from './shared';

type Ctx = CanvasRenderingContext2D;

// ── Helpers shared by Heart trace and Summary ────────────────────────────────

/** Wraps to at most maxLines, shrinking the font a little first if needed. */
export function titleLines(ctx: Ctx, text: string, maxW: number, f: FontSpec, maxLines = 2): { lines: string[]; size: number } {
  setFont(ctx, f);
  let lines = wrapText(ctx, text, maxW, 99);
  if (lines.length <= 1) return { lines, size: f.size };
  const smaller = { ...f, size: Math.round(f.size * 0.82) };
  setFont(ctx, smaller);
  lines = wrapText(ctx, text, maxW, maxLines);
  return { lines, size: smaller.size };
}

const is12h = (data: CardData) => /[AP]M$/.test(data.timeText);

/**
 * Number and unit for a stat value. The time range's shared AM/PM goes small like a unit
 * ("1:11–4:04" + "AM"), so it sits with the other numbers instead of forcing them all smaller.
 */
export function valueParts(item: StatItem): { num: string; unit: string } {
  if (item.key === 'timeRange') {
    const m = /^([^AP]*\S)\s([AP]M)$/.exec(item.value);
    if (m) return { num: m[1], unit: m[2] };
    return { num: item.value, unit: '' };
  }
  return item.number ? { num: item.number, unit: item.unit } : { num: item.value, unit: '' };
}

export type ValueStyle = { size: number; unitRatio: number; weight?: number };

function partsWidth(ctx: Ctx, item: StatItem, size: number, s: ValueStyle): number {
  const { num, unit } = valueParts(item);
  setFont(ctx, { family: SANS, weight: s.weight ?? 700, size });
  let w = ctx.measureText(num).width;
  if (unit) {
    setFont(ctx, { family: SANS, weight: 500, size: size * s.unitRatio });
    w += size * 0.14 + ctx.measureText(unit).width;
  }
  return w;
}

/** One value size for every stat on the card: the largest (≤ base) at which each fits its width. */
export function sharedValueSize(ctx: Ctx, items: { item: StatItem; maxW: number }[], s: ValueStyle, minScale = 0.55): number {
  let size = s.size;
  for (const { item, maxW } of items) {
    const w = partsWidth(ctx, item, s.size, s);
    if (w > maxW) size = Math.min(size, Math.floor((s.size * maxW) / w));
  }
  return Math.max(size, Math.round(s.size * minScale));
}

/** Draws number + small unit at one size (ellipsized only if it still can't fit at the floor). */
export function drawValue(ctx: Ctx, item: StatItem, x: number, base: number, maxW: number, size: number, s: ValueStyle, ink: string, muted: string): void {
  const { num, unit } = valueParts(item);
  const numF: FontSpec = { family: SANS, weight: s.weight ?? 700, size };
  const unitF: FontSpec = { family: SANS, weight: 500, size: size * s.unitRatio };
  const gap = size * 0.14;
  setFont(ctx, unitF);
  const uw = unit ? ctx.measureText(unit).width + gap : 0;
  const nw = drawFitText(ctx, num, x, base, Math.max(1, maxW - uw), numF, ink, 'left', 1);
  if (unit) drawFitText(ctx, unit, x + nw + gap, base, Math.max(1, maxW - nw - gap), unitF, muted, 'left', 1);
}

function hourLabel(data: CardData, minOfDay: number): string {
  const h = Math.floor(minOfDay / 60) % 24;
  return is12h(data) ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` : `${String(h).padStart(2, '0')}:00`;
}

/**
 * Whole hours inside the session as fractions (0–1) along a graph drawn by graphPoints over
 * `data.hrSeries`. Hours in the outer 6% are left out so one never reads as the start or end time.
 */
export function hourTicks(data: CardData): { at: number; label: string }[] {
  const s = data.hrSeries;
  const t0 = s.length > 1 ? s[0].t : 0;
  const t1 = s.length > 1 ? s[s.length - 1].t : data.durationSec;
  const span = Math.max(1, t1 - t0);
  const out: { at: number; label: string }[] = [];
  const endMin = data.startMin + data.durationSec / 60;
  for (let m = Math.ceil((data.startMin + 1) / 60) * 60; m < endMin; m += 60) {
    const at = ((m - data.startMin) * 60 - t0) / span;
    if (at >= 0.06 && at <= 0.94) out.push({ at, label: hourLabel(data, m) });
  }
  return out;
}

/**
 * Time axis under a graph: whole hours inside the session, plus the start and end at the ends
 * when `ends` is true. Labels that would crowd the ends or each other are dropped.
 */
export function drawTimeAxis(
  ctx: Ctx,
  data: CardData,
  x: number,
  w: number,
  base: number,
  f: FontSpec,
  color: string,
  ends: boolean,
): void {
  setFont(ctx, f);
  const minGap = f.size * 1.2;
  let left = x;
  let right = x + w;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  if (ends) {
    ctx.textAlign = 'left';
    ctx.fillText(data.timeText, x, base);
    left = x + ctx.measureText(data.timeText).width + minGap;
    ctx.textAlign = 'right';
    ctx.fillText(data.endTimeText, x + w, base);
    right = x + w - ctx.measureText(data.endTimeText).width - minGap;
  }
  ctx.textAlign = 'center';
  let last = -Infinity;
  for (const tk of hourTicks(data)) {
    const cx = x + tk.at * w;
    const lw = ctx.measureText(tk.label).width;
    if (cx - lw / 2 < Math.max(left, last + minGap) || cx + lw / 2 > right) continue;
    ctx.fillText(tk.label, cx, base);
    last = cx + lw / 2;
  }
}

/**
 * Zones reached, for the legend. A zone time that is already a stat on the card (say "Moderate or
 * harder 52m" when moderate was the only hard zone) keeps its dot and name but drops the number (R4).
 */
export function legendItems(data: CardData, opts: CardOptions): ZoneItem[] {
  const shown = new Set(visibleStats(data, opts).map((s) => s.number));
  return zoneItems(data, opts.theme).map((it) => (shown.has(it.text) ? { ...it, text: '' } : it));
}

// ── Heart trace ───────────────────────────────────────────────────────────────

const PAD = 64;
const TOP = 64;
const BOTTOM = 48;
const HEAD = 72;
const SUB = 34;
const ICON = 92;
const CHART_GAP = 28;
const CHART_H = 500;
const AXIS = 24;
const AXIS_GAP = 16;
const LEGEND = 24;
const LEGEND_GAP = 20;
const STATS_GAP = 44;
const LABEL = 30;
const VALUE: ValueStyle = { size: 64, unitRatio: 0.47 };
const ROW_GAP = 36;
const LOGO = 26;
const RADIUS = 64;

const headFont: FontSpec = { family: SANS, weight: 700, size: HEAD };

const colors = (opts: CardOptions) =>
  opts.theme === 'dark'
    ? { bg: '#0F1012', surface: '#1C1D20', ink: '#F1F2F4', muted: '#A7ABB1', faint: '#6B7078' }
    : { bg: '#F6F7F9', surface: '#FFFFFF', ink: '#1A1C1E', muted: '#5B6066', faint: '#9AA0A8' };

function rows2<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

function layout(ctx: Ctx, width: number, data: CardData, opts: CardOptions) {
  const head = titleLines(ctx, data.title, width - PAD * 2 - ICON - 24, headFont, 2);
  const headH = head.lines.length * head.size * 1.08 + 14 + SUB * 1.2;
  const chartTop = TOP + Math.max(headH, ICON) + CHART_GAP;
  const axisTop = chartTop + CHART_H + AXIS_GAP;
  const legend = legendItems(data, opts);
  const legendTop = axisTop + AXIS * 1.2 + LEGEND_GAP;
  const afterAxis = legend.length > 0 ? legendTop + LEGEND * 1.2 : axisTop + AXIS * 1.2;
  const rows = rows2(visibleStats(data, opts));
  const statsTop = afterAxis + STATS_GAP;
  const rowH = LABEL * 1.2 + 12 + VALUE.size;
  const statsH = rows.length * rowH + Math.max(0, rows.length - 1) * ROW_GAP;
  let h = statsTop + statsH;
  const logoTop = h + 44;
  h = opts.showLogo ? logoTop + LOGO * 1.2 + BOTTOM : h + BOTTOM + 8;
  return { head, chartTop, axisTop, legend, legendTop, rows, statsTop, rowH, logoTop, h };
}

export const trace: CardDesign = {
  id: 'trace',
  name: 'Heart trace',
  blurb: 'Your heart rate as one clean line',
  needsHr: true,
  supportsAccent: true,

  background(opts) {
    return colors(opts).bg;
  },

  measure(width, data, opts) {
    return { h: Math.round(layout(measureContext(), width, data, opts).h) };
  },

  draw(ctx, box: Rect, data, opts) {
    const p = colors(opts);
    const accent = accentInk(opts);
    const L = layout(ctx, box.w, data, opts);
    const x0 = box.x;
    const y0 = box.y;

    fillRoundRect(ctx, x0, y0, box.w, box.h, RADIUS, p.surface);

    // Header: title, then the date only (the start and end sit on the axis, or in the time stat).
    let y = y0 + TOP;
    const headW = box.w - PAD * 2 - ICON - 24;
    L.head.lines.forEach((line) => {
      drawFitText(ctx, line, x0 + PAD, baseline(y, L.head.size), headW, { ...headFont, size: L.head.size }, p.ink);
      y += L.head.size * 1.08;
    });
    y += 14;
    drawFitText(ctx, metaLine(data, false), x0 + PAD, baseline(y, SUB), headW, { family: SANS, weight: 400, size: SUB }, p.muted, 'left', 0.7);
    drawIconPath(ctx, data.sportIcon, accent, x0 + box.w - PAD - ICON, y0 + TOP, ICON);

    // Chart, full bleed inside the card.
    const series = data.hrSeries;
    const chart = { x: x0, y: y0 + L.chartTop, w: box.w, h: CHART_H };
    if (series.length > 1) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const s of series) {
        lo = Math.min(lo, s.bpm);
        hi = Math.max(hi, s.bpm);
      }
      const span = Math.max(12, hi - lo);
      const scale = { min: lo - span * 0.12, max: hi + span * 0.22 };
      const yOf = (bpm: number) => chart.y + chart.h - ((bpm - scale.min) / (scale.max - scale.min)) * chart.h;

      ctx.save();
      roundRectPath(ctx, x0, y0, box.w, box.h, RADIUS);
      ctx.clip();
      drawZoneLine(ctx, data, { x: chart.x - 4, y: chart.y, w: chart.w + 8, h: chart.h }, opts, { lineWidth: 7, fill: true, scale });
      ctx.restore();

      if (data.avgHr !== null) {
        const ay = yOf(data.avgHr);
        ctx.save();
        ctx.setLineDash([14, 12]);
        ctx.strokeStyle = rgba(p.ink, 0.42);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x0, ay);
        ctx.lineTo(x0 + box.w, ay);
        ctx.stroke();
        ctx.restore();
        // The label only when Avg HR isn't already a stat; a chip so the trace never runs through it.
        if (!showsStat(data, opts, 'avgHr')) {
          const label = `avg ${data.avgHr}`;
          setFont(ctx, { family: SANS, weight: 600, size: 28 });
          const lw = ctx.measureText(label).width;
          fillRoundRect(ctx, x0 + PAD - 14, ay - 22, lw + 28, 44, 22, p.surface);
          drawFitText(ctx, label, x0 + PAD, ay + 10, 300, { family: SANS, weight: 600, size: 28 }, p.muted);
        }
      }

      // No dot on the smoothed line (it never reaches the real peak): the real value goes up top.
      if (data.maxHr !== null && !showsStat(data, opts, 'maxHr')) {
        drawFitText(ctx, `peak ${data.maxHr} bpm`, x0 + box.w - PAD, chart.y + 30, 400, { family: SANS, weight: 500, size: 26 }, p.muted, 'right');
      }
    }

    // Time axis: whole hours, and the start / end unless the time-range stat already says them.
    drawTimeAxis(ctx, data, x0 + PAD, box.w - PAD * 2, baseline(y0 + L.axisTop, AXIS), { family: SANS, size: AXIS }, p.faint, !showsTimeStat(data, opts));

    if (L.legend.length > 0) {
      drawZoneLegend(ctx, L.legend, x0 + PAD, baseline(y0 + L.legendTop, LEGEND), box.w - PAD * 2, {
        size: LEGEND,
        ink: p.ink,
        muted: p.muted,
        family: SANS,
      });
    }

    // Stats: two columns, every value at one size.
    const gridW = box.w - PAD * 2;
    const colW = gridW / 2;
    const maxW = colW - 24;
    const all = L.rows.flat();
    const size = sharedValueSize(ctx, all.map((item) => ({ item, maxW })), VALUE);
    L.rows.forEach((row, r) => {
      const top = y0 + L.statsTop + r * (L.rowH + ROW_GAP);
      row.forEach((item, i) => {
        const cx = x0 + PAD + i * colW;
        drawFitText(ctx, item.label, cx, baseline(top, LABEL), maxW, { family: SANS, size: LABEL }, p.muted, 'left', 0.7);
        drawValue(ctx, item, cx, top + LABEL * 1.2 + 12 + VALUE.size * 0.78, maxW, size, VALUE, p.ink, p.muted);
      });
    });

    if (opts.showLogo) {
      drawLogo(ctx, x0 + box.w / 2, y0 + L.logoTop + LOGO * 0.6, LOGO, rgba(p.ink, 0.45), 'center');
    }
  },
};
