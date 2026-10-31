import { formatMinutes, hrrZone, hrrZoneStarts } from '../tcx/stats';
import { graphPoints, rgba, seriesRange, setFont, tracePath, type FontSpec, type GraphScale } from './canvas';
import { accentInk, ZONE_NAMES, zoneColors } from './palette';
import type { CardData, CardOptions, Rect } from './types';

type Ctx = CanvasRenderingContext2D;

export type ZoneItem = { index: number; name: string; minutes: number; text: string; color: string; range: string };

/** Zones with at least one (rounded) minute, light → peak. Empty when zones aren't set up. */
export function zoneItems(data: CardData, theme: CardOptions['theme']): ZoneItem[] {
  const z = data.zones;
  if (!z) return [];
  const colors = zoneColors(theme);
  const starts = hrrZoneStarts(z.restingHr, z.maxHr);
  const mins = [z.light, z.moderate, z.vigorous, z.peak];
  const ranges = [`under ${starts[0]} bpm`, `${starts[0]}–${starts[1] - 1} bpm`, `${starts[1]}–${starts[2] - 1} bpm`, `${starts[2]}+ bpm`];
  return mins
    .map((m, i) => ({ index: i, name: ZONE_NAMES[i], minutes: m, text: formatMinutes(m), color: colors[i], range: ranges[i] }))
    .filter((it) => Math.round(it.minutes) > 0);
}

/** Real time at moderate effort or harder, in minutes (null without zones). */
export function effortMinutes(data: CardData): number | null {
  const z = data.zones;
  return z ? z.moderate + z.vigorous + z.peak : null;
}

export type ZoneLineStyle = {
  lineWidth: number;
  /** Soft neutral area under the line. */
  fill?: boolean;
  scale?: GraphScale;
  /** Colour for the whole line when zones aren't set up (defaults to the picked colour). */
  fallback?: string;
};

/**
 * The heart-rate line, coloured by zone where it is (smoothed series, so it's approximate to a
 * minute or so). Without zones it is one line in the picked colour. Returns the points drawn.
 */
export function drawZoneLine(ctx: Ctx, data: CardData, rect: Rect, opts: CardOptions, style: ZoneLineStyle): [number, number][] {
  const series = data.hrSeries;
  if (series.length < 2) return [];
  const pts = graphPoints(series, rect, style.scale ?? seriesRange(series));
  const dark = opts.theme === 'dark';
  if (style.fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], rect.y + rect.h);
    tracePath(ctx, pts, false);
    ctx.lineTo(pts[pts.length - 1][0], rect.y + rect.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    const base = dark ? '#FFFFFF' : '#000000';
    g.addColorStop(0, rgba(base, dark ? 0.1 : 0.06));
    g.addColorStop(1, rgba(base, 0));
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.lineWidth = style.lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const z = data.zones;
  if (!z) {
    ctx.beginPath();
    tracePath(ctx, pts);
    ctx.strokeStyle = style.fallback ?? accentInk(opts);
    ctx.stroke();
    return pts;
  }
  const colors = zoneColors(opts.theme);
  const zoneAt = series.map((p) => hrrZone(p.bpm, z.restingHr, z.maxHr));
  let start = 0;
  for (let i = 1; i <= pts.length; i++) {
    if (i < pts.length && zoneAt[i] === zoneAt[start]) continue;
    // Each run reaches one point into the next so the colours meet without a gap.
    const run = pts.slice(start, Math.min(i + 1, pts.length));
    if (run.length >= 2) {
      ctx.beginPath();
      tracePath(ctx, run);
      ctx.strokeStyle = colors[zoneAt[start]];
      ctx.stroke();
    }
    start = i;
  }
  return pts;
}

/**
 * One line of "● Light 54m  ● Moderate 1h 33m …" for the zones reached. Returns the width used
 * (0 when there's nothing to show). Shrinks the font to fit `maxW`.
 */
export function drawZoneLegend(
  ctx: Ctx,
  items: ZoneItem[],
  x: number,
  y: number,
  maxW: number,
  opts: { size: number; ink: string; muted: string; family: string; align?: 'left' | 'center' },
): number {
  if (items.length === 0) return 0;
  const measure = (size: number) => {
    const name: FontSpec = { family: opts.family, weight: 500, size };
    const val: FontSpec = { family: opts.family, weight: 700, size };
    const dot = size * 0.62;
    const gapIn = size * 0.4;
    const gapOut = size * 1.1;
    const parts = items.map((it) => {
      setFont(ctx, name);
      const nw = ctx.measureText(it.name).width;
      setFont(ctx, val);
      const vw = ctx.measureText(it.text).width;
      return { it, nw, vw, w: dot + gapIn + nw + gapIn + vw };
    });
    const total = parts.reduce((s, p) => s + p.w, 0) + gapOut * (parts.length - 1);
    return { name, val, dot, gapIn, gapOut, parts, total };
  };
  let size = opts.size;
  let m = measure(size);
  while (m.total > maxW && size > opts.size * 0.6) {
    size *= 0.94;
    m = measure(size);
  }
  let cx = opts.align === 'center' ? x + (maxW - m.total) / 2 : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const p of m.parts) {
    ctx.beginPath();
    ctx.arc(cx + m.dot / 2, y - size * 0.34, m.dot / 2, 0, Math.PI * 2);
    ctx.fillStyle = p.it.color;
    ctx.fill();
    cx += m.dot + m.gapIn;
    setFont(ctx, m.name);
    ctx.fillStyle = opts.muted;
    ctx.fillText(p.it.name, cx, y);
    cx += p.nw + m.gapIn;
    setFont(ctx, m.val);
    ctx.fillStyle = opts.ink;
    ctx.fillText(p.it.text, cx, y);
    cx += p.vw + m.gapOut;
  }
  return m.total;
}
