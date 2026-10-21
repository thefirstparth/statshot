import { drawFitText, drawLogo, mix, rgba, roundRectPath, statRows, themeInk, visibleStats } from '../canvas';
import { SANS } from '../font-faces';
import { drawIcon } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, dateLine, drawStatGrid, statGridHeight, type StatGridStyle } from './shared';

const PAD = 72;
const ICON = 96;
const TITLE = 64;
const DATE = 36;
const LOGO = 30;

function gridStyle(opts: CardOptions): StatGridStyle {
  return {
    label: { family: SANS, weight: 400, size: 28 },
    value: { family: SANS, weight: 600, size: 48 },
    ink: themeInk(opts),
    labelAlpha: 0.6,
    gap: 8,
    rowGap: 40,
    align: 'center',
  };
}

function layout(data: CardData, opts: CardOptions) {
  const rows = statRows(visibleStats(data, opts));
  const iconTop = PAD;
  const titleTop = iconTop + ICON + 32;
  const dateTop = titleTop + TITLE * 1.2 + 4;
  const statsTop = dateTop + DATE * 1.2 + 56;
  const statsH = statGridHeight(rows.length, gridStyle(opts));
  const footerTop = statsTop + statsH + 64;
  const h = opts.showLogo ? footerTop + LOGO + PAD : statsTop + statsH + PAD;
  return { rows, iconTop, titleTop, dateTop, statsTop, footerTop, h };
}

export const glass: CardDesign = {
  id: 'glass',
  name: 'Glass',
  supportsAccent: true,

  background(opts) {
    return opts.theme === 'dark' ? mix(opts.accent, '#0B0B0E', 0.8) : mix(opts.accent, '#FFFFFF', 0.82);
  },

  icons(data, opts) {
    return [{ name: data.sportIcon, color: opts.accent, size: ICON }];
  },

  measure(_width, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(data, opts);
    const ink = themeInk(opts);
    const dark = opts.theme === 'dark';
    const cx = box.x + box.w / 2;

    // Frosted panel + 2 px inner stroke.
    roundRectPath(ctx, box.x, box.y, box.w, box.h, 56);
    ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.08)';
    ctx.fill();
    roundRectPath(ctx, box.x + 1, box.y + 1, box.w - 2, box.h - 2, 55);
    ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.10)';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawIcon(ctx, data.sportIcon, opts.accent, cx - ICON / 2, box.y + L.iconTop, ICON);

    const maxW = box.w - PAD * 2;
    drawFitText(ctx, data.title, cx, box.y + baseline(L.titleTop, TITLE), maxW, { family: SANS, weight: 600, size: TITLE }, ink, 'center');
    drawFitText(
      ctx,
      dateLine(data.dateText, data.timeText),
      cx,
      box.y + baseline(L.dateTop, DATE),
      maxW,
      { family: SANS, weight: 400, size: DATE },
      rgba(ink, 0.6),
      'center',
    );

    drawStatGrid(ctx, L.rows, box.x + PAD / 2, box.y + L.statsTop, box.w - PAD, gridStyle(opts));

    if (opts.showLogo) {
      const y = box.y + L.footerTop;
      ctx.fillStyle = rgba(ink, dark ? 0.18 : 0.12);
      ctx.fillRect(box.x + PAD, y - 34, box.w - PAD * 2, 2);
      drawLogo(ctx, cx, y + LOGO / 2 + 4, LOGO, rgba(ink, 0.85), 'center');
    }
  },
};
