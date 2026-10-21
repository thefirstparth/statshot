import { drawFitText, drawLogo, onColor, rgba, splitRows, visibleStats } from '../canvas';
import { GROTESK, font } from '../font-faces';
import { drawIcon } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, drawStatGrid, statGridHeight, type StatGridStyle } from './shared';

const PAD = 56;
const RULE = 8;
const TITLE = 72;
const DATE = 36;
const CIRCLE = 120;
const CIRCLE_ICON = 64;
const FOOTER_H = 96;
const LOGO = 30;

const colors = (opts: CardOptions) =>
  opts.theme === 'dark' ? { card: '#000000', ink: '#FFFFFF', canvas: '#1A1A1A' } : { card: '#FFFFFF', ink: '#000000', canvas: '#E8E8E8' };

function gridStyle(ink: string): StatGridStyle {
  return {
    label: { family: GROTESK, weight: 500, size: 30 },
    value: { family: GROTESK, weight: 700, size: 64 },
    ink,
    labelAlpha: 0.65,
    gap: 4,
    rowGap: 44,
    align: 'left',
    inset: 0,
  };
}

function layout(data: CardData, opts: CardOptions) {
  const rows = splitRows(visibleStats(data, opts), 2);
  const headerTop = PAD + RULE + 44;
  const headerH = Math.max(CIRCLE, TITLE * 1.1 + 12 + DATE * 1.2);
  const statsTop = headerTop + headerH + 64;
  const statsH = statGridHeight(rows.length, gridStyle('#000'));
  const ruleTop = statsTop + statsH + 64;
  const h = ruleTop + RULE + FOOTER_H;
  return { rows, headerTop, headerH, statsTop, ruleTop, h };
}

export const block: CardDesign = {
  id: 'block',
  name: 'Block',
  supportsAccent: true,

  background(opts) {
    return colors(opts).canvas;
  },

  icons(data, opts) {
    return [{ name: data.sportIcon, color: onColor(opts.accent), size: CIRCLE_ICON }];
  },

  measure(_width, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(data, opts);
    const c = colors(opts);
    ctx.fillStyle = c.card;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    const left = box.x + PAD;
    const inner = box.w - PAD * 2;
    ctx.fillStyle = c.ink;
    ctx.fillRect(left, box.y + PAD, inner, RULE);

    // Accent circle with the sport icon, top-right.
    const circleX = box.x + box.w - PAD - CIRCLE;
    const circleY = box.y + L.headerTop;
    ctx.beginPath();
    ctx.arc(circleX + CIRCLE / 2, circleY + CIRCLE / 2, CIRCLE / 2, 0, Math.PI * 2);
    ctx.fillStyle = opts.accent;
    ctx.fill();
    if (opts.theme === 'dark' && opts.accent.toUpperCase() === '#000000') {
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    const iconOff = (CIRCLE - CIRCLE_ICON) / 2;
    drawIcon(ctx, data.sportIcon, onColor(opts.accent), circleX + iconOff, circleY + iconOff, CIRCLE_ICON);

    const textW = inner - CIRCLE - 32;
    const titleTop = box.y + L.headerTop - 6;
    drawFitText(ctx, data.title, left, baseline(titleTop, TITLE), textW, { family: GROTESK, weight: 700, size: TITLE }, c.ink);
    drawFitText(
      ctx,
      data.dateText,
      left,
      baseline(titleTop + TITLE * 1.1 + 12, DATE),
      textW,
      { family: GROTESK, weight: 500, size: DATE },
      rgba(c.ink, 0.7),
    );

    drawStatGrid(ctx, L.rows, left, box.y + L.statsTop, inner, gridStyle(c.ink), 2);

    ctx.fillStyle = c.ink;
    ctx.fillRect(left, box.y + L.ruleTop, inner, RULE);

    const footerMid = box.y + L.ruleTop + RULE + FOOTER_H / 2 - 4;
    if (opts.showLogo) drawLogo(ctx, left, footerMid, LOGO, c.ink, 'left');
    ctx.font = font(GROTESK, 500, LOGO);
    ctx.fillStyle = rgba(c.ink, 0.7);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(data.timeText, left + inner, footerMid + LOGO * 0.36);
  },
};
