import { drawFitText, rgba, setFont, visibleStats, type FontSpec } from '../canvas';
import { drawIconPath } from '../icons';
import { accentTones } from '../palette';
import type { CardData, CardDesign, CardOptions, StatItem, StatKey } from '../types';

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

/** Material Symbols icon per stat (filled variants exist for all of them). */
export const STAT_ICONS: Record<StatKey, string> = {
  duration: 'timer-fill',
  energy: 'local_fire_department-fill',
  avgHr: 'favorite-fill',
  maxHr: 'ecg_heart-fill',
  minHr: 'heart_minus-fill',
  zoneMin: 'monitor_heart-fill',
  distance: 'route-fill',
  timeRange: 'schedule-fill',
};

/** Scalloped "cookie" sticker shape (12 soft lobes), centred on cx, cy. */
export function cookiePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lobes = 12): void {
  ctx.beginPath();
  const steps = 192;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (0.92 + 0.08 * Math.cos(a * lobes));
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The sport glyph on a cookie sticker in the picked colour. */
export function drawSportBadge(ctx: CanvasRenderingContext2D, data: CardData, x: number, y: number, size: number, opts: CardOptions): void {
  const c = accentTones(opts);
  cookiePath(ctx, x + size / 2, y + size / 2, size / 2);
  ctx.fillStyle = c.bg;
  ctx.fill();
  const g = size * 0.52;
  drawIconPath(ctx, data.sportIcon, c.fg, x + (size - g) / 2, y + (size - g) / 2, g);
}

/** True when the card shows the start–end time as a stat, so headers should show only the date. */
export function showsTimeStat(data: CardData, opts: CardOptions): boolean {
  return visibleStats(data, opts).some((s) => s.key === 'timeRange');
}

/** True when `key` is one of the stats shown on the card (graph labels skip those values). */
export function showsStat(data: CardData, opts: CardOptions, key: StatKey): boolean {
  return visibleStats(data, opts).some((s) => s.key === key);
}

/** metaLine that leaves the time out when the time range is already a stat on the card. */
export function cardMeta(data: CardData, opts: CardOptions): string {
  return metaLine(data, !showsTimeStat(data, opts));
}

/** "Tue 20 Oct · 02:02 · Smash Club" */
export function metaLine(data: CardData, withTime = true): string {
  // With a place, the time makes way so the line stays readable instead of shrinking.
  const place = shortPlace(data);
  return [`${data.weekday} ${data.shortDate}`, withTime && !place ? data.timeText : '', place].filter(Boolean).join(' · ');
}

/** The location, shortened past `max` characters (an emoji counts as one): first part before a comma, else cut with "…". */
export function shortPlace(data: CardData, max = 26): string {
  const chars = Array.from(data.location);
  if (chars.length <= max) return data.location;
  // "Riverside Sports Club, Bengaluru" reads better as "Riverside Sports Club" than cut mid-word.
  const head = data.location.split(',')[0].trim();
  if (head && Array.from(head).length <= max) return head;
  return chars.slice(0, max - 1).join('').trimEnd() + '…';
}
