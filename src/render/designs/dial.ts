import { drawFitText, drawLogo, rgba, setFont, splitRows, visibleStats, type FontSpec } from '../canvas';
import { DISPLAY, MONO, SANS } from '../font-faces';
import { accentInk, zoneColors } from '../palette';
import { hrrZone } from '../../tcx/stats';
import { drawZoneLegend, zoneItems } from '../zone-graph';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { drawSportBadge, metaLine } from './shared';

const DIAL = 780;
const BADGE = 116;
const TITLE = 64;
const META = 36;
const LEGEND = 28;
const VALUE = 60;
const UNIT = 30;
const LABEL = 26;
const STATS_H = VALUE + 14 + LABEL * 1.2;
const LOGO = 28;
/** Shortest stretch the arc colours on its own (the arc is ~0.25° a minute). */
const MIN_RUN_SEC = 180;

function colors(opts: CardOptions) {
  const clear = opts.background === 'transparent';
  return opts.theme === 'dark'
    ? { ink: '#F1F2F4', muted: clear ? 'rgba(241,242,244,0.9)' : 'rgba(241,242,244,0.66)', track: clear ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.14)', tick: clear ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.34)', faint: clear ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.42)' }
    : { ink: '#1A1C1E', muted: 'rgba(26,28,30,0.62)', track: 'rgba(0,0,0,0.09)', tick: 'rgba(0,0,0,0.28)', faint: 'rgba(0,0,0,0.38)' };
}

/** The stats row: everything but duration and the time range (both in the centre) and effort (the legend covers it). */
function extras(data: CardData, opts: CardOptions): StatItem[] {
  return visibleStats(data, opts).filter((s) => s.key !== 'duration' && s.key !== 'timeRange' && s.key !== 'zoneMin');
}

function layout(data: CardData, opts: CardOptions) {
  const titleTop = DIAL + 56;
  const metaTop = titleTop + TITLE * 1.15 + 6;
  let end = metaTop + META * 1.2;
  const legend = zoneItems(data, opts.theme).length > 0;
  const legendTop = end + 36;
  if (legend) end = legendTop + LEGEND * 1.2;
  const rows = splitRows(extras(data, opts), 3);
  const statsTop = end + (legend ? 48 : 56);
  if (rows.length) end = statsTop + rows.length * STATS_H + (rows.length - 1) * 32;
  const logoTop = end + 48;
  if (opts.showLogo) end = logoTop + LOGO * 1.2;
  return { titleTop, metaTop, legend, legendTop, statsTop, logoTop, rows, h: end };
}

/** Angle for a minute of the day: midnight at the top, clockwise. */
const angle = (min: number) => (min / 1440) * Math.PI * 2 - Math.PI / 2;

type Run = { zone: number; t0: number; t1: number };

/**
 * Stretches of the session in one zone (seconds from the start). The session is cut into short
 * windows (≥ MIN_RUN_SEC) and each takes the zone it spent most time in, so brief blips vanish
 * without swallowing a session that swings between zones.
 */
function zoneRuns(data: CardData): Run[] {
  const z = data.zones;
  const s = data.hrSeries;
  if (!z || s.length < 2) return [];
  const dur = Math.max(data.durationSec, s[s.length - 1].t);
  const win = Math.max(MIN_RUN_SEC, dur / 60);
  const n = Math.max(1, Math.round(dur / win));
  const time = Array.from({ length: n }, () => [0, 0, 0, 0]);
  s.forEach((p, i) => {
    const t0 = i === 0 ? 0 : (s[i - 1].t + p.t) / 2;
    const t1 = i === s.length - 1 ? dur : (p.t + s[i + 1].t) / 2;
    const zone = hrrZone(p.bpm, z.restingHr, z.maxHr);
    // Spread this sample's time over the windows it overlaps.
    for (let w = Math.floor((t0 / dur) * n); w < n && (w * dur) / n < t1; w++) {
      const lo = Math.max(t0, (w * dur) / n);
      const hi = Math.min(t1, ((w + 1) * dur) / n);
      if (hi > lo) time[w][zone] += hi - lo;
    }
  });
  const out: Run[] = [];
  time.forEach((t, w) => {
    const zone = t.indexOf(Math.max(...t));
    const t0 = (w * dur) / n;
    const t1 = ((w + 1) * dur) / n;
    const last = out[out.length - 1];
    if (last && last.zone === zone) last.t1 = t1;
    else out.push({ zone, t0, t1 });
  });
  return out;
}

/** One row of stats: big number + small unit over a label, one shared size so no column looks smaller. */
function drawStatRow(ctx: CanvasRenderingContext2D, row: StatItem[], x: number, top: number, w: number, ink: string, muted: string): void {
  const colW = w / row.length;
  const maxW = colW - 32;
  const num = (size: number): FontSpec => ({ family: SANS, weight: 700, size });
  const unit = (size: number): FontSpec => ({ family: SANS, weight: 600, size });
  const width = (s: StatItem, k: number) => {
    setFont(ctx, num(VALUE * k));
    let wd = ctx.measureText(s.number).width;
    if (s.unit) {
      setFont(ctx, unit(UNIT * k));
      wd += 8 * k + ctx.measureText(s.unit).width;
    }
    return wd;
  };
  const k = Math.max(0.55, Math.min(1, ...row.map((s) => maxW / width(s, 1))));
  row.forEach((s, i) => {
    const cx = x + colW * (i + 0.5);
    const wd = width(s, k);
    let lx = cx - wd / 2;
    const base = top + VALUE * 0.86;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    setFont(ctx, num(VALUE * k));
    ctx.fillText(s.number, lx, base);
    lx += ctx.measureText(s.number).width + 8 * k;
    if (s.unit) {
      setFont(ctx, unit(UNIT * k));
      ctx.fillText(s.unit, lx, base);
    }
    drawFitText(ctx, s.label, cx, top + VALUE + 14 + LABEL * 0.9, maxW, { family: SANS, weight: 500, size: LABEL }, muted, 'center', 0.7);
  });
}

export const dial: CardDesign = {
  id: 'dial',
  name: 'Day dial',
  blurb: 'When you played, on a 24-hour clock',
  floating: true,
  supportsAccent: true,

  background(opts) {
    return opts.theme === 'dark' ? '#0B0C0E' : '#F6F7F9';
  },

  measure(_w, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(opts);
    const L = layout(data, opts);
    const cx = box.x + box.w / 2;
    const cy = box.y + DIAL / 2;
    const R = DIAL * 0.44;

    // Clock face, quiet: thin track, 24 hour ticks, four tiny numerals.
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = c.track;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.lineCap = 'round';
    for (let h = 0; h < 24; h++) {
      const major = h % 6 === 0;
      const a = angle(h * 60);
      const r1 = R - (major ? 50 : 38);
      const r2 = R - 26;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.strokeStyle = major ? c.faint : c.tick;
      ctx.lineWidth = major ? 5 : 3;
      ctx.stroke();
    }
    ctx.font = `500 26px "${MONO}", ui-monospace, monospace`;
    ctx.fillStyle = c.faint;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Match the clock labels to the time format on the card.
    const twelve = /[AP]M$/.test(data.timeText);
    const marks = twelve ? ['12 AM', '6 AM', '12 PM', '6 PM'] : ['00', '06', '12', '18'];
    [0, 6, 12, 18].forEach((h, i) => {
      const a = angle(h * 60);
      const r = R - (twelve ? 92 : 76);
      ctx.fillText(marks[i], cx + r * Math.cos(a), cy + r * Math.sin(a));
    });
    ctx.textBaseline = 'alphabetic';

    // The session arc, coloured by zone along its length (one accent arc without zones).
    // Short sessions still get a visible arc (at least ~40 minutes of the dial).
    const realMin = data.durationSec / 60;
    const shownMin = Math.min(Math.max(realMin, 40), 1439);
    const k = realMin > 0 ? shownMin / realMin : 1;
    const at = (sec: number) => angle(data.startMin + (sec / 60) * k);
    const a0 = angle(data.startMin);
    const a1 = angle(data.startMin + shownMin);
    const LW = 34;
    const runs = zoneRuns(data);
    if (runs.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1);
      ctx.strokeStyle = accentInk(opts);
      ctx.lineWidth = LW;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      const zc = zoneColors(opts.theme);
      const cap = (a: number, color: string) => {
        ctx.beginPath();
        ctx.arc(cx + R * Math.cos(a), cy + R * Math.sin(a), LW / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      };
      // See-through cards: one soft halo under the whole arc, none per segment (no seams).
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1);
      ctx.strokeStyle = zc[runs[0].zone];
      ctx.lineWidth = LW;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      cap(a0, zc[runs[0].zone]);
      cap(a1, zc[runs[runs.length - 1].zone]);
      ctx.lineCap = 'butt';
      ctx.lineWidth = LW;
      runs.forEach((r, i) => {
        // A hair of overlap so neighbouring colours meet without a seam.
        const s = i === 0 ? a0 : at(r.t0);
        const e = i === runs.length - 1 ? a1 : at(r.t1) + 0.003;
        ctx.beginPath();
        ctx.arc(cx, cy, R, s, e);
        ctx.strokeStyle = zc[r.zone];
        ctx.stroke();
      });
      ctx.restore();
    }

    // Centre: sport sticker, duration, time range.
    drawSportBadge(ctx, data, cx - BADGE / 2, cy - 196, BADGE, opts);
    drawFitText(ctx, data.stats.duration?.value ?? '', cx, cy + 62, R * 1.1, { family: DISPLAY, weight: 800, size: 124 }, c.ink, 'center', 0.5);
    drawFitText(ctx, `${data.timeText} – ${data.endTimeText}`, cx, cy + 128, R * 1.2, { family: MONO, weight: 400, size: 36 }, c.muted, 'center', 0.7);

    // Below the dial: title, date (the centre has the times), zone legend, stats.
    drawFitText(ctx, data.title, cx, box.y + L.titleTop + TITLE * 0.9, box.w, { family: SANS, weight: 700, size: TITLE }, c.ink, 'center', 0.6);
    drawFitText(ctx, metaLine(data, false), cx, box.y + L.metaTop + META * 0.9, box.w, { family: SANS, weight: 400, size: META }, c.muted, 'center');

    if (L.legend) {
      drawZoneLegend(ctx, zoneItems(data, opts.theme), box.x, box.y + L.legendTop + LEGEND * 0.9, box.w, { size: LEGEND, ink: c.ink, muted: c.muted, family: SANS, align: 'center' });
    }

    L.rows.forEach((row, r) => drawStatRow(ctx, row, box.x, box.y + L.statsTop + r * (STATS_H + 32), box.w, c.ink, c.muted));

    if (opts.showLogo) drawLogo(ctx, cx, box.y + L.logoTop + LOGO * 0.6, LOGO, rgba(opts.theme === 'dark' ? '#FFFFFF' : '#1A1C1E', 0.55), 'center');
  },
};
