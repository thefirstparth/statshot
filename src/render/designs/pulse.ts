import { drawFitText, drawHrGraph, drawLogo, fillRoundRect, rgba, roundRectPath, setFont, statRows, visibleStats } from '../canvas';
import { SANS } from '../font-faces';
import { drawIcon } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { cardColors } from './midnight';
import { baseline, dateLine, drawStatGrid, statGridHeight, type StatGridStyle } from './shared';

const PAD = 64;
const TITLE = 60;
const DATE = 34;
const ICON = 72;
const CHART_H = 360;
const LOGO = 28;

function gridStyle(ink: string): StatGridStyle {
  return {
    label: { family: SANS, weight: 400, size: 28 },
    value: { family: SANS, weight: 600, size: 48 },
    ink,
    labelAlpha: 0.6,
    gap: 8,
    rowGap: 36,
    align: 'left',
    inset: 0,
  };
}

/** Title + date block shared by Pulse and Zones. */
export function drawHeader(
  ctx: CanvasRenderingContext2D,
  box: Rect,
  data: CardData,
  opts: CardOptions,
  ink: string,
): void {
  const textW = box.w - PAD * 2 - ICON - 24;
  drawFitText(ctx, data.title, box.x + PAD, box.y + baseline(PAD - 6, TITLE), textW, { family: SANS, weight: 600, size: TITLE }, ink);
  drawFitText(
    ctx,
    dateLine(data.dateText, data.timeText),
    box.x + PAD,
    box.y + baseline(PAD + TITLE * 1.2, DATE),
    textW,
    { family: SANS, weight: 400, size: DATE },
    rgba(ink, 0.6),
  );
  drawIcon(ctx, data.sportIcon, opts.accent, box.x + box.w - PAD - ICON, box.y + PAD + 4, ICON);
}

export const HEADER_H = PAD + TITLE * 1.2 + DATE * 1.2;

function layout(data: CardData, opts: CardOptions) {
  const rows = statRows(visibleStats(data, opts));
  const chartTop = HEADER_H + 40;
  const statsTop = chartTop + CHART_H + 48;
  const statsH = statGridHeight(rows.length, gridStyle('#000'));
  const footerTop = statsTop + statsH + 56;
  const h = opts.showLogo ? footerTop + LOGO + 52 : statsTop + statsH + PAD;
  return { rows, chartTop, statsTop, footerTop, h };
}

export const pulse: CardDesign = {
  id: 'pulse',
  name: 'Pulse',
  needsHr: true,
  supportsAccent: true,

  background(opts) {
    return cardColors(opts).canvas;
  },

  icons(data, opts) {
    return [{ name: data.sportIcon, color: opts.accent, size: ICON }];
  },

  measure(_width, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(data, opts);
    const c = cardColors(opts);
    fillRoundRect(ctx, box.x, box.y, box.w, box.h, 56, c.card);
    drawHeader(ctx, box, data, opts, c.ink);

    const series = data.hrSeries;
    const chart = { x: box.x, y: box.y + L.chartTop, w: box.w, h: CHART_H };
    if (series.length > 1) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of series) {
        lo = Math.min(lo, p.bpm);
        hi = Math.max(hi, p.bpm);
      }
      if (data.avgHr !== null) {
        lo = Math.min(lo, data.avgHr);
        hi = Math.max(hi, data.avgHr);
      }
      const span = Math.max(12, hi - lo);
      const scale = { min: lo - span * 0.08, max: hi + span * 0.3 };
      const yOf = (bpm: number) => chart.y + chart.h - ((bpm - scale.min) / (scale.max - scale.min)) * chart.h;

      ctx.save();
      roundRectPath(ctx, box.x, box.y, box.w, box.h, 56);
      ctx.clip();
      const pts = drawHrGraph(ctx, series, { x: chart.x - 3, y: chart.y, w: chart.w + 6, h: chart.h }, { color: opts.accent, lineWidth: 6, fillFrom: 0.35, scale });
      ctx.restore();

      // Dashed average line with label.
      if (data.avgHr !== null) {
        const ay = yOf(data.avgHr);
        ctx.save();
        ctx.setLineDash([14, 12]);
        ctx.strokeStyle = rgba(c.ink, 0.5);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(box.x + PAD, ay);
        ctx.lineTo(box.x + box.w - PAD, ay);
        ctx.stroke();
        ctx.restore();
        setFont(ctx, { family: SANS, weight: 500, size: 28 });
        const label = `avg ${data.avgHr}`;
        const lw = ctx.measureText(label).width;
        const lx = box.x + box.w - PAD - lw - 20;
        fillRoundRect(ctx, lx - 14, ay - 22, lw + 28, 44, 22, c.card);
        ctx.fillStyle = rgba(c.ink, 0.75);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, lx, ay + 10);
      }

      // Peak marker on the curve, labelled with the true max HR.
      let peak = 0;
      pts.forEach((p, i) => {
        if (p[1] < pts[peak][1]) peak = i;
      });
      if (pts.length > 0 && data.maxHr !== null) {
        const [mx, my] = pts[peak];
        ctx.beginPath();
        ctx.arc(mx, my, 12, 0, Math.PI * 2);
        ctx.fillStyle = opts.accent;
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = c.card;
        ctx.stroke();
        setFont(ctx, { family: SANS, weight: 600, size: 30 });
        const label = `max ${data.maxHr}`;
        const lw = ctx.measureText(label).width;
        const lx = Math.min(Math.max(mx - lw / 2, box.x + PAD), box.x + box.w - PAD - lw);
        ctx.fillStyle = c.ink;
        ctx.textAlign = 'left';
        ctx.fillText(label, lx, my - 30);
      }
    }

    drawStatGrid(ctx, L.rows, box.x + PAD, box.y + L.statsTop, box.w - PAD * 2, gridStyle(c.ink));

    if (opts.showLogo) {
      drawLogo(ctx, box.x + box.w / 2, box.y + L.footerTop + LOGO / 2, LOGO, rgba(c.ink, 0.7), 'center');
    }
  },
};
