import { drawFitText, rgba, statRows, visibleStats } from '../canvas';
import { SERIF } from '../font-faces';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, drawStatGrid, shortPlace, statGridHeight, type StatGridStyle } from './shared';

const TOP = 24;
const TITLE = 120;
const DATE = 44;
const RULE_W = 200;
const RULE_H = 4;
const LOGO = 44;

const colors = (opts: CardOptions) =>
  opts.theme === 'dark' ? { ink: '#F5F0E6', canvas: '#14120F' } : { ink: '#1B1814', canvas: '#F3EDE2' };

function gridStyle(ink: string): StatGridStyle {
  return {
    label: { family: SERIF, weight: 400, size: 36 },
    value: { family: SERIF, weight: 400, size: 48, style: 'italic' },
    ink,
    labelAlpha: 0.7,
    gap: 0,
    rowGap: 36,
    align: 'center',
    valueFirst: true,
  };
}

function layout(data: CardData, opts: CardOptions) {
  const rows = statRows(visibleStats(data, opts));
  const titleTop = TOP;
  const dateTop = titleTop + TITLE * 1.1 + 4;
  const rule1 = dateTop + DATE * 1.2 + 52;
  const statsTop = rule1 + RULE_H + 56;
  const statsH = statGridHeight(rows.length, gridStyle('#000'));
  const rule2 = statsTop + statsH + 56;
  const logoTop = rule2 + RULE_H + 40;
  const h = opts.showLogo ? logoTop + LOGO * 1.2 + TOP : rule2 + RULE_H + TOP;
  return { rows, titleTop, dateTop, rule1, statsTop, rule2, logoTop, h };
}

export const editorial: CardDesign = {
  id: 'editorial',
  name: 'Editorial',
  blurb: 'Elegant, like a magazine page',
  floating: true,
  supportsAccent: false,

  background(opts) {
    return colors(opts).canvas;
  },

  measure(_width, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(data, opts);
    const { ink } = colors(opts);
    const cx = box.x + box.w / 2;
    const maxW = box.w - 40;

    drawFitText(ctx, data.title, cx, box.y + baseline(L.titleTop, TITLE) - 8, maxW, { family: SERIF, weight: 400, size: TITLE, style: 'italic' }, ink, 'center');
    drawFitText(
      ctx,
      data.location ? `${data.dateText} · ${shortPlace(data)}` : `${data.dateText}, ${data.timeText}`,
      cx,
      box.y + baseline(L.dateTop, DATE),
      maxW,
      { family: SERIF, weight: 400, size: DATE },
      rgba(ink, 0.8),
      'center',
    );

    ctx.fillStyle = ink;
    ctx.fillRect(cx - RULE_W / 2, box.y + L.rule1, RULE_W, RULE_H);
    drawStatGrid(ctx, L.rows, box.x, box.y + L.statsTop, box.w, gridStyle(ink));
    ctx.fillStyle = ink;
    ctx.fillRect(cx - RULE_W / 2, box.y + L.rule2, RULE_W, RULE_H);

    if (opts.showLogo) {
      drawFitText(ctx, 'Sweatshot', cx, box.y + baseline(L.logoTop, LOGO), maxW, { family: SERIF, weight: 400, size: LOGO, style: 'italic' }, rgba(ink, 0.85), 'center');
    }
  },
};
