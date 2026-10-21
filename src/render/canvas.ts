import type { HrSample } from '../tcx/parse';
import { font, SANS } from './font-faces';
import type { CardData, CardOptions, StatItem } from './types';

type Ctx = CanvasRenderingContext2D;

// ── Colour ────────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Linear mix of two hex colours; t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever reads better on `bg`. */
export function onColor(bg: string): string {
  return luminance(bg) > 0.45 ? '#000000' : '#FFFFFF';
}

/** Light text for the dark theme, dark text for the light theme. */
export function themeInk(opts: CardOptions): string {
  return opts.theme === 'dark' ? '#FFFFFF' : '#111214';
}

// ── Shapes ────────────────────────────────────────────────────────────────────

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function fillRoundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ── Text ──────────────────────────────────────────────────────────────────────

export type FontSpec = {
  family?: string;
  weight?: number;
  size: number;
  style?: 'normal' | 'italic';
};

export function setFont(ctx: Ctx, f: FontSpec): void {
  ctx.font = font(f.family ?? SANS, f.weight ?? 400, f.size, f.style ?? 'normal');
}

/** Cuts text to fit maxWidth with a trailing ellipsis (uses the current ctx.font). */
export function ellipsize(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = chars.slice(0, mid).join('').trimEnd() + '…';
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? '…' : chars.slice(0, lo).join('').trimEnd() + '…';
}

/**
 * Shrinks the font until the text fits on one line (down to minScale of the base size), then
 * ellipsizes. Leaves ctx.font set to the chosen size and returns the text to draw.
 */
export function fitText(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  f: FontSpec,
  minScale = 0.6,
): { text: string; size: number } {
  setFont(ctx, f);
  const w = ctx.measureText(text).width;
  if (w <= maxWidth) return { text, size: f.size };
  const size = Math.max(f.size * minScale, Math.floor(f.size * (maxWidth / w) * 100) / 100);
  setFont(ctx, { ...f, size });
  return { text: ellipsize(ctx, text, maxWidth), size };
}

/** Draws a single line, shrinking/ellipsizing to fit. Returns the drawn width. */
export function drawFitText(
  ctx: Ctx,
  text: string,
  x: number,
  baseline: number,
  maxWidth: number,
  f: FontSpec,
  color: string,
  align: CanvasTextAlign = 'left',
  minScale = 0.6,
): number {
  const fitted = fitText(ctx, text, maxWidth, f, minScale);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fitted.text, x, baseline);
  return ctx.measureText(fitted.text).width;
}

/** Greedy word wrap (current ctx.font). Long words are ellipsized. */
export function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines = 6): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const out = lines.map((l) => ellipsize(ctx, l, maxWidth));
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(ctx, kept[maxLines - 1] + '…', maxWidth);
    return kept;
  }
  return out;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/** Selected stats that have data, in the user's order. Never empty. */
export function visibleStats(data: CardData, opts: CardOptions): StatItem[] {
  const out = opts.stats.map((k) => data.stats[k]).filter((s): s is StatItem => !!s);
  if (out.length > 0) return out;
  return data.stats.duration ? [data.stats.duration] : [];
}

/** Splits items into balanced rows of at most `perRow`: 4 → 2+2, 5 → 3+2, 6 → 3+3. */
export function splitRows<T>(items: T[], perRow: number): T[][] {
  if (items.length === 0) return [];
  const rows = Math.ceil(items.length / perRow);
  const base = Math.ceil(items.length / rows);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += base) out.push(items.slice(i, i + base));
  return out;
}

/** Glass/Pulse/Zones-style rows: ≤3 per row, 2 rows when there are more than 3. */
export function statRows(items: StatItem[]): StatItem[][] {
  return splitRows(items, items.length === 4 ? 2 : 3);
}

// ── Randomness ────────────────────────────────────────────────────────────────

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Logo ──────────────────────────────────────────────────────────────────────

/** The 3-bar glyph, drawn with paths into a size×size square. */
export function drawLogoGlyph(ctx: Ctx, x: number, y: number, size: number, color: string): void {
  const barW = size * 0.24;
  const gap = (size - barW * 3) / 2;
  const heights = [0.5, 0.75, 1];
  ctx.fillStyle = color;
  heights.forEach((hf, i) => {
    const h = size * hf;
    roundRectPath(ctx, x + i * (barW + gap), y + size - h, barW, h, barW * 0.45);
    ctx.fill();
  });
}

const LOGO_TEXT = 'Statshot';

export function measureLogo(ctx: Ctx, size: number, family = SANS, style: 'normal' | 'italic' = 'normal'): number {
  ctx.font = font(family, 600, size, style);
  return size * 0.78 + size * 0.36 + ctx.measureText(LOGO_TEXT).width;
}

/**
 * Wordmark + glyph. `size` is the text size; the glyph matches cap height. `y` is the
 * vertical centre of the mark. Returns the drawn width.
 */
export function drawLogo(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
): number {
  const w = measureLogo(ctx, size);
  const left = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
  const glyph = size * 0.78;
  drawLogoGlyph(ctx, left, y - glyph / 2 - size * 0.02, glyph, color);
  ctx.font = font(SANS, 600, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(LOGO_TEXT, left + glyph + size * 0.36, y + size * 0.36);
  return w;
}

// ── Heart-rate graphs ─────────────────────────────────────────────────────────

export type GraphScale = { min: number; max: number };

export function seriesRange(series: HrSample[]): GraphScale {
  let min = Infinity;
  let max = -Infinity;
  for (const p of series) {
    if (p.bpm < min) min = p.bpm;
    if (p.bpm > max) max = p.bpm;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  if (max - min < 10) {
    const mid = (max + min) / 2;
    return { min: mid - 5, max: mid + 5 };
  }
  return { min, max };
}

export function graphPoints(
  series: HrSample[],
  rect: { x: number; y: number; w: number; h: number },
  scale: GraphScale,
): [number, number][] {
  if (series.length === 0) return [];
  const t0 = series[0].t;
  const span = Math.max(1, series[series.length - 1].t - t0);
  const range = Math.max(1, scale.max - scale.min);
  return series.map((p) => [
    rect.x + ((p.t - t0) / span) * rect.w,
    rect.y + rect.h - ((p.bpm - scale.min) / range) * rect.h,
  ]);
}

/** Smooth path through the points (quadratic midpoints). Starts a new path. */
export function tracePath(ctx: Ctx, pts: [number, number][], moveFirst = true): void {
  if (pts.length === 0) return;
  if (moveFirst) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

export type GraphStyle = {
  color: string;
  lineWidth: number;
  fillFrom?: number; // alpha at the top of the area fill; omit for a bare line
  scale?: GraphScale;
};

/** Line (and optional gradient area) chart of the HR series inside rect. */
export function drawHrGraph(
  ctx: Ctx,
  series: HrSample[],
  rect: { x: number; y: number; w: number; h: number },
  style: GraphStyle,
): [number, number][] {
  if (series.length < 2) return [];
  const pts = graphPoints(series, rect, style.scale ?? seriesRange(series));
  if (style.fillFrom !== undefined) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], rect.y + rect.h);
    tracePath(ctx, pts, false);
    ctx.lineTo(pts[pts.length - 1][0], rect.y + rect.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    g.addColorStop(0, rgba(style.color, style.fillFrom));
    g.addColorStop(1, rgba(style.color, 0));
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.beginPath();
  tracePath(ctx, pts);
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  return pts;
}

/** Evenly resampled bar heights (0–1) for tiny bar sparklines. */
export function sparkBars(series: HrSample[], count: number): number[] {
  if (series.length === 0) return [];
  const { min, max } = seriesRange(series);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * series.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * series.length) / count));
    let sum = 0;
    for (let j = from; j < to; j++) sum += series[Math.min(j, series.length - 1)].bpm;
    const v = sum / (to - from);
    out.push((v - min) / Math.max(1, max - min));
  }
  return out;
}
