import { drawFitText, drawLogo, fitText, rgba, seriesRange, setFont, splitRows, visibleStats, wrapText, type FontSpec } from '../canvas';
import { measureContext } from '../env';
import { DISPLAY, SANS } from '../font-faces';
import { accentInk } from '../palette';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { drawZoneLine } from '../zone-graph';
import { baseline, drawSportBadge, shortPlace } from './shared';

type Ctx = CanvasRenderingContext2D;

const INSET = 48;
const BADGE = 104;
const BADGE_GAP = 28;
const TITLE = 54;
const TITLE_LH = 1.12;
const SUB = 30;
const SUB_LH = 1.3;
const HEAD_GAP = 10; // title → meta line
const LABEL = 26; // uppercase label above the big number
const LABEL_TRACK = 2.6;
const BIG = 280;
const BIG_UNIT = 0.3; // unit size for "kcal"/"bpm", × BIG
const BIG_UNIT_HM = 0.42; // unit size for the h/m of a duration
const TRACE_H = 120;
const TRACE_PAD = 8;
const CAPTION = 21;
const SEC_LABEL = 26;
const SEC_VALUE = 64;
const SEC_GAP = 12; // label → value
const SEC_ROW_GAP = 44;
const SEC_COL_GAP = 36;
const LOGO = 24;

const FONT_TITLE: FontSpec = { family: SANS, weight: 600, size: TITLE };
const FONT_SUB: FontSpec = { family: SANS, weight: 400, size: SUB };
const FONT_LABEL: FontSpec = { family: SANS, weight: 600, size: LABEL };
const FONT_SEC_LABEL: FontSpec = { family: SANS, weight: 500, size: SEC_LABEL };

function colors(opts: CardOptions) {
  return opts.theme === 'dark'
    ? { ink: '#FFFFFF', muted: 'rgba(255,255,255,0.6)', avgLine: 'rgba(255,255,255,0.3)' }
    : { ink: '#15171A', muted: 'rgba(21,23,26,0.6)', avgLine: 'rgba(21,23,26,0.3)' };
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

/** Secondary stats: everything visible except the big number and the time range (it's in the header). */
function secondary(data: CardData, opts: CardOptions, big: StatItem | undefined): StatItem[] {
  return visibleStats(data, opts).filter((s) => s.key !== big?.key && s.key !== 'timeRange');
}

const hasTrace = (data: CardData, opts: CardOptions) => opts.showGraph && data.hrSeries.length > 1;

/** Header text block: title (one or two lines) and the date · time range line (place may wrap below). */
function header(ctx: Ctx, data: CardData, tw: number) {
  setFont(ctx, FONT_TITLE);
  let titleSize = TITLE;
  let title = [data.title];
  if (ctx.measureText(data.title).width > tw) {
    const fit = fitText(ctx, data.title, tw, FONT_TITLE, 0.82);
    if (fit.text === data.title) titleSize = fit.size;
    else {
      setFont(ctx, FONT_TITLE);
      title = wrapText(ctx, data.title, tw, 2);
    }
  }
  const range = data.stats.timeRange?.value ?? data.timeText;
  const when = `${data.weekday} ${data.shortDate} · ${range}`;
  const place = shortPlace(data);
  const meta: string[] = [];
  setFont(ctx, FONT_SUB);
  if (place && ctx.measureText(`${when} · ${place}`).width <= tw) meta.push(`${when} · ${place}`);
  else meta.push(when, ...(place ? [place] : []));
  const h = title.length * titleSize * TITLE_LH + HEAD_GAP + meta.length * SUB * SUB_LH;
  return { title, titleSize, meta, h };
}

function layout(data: CardData, opts: CardOptions, w: number) {
  const ctx = measureContext();
  const tw = w - BADGE - BADGE_GAP;
  const head = header(ctx, data, tw);
  const headH = Math.max(BADGE, head.h);
  const big = bigItem(data, opts);
  const labelTop = headH + 96;
  const bigTop = labelTop + LABEL * 1.2 + 14;
  const bigBase = bigTop + BIG * 0.74;
  let y = bigBase + 8;
  const trace = hasTrace(data, opts);
  const traceTop = y + 44;
  if (trace) y = traceTop + TRACE_H + 14 + CAPTION * 1.2;
  const rows = splitRows(secondary(data, opts, big), 3);
  const secTop = y + 76;
  const rowH = SEC_LABEL * 1.2 + SEC_GAP + SEC_VALUE;
  if (rows.length) y = secTop + rows.length * rowH + (rows.length - 1) * SEC_ROW_GAP;
  const logoTop = y + 80;
  if (opts.showLogo) y = logoTop + LOGO * 1.2;
  return { tw, head, headH, big, labelTop, bigBase, trace, traceTop, rows, secTop, rowH, logoTop, h: y };
}

/** Draws the big number with small units on the same baseline; scales the group down to fit. */
function drawBig(ctx: Ctx, item: StatItem, x: number, by: number, maxW: number, ink: string, unitInk: string): void {
  const parts = bigParts(item);
  const duration = parts.length > 0 && parts.every(([, u]) => u.length === 1);
  const unitK = duration ? BIG_UNIT_HM : BIG_UNIT;
  const measure = (size: number) => {
    const num: FontSpec = { family: DISPLAY, weight: 800, size };
    const unit: FontSpec = { family: SANS, weight: 700, size: size * unitK };
    const pieces = parts.map(([n, u]) => {
      setFont(ctx, num);
      const nw = ctx.measureText(n).width;
      setFont(ctx, unit);
      const uw = u ? ctx.measureText(u).width : 0;
      const gap = u ? size * (u.length > 1 ? 0.06 : 0.015) : 0;
      return { n, u, nw, uw, gap };
    });
    const space = size * 0.2;
    const total = pieces.reduce((s, p) => s + p.nw + p.gap + p.uw, 0) + space * (pieces.length - 1);
    return { num, unit, pieces, space, total };
  };
  let m = measure(BIG);
  if (m.total > maxW) m = measure(BIG * (maxW / m.total));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let cx = x - m.num.size * 0.02;
  for (const p of m.pieces) {
    setFont(ctx, m.num);
    ctx.fillStyle = ink;
    ctx.fillText(p.n, cx, by);
    cx += p.nw + p.gap;
    if (p.u) {
      setFont(ctx, m.unit);
      ctx.fillStyle = unitInk;
      ctx.fillText(p.u, cx, by);
      cx += p.uw;
    }
    cx += m.space;
  }
}

/** Uppercase label with a little tracking (drawn per character so it works without letterSpacing). */
function drawTracked(ctx: Ctx, text: string, x: number, y: number, maxW: number, f: FontSpec, color: string): void {
  setFont(ctx, f);
  const chars = Array.from(text);
  const width = (track: number) => chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + track * (chars.length - 1);
  if (width(LABEL_TRACK) > maxW) {
    drawFitText(ctx, text, x, y, maxW, f, color, 'left', 0.6);
    return;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // One string (so text recorders see the whole label), tracked where the canvas supports it.
  const tc = ctx as Ctx & { letterSpacing?: string };
  const spaced = 'letterSpacing' in tc;
  if (spaced) tc.letterSpacing = `${LABEL_TRACK}px`;
  ctx.fillText(text, x, y);
  // Back to no tracking explicitly (restoring a read-back '' is ignored by Chrome).
  if (spaced) tc.letterSpacing = '0px';
}

/** Secondary value: number plus a small muted unit (durations print as they are). */
function secWidth(ctx: Ctx, item: StatItem, size: number): number {
  setFont(ctx, { family: DISPLAY, weight: 700, size });
  let w = ctx.measureText(item.unit ? item.number : item.value).width;
  if (item.unit) {
    setFont(ctx, { family: SANS, weight: 600, size: size * 0.5 });
    w += size * 0.16 + ctx.measureText(item.unit).width;
  }
  return w;
}

function drawSec(ctx: Ctx, item: StatItem, x: number, by: number, size: number, ink: string, muted: string): void {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, { family: DISPLAY, weight: 700, size });
  ctx.fillStyle = ink;
  const text = item.unit ? item.number : item.value;
  ctx.fillText(text, x, by);
  if (item.unit) {
    const nw = ctx.measureText(text).width;
    setFont(ctx, { family: SANS, weight: 600, size: size * 0.5 });
    ctx.fillStyle = muted;
    ctx.fillText(item.unit, x + nw + size * 0.16, by);
  }
}

export const hero: CardDesign = {
  id: 'hero',
  name: 'Hero number',
  blurb: 'One big number, your pick',
  floating: true,
  supportsAccent: true,
  supportsGraph: true,
  supportsBigStat: true,

  background(opts) {
    return opts.theme === 'dark' ? '#0F1012' : '#F6F7F9';
  },

  measure(w, data, opts) {
    return { h: layout(data, opts, w - INSET * 2).h + INSET * 2 };
  },

  draw(ctx: Ctx, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(opts);
    const accent = accentInk(opts);
    // Breathing room so the big number never runs to the image edge.
    box = { x: box.x + INSET, y: box.y + INSET, w: box.w - INSET * 2, h: box.h - INSET * 2 };
    const { x, w } = box;
    const top = box.y;
    const L = layout(data, opts, w);

    // Header: badge, title, "Sat 31 Oct · 1:11–4:04 AM".
    const badgeY = top + (L.headH - BADGE) / 2;
    drawSportBadge(ctx, data, x, badgeY, BADGE, opts);
    const tx = x + BADGE + BADGE_GAP;
    let ty = top + (L.headH - L.head.h) / 2;
    const titleFont = { ...FONT_TITLE, size: L.head.titleSize };
    for (const line of L.head.title) {
      drawFitText(ctx, line, tx, baseline(ty, L.head.titleSize), L.tw, titleFont, c.ink, 'left', 0.82);
      ty += L.head.titleSize * TITLE_LH;
    }
    ty += HEAD_GAP;
    for (const line of L.head.meta) {
      drawFitText(ctx, line, tx, baseline(ty, SUB), L.tw, FONT_SUB, c.muted, 'left', 0.8);
      ty += SUB * SUB_LH;
    }

    // Label and the big number.
    if (L.big) {
      drawTracked(ctx, L.big.label.toUpperCase(), x, baseline(top + L.labelTop, LABEL), w, FONT_LABEL, c.muted);
      drawBig(ctx, L.big, x, top + L.bigBase, w, c.ink, accent);
    }

    // Heart-rate trace with a dashed average line; the header already has the start and end times.
    if (L.trace) {
      const rect = { x, y: top + L.traceTop + TRACE_PAD, w, h: TRACE_H - TRACE_PAD * 2 };
      const scale = seriesRange(data.hrSeries);
      if (data.avgHr !== null) {
        const t = Math.min(1, Math.max(0, (data.avgHr - scale.min) / Math.max(1, scale.max - scale.min)));
        const ay = Math.round(rect.y + rect.h - t * rect.h) + 0.5;
        ctx.save();
        ctx.setLineDash([6, 10]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = c.avgLine;
        ctx.beginPath();
        ctx.moveTo(x, ay);
        ctx.lineTo(x + w, ay);
        ctx.stroke();
        ctx.restore();
      }
      drawZoneLine(ctx, data, rect, opts, { lineWidth: 4.5, scale });
      const capY = baseline(top + L.traceTop + TRACE_H + 14, CAPTION);
      const caption = data.avgHr !== null ? 'Heart rate · dashed line = average' : 'Heart rate';
      drawFitText(ctx, caption, x, capY, w, { family: SANS, weight: 500, size: CAPTION }, c.muted, 'left', 0.7);
    }

    // Secondary stats: one row of up to three (two rows when more), all at ONE value size.
    if (L.rows.length) {
      const colW = (w + SEC_COL_GAP) / 3;
      const maxW = colW - SEC_COL_GAP;
      let size = SEC_VALUE;
      for (const item of L.rows.flat()) {
        const iw = secWidth(ctx, item, SEC_VALUE);
        if (iw > maxW) size = Math.min(size, (SEC_VALUE * maxW) / iw);
      }
      L.rows.forEach((row, r) => {
        const ry = top + L.secTop + r * (L.rowH + SEC_ROW_GAP);
        row.forEach((item, i) => {
          const cx = x + i * colW;
          // The short label ("Moderate+") when the full one would need shrinking or cutting.
          setFont(ctx, FONT_SEC_LABEL);
          const label = ctx.measureText(item.label).width <= maxW ? item.label : item.short;
          drawFitText(ctx, label, cx, baseline(ry, SEC_LABEL), maxW, FONT_SEC_LABEL, c.muted, 'left', 0.75);
          drawSec(ctx, item, cx, ry + SEC_LABEL * 1.2 + SEC_GAP + SEC_VALUE * 0.78, size, c.ink, c.muted);
        });
      });
    }

    if (opts.showLogo) drawLogo(ctx, x, top + L.logoTop + LOGO * 0.6, LOGO, rgba(c.ink, 0.4));
  },
};
