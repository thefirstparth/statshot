import { drawFitText, drawLogo, ellipsize, mix, rgba, roundRectPath, setFont, visibleStats, wrapText, type FontSpec } from '../canvas';
import { DISPLAY, SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import { accentByKey, isMono } from '../palette';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { baseline, cardMeta } from './shared';

type Ctx = CanvasRenderingContext2D;

const H = 1280;
const PAD_X = 80;
const PAD_TOP = 88;
const PAD_BOTTOM = 80;
const RADIUS = 56;
const TOP_TEXT = 38;
const TITLE = 150;
const LABEL = 34;
const BIG = 300;
const BIG_UNIT = 0.32; // "kcal", "bpm"
const BIG_UNIT_HM = 0.62; // the h/m of a duration
const LINE = 48;
const LINE_LH = 1.25;
const LOGO = 22;

type Pal = { paper: string; text: string; soft: string; glyph: string };

/** Panel colours from the picked colour: deep paper with pale ink on dark, pastel paper with deep ink on light. */
function palette(opts: CardOptions): Pal {
  const dark = opts.theme === 'dark';
  const a = accentByKey(opts.accent);
  const shadeDark = a?.dark ?? opts.accent;
  const shadeLight = a?.light ?? opts.accent;
  if (isMono(opts.accent)) {
    // Graphite on dark, light grey on light.
    if (dark) {
      const text = mix(shadeDark, '#000000', 0.05);
      return { paper: mix(shadeDark, '#000000', 0.84), text, soft: rgba(text, 0.7), glyph: rgba(text, 0.08) };
    }
    return { paper: mix(shadeLight, '#FFFFFF', 0.92), text: shadeLight, soft: rgba(shadeLight, 0.62), glyph: rgba(shadeLight, 0.06) };
  }
  if (dark) {
    const text = mix(shadeDark, '#FFFFFF', 0.75);
    return { paper: mix(shadeDark, '#000000', 0.73), text, soft: rgba(text, 0.72), glyph: rgba(text, 0.16) };
  }
  const text = mix(shadeLight, '#000000', 0.55);
  return { paper: mix(shadeDark, '#FFFFFF', 0.76), text, soft: rgba(text, 0.72), glyph: rgba(shadeLight, 0.13) };
}

/** The big number: the user's pick, or the duration when this file lacks it. */
function bigItem(data: CardData, opts: CardOptions): StatItem | undefined {
  return data.stats[opts.bigStat] ?? data.stats.duration;
}

/** "2h 53m" → [["2","h"],["53","m"]]; "1030" + "kcal" → [["1030","kcal"]]. */
function bigParts(item: StatItem): [string, string][] {
  if (item.unit) return [[item.number, item.unit]];
  const parts = [...item.number.matchAll(/(\d+)\s*([hms])/g)].map((m) => [m[1], m[2]] as [string, string]);
  return parts.length && parts.map((p) => p.join('')).join(' ') === item.number ? parts : [[item.number, '']];
}

/** Big number with a smaller unit on the same baseline; the whole group shrinks to fit. */
function drawBig(ctx: Ctx, item: StatItem, x: number, by: number, maxW: number, ink: string): void {
  const parts = bigParts(item);
  const unitK = parts.every(([, u]) => u.length === 1) ? BIG_UNIT_HM : BIG_UNIT;
  const measure = (size: number) => {
    const num: FontSpec = { family: DISPLAY, weight: 800, size };
    const unit: FontSpec = { family: DISPLAY, weight: 800, size: size * unitK };
    const pieces = parts.map(([n, u]) => {
      setFont(ctx, num);
      const nw = ctx.measureText(n).width;
      setFont(ctx, unit);
      const uw = u ? ctx.measureText(u).width : 0;
      return { n, u, nw, uw, gap: u ? size * (u.length > 1 ? 0.06 : 0.01) : 0 };
    });
    const space = size * 0.2;
    const total = pieces.reduce((s, p) => s + p.nw + p.gap + p.uw, 0) + space * (pieces.length - 1);
    return { num, unit, pieces, space, total };
  };
  let m = measure(BIG);
  if (m.total > maxW) m = measure(BIG * (maxW / m.total));
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let cx = x - m.num.size * 0.02;
  for (const p of m.pieces) {
    setFont(ctx, m.num);
    ctx.fillText(p.n, cx, by);
    cx += p.nw + p.gap;
    if (p.u) {
      setFont(ctx, m.unit);
      ctx.fillText(p.u, cx, by);
      cx += p.uw;
    }
    cx += m.space;
  }
}

/** The other stats as one sentence, wrapping only between stats. Shrinks before it ever drops one. */
function sentence(ctx: Ctx, phrases: string[], maxW: number): { lines: string[]; size: number } {
  const build = (size: number) => {
    setFont(ctx, { family: SANS, weight: 600, size });
    const lines: string[] = [];
    for (const p of phrases) {
      const last = lines[lines.length - 1];
      if (last && ctx.measureText(`${last} · ${p}`).width <= maxW) lines[lines.length - 1] = `${last} · ${p}`;
      else lines.push(ellipsize(ctx, p, maxW));
    }
    return lines;
  };
  for (const k of [1, 0.92, 0.85]) {
    const lines = build(LINE * k);
    if (lines.length <= 3) return { lines, size: LINE * k };
  }
  return { lines: build(LINE * 0.85), size: LINE * 0.85 };
}

export const poster: CardDesign = {
  id: 'poster',
  name: 'Poster',
  blurb: 'Bold type, made for a story',
  supportsAccent: true,
  supportsBigStat: true,

  background(opts) {
    return opts.theme === 'dark' ? '#0B0C0E' : '#FFFFFF';
  },

  measure() {
    return { h: H };
  },

  draw(ctx: Ctx, box: Rect, data: CardData, opts: CardOptions) {
    const p = palette(opts);
    const { x, y, w } = box;
    ctx.save();
    roundRectPath(ctx, x, y, w, H, RADIUS);
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.clip();
    // The sport glyph, huge and cropped off the top-right corner.
    drawIconPath(ctx, data.sportIcon, p.glyph, x + w - 760, y - 170, 1100);
    ctx.restore();

    const inner = w - PAD_X * 2;
    const left = x + PAD_X;
    // Date (and start time unless the time range is in the sentence below).
    drawFitText(ctx, cardMeta(data, opts), left, baseline(y + PAD_TOP, TOP_TEXT), inner * 0.72, { family: SANS, weight: 400, size: TOP_TEXT }, p.text, 'left', 0.7);

    // Bottom block, laid out from the bottom up.
    let bottom = y + H - PAD_BOTTOM;
    if (opts.showLogo) {
      drawLogo(ctx, left, bottom - LOGO * 0.5, LOGO, rgba(p.text, 0.5));
      bottom -= LOGO + 36;
    }

    const big = bigItem(data, opts);
    const rest = visibleStats(data, opts).filter((s) => s.key !== big?.key);
    if (rest.length) {
      const s = sentence(ctx, rest.map((st) => st.phrase), inner);
      setFont(ctx, { family: SANS, weight: 600, size: s.size });
      ctx.fillStyle = p.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      for (let i = s.lines.length - 1; i >= 0; i--) {
        ctx.fillText(s.lines[i], left, bottom - s.size * 0.22);
        bottom -= s.size * LINE_LH;
      }
      bottom -= 28;
    }
    if (big) {
      drawBig(ctx, big, left, bottom - BIG * 0.05, inner, p.text);
      bottom -= BIG * 0.76;
      drawFitText(ctx, big.label, left, bottom - 16, inner, { family: SANS, weight: 600, size: LABEL }, p.soft, 'left', 0.7);
      bottom -= 16 + LABEL + 44;
    }
    // Biggest size at which the title fits on two lines without cutting a word (three at the smallest).
    let titleSize = TITLE;
    let fitted: string[] = [];
    for (const [k, lines] of [[1, 2], [0.78, 2], [0.62, 2], [0.5, 2], [0.5, 3]]) {
      titleSize = TITLE * k;
      setFont(ctx, { family: DISPLAY, weight: 800, size: titleSize });
      fitted = wrapText(ctx, data.title, inner, lines);
      if (!fitted.some((l) => l.endsWith('…'))) break;
    }
    setFont(ctx, { family: DISPLAY, weight: 800, size: titleSize });
    ctx.fillStyle = p.text;
    ctx.textAlign = 'left';
    for (let i = fitted.length - 1; i >= 0; i--) {
      ctx.fillText(fitted[i], left, bottom);
      bottom -= titleSize * 0.92;
    }
  },
};
