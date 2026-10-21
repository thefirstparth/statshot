import { BRAND, drawFitText, mix, rgba, roundRectPath, setFont, visibleStats, wrapText } from '../canvas';
import { DISPLAY, SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, metaLine } from './shared';

const H = 1280;
const PAD = 80;
const RADIUS = 56;
const TITLE = 150;
const BIG = 300;
const LINE = 48;
const TOP_TEXT = 38;

function palette(data: CardData, opts: CardOptions) {
  const c = data.sportColors;
  return opts.theme === 'dark'
    ? { paper: mix(c.fg, '#000000', 0.45), text: c.bg, glyph: rgba(c.bg, 0.16) }
    : { paper: c.bg, text: mix(c.fg, '#000000', 0.35), glyph: rgba(c.strong, 0.22) };
}

export const poster: CardDesign = {
  id: 'poster',
  name: 'Poster',
  blurb: 'Bold type, made for a story',
  supportsAccent: false,

  background(opts) {
    return opts.theme === 'dark' ? '#0B0C0E' : '#FFFFFF';
  },

  measure() {
    return { h: H };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const p = palette(data, opts);
    const x = box.x;
    const y = box.y;
    const w = box.w;
    ctx.save();
    roundRectPath(ctx, x, y, w, H, RADIUS);
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.clip();
    // The sport glyph, huge and cropped off the top-right corner.
    drawIconPath(ctx, data.sportIcon, p.glyph, x + w - 760, y - 170, 1100);
    ctx.restore();

    const inner = w - PAD * 2;
    const topY = y + 88;
    if (opts.showLogo) {
      drawFitText(ctx, BRAND, x + PAD, baseline(topY, TOP_TEXT), inner, { family: SANS, weight: 700, size: TOP_TEXT }, p.text);
    }
    drawFitText(ctx, metaLine(data), x + PAD, baseline(topY + (opts.showLogo ? TOP_TEXT * 1.3 : 0), TOP_TEXT), inner * 0.7, { family: SANS, weight: 400, size: TOP_TEXT }, p.text);

    const stats = visibleStats(data, opts);
    const [big, ...rest] = stats;
    // Bottom block, laid out from the bottom up.
    let bottom = y + H - 96;
    if (rest.length) {
      setFont(ctx, { family: SANS, weight: 600, size: LINE });
      const lines = wrapText(ctx, rest.map((s) => s.value).join(' · '), inner, 2);
      for (let i = lines.length - 1; i >= 0; i--) {
        ctx.fillStyle = p.text;
        ctx.textAlign = 'left';
        ctx.fillText(lines[i], x + PAD, bottom);
        bottom -= LINE * 1.25;
      }
      bottom -= 28;
    }
    if (big) {
      drawFitText(ctx, big.value, x + PAD - 6, bottom, inner + 6, { family: DISPLAY, weight: 800, size: BIG }, p.text, 'left', 0.35);
      bottom -= BIG * 0.86;
    }
    setFont(ctx, { family: DISPLAY, weight: 800, size: TITLE });
    const titleLines = wrapText(ctx, data.title, inner, 2);
    const titleSize = titleLines.length > 1 ? TITLE * 0.78 : TITLE;
    setFont(ctx, { family: DISPLAY, weight: 800, size: titleSize });
    const fitted = wrapText(ctx, data.title, inner, 2);
    for (let i = fitted.length - 1; i >= 0; i--) {
      ctx.fillStyle = p.text;
      ctx.textAlign = 'left';
      ctx.fillText(fitted[i], x + PAD, bottom);
      bottom -= titleSize * 0.92;
    }
  },
};
