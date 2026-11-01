import { drawLogoGlyph, ellipsize, rgba, seededRandom, setFont, visibleStats } from '../canvas';
import { measureContext } from '../env';
import { MONO } from '../font-faces';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { zoneItems } from '../zone-graph';
import { meanBpm } from './editorial';
import { shortPlace } from './shared';

type Ctx = CanvasRenderingContext2D;

const PAPER = '#F2F0EB';
const INK = '#1C1C1C';
const EDGE = 14; // torn-edge depth
const SIDE = 70;
const BRAND = 24;
const TITLE = 68;
const DATE = 30;
const PLACE = 26;
const HEAD = 22;
const LINE = 34;
const LINE_H = 60;
const TOTAL = 62;
const TOTAL_UNIT = 34;
const SERVED = 28;
const CODE_H = 124;
const CAPTION = 20;
const TRACK = 0.14;

type Row = { label: string; value: string };

/** A receipt line per value; a value already on the paper is never printed again. */
function lines(data: CardData, opts: CardOptions) {
  const vis = visibleStats(data, opts);
  const has = (k: StatItem['key']) => vis.some((s) => s.key === k);
  const energy = has('energy') ? data.stats.energy : undefined;
  const duration = data.stats.duration!;
  // The total is the energy; without it, the time is the total and there's no subtotal.
  const total = energy ?? duration;
  const printed = new Set<string>([total.value]);
  const keep = (rows: Row[]) =>
    rows.filter((r) => {
      if (printed.has(r.value)) return false;
      printed.add(r.value);
      return true;
    });
  const others: Row[] = vis
    .filter((s) => s.key !== 'duration' && s.key !== 'energy' && s.key !== 'timeRange')
    .map((s) => ({ label: s.label.toUpperCase(), value: s.value }));
  const sub: Row[] = energy && has('duration') ? [{ label: 'SUBTOTAL', value: duration.value }] : [];
  const zones = zoneItems(data, 'light').map((z) => ({ label: z.name.toUpperCase(), value: z.text }));
  // Zone times are the order; without zones the stats are.
  const items = keep(zones.length ? zones : others);
  const tail = keep(zones.length ? [...sub, ...others] : sub);
  return { items, zoned: zones.length > 0 && items.length > 0, tail, total };
}

/** Tracked mono text, centred or at x. Uses letterSpacing where the canvas has it. */
function tracked(ctx: Ctx, text: string, x: number, y: number, size: number, weight: number, color: string, align: 'left' | 'center' | 'right', maxW: number): void {
  const c = ctx as Ctx & { letterSpacing?: string };
  setFont(ctx, { family: MONO, weight, size });
  const spaced = 'letterSpacing' in c;
  const prev = c.letterSpacing;
  if (spaced) c.letterSpacing = `${(size * TRACK).toFixed(2)}px`;
  const t = ellipsize(ctx, text, maxW);
  // Trailing letter spacing would push centred text left; measure without it.
  const w = ctx.measureText(t).width - (spaced ? size * TRACK : 0);
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, left, y);
  if (spaced) c.letterSpacing = prev ?? '0px';
}

/** The title in caps on one line, or two when one line would get too small. */
function fitTitle(ctx: Ctx, title: string, maxW: number): { lines: string[]; size: number } {
  const text = title.toUpperCase();
  maxW -= 2; // float slack, so a title fitted to the width is never ellipsized
  setFont(ctx, { family: MONO, weight: 700, size: 100 });
  const one = Math.min(TITLE, (100 * maxW) / ctx.measureText(text).width);
  const words = text.split(/\s+/).filter(Boolean);
  if (one >= TITLE * 0.72 || words.length < 2) return { lines: [text], size: Math.max(one, TITLE * 0.4) };
  let best = { a: text, b: '', w: Infinity };
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (w < best.w) best = { a, b, w };
  }
  const two = Math.max(TITLE * 0.4, Math.min(TITLE * 0.85, (100 * maxW) / best.w));
  return two > one ? { lines: [best.a, best.b], size: two } : { lines: [text], size: Math.max(one, TITLE * 0.4) };
}

/**
 * The heart-rate "barcode": one bar per time slice, its height the slice's average heart rate
 * between the session's lowest and highest slice. Empty without heart rate.
 */
function hrBars(data: CardData): number[] {
  const s = data.hrSeries;
  if (s.length < 2) return [];
  const lastT = s[s.length - 1].t;
  const end = lastT >= data.durationSec - 180 ? data.durationSec : lastT;
  const n = Math.max(60, Math.min(90, Math.round(end / 120)));
  const avgs = Array.from({ length: n }, (_, i) => meanBpm(s, (i * end) / n, ((i + 1) * end) / n));
  const lo = Math.min(...avgs);
  const hi = Math.max(...avgs);
  return avgs.map((v) => (hi - lo < 1 ? 0.6 : 0.16 + (0.84 * (v - lo)) / (hi - lo)));
}

function layout(width: number, data: CardData, opts: CardOptions) {
  const ctx = measureContext();
  const inner = width - SIDE * 2;
  const L = lines(data, opts);
  let y = EDGE + 58;
  const brandY = opts.showLogo ? y + BRAND * 0.8 : 0;
  if (opts.showLogo) y += BRAND + 38;
  const title = fitTitle(ctx, data.title, inner);
  const titleY = y + title.size * 0.78;
  y = titleY + (title.lines.length - 1) * title.size * 1.08;
  const dateY = y + 30 + DATE * 0.8;
  y = dateY;
  const place = shortPlace(data, 34);
  const placeY = place ? y + 16 + PLACE * 0.85 : 0;
  if (place) y = placeY;
  const rule1 = y + 34;
  y = rule1 + 30;
  const headY = L.zoned ? y + HEAD * 0.8 : 0;
  if (L.zoned) y += HEAD + 14;
  const itemsY = y;
  y += L.items.length * LINE_H;
  const rule2 = L.items.length && L.tail.length ? y + 8 : 0;
  if (rule2) y = rule2 + 30;
  const tailY = y;
  y += L.tail.length * LINE_H;
  const dbl1 = (L.items.length || L.tail.length ? y + 6 : rule1 + 6);
  const totalY = dbl1 + 16 + 16 + TOTAL * 0.78;
  const dbl2 = totalY + 32;
  const servedY = dbl2 + 16 + 54;
  // One SERVED line per session ("2 sessions" needs no extra label: the lines say it).
  const served = servedLines(data);
  y = servedY + (served.length - 1) * SERVED * 1.6;
  const bars = opts.showGraph ? hrBars(data) : [];
  const codeTop = bars.length ? y + 44 : 0;
  if (bars.length) y = codeTop + CODE_H + 18 + CAPTION * 0.8;
  const thanksY = y + 54;
  const h = thanksY + 64 + EDGE;
  return { ...L, title, brandY, titleY, dateY, place, placeY, rule1, headY, itemsY, rule2, tailY, dbl1, totalY, dbl2, servedY, served, bars, codeTop, thanksY, h };
}

/** "SERVED 1:11–4:04 AM", one per session. */
function servedLines(data: CardData): string[] {
  if (data.sessions.length < 2) return [`SERVED ${data.stats.timeRange?.value ?? data.timeText}`.toUpperCase()];
  return data.sessions.map((s) => `SERVED ${compactRange(s.startText, s.endText)}`.toUpperCase());
}

/** "6:00–7:10 PM" rather than "6:00 PM–7:10 PM" when both halves share the suffix. */
function compactRange(a: string, b: string): string {
  const sa = a.slice(-2);
  return /[AP]M$/.test(a) && sa === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

/** Deterministic jagged edge points along y = 0 (top) for width w. */
function tornEdge(rand: () => number, w: number): [number, number][] {
  const pts: [number, number][] = [];
  const teeth = 46;
  const step = w / teeth;
  for (let i = 0; i <= teeth; i++) {
    const x = i === 0 ? 0 : i === teeth ? w : i * step + (rand() - 0.5) * step * 0.3;
    const y = i % 2 === 0 ? rand() * 2.5 : EDGE - rand() * 2.5;
    pts.push([x, y]);
  }
  return pts;
}

function paperPath(ctx: Ctx, box: Rect, seed: number): void {
  const top = tornEdge(seededRandom(seed), box.w);
  const bottom = tornEdge(seededRandom(seed ^ 0x9e3779b9), box.w);
  ctx.beginPath();
  ctx.moveTo(box.x + top[0][0], box.y + top[0][1]);
  for (const [x, y] of top) ctx.lineTo(box.x + x, box.y + y);
  for (let i = bottom.length - 1; i >= 0; i--) {
    const [x, y] = bottom[i];
    ctx.lineTo(box.x + x, box.y + box.h - y);
  }
  ctx.closePath();
}

function dashedRule(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = rgba(INK, 0.45);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}

function doubleRule(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y + 10, w, 3);
}

/** "LABEL ........ value", the leader in faint dots. */
function leaderLine(ctx: Ctx, r: Row, x: number, y: number, w: number): void {
  setFont(ctx, { family: MONO, weight: 700, size: LINE });
  const valueW = ctx.measureText(r.value).width;
  setFont(ctx, { family: MONO, weight: 400, size: LINE });
  const label = ellipsize(ctx, r.label, w - valueW - 60);
  const labelW = ctx.measureText(label).width;
  const dotW = ctx.measureText('.').width;
  const dots = '.'.repeat(Math.max(0, Math.floor((w - labelW - valueW - 40) / dotW)));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.fillText(label, x, y);
  ctx.fillStyle = rgba(INK, 0.4);
  ctx.fillText(dots, x + labelW + 20, y);
  setFont(ctx, { family: MONO, weight: 700, size: LINE });
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(r.value, x + w, y);
}

export const receipt: CardDesign = {
  id: 'receipt',
  name: 'Receipt',
  blurb: 'Your session, itemised like a receipt',
  supportsAccent: false,
  supportsGraph: true,
  background(opts) {
    // The paper always stays paper; Light/Dark only changes what's behind it.
    return opts.theme === 'dark' ? '#0B0B0D' : '#D9D6D0';
  },

  measure(width, data, opts) {
    return { h: layout(width, data, opts).h };
  },

  draw(ctx: Ctx, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(box.w, data, opts);
    const left = box.x + SIDE;
    const inner = box.w - SIDE * 2;
    const cx = box.x + box.w / 2;
    const Y = (v: number) => box.y + v;

    // Paper with a soft drop shadow, then clip everything else to it.
    ctx.save();
    paperPath(ctx, box, data.seed);
    ctx.shadowColor = opts.theme === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.restore();

    ctx.save();
    paperPath(ctx, box, data.seed);
    ctx.clip();
    ctx.shadowColor = 'transparent';

    // Paper speckle (seeded) and a soft shadow band on the right.
    const rand = seededRandom(data.seed ^ 0x51ed27);
    const specks = Math.round((box.w * box.h) / 260);
    for (let i = 0; i < specks; i++) {
      const dark = rand() < 0.7;
      ctx.fillStyle = dark ? `rgba(60, 50, 40, ${0.04 + rand() * 0.02})` : `rgba(255, 255, 255, ${0.04 + rand() * 0.02})`;
      const s = 1 + rand() * 2.2;
      ctx.fillRect(box.x + rand() * box.w, box.y + rand() * box.h, s, s);
    }
    const shadowX = box.x + box.w * 0.85;
    const g = ctx.createLinearGradient(shadowX, 0, box.x + box.w, 0);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(shadowX, box.y, box.w * 0.15, box.h);

    // Header: the shop (our mark), the title, the date, the place.
    if (opts.showLogo) {
      const c = ctx as Ctx & { letterSpacing?: string };
      const spaced = 'letterSpacing' in c;
      const sp = BRAND * TRACK * 1.4;
      const prev = c.letterSpacing;
      setFont(ctx, { family: MONO, weight: 700, size: BRAND });
      if (spaced) c.letterSpacing = `${sp.toFixed(2)}px`;
      const wordW = ctx.measureText('SWEATSHOT').width - (spaced ? sp : 0);
      const glyph = BRAND * 0.95;
      const left0 = cx - (glyph + 14 + wordW) / 2;
      drawLogoGlyph(ctx, left0, Y(L.brandY) - glyph * 0.86, glyph, rgba(INK, 0.75));
      ctx.fillStyle = rgba(INK, 0.75);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('SWEATSHOT', left0 + glyph + 14, Y(L.brandY));
      if (spaced) c.letterSpacing = prev ?? '0px';
    }
    setFont(ctx, { family: MONO, weight: 700, size: L.title.size });
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    L.title.lines.forEach((line, i) => ctx.fillText(ellipsize(ctx, line, inner), cx, Y(L.titleY) + i * L.title.size * 1.08));
    tracked(ctx, data.dateText.toUpperCase(), cx, Y(L.dateY), DATE, 400, INK, 'center', inner);
    if (L.place) tracked(ctx, L.place.toUpperCase(), cx, Y(L.placeY), PLACE, 400, rgba(INK, 0.72), 'center', inner);

    dashedRule(ctx, left, Y(L.rule1), inner);

    // The order: zone times (or the stats), then subtotal and the rest.
    if (L.zoned) {
      tracked(ctx, 'ITEM', left, Y(L.headY), HEAD, 400, rgba(INK, 0.6), 'left', inner / 2);
      tracked(ctx, 'TIME', left + inner, Y(L.headY), HEAD, 400, rgba(INK, 0.6), 'right', inner / 2);
    }
    L.items.forEach((r, i) => leaderLine(ctx, r, left, Y(L.itemsY + i * LINE_H + LINE * 0.8), inner));
    if (L.rule2) dashedRule(ctx, left, Y(L.rule2), inner);
    L.tail.forEach((r, i) => leaderLine(ctx, r, left, Y(L.tailY + i * LINE_H + LINE * 0.8), inner));

    // TOTAL between double rules.
    doubleRule(ctx, left, Y(L.dbl1), inner);
    const ty = Y(L.totalY);
    setFont(ctx, { family: MONO, weight: 700, size: TOTAL });
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', left, ty);
    const labelW = ctx.measureText('TOTAL').width;
    const unit = L.total.unit;
    setFont(ctx, { family: MONO, weight: 700, size: TOTAL_UNIT });
    const unitW = unit ? ctx.measureText(unit).width : 0;
    ctx.textAlign = 'right';
    if (unit) ctx.fillText(unit, left + inner, ty);
    setFont(ctx, { family: MONO, weight: 700, size: TOTAL });
    const numText = unit ? L.total.number : L.total.value;
    ctx.fillText(ellipsize(ctx, numText, inner - labelW - unitW - 40), left + inner - (unit ? unitW + 14 : 0), ty);
    doubleRule(ctx, left, Y(L.dbl2), inner);

    // The times, once.
    L.served.forEach((line, i) => tracked(ctx, line, cx, Y(L.servedY + i * SERVED * 1.6), SERVED, 400, INK, 'center', inner));

    // Heart-rate barcode: thin bars on a midline, one per time slice.
    if (L.bars.length) {
      const n = L.bars.length;
      const codeW = Math.round(inner * 0.86);
      const pitch = codeW / n;
      const bw = Math.max(2, Math.round(pitch * 0.58));
      const x0 = cx - codeW / 2;
      const mid = Y(L.codeTop) + CODE_H / 2;
      ctx.fillStyle = INK;
      L.bars.forEach((v, i) => {
        const bh = Math.round(CODE_H * v);
        ctx.fillRect(Math.round(x0 + i * pitch + (pitch - bw) / 2), Math.round(mid - bh / 2), bw, bh);
      });
      tracked(ctx, 'HEART RATE', cx, Y(L.codeTop) + CODE_H + 18 + CAPTION * 0.8, CAPTION, 400, rgba(INK, 0.6), 'center', inner);
    }

    tracked(ctx, 'THANK YOU · COME AGAIN SOON', cx, Y(L.thanksY), 24, 400, INK, 'center', inner);
    ctx.restore();
  },
};
