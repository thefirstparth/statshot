import { drawFitText, drawLogo, fillRoundRect, fitText, luminance, mix, rgba, setFont, splitRows, visibleStats } from '../canvas';
import { DISPLAY, SANS } from '../font-faces';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, drawSportBadge, metaLine } from './shared';

const BADGE = 128;
const TITLE = 66;
const SUB = 36;
const BIG = 360;
const BIG_UNIT = 96;
const BAR_W = 220;
const BAR_H = 20;
const SEC_VALUE = 84;
const SEC_LABEL = 34;
const SEC_ROW = SEC_VALUE + 10 + SEC_LABEL * 1.2;
const LOGO = 30;
const INSET = 48;

function ink(opts: CardOptions) {
  return opts.theme === 'dark' ? { ink: '#FFFFFF', muted: 'rgba(255,255,255,0.68)' } : { ink: '#15171A', muted: 'rgba(21,23,26,0.62)' };
}

/** Accent readable on the theme: very light accents get darkened on light cards and vice versa. */
function readable(accent: string, opts: CardOptions): string {
  const l = luminance(accent);
  if (opts.theme === 'light' && l > 0.5) return mix(accent, '#000000', 0.32);
  if (opts.theme === 'dark' && l < 0.08) return mix(accent, '#FFFFFF', 0.45);
  return accent;
}

function layout(data: CardData, opts: CardOptions) {
  const stats = visibleStats(data, opts);
  const [hero, ...rest] = stats;
  const rows = splitRows(rest, 3);
  const bigTop = BADGE + 64;
  const barTop = bigTop + BIG * 0.8 + 64;
  const secTop = barTop + BAR_H + 56;
  const secH = rows.length ? rows.length * SEC_ROW + (rows.length - 1) * 36 : 0;
  const end = rows.length ? secTop + secH : barTop + BAR_H;
  const logoTop = end + 96;
  const h = opts.showLogo ? logoTop + LOGO * 1.2 : end;
  return { hero, rows, bigTop, barTop, secTop, logoTop, h };
}

export const hero: CardDesign = {
  id: 'hero',
  name: 'Hero number',
  blurb: 'One big number',
  floating: true,
  supportsAccent: true,

  background(opts) {
    return opts.theme === 'dark' ? '#0F1012' : '#F6F7F9';
  },

  measure(_w, data, opts) {
    return { h: layout(data, opts).h + INSET * 2 };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const { ink: text, muted } = ink(opts);
    const accent = readable(opts.accent, opts);
    const L = layout(data, opts);
    // Breathing room so the big number never runs to the image edge.
    box = { x: box.x + INSET, y: box.y + INSET, w: box.w - INSET * 2, h: box.h - INSET * 2 };
    const x = box.x;
    const w = box.w;

    drawSportBadge(ctx, data, x, box.y, BADGE, opts.theme === 'dark');
    const tx = x + BADGE + 28;
    const tw = w - BADGE - 28;
    const titleSize = fitText(ctx, data.title, tw, { family: SANS, weight: 700, size: TITLE }, 0.6).size;
    const blockH = titleSize * 1.05 + 8 + SUB * 1.2;
    const top = box.y + (BADGE - blockH) / 2;
    drawFitText(ctx, data.title, tx, baseline(top, titleSize), tw, { family: SANS, weight: 700, size: TITLE }, text, 'left', 0.6);
    drawFitText(ctx, metaLine(data), tx, baseline(top + titleSize * 1.05 + 8, SUB), tw, { family: SANS, weight: 400, size: SUB }, muted);

    if (L.hero) {
      // The one big number, its unit in the accent colour on the same baseline.
      const unit = L.hero.unit;
      setFont(ctx, { family: SANS, weight: 700, size: BIG_UNIT });
      const unitW = unit ? ctx.measureText(unit).width + 24 : 0;
      const by = box.y + L.bigTop + BIG * 0.8;
      const numW = drawFitText(ctx, L.hero.number, x - 6, by, w - unitW, { family: DISPLAY, weight: 800, size: BIG }, text, 'left', 0.3);
      if (unit) drawFitText(ctx, unit, x + numW + 18, by, w - numW - 18, { family: SANS, weight: 700, size: BIG_UNIT }, accent, 'left', 0.5);
      // Label above the number keeps "what is this?" obvious.
      drawFitText(ctx, L.hero.label, x, box.y + L.bigTop + 8, w, { family: SANS, weight: 600, size: 34 }, muted);
    }

    fillRoundRect(ctx, x, box.y + L.barTop, BAR_W, BAR_H, BAR_H / 2, accent);

    L.rows.forEach((row, r) => {
      const colW = w / 3;
      const ry = box.y + L.secTop + r * (SEC_ROW + 36);
      row.forEach((item, i) => {
        const cx = x + i * colW;
        drawFitText(ctx, item.value, cx, ry + SEC_VALUE * 0.86, colW - 44, { family: DISPLAY, weight: 800, size: SEC_VALUE }, text, 'left', 0.3);
        drawFitText(ctx, item.label, cx, baseline(ry + SEC_VALUE + 10, SEC_LABEL), colW - 24, { family: SANS, weight: 500, size: SEC_LABEL }, muted, 'left', 0.7);
      });
    });

    if (opts.showLogo) drawLogo(ctx, x, box.y + L.logoTop + LOGO * 0.6, LOGO, rgba(text, 0.6));
  },
};
