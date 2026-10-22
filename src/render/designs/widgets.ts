import { BRAND, drawFitText, drawHrGraph, fillRoundRect, mix, visibleStats, type FontSpec } from '../canvas';
import { DISPLAY, SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { metaLine, STAT_ICONS } from './shared';

const GAP = 32;
const BIG_H = 444;
const MINI_H = (BIG_H - GAP) / 2;
const GRAPH_H = 330;
const FOOT = 32;

type Mini = { icon: string; value: string; label: string };

function colors(data: CardData, opts: CardOptions) {
  const c = data.sportColors;
  return opts.theme === 'dark'
    ? { surface: '#1E2023', ink: '#F1F2F4', muted: '#A7ABB1', accent: c.bg, hero: mix(c.fg, '#000000', 0.4), onHero: c.bg }
    : { surface: '#FFFFFF', ink: '#1A1C1E', muted: '#5B6066', accent: c.strong, hero: c.bg, onHero: mix(c.fg, '#000000', 0.25) };
}

const toMini = (s: StatItem): Mini => ({ icon: STAT_ICONS[s.key], value: s.value, label: s.label });

function layout(data: CardData, opts: CardOptions) {
  const [first, ...rest] = visibleStats(data, opts);
  const minis = rest.map(toMini);
  // The right column always holds two widgets; the date fills a gap.
  const dateMini: Mini = { icon: 'schedule-fill', value: `${data.weekday} ${data.shortDate}`, label: 'Date' };
  while (minis.length < 2) minis.push(dateMini);
  const side = minis.slice(0, 2);
  const extra = minis.slice(2);
  const extraRows = Math.ceil(extra.length / 2);
  let y = BIG_H;
  if (extraRows) y += GAP + extraRows * MINI_H + (extraRows - 1) * GAP;
  const graph = opts.showGraph && data.hrSeries.length > 1;
  const graphTop = y + GAP;
  if (graph) y = graphTop + GRAPH_H;
  const footTop = y + 36;
  return { first, side, extra, graph, graphTop, footTop, h: footTop + FOOT * 1.3 };
}

function drawMini(ctx: CanvasRenderingContext2D, m: Mini, x: number, y: number, w: number, c: ReturnType<typeof colors>): void {
  fillRoundRect(ctx, x, y, w, MINI_H, 64, c.surface);
  const icon = 60;
  drawIconPath(ctx, m.icon, c.accent, x + 40, y + (MINI_H - icon) / 2, icon);
  const tx = x + 40 + icon + 22;
  const tw = w - (tx - x) - 32;
  const value: FontSpec = { family: DISPLAY, weight: 800, size: 72 };
  drawFitText(ctx, m.value, tx, y + MINI_H / 2 + 14, tw, value, c.ink, 'left', 0.45);
  drawFitText(ctx, m.label, tx, y + MINI_H / 2 + 56, tw, { family: SANS, weight: 500, size: 30 }, c.muted, 'left', 0.7);
}

export const widgets: CardDesign = {
  id: 'widgets',
  name: 'Widgets',
  blurb: 'Your stats as a stack of phone widgets',
  supportsAccent: false,
  supportsGraph: true,

  background(opts) {
    return opts.theme === 'dark' ? '#000000' : '#EEF0F3';
  },

  measure(_w, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(data, opts);
    const L = layout(data, opts);
    const half = (box.w - GAP) / 2;
    const x = box.x;
    const y = box.y;

    // Big widget: sport glyph, title, the first stat.
    fillRoundRect(ctx, x, y, half, BIG_H, 76, c.hero);
    drawIconPath(ctx, data.sportIcon, c.onHero, x + 48, y + 48, 112);
    const inner = half - 96;
    drawFitText(ctx, data.title, x + 48, y + BIG_H - 48 - 104 - 18, inner, { family: SANS, weight: 700, size: 46 }, c.onHero, 'left', 0.6);
    if (L.first) {
      drawFitText(ctx, L.first.value, x + 48, y + BIG_H - 48 - 12, inner, { family: DISPLAY, weight: 800, size: 104 }, c.onHero, 'left', 0.4);
    }

    L.side.forEach((m, i) => drawMini(ctx, m, x + half + GAP, y + i * (MINI_H + GAP), half, c));
    L.extra.forEach((m, i) => {
      const row = Math.floor(i / 2);
      const w = L.extra.length % 2 === 1 && i === L.extra.length - 1 ? box.w : half;
      drawMini(ctx, m, x + (i % 2) * (half + GAP), y + BIG_H + GAP + row * (MINI_H + GAP), w, c);
    });

    if (L.graph) {
      const gy = y + L.graphTop;
      fillRoundRect(ctx, x, gy, box.w, GRAPH_H, 76, c.surface);
      drawFitText(ctx, 'Heart rate', x + 48, gy + 82, box.w / 2, { family: SANS, weight: 700, size: 40 }, c.ink);
      const sub = [data.avgHr !== null ? `avg ${data.avgHr}` : '', data.maxHr !== null ? `peak ${data.maxHr}` : ''].filter(Boolean).join(' · ');
      drawFitText(ctx, sub, x + box.w - 48, gy + 82, box.w / 2 - 48, { family: SANS, weight: 400, size: 32 }, c.muted, 'right');
      drawHrGraph(ctx, data.hrSeries, { x: x + 48, y: gy + 120, w: box.w - 96, h: GRAPH_H - 160 }, { color: c.accent, lineWidth: 5, fillFrom: 0.25 });
    }

    const foot = [opts.showLogo ? BRAND : '', metaLine(data)].filter(Boolean).join(' · ');
    drawFitText(ctx, foot, x + box.w / 2, y + L.footTop + FOOT, box.w, { family: SANS, weight: 500, size: FOOT }, opts.background === 'transparent' && opts.theme === 'dark' ? '#FFFFFF' : c.muted, 'center');
  },
};
