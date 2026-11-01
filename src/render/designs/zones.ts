import { drawFitText, drawLogo, fillRoundRect, fitText, rgba, setFont } from '../canvas';
import { SANS } from '../font-faces';
import { drawIconPath } from '../icons';
import { ZONE_NAMES } from '../palette';
import { formatMinutes, hrrZoneStarts } from '../../tcx/stats';
import { effortMinutes, unmeasuredMinutes, zoneItems, type ZoneItem } from '../zone-graph';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline, drawSportBadge, shortPlace } from './shared';

const PAD = 60;
const BADGE = 96;
const TITLE = 60;
const SUB = 30;
const DONUT = 540; // outer diameter
const RING = 68;
const ROW_H = 88;
const NOTE = 28;
const LOGO = 24;

const colors = (opts: CardOptions) =>
  opts.theme === 'dark'
    ? { canvas: '#0F1012', card: '#1C1D20', ink: '#F1F2F4', muted: '#A7ABB1', line: 'rgba(255,255,255,0.08)', empty: '#2E3034' }
    : { canvas: '#F6F7F9', card: '#FFFFFF', ink: '#1A1C1E', muted: '#5B6066', line: 'rgba(0,0,0,0.07)', empty: '#E6E8EB' };

type Row = { name: string; range: string; pct: string; time: string; color: string | null };

/**
 * The centre number. Normally the real time at moderate or harder; when that is exactly one
 * zone's time (only one zone that hard), it would repeat that row, so the centre shows the share
 * of the session instead (and the rows drop their % column).
 */
function centre(data: CardData, opts: CardOptions): { big: string; share: boolean } | null {
  const effort = effortMinutes(data);
  if (effort === null) return null;
  const time = data.stats.zoneMin?.value ?? formatMinutes(effort);
  if (!zoneItems(data, opts.theme).some((it) => it.text === time)) return { big: time, share: false };
  return { big: `${Math.round((effort / Math.max(1, data.durationSec / 60)) * 100)}%`, share: true };
}

/** Legend rows, hardest zone first. Zero-minute zones are left out; the top zone shown has no ceiling. */
function rows(data: CardData, opts: CardOptions): Row[] {
  const z = data.zones;
  if (!z) return [...ZONE_NAMES].reverse().map((name) => ({ name, range: '', pct: '', time: '–', color: null }));
  const items = zoneItems(data, opts.theme);
  // Shares are of the whole playing time, so time without heart rate gets its own row.
  const missing = unmeasuredMinutes(data);
  const total = items.reduce((s, it) => s + it.minutes, 0) + missing || 1;
  const starts = hrrZoneStarts(z.restingHr, z.maxHr);
  const top = items[items.length - 1];
  const share = centre(data, opts)?.share;
  const out: Row[] = items
    .map((it) => ({
      name: it.name,
      range: it === top && it.index > 0 ? `${starts[it.index - 1]}+ bpm` : it.range,
      pct: share ? '' : `${Math.round((it.minutes / total) * 100)}%`,
      time: it.text,
      color: it.color,
    }))
    .reverse();
  if (missing) out.push({ name: 'No heart rate', range: '', pct: share ? '' : `${Math.round((missing / total) * 100)}%`, time: formatMinutes(missing), color: null });
  return out;
}

function layout(data: CardData, opts: CardOptions) {
  const donutTop = PAD + BADGE + 60;
  const rowsTop = donutTop + DONUT + 44;
  let end = rowsTop + rows(data, opts).length * ROW_H;
  const noteTop = end + 28;
  if (!data.zones) end = noteTop + NOTE * 1.2;
  const logoTop = end + 32;
  if (opts.showLogo) end = logoTop + LOGO * 1.2;
  return { donutTop, rowsTop, noteTop, logoTop, h: end + PAD - 8 };
}

/** "Sat 31 Oct · 1:11 AM–4:04 AM", plus the place when it fits without shrinking. */
function headerLine(ctx: CanvasRenderingContext2D, data: CardData, maxW: number): string {
  const base = [`${data.weekday} ${data.shortDate}`, data.sessionsText, data.stats.timeRange?.value ?? data.timeText].filter(Boolean).join(' · ');
  const place = shortPlace(data);
  if (!place) return base;
  const withPlace = `${base} · ${place}`;
  setFont(ctx, { family: SANS, weight: 400, size: SUB });
  return ctx.measureText(withPlace).width <= maxW ? withPlace : base;
}

function drawDonut(ctx: CanvasRenderingContext2D, items: ZoneItem[], cx: number, cy: number, empty: string, missing: number): void {
  const r = DONUT / 2 - RING / 2;
  ctx.lineWidth = RING;
  ctx.lineCap = 'butt';
  if (items.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = empty;
    ctx.stroke();
    return;
  }
  const total = items.reduce((s, it) => s + it.minutes, 0) + missing || 1;
  // A small gap between segments (none when there's only one).
  const gap = items.length > 1 || missing ? 0.035 : 0;
  let a = -Math.PI / 2;
  for (const it of items) {
    const span = (it.minutes / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a + gap / 2, a + Math.max(span - gap / 2, gap / 2 + 0.001));
    ctx.strokeStyle = it.color;
    ctx.stroke();
    a += span;
  }
  if (missing) {
    // Time without heart rate: the rest of the ring, in the empty-track colour.
    ctx.beginPath();
    ctx.arc(cx, cy, r, a + gap / 2, -Math.PI / 2 + Math.PI * 2 - gap / 2);
    ctx.strokeStyle = empty;
    ctx.stroke();
  }
}

export const zones: CardDesign = {
  id: 'zones',
  name: 'Zones',
  blurb: 'Time in each heart-rate zone',
  needsHr: true,
  needsZones: true,
  supportsAccent: true,

  background(opts) {
    return colors(opts).canvas;
  },

  measure(_w, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(opts);
    const L = layout(data, opts);
    const x = box.x + PAD;
    const w = box.w - PAD * 2;
    fillRoundRect(ctx, box.x, box.y, box.w, L.h, 56, c.card);

    // Header: badge, title, date · time range.
    drawSportBadge(ctx, data, x, box.y + PAD, BADGE, opts);
    const tx = x + BADGE + 28;
    const tw = w - BADGE - 28;
    const ts = fitText(ctx, data.title, tw, { family: SANS, weight: 700, size: TITLE }, 0.6).size;
    const top = box.y + PAD + (BADGE - (ts * 1.05 + 8 + SUB * 1.2)) / 2;
    drawFitText(ctx, data.title, tx, baseline(top, ts), tw, { family: SANS, weight: 700, size: TITLE }, c.ink, 'left', 0.6);
    drawFitText(ctx, headerLine(ctx, data, tw), tx, baseline(top + ts * 1.05 + 8, SUB), tw, { family: SANS, weight: 400, size: SUB }, c.muted, 'left', 0.7);

    // Donut: one segment per zone reached; real time at moderate or harder in the middle.
    const items = zoneItems(data, opts.theme);
    const cx = box.x + box.w / 2;
    const cy = box.y + L.donutTop + DONUT / 2;
    drawDonut(ctx, items, cx, cy, c.empty, unmeasuredMinutes(data));
    const inner = DONUT - RING * 2 - 48;
    const ctr = centre(data, opts);
    if (ctr) {
      drawFitText(ctx, ctr.big, cx, cy + 16, inner, { family: SANS, weight: 800, size: 104 }, c.ink, 'center', 0.6);
      drawFitText(ctx, 'moderate or harder', cx, cy + 66, inner, { family: SANS, weight: 500, size: 28 }, rgba(c.ink, 0.6), 'center', 0.7);
      drawFitText(ctx, `of ${data.stats.duration?.value ?? ''}`, cx, cy + 104, inner, { family: SANS, weight: 500, size: 28 }, rgba(c.ink, 0.6), 'center', 0.7);
    } else {
      const lock = 72;
      drawIconPath(ctx, 'lock-fill', c.muted, cx - lock / 2, cy - lock - 4, lock);
      drawFitText(ctx, 'Zones not set up', cx, cy + 48, inner, { family: SANS, weight: 600, size: 32 }, c.muted, 'center', 0.7);
    }

    // Legend rows: zone, bpm range, share, time.
    const TIME_W = 152;
    const PCT_W = 110;
    rows(data, opts).forEach((r, i) => {
      const ry = box.y + L.rowsTop + i * ROW_H;
      ctx.fillStyle = c.line;
      ctx.fillRect(x, ry, w, 2);
      const mid = ry + ROW_H / 2;
      fillRoundRect(ctx, x, mid - 12, 24, 24, 8, r.color ?? c.empty);
      const nameX = x + 24 + 22;
      const nameMax = w - (nameX - x) - TIME_W - PCT_W - 24;
      const nw = drawFitText(ctx, r.name, nameX, mid + 13, nameMax, { family: SANS, weight: 600, size: 36 }, c.ink, 'left', 0.7);
      if (r.range) drawFitText(ctx, r.range, nameX + nw + 16, mid + 12, nameMax - nw - 16, { family: SANS, weight: 400, size: 26 }, rgba(c.ink, 0.5), 'left', 0.8);
      if (r.pct) drawFitText(ctx, r.pct, x + w - TIME_W - 16, mid + 11, PCT_W, { family: SANS, weight: 400, size: 30 }, rgba(c.ink, 0.55), 'right');
      drawFitText(ctx, r.time, x + w, mid + 14, TIME_W, { family: SANS, weight: 700, size: 40 }, c.ink, 'right', 0.7);
    });

    if (!data.zones) {
      drawFitText(ctx, 'Add resting heart rate and age in Settings', x, baseline(box.y + L.noteTop, NOTE), w, { family: SANS, weight: 400, size: NOTE }, c.muted, 'left', 0.7);
    }
    if (opts.showLogo) drawLogo(ctx, x, box.y + L.logoTop + LOGO * 0.6, LOGO, rgba(c.ink, 0.35));
  },
};
