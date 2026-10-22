import {
  drawFitText,
  drawHrGraph,
  drawLogo,
  fillRoundRect,
  mix,
  rgba,
  roundRectPath,
  setFont,
  statRows,
  visibleStats,
  wrapText,
  type FontSpec,
} from '../canvas';
import { SANS } from '../font-faces';
import { measureContext } from '../env';
import { drawIconPath } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { baseline, shortPlace } from './shared';

type Ctx = CanvasRenderingContext2D;

// ── Shared by Trace, Zones and Dial (Google Health-style sport tones) ─────────

export type Palette = {
  bg: string; // canvas when solid
  surface: string; // card
  ink: string;
  muted: string;
  line: string;
  track: string;
  tick: string;
  accent: string; // sport colour, tuned to the theme
  container: string; // soft sport tint (icon cookie)
  onContainer: string;
};

export function palette(data: CardData, opts: CardOptions): Palette {
  const sc = data.sportColors;
  if (opts.theme === 'dark') {
    return {
      bg: '#0F1012',
      surface: '#1C1D20',
      ink: '#F1F2F4',
      muted: '#A7ABB1',
      line: '#2C2E33',
      track: '#2A2D31',
      tick: '#5A5F67',
      accent: mix(sc.strong, '#FFFFFF', 0.42),
      container: mix(sc.strong, '#1C1D20', 0.72),
      onContainer: sc.bg,
    };
  }
  return {
    bg: '#F6F7F9',
    surface: '#FFFFFF',
    ink: '#1A1C1E',
    muted: '#5B6066',
    line: '#ECEEF1',
    track: '#DDE1E6',
    tick: '#9AA0A8',
    accent: mix(sc.strong, sc.fg, 0.45),
    container: sc.bg,
    onContainer: sc.fg,
  };
}

/** "Tue 20 Oct · 02:02 · Smash Club" */
export function metaLine(data: CardData, withTime = true): string {
  const parts = [`${data.weekday} ${data.shortDate}`];
  if (withTime && !data.location) parts.push(data.timeText);
  if (data.location) parts.push(shortPlace(data));
  return parts.join(' · ');
}

/** Material-style "cookie" (scalloped circle) centred on cx, cy. */
export function cookiePath(ctx: Ctx, cx: number, cy: number, r: number, lobes = 9): void {
  ctx.beginPath();
  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (0.93 + 0.07 * Math.cos(lobes * (a + Math.PI / 2)));
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawSportBadge(ctx: Ctx, data: CardData, p: Palette, x: number, y: number, size: number): void {
  cookiePath(ctx, x + size / 2, y + size / 2, size / 2);
  ctx.fillStyle = p.container;
  ctx.fill();
  const icon = size * 0.46;
  drawIconPath(ctx, data.sportIcon, p.onContainer, x + (size - icon) / 2, y + (size - icon) / 2, icon);
}

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

/** Big number with a small unit after it, shrunk together to fit maxW. */
export function drawNumberUnit(
  ctx: Ctx,
  item: StatItem,
  x: number,
  base: number,
  maxW: number,
  num: FontSpec,
  unit: FontSpec,
  ink: string,
  muted: string,
  align: 'left' | 'center' = 'left',
): void {
  const n = item.number || item.value;
  const u = item.number ? item.unit : '';
  const gap = u ? num.size * 0.14 : 0;
  setFont(ctx, num);
  const nw = ctx.measureText(n).width;
  setFont(ctx, unit);
  const uw = u ? ctx.measureText(u).width : 0;
  const total = nw + gap + uw;
  const k = Math.max(0.55, Math.min(1, maxW / Math.max(1, total)));
  if (total * k > maxW) {
    // Still too wide: plain fitted value.
    drawFitText(ctx, item.value, x, base, maxW, { ...num, size: num.size * 0.55 }, ink, align, 0.5);
    return;
  }
  const left = align === 'center' ? x - (total * k) / 2 : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, { ...num, size: num.size * k });
  ctx.fillStyle = ink;
  ctx.fillText(n, left, base);
  if (u) {
    setFont(ctx, { ...unit, size: unit.size * Math.max(k, 0.8) });
    ctx.fillStyle = muted;
    ctx.fillText(u, left + (nw + gap) * k, base);
  }
}

// ── Heart trace ───────────────────────────────────────────────────────────────

const PAD = 64;
const TOP = 64;
const BOTTOM = 56;
const GAP = 40;
const HEAD = 72;
const SUB = 36;
const ICON = 96;
const CHART_H = 520;
const TIME = 30;
const LABEL = 30;
const VALUE = 64;
const ROW_GAP = 36;
const LOGO = 26;
const RADIUS = 64;

const headFont: FontSpec = { family: SANS, weight: 700, size: HEAD };

function headLines(ctx: Ctx, data: CardData, w: number): { lines: string[]; size: number } {
  return titleLines(ctx, data.title, w, headFont, 2);
}

function layout(ctx: Ctx, width: number, data: CardData, opts: CardOptions) {
  const head = headLines(ctx, data, width - PAD * 2 - ICON - 24);
  const headH = head.lines.length * head.size * 1.08 + 10 + SUB * 1.2;
  const chartTop = TOP + Math.max(headH, ICON) + GAP;
  const timeTop = chartTop + CHART_H + 24;
  const rows = statRows(visibleStats(data, opts));
  const statsTop = timeTop + TIME * 1.2 + GAP;
  const rowH = LABEL * 1.2 + 8 + VALUE;
  const statsH = rows.length * rowH + Math.max(0, rows.length - 1) * ROW_GAP;
  let h = statsTop + statsH;
  const logoTop = h + 48;
  h = opts.showLogo ? logoTop + LOGO * 1.2 + BOTTOM - 8 : h + BOTTOM + 8;
  return { head, chartTop, timeTop, rows, statsTop, rowH, logoTop, h };
}

export const trace: CardDesign = {
  id: 'trace',
  name: 'Heart trace',
  blurb: 'Your heart rate as one clean line',
  needsHr: true,
  supportsAccent: false,

  background(opts) {
    return opts.theme === 'dark' ? '#0F1012' : '#F6F7F9';
  },

  measure(width, data, opts) {
    return { h: Math.round(layout(measureContext(), width, data, opts).h) };
  },

  draw(ctx, box: Rect, data, opts) {
    const p = palette(data, opts);
    const L = layout(ctx, box.w, data, opts);
    const x0 = box.x;
    const y0 = box.y;

    fillRoundRect(ctx, x0, y0, box.w, box.h, RADIUS, p.surface);

    // Header
    let y = y0 + TOP;
    const headW = box.w - PAD * 2 - ICON - 24;
    L.head.lines.forEach((line) => {
      drawFitText(ctx, line, x0 + PAD, baseline(y, L.head.size), headW, { ...headFont, size: L.head.size }, p.ink);
      y += L.head.size * 1.08;
    });
    y += 10;
    drawFitText(ctx, metaLine(data), x0 + PAD, baseline(y, SUB), headW, { family: SANS, weight: 400, size: SUB }, p.muted, 'left', 0.7);
    drawIconPath(ctx, data.sportIcon, p.accent, x0 + box.w - PAD - ICON, y0 + TOP, ICON);

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
      const pts = drawHrGraph(ctx, series, { x: chart.x - 4, y: chart.y, w: chart.w + 8, h: chart.h }, {
        color: p.accent,
        lineWidth: 7,
        fillFrom: 0.28,
        scale,
      });
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
        // A small chip so the trace never runs through the label.
        const label = `avg ${data.avgHr}`;
        setFont(ctx, { family: SANS, weight: 600, size: 30 });
        const lw = ctx.measureText(label).width;
        fillRoundRect(ctx, x0 + PAD - 12, ay - 24, lw + 24, 48, 24, p.surface);
        drawFitText(ctx, label, x0 + PAD, ay + 11, 300, { family: SANS, weight: 600, size: 30 }, p.muted);
      }

      if (pts.length > 0) {
        let peak = 0;
        pts.forEach((pt, i) => {
          if (pt[1] < pts[peak][1]) peak = i;
        });
        const [mx, my] = pts[peak];
        const dx = Math.min(Math.max(mx, x0 + 30), x0 + box.w - 30);
        ctx.beginPath();
        ctx.arc(dx, my, 15.5, 0, Math.PI * 2);
        ctx.fillStyle = p.accent;
        ctx.fill();
        ctx.lineWidth = 9;
        ctx.strokeStyle = p.surface;
        ctx.stroke();
        const label = `${data.maxHr ?? series[peak]?.bpm ?? ''}`;
        setFont(ctx, { family: SANS, weight: 700, size: 42 });
        const lw = ctx.measureText(label).width;
        const lx = Math.min(Math.max(dx, x0 + PAD + lw / 2), x0 + box.w - PAD - lw / 2);
        ctx.fillStyle = p.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, lx, my - 34);
      }
    }

    // Start / end times under the chart.
    const tb = baseline(y0 + L.timeTop, TIME);
    drawFitText(ctx, data.timeText, x0 + PAD, tb, 300, { family: SANS, size: TIME }, p.muted);
    drawFitText(ctx, data.endTimeText, x0 + box.w - PAD, tb, 300, { family: SANS, size: TIME }, p.muted, 'right');

    // Stats
    const gridW = box.w - PAD * 2;
    L.rows.forEach((row, r) => {
      const top = y0 + L.statsTop + r * (L.rowH + ROW_GAP);
      const colW = gridW / 3;
      const cols = row.length;
      const cw = cols === 2 ? gridW / 2 : colW;
      row.forEach((item, i) => {
        const cx = x0 + PAD + i * cw;
        drawFitText(ctx, item.label, cx, baseline(top, LABEL), cw - 24, { family: SANS, size: LABEL }, p.muted, 'left', 0.7);
        drawNumberUnit(
          ctx,
          item,
          cx,
          top + LABEL * 1.2 + 8 + VALUE * 0.78,
          cw - 24,
          { family: SANS, weight: 700, size: VALUE },
          { family: SANS, weight: 400, size: 30 },
          p.ink,
          p.muted,
        );
      });
    });

    if (opts.showLogo) {
      drawLogo(ctx, x0 + box.w / 2, y0 + L.logoTop + LOGO * 0.6, LOGO, rgba(p.ink, 0.45), 'center');
    }
  },
};
