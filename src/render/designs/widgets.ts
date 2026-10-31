import { drawFitText, drawLogo, fillRoundRect, mix, rgba, roundRectPath, setFont, visibleStats, type FontSpec } from '../canvas';
import { SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import { accentInk, isMono } from '../palette';
import { drawZoneLegend, drawZoneLine, zoneItems } from '../zone-graph';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { showsStat, STAT_ICONS } from './shared';

const GAP = 28;
const TILE = 446; // a small square widget: (920 - GAP) / 2
const RADIUS = 52;
const P = 36; // inner padding
const ICON = 56;
const NUM = 80;
const UNIT = 36;
const CAP = 28;
const TINY = 24;
const LOGO = 24;

// Material Symbols Rounded glyphs the icon set doesn't ship (bolt, bedtime, light_mode), 0 -960 960 960 box.
const GLYPHS: Record<string, string> = {
  bolt: 'M360-360H217q-18 0-26.5-16t2.5-31l338-488q8-11 20-15t24 1q12 5 19 16t5 24l-39 309h176q19 0 27 17t-4 32L388-66q-8 10-20.5 13T344-55q-11-5-17.5-16T322-95l38-265Z',
  moon: 'M484-80q-84 0-157.5-32t-128-86.5Q144-253 112-326.5T80-484q0-132 77.5-238T361-868q17-5 31 5t12 27q-7 88 23.5 169.5T521-522q63 63 145 94t170 24q17-2 26.5 13t4.5 32q-40 125-145.5 202T484-80Z',
  sun: 'M480-280q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM70-450q-13 0-21.5-8.5T40-480q0-13 8.5-21.5T70-510h100q13 0 21.5 8.5T200-480q0 13-8.5 21.5T170-450H70Zm720 0q-13 0-21.5-8.5T760-480q0-13 8.5-21.5T790-510h100q13 0 21.5 8.5T920-480q0 13-8.5 21.5T890-450H790ZM480-760q-13 0-21.5-8.5T450-790v-100q0-13 8.5-21.5T480-920q13 0 21.5 8.5T510-890v100q0 13-8.5 21.5T480-760Zm0 720q-13 0-21.5-8.5T450-70v-100q0-13 8.5-21.5T480-200q13 0 21.5 8.5T510-170v100q0 13-8.5 21.5T480-40Z',
};

function drawGlyph(ctx: CanvasRenderingContext2D, name: string, color: string, x: number, y: number, size: number): void {
  if (typeof Path2D === 'undefined') return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 960, size / 960);
  ctx.translate(0, 960);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(GLYPHS[name]));
  ctx.restore();
}

function colors(opts: CardOptions) {
  const accent = accentInk(opts);
  const dark = opts.theme === 'dark';
  const base = dark
    ? { canvas: '#0B0B0D', tile: '#1A1B1F', ink: '#F2F3F5', muted: '#8D929B', track: '#2C2E34' }
    : { canvas: '#EEF0F3', tile: '#FFFFFF', ink: '#15171A', muted: '#6B7079', track: '#E6E8EB' };
  // The hero widget is filled with the picked colour: dark ink on the bright dark-theme shades,
  // white on the deeper light-theme shades (Mono: white tile on dark, black tile on light).
  const onHero = dark ? (isMono(opts.accent) ? '#15171A' : mix(accent, '#000000', 0.86)) : '#FFFFFF';
  return { ...base, accent, hero: accent, onHero };
}

type C = ReturnType<typeof colors>;

type Tile = { kind: 'hero'; stat: StatItem } | { kind: 'time' } | { kind: 'effort'; stat: StatItem } | { kind: 'stat'; stat: StatItem };
type Row = { kind: 'pair'; tiles: Tile[] } | { kind: 'wide'; tile: Tile } | { kind: 'graph' };

function toTile(s: StatItem): Tile {
  if (s.key === 'timeRange') return { kind: 'time' };
  if (s.key === 'zoneMin') return { kind: 'effort', stat: s };
  return { kind: 'stat', stat: s };
}

/**
 * Small square widgets in pairs. The accent widget holds duration (or the first stat when
 * duration is off); with an odd count it goes full width, so 1–6 stats always fill whole rows.
 * The heart-rate graph sits after the first pair of small widgets when more follow.
 */
function layout(data: CardData, opts: CardOptions) {
  const stats = visibleStats(data, opts);
  const hero = stats.find((s) => s.key === 'duration') ?? stats[0];
  const others = stats.filter((s) => s !== hero).map(toTile);
  const heroTile: Tile = { kind: 'hero', stat: hero };
  const wideHero = stats.length % 2 === 1;
  const smalls = wideHero ? others : [heroTile, ...others];
  const pairs: Row[] = [];
  for (let i = 0; i < smalls.length; i += 2) pairs.push({ kind: 'pair', tiles: smalls.slice(i, i + 2) });
  const graph = opts.showGraph && data.hrSeries.length > 1;
  const rows: Row[] = wideHero ? [{ kind: 'wide', tile: heroTile }] : [];
  pairs.forEach((r, i) => {
    rows.push(r);
    if (graph && i === 0 && pairs.length > 1) rows.push({ kind: 'graph' });
  });
  if (graph && !rows.some((r) => r.kind === 'graph')) rows.push({ kind: 'graph' });
  const gridH = rows.length * TILE + (rows.length - 1) * GAP;
  const logoTop = gridH + 32;
  const h = opts.showLogo ? logoTop + LOGO * 1.2 + 8 : gridH;
  const timeTile = stats.some((s) => s.key === 'timeRange');
  return { rows, smalls, timeTile, logoTop, h };
}

/** Big number with a smaller unit after it. */
function drawNumber(ctx: CanvasRenderingContext2D, s: { number: string; unit: string }, x: number, y: number, k: number, color: string, size = NUM): void {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  setFont(ctx, { family: SANS, weight: 700, size: size * k });
  ctx.fillText(s.number, x, y);
  if (!s.unit) return;
  const nx = x + ctx.measureText(s.number).width + 6 * k;
  setFont(ctx, { family: SANS, weight: 600, size: UNIT * k * (size / NUM) });
  ctx.fillText(s.unit, nx, y);
}

function numberWidth(ctx: CanvasRenderingContext2D, s: { number: string; unit: string }, k: number, size = NUM): number {
  setFont(ctx, { family: SANS, weight: 700, size: size * k });
  let w = ctx.measureText(s.number).width;
  if (s.unit) {
    setFont(ctx, { family: SANS, weight: 600, size: UNIT * k * (size / NUM) });
    w += 6 * k + ctx.measureText(s.unit).width;
  }
  return w;
}

/** What a small widget prints as its big number. */
function tileNumber(data: CardData, t: Tile): { number: string; unit: string } {
  if (t.kind === 'time') return { number: data.timeText, unit: '' };
  return { number: t.stat.number, unit: t.stat.unit };
}

function partOfDay(min: number): { name: string; glyph: string } {
  if (min < 300) return { name: 'Night', glyph: 'moon' };
  if (min < 720) return { name: 'Morning', glyph: 'sun' };
  if (min < 1020) return { name: 'Afternoon', glyph: 'sun' };
  if (min < 1260) return { name: 'Evening', glyph: 'moon' };
  return { name: 'Night', glyph: 'moon' };
}

/** Bottom block of a widget: number then caption, anchored to the bottom padding. */
function bottomBaselines(y: number, h: number, size = NUM): { num: number; cap: number } {
  const cap = y + h - P - CAP * 0.28;
  return { cap, num: cap - CAP - 16 - size * 0.06 };
}

function drawTile(ctx: CanvasRenderingContext2D, t: Tile, x: number, y: number, w: number, k: number, data: CardData, opts: CardOptions, c: C): void {
  const inner = w - P * 2;
  const tiny: FontSpec = { family: SANS, weight: 500, size: TINY };
  const cap: FontSpec = { family: SANS, weight: 500, size: CAP };

  if (t.kind === 'hero') {
    fillRoundRect(ctx, x, y, w, TILE, RADIUS, c.hero);
    const wide = w > TILE;
    const size = wide ? NUM * 1.5 : NUM;
    drawIconPath(ctx, data.sportIcon, c.onHero, x + P, y + P, 68);
    drawFitText(ctx, `${data.weekday} ${data.shortDate}`, x + w - P, y + P + TINY * 0.9, inner - 90, tiny, rgba(c.onHero, 0.75), 'right', 0.8);
    const b = bottomBaselines(y, TILE, size);
    const capSize = wide ? 34 : CAP;
    const capBase = wide ? b.cap - 2 : b.cap;
    const kk = wide ? Math.min(1, inner / numberWidth(ctx, t.stat, 1, size)) : k;
    drawNumber(ctx, t.stat, x + P, capBase - capSize - 16 - size * 0.06, kk, c.onHero, size);
    drawFitText(ctx, data.title, x + P, capBase, inner, { family: SANS, weight: 600, size: capSize }, rgba(c.onHero, 0.85), 'left', 0.7);
    if (t.stat.key !== 'duration') {
      // Not the duration: name the number, above it.
      drawFitText(ctx, t.stat.label, x + P, capBase - capSize - 16 - size * 0.06 - size * 0.86 - 14, inner, tiny, rgba(c.onHero, 0.75), 'left', 0.8);
    }
    return;
  }

  fillRoundRect(ctx, x, y, w, TILE, RADIUS, c.tile);
  const b = bottomBaselines(y, TILE);
  drawNumber(ctx, tileNumber(data, t), x + P, b.num, k, c.ink);

  if (t.kind === 'time') {
    // Mini 24 h dial: midnight at the top, the session as an arc.
    const D = 108;
    const sw = 12;
    const cx = x + P + D / 2;
    const cy = y + P + D / 2;
    const r = D / 2 - sw / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = c.track;
    ctx.lineWidth = sw;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + sw / 2 + 6);
    ctx.lineTo(cx, cy - r + sw / 2 + 16);
    ctx.strokeStyle = c.track;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    const a = (m: number) => (m / 1440) * Math.PI * 2 - Math.PI / 2;
    const mins = Math.min(Math.max(data.durationSec / 60, 20), 1439);
    ctx.beginPath();
    ctx.arc(cx, cy, r, a(data.startMin), a(data.startMin + mins));
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = sw;
    ctx.lineCap = 'round';
    ctx.stroke();
    const part = partOfDay(data.startMin);
    setFont(ctx, tiny);
    const tw = ctx.measureText(part.name).width;
    drawFitText(ctx, part.name, x + w - P, y + P + TINY * 0.9, inner - D, tiny, c.muted, 'right');
    drawGlyph(ctx, part.glyph, c.muted, x + w - P - tw - 8 - 26, y + P - 1, 26);
    drawFitText(ctx, `to ${data.endTimeText}`, x + P, b.cap, inner, cap, c.muted, 'left', 0.7);
    return;
  }

  if (t.kind === 'effort') {
    drawGlyph(ctx, 'bolt', c.accent, x + P - 4, y + P, ICON);
    // Mini zone bar: the share of each zone reached.
    const items = zoneItems(data, opts.theme);
    const total = items.reduce((s, it) => s + it.minutes, 0) || 1;
    const bh = 16;
    const by = y + P + ICON + 24;
    const gap = 4;
    let bx = x + P;
    const avail = inner - gap * (items.length - 1);
    ctx.save();
    roundRectPath(ctx, x + P, by, inner, bh, bh / 2);
    ctx.clip();
    items.forEach((it) => {
      const bw = (it.minutes / total) * avail;
      ctx.fillStyle = it.color;
      ctx.fillRect(bx, by, bw, bh);
      bx += bw + gap;
    });
    ctx.restore();
    drawFitText(ctx, 'moderate or harder', x + P, b.cap, inner, cap, c.muted, 'left', 0.7);
    return;
  }

  // Plain stat widget.
  const s = t.stat;
  drawIconPath(ctx, STAT_ICONS[s.key], c.accent, x + P - 4, y + P, ICON);
  if (s.key === 'energy' && data.durationSec >= 600) {
    const perHour = Math.round(Number(s.number) / (data.durationSec / 3600));
    if (Number.isFinite(perHour)) drawFitText(ctx, `${perHour} kcal/h`, x + w - P, y + P + TINY * 0.9, inner - ICON - 16, tiny, c.muted, 'right', 0.8);
  }
  drawFitText(ctx, s.label, x + P, b.cap, inner, cap, c.muted, 'left', 0.7);
}

function drawGraph(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, data: CardData, opts: CardOptions, c: C, timeTile: boolean): void {
  fillRoundRect(ctx, x, y, w, TILE, RADIUS, c.tile);
  const inner = w - P * 2;
  const headBase = y + P + 30 * 0.8;
  drawFitText(ctx, 'Heart rate', x + P, headBase, inner / 2, { family: SANS, weight: 600, size: 30 }, c.ink);
  // Only the values that aren't widgets already.
  const parts = [
    data.avgHr !== null && !showsStat(data, opts, 'avgHr') ? `avg ${data.avgHr}` : '',
    data.maxHr !== null && !showsStat(data, opts, 'maxHr') ? `peak ${data.maxHr}` : '',
  ].filter(Boolean);
  if (parts.length) drawFitText(ctx, `${parts.join(' · ')} bpm`, x + w - P, headBase, inner / 2, { family: SANS, weight: 500, size: TINY }, c.muted, 'right', 0.8);

  const items = zoneItems(data, opts.theme);
  let bottom = y + TILE - P;
  const legendBase = bottom - TINY * 0.25;
  if (items.length) bottom = legendBase - TINY - 26;
  // Start and end on the axis, unless the time widget already says them.
  let axisBase = 0;
  if (!timeTile) {
    axisBase = bottom - TINY * 0.25;
    bottom = axisBase - TINY - 14;
  }
  const top = headBase + 36;
  drawZoneLine(ctx, data, { x: x + P, y: top, w: inner, h: bottom - top }, opts, { lineWidth: 5, fill: true });
  if (axisBase) {
    const f: FontSpec = { family: SANS, weight: 500, size: TINY };
    drawFitText(ctx, data.timeText, x + P, axisBase, inner / 2, f, c.muted, 'left');
    drawFitText(ctx, data.endTimeText, x + w - P, axisBase, inner / 2, f, c.muted, 'right');
  }
  if (items.length) drawZoneLegend(ctx, items, x + P, legendBase, inner, { size: TINY, ink: c.ink, muted: c.muted, family: SANS, align: 'left' });
}

export const widgets: CardDesign = {
  id: 'widgets',
  name: 'Widgets',
  blurb: 'Your stats as a stack of phone widgets',
  supportsAccent: true,
  supportsGraph: true,

  background(opts) {
    return colors(opts).canvas;
  },

  measure(_w, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(opts);
    const L = layout(data, opts);
    const half = (box.w - GAP) / 2;

    // One number size for every small widget, so none looks smaller than its neighbour.
    let k = 1;
    for (const t of L.smalls) k = Math.min(k, (half - P * 2) / numberWidth(ctx, tileNumber(data, t), 1));
    k = Math.max(0.6, k);

    let y = box.y;
    for (const row of L.rows) {
      if (row.kind === 'wide') drawTile(ctx, row.tile, box.x, y, box.w, k, data, opts, c);
      else if (row.kind === 'graph') drawGraph(ctx, box.x, y, box.w, data, opts, c, L.timeTile);
      else row.tiles.forEach((t, i) => drawTile(ctx, t, box.x + i * (half + GAP), y, half, k, data, opts, c));
      y += TILE + GAP;
    }

    if (opts.showLogo) {
      const clear = opts.background === 'transparent';
      const ink = opts.theme === 'dark' ? rgba('#FFFFFF', clear ? 0.8 : 0.35) : rgba('#15171A', clear ? 0.7 : 0.4);
      drawLogo(ctx, box.x + box.w / 2, box.y + L.logoTop + LOGO * 0.6, LOGO, ink, 'center');
    }
  },
};
