import { drawFitText, rgba, setFont, visibleStats, type FontSpec } from '../canvas';
import type { CardDesign, StatItem } from '../types';

type Ctx = CanvasRenderingContext2D;

/** Approximate ascent used to place a baseline from the top of a line box. */
export const ASCENT = 0.93;

export function baseline(top: number, size: number): number {
  return top + size * ASCENT;
}

export type StatGridStyle = {
  label: FontSpec;
  value: FontSpec;
  ink: string;
  labelAlpha: number;
  gap: number; // between the label line and the value line
  rowGap: number;
  align: 'left' | 'center';
  /** Inset of left-aligned text inside its column. */
  inset?: number;
  valueFirst?: boolean;
};

export function statRowHeight(s: StatGridStyle): number {
  return s.label.size * 1.2 + s.gap + s.value.size * 1.12;
}

export function statGridHeight(rows: number, s: StatGridStyle): number {
  if (rows <= 0) return 0;
  return rows * statRowHeight(s) + (rows - 1) * s.rowGap;
}

/**
 * Draws rows of stats into columns of equal width. Each row distributes its own items, so
 * a 3+2 split stays balanced. Returns the height used.
 */
export function drawStatGrid(
  ctx: Ctx,
  rows: StatItem[][],
  x: number,
  y: number,
  w: number,
  s: StatGridStyle,
  columns?: number,
): number {
  const rowH = statRowHeight(s);
  const labelH = s.label.size * 1.2;
  const valueH = s.value.size * 1.12;
  rows.forEach((row, r) => {
    const top = y + r * (rowH + s.rowGap);
    const cols = columns ?? row.length;
    const colW = w / cols;
    row.forEach((item, i) => {
      const inset = s.align === 'left' ? (s.inset ?? 0) : 0;
      const cx = s.align === 'center' ? x + colW * (i + 0.5) : x + colW * i + inset;
      const maxW = colW - (s.align === 'center' ? 24 : inset + 24);
      const labelTop = s.valueFirst ? top + valueH + s.gap : top;
      const valueTop = s.valueFirst ? top : top + labelH + s.gap;
      drawFitText(
        ctx,
        item.label,
        cx,
        baseline(labelTop, s.label.size),
        maxW,
        s.label,
        rgba(s.ink, s.labelAlpha),
        s.align,
        0.7,
      );
      drawFitText(ctx, item.value, cx, baseline(valueTop, s.value.size), maxW, s.value, s.ink, s.align, 0.6);
    });
  });
  return statGridHeight(rows.length, s);
}

/** Measures text with a given font through any context. */
export function textWidth(ctx: Ctx, text: string, f: FontSpec): number {
  setFont(ctx, f);
  return ctx.measureText(text).width;
}

export function dateLine(dateText: string, timeText: string): string {
  return `${dateText} · ${timeText}`;
}

/**
 * Temporary stand-in used while a design is being drawn: title, date and the stats as text.
 * Each real design replaces its file wholesale.
 */
export function placeholderDesign(id: string, name: string, blurb: string): CardDesign {
  const pad = 64;
  return {
    id,
    name,
    blurb,
    supportsAccent: false,
    background: (opts) => (opts.theme === 'dark' ? '#111214' : '#F6F7F9'),
    measure: (_w, data, opts) => ({ h: pad * 2 + 140 + visibleStats(data, opts).length * 90 }),
    draw(ctx, box, data, opts) {
      const ink = opts.theme === 'dark' ? '#FFFFFF' : '#111214';
      drawFitText(ctx, data.title, box.x + pad, box.y + pad + 70, box.w - pad * 2, { size: 72, weight: 700 }, ink);
      visibleStats(data, opts).forEach((s, i) => {
        drawFitText(ctx, `${s.label}: ${s.value}`, box.x + pad, box.y + pad + 200 + i * 90, box.w - pad * 2, { size: 48 }, ink);
      });
    },
  };
}
