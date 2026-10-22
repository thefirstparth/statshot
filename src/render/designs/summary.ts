import { drawFitText, drawHrGraph, drawLogo, fillRoundRect, fitText, rgba, setFont, visibleStats } from '../canvas';
import { SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { baseline, drawSportBadge, metaLine, STAT_ICONS } from './shared';

const PAD = 64;
const BADGE = 152;
const TITLE = 72;
const SUB = 36;
const GAP = 24;
const TILE_PAD = 40;
const LABEL = 32;
const ICON = 44;
const VALUE = 88;
const UNIT = 38;
const TILE_H = TILE_PAD * 2 + ICON + 18 + VALUE;
const GRAPH_H = 200;
const LOGO = 28;

const colors = (opts: CardOptions) =>
  opts.theme === 'dark'
    ? { canvas: '#0F1012', card: '#1C1D20', tile: '#26282C', ink: '#F1F2F4', muted: '#A7ABB1' }
    : { canvas: '#F6F7F9', card: '#FFFFFF', tile: '#F1F3F5', ink: '#1A1C1E', muted: '#5B6066' };

function rows(stats: StatItem[]): StatItem[][] {
  const out: StatItem[][] = [];
  for (let i = 0; i < stats.length; i += 2) out.push(stats.slice(i, i + 2));
  return out;
}

function layout(data: CardData, opts: CardOptions) {
  const stats = visibleStats(data, opts);
  const r = rows(stats);
  const gridTop = PAD + BADGE + 48;
  const gridH = r.length * TILE_H + (r.length - 1) * GAP;
  const graph = opts.showGraph && data.hrSeries.length > 1;
  const graphTop = gridTop + gridH + GAP;
  const afterGraph = graph ? graphTop + GRAPH_H : gridTop + gridH;
  const logoTop = afterGraph + 40;
  const h = (opts.showLogo ? logoTop + LOGO * 1.2 : afterGraph) + PAD;
  return { rows: r, gridTop, graph, graphTop, logoTop, h };
}

export const summary: CardDesign = {
  id: 'summary',
  name: 'Summary',
  blurb: 'Big title, your stats in a tidy grid',
  supportsAccent: false,
  supportsGraph: true,

  background(opts) {
    return colors(opts).canvas;
  },

  measure(_w, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(opts);
    const L = layout(data, opts);
    const dark = opts.theme === 'dark';
    const accent = dark ? data.sportColors.bg : data.sportColors.strong;
    fillRoundRect(ctx, box.x, box.y, box.w, L.h, 72, c.card);

    // Header: sport sticker, title, meta line.
    drawSportBadge(ctx, data, box.x + PAD, box.y + PAD, BADGE, dark);
    const tx = box.x + PAD + BADGE + 36;
    const tw = box.x + box.w - PAD - tx;
    const titleSize = fitText(ctx, data.title, tw, { family: SANS, weight: 700, size: TITLE }, 0.62).size;
    const blockH = titleSize * 1.05 + 14 + SUB * 1.2;
    const top = box.y + PAD + (BADGE - blockH) / 2;
    drawFitText(ctx, data.title, tx, baseline(top, titleSize), tw, { family: SANS, weight: 700, size: TITLE }, c.ink, 'left', 0.62);
    drawFitText(ctx, metaLine(data), tx, baseline(top + titleSize * 1.05 + 14, SUB), tw, { family: SANS, weight: 400, size: SUB }, c.muted);

    // Stat tiles, two per row; a lone last tile spans the row.
    const inner = box.w - PAD * 2;
    L.rows.forEach((row, ri) => {
      const y = box.y + L.gridTop + ri * (TILE_H + GAP);
      const w = row.length === 1 ? inner : (inner - GAP) / 2;
      row.forEach((item, i) => {
        const x = box.x + PAD + i * (w + GAP);
        fillRoundRect(ctx, x, y, w, TILE_H, 48, c.tile);
        const maxW = w - TILE_PAD * 2;
        drawIconPath(ctx, STAT_ICONS[item.key], accent, x + TILE_PAD, y + TILE_PAD, ICON);
        drawFitText(ctx, item.label, x + TILE_PAD + ICON + 14, y + TILE_PAD + ICON * 0.5 + LABEL * 0.36, maxW - ICON - 14, { family: SANS, weight: 500, size: LABEL }, c.muted, 'left', 0.7);
        const vy = y + TILE_PAD + ICON + 18 + VALUE * 0.86;
        setFont(ctx, { family: SANS, weight: 700, size: VALUE });
        const unitW = item.unit ? (setFont(ctx, { family: SANS, weight: 500, size: UNIT }), ctx.measureText(item.unit).width + 12) : 0;
        const numW = drawFitText(ctx, item.number, x + TILE_PAD, vy, maxW - unitW, { family: SANS, weight: 700, size: VALUE }, c.ink, 'left', 0.3);
        if (item.unit) {
          drawFitText(ctx, item.unit, x + TILE_PAD + numW + 12, vy, maxW - numW - 12, { family: SANS, weight: 500, size: UNIT }, c.muted);
        }
      });
    });

    if (L.graph) {
      const gy = box.y + L.graphTop;
      fillRoundRect(ctx, box.x + PAD, gy, inner, GRAPH_H, 48, c.tile);
      drawHrGraph(ctx, data.hrSeries, { x: box.x + PAD + 36, y: gy + 36, w: inner - 72, h: GRAPH_H - 72 }, {
        color: accent,
        lineWidth: 5,
        fillFrom: 0.28,
      });
    }

    if (opts.showLogo) drawLogo(ctx, box.x + box.w / 2, box.y + L.logoTop + LOGO * 0.6, LOGO, rgba(c.ink, 0.55), 'center');
  },
};
