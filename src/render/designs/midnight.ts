import { drawFitText, drawHrGraph, drawLogo, fillRoundRect, rgba, roundRectPath, splitRows, visibleStats } from '../canvas';
import { SANS } from '../font-faces';
import { drawIcon } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, dateLine, drawStatGrid, statGridHeight, type StatGridStyle } from './shared';

const PAD = 64;
const ICON = 88;
const TITLE = 56;
const DATE = 32;
const PANEL_MARGIN = 40;
const PANEL_PAD = 44;
const GRAPH_H = 132;
const LOGO = 28;

export const cardColors = (opts: CardOptions) =>
  opts.theme === 'dark'
    ? { card: '#16181D', panel: '#20232A', ink: '#F2F3F5', canvas: '#0A0B0D' }
    : { card: '#FFFFFF', panel: '#F1F2F5', ink: '#111214', canvas: '#E4E6EB' };

function gridStyle(ink: string): StatGridStyle {
  return {
    label: { family: SANS, weight: 400, size: 28 },
    value: { family: SANS, weight: 600, size: 52 },
    ink,
    labelAlpha: 0.6,
    gap: 8,
    rowGap: 40,
    align: 'left',
    inset: PANEL_PAD,
  };
}

function layout(data: CardData, opts: CardOptions) {
  const stats = visibleStats(data, opts);
  const rows = splitRows(stats, 2);
  const headerH = Math.max(ICON, TITLE * 1.2 + 6 + DATE * 1.2);
  const panelTop = PAD + headerH + 48;
  const gridH = statGridHeight(rows.length, gridStyle('#000'));
  const graph = opts.showGraph && data.hrSeries.length > 1;
  const panelH = PANEL_PAD * 2 + gridH + (graph ? GRAPH_H - 8 : 0);
  const footerTop = panelTop + panelH + 48;
  const h = opts.showLogo ? footerTop + LOGO + 52 : panelTop + panelH + PANEL_MARGIN;
  return { rows, headerH, panelTop, panelH, gridH, graph, footerTop, h };
}

export const midnight: CardDesign = {
  id: 'midnight',
  name: 'Midnight',
  supportsAccent: true,
  supportsGraph: true,

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

    // Header: accent icon, then title and date stacked beside it.
    const headerTop = box.y + PAD;
    drawIcon(ctx, data.sportIcon, opts.accent, box.x + PAD, headerTop + (L.headerH - ICON) / 2, ICON);
    const textX = box.x + PAD + ICON + 28;
    const textW = box.x + box.w - PAD - textX;
    const blockH = TITLE * 1.2 + 6 + DATE * 1.2;
    const blockTop = headerTop + (L.headerH - blockH) / 2;
    drawFitText(ctx, data.title, textX, baseline(blockTop, TITLE), textW, { family: SANS, weight: 600, size: TITLE }, c.ink);
    drawFitText(
      ctx,
      dateLine(data.dateText, data.timeText),
      textX,
      baseline(blockTop + TITLE * 1.2 + 6, DATE),
      textW,
      { family: SANS, weight: 400, size: DATE },
      rgba(c.ink, 0.6),
    );

    // Inset panel with a 2-column grid and a hairline divider.
    const px = box.x + PANEL_MARGIN;
    const pw = box.w - PANEL_MARGIN * 2;
    const py = box.y + L.panelTop;
    fillRoundRect(ctx, px, py, pw, L.panelH, 36, c.panel);
    const twoCols = L.rows.some((r) => r.length > 1);
    if (twoCols) {
      ctx.fillStyle = rgba(c.ink, 0.14);
      ctx.fillRect(px + pw / 2 - 1, py + PANEL_PAD, 2, L.gridH);
    }
    drawStatGrid(ctx, L.rows, px, py + PANEL_PAD, pw, gridStyle(c.ink), twoCols ? 2 : 1);

    if (L.graph) {
      ctx.save();
      roundRectPath(ctx, px, py, pw, L.panelH, 36);
      ctx.clip();
      const gy = py + L.panelH - GRAPH_H;
      drawHrGraph(ctx, data.hrSeries, { x: px - 4, y: gy + 18, w: pw + 8, h: GRAPH_H - 26 }, { color: opts.accent, lineWidth: 5, fillFrom: 0.3 });
      ctx.restore();
    }

    if (opts.showLogo) {
      drawLogo(ctx, box.x + box.w / 2, box.y + L.footerTop + LOGO / 2, LOGO, rgba(c.ink, 0.7), 'center');
    }
  },
};
