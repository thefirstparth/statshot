import type { HrSample } from '../../tcx/parse';
import { formatMinutes } from '../../tcx/stats';
import { drawLogo, ellipsize, graphPoints, luminance, rgba, roundRectPath, seriesRange, setFont, tracePath, visibleStats, wrapText, type FontSpec } from '../canvas';
import { measureContext } from '../env';
import { SANS, SERIF } from '../font-faces';
import { accentByKey, isMono } from '../palette';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { effortMinutes } from '../zone-graph';
import { shortPlace, showsStat } from './shared';

type Ctx = CanvasRenderingContext2D;

// ── Copy: every line is generated from the session and must be literally true ──────────────────

/** "The late issue" only for starts from 9 PM up to (not including) 5 AM; otherwise the true part of day. */
export function issueLabel(startMin: number): string {
  const h = Math.floor((((startMin % 1440) + 1440) % 1440) / 60);
  if (h >= 21 || h < 5) return 'The late issue';
  if (h < 12) return 'The morning issue';
  if (h < 17) return 'The afternoon issue';
  return 'The evening issue';
}

/** One stretch of the session: a full hour (60) or the shorter last stretch, with its average bpm. */
export type HrSlice = { minutes: number; avg: number };

function interp(series: HrSample[], t: number): number {
  if (t <= series[0].t) return series[0].bpm;
  const last = series[series.length - 1];
  if (t >= last.t) return last.bpm;
  let lo = 0;
  let hi = series.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = series[lo];
  const b = series[hi];
  return a.bpm + ((b.bpm - a.bpm) * (t - a.t)) / Math.max(1e-9, b.t - a.t);
}

/** Time-weighted mean bpm between two elapsed times (seconds). */
export function meanBpm(series: HrSample[], from: number, to: number): number {
  const steps = Math.max(4, Math.ceil((to - from) / 10));
  let sum = 0;
  for (let i = 0; i < steps; i++) sum += interp(series, from + ((i + 0.5) * (to - from)) / steps);
  return sum / steps;
}

/** Where the heart-rate record ends: the session end, unless the HR stopped well before it. */
function hrEnd(series: HrSample[], durationSec: number): number {
  const lastT = series[series.length - 1].t;
  return lastT >= durationSec - 180 ? durationSec : lastT;
}

/** Hour-by-hour averages from the start; the last slice is shorter when the session doesn't end on the hour. */
export function hourSlices(series: HrSample[], durationSec: number): HrSlice[] {
  if (series.length < 2) return [];
  const end = hrEnd(series, durationSec);
  // 59.5+ minutes counts as a full hour, as the duration text rounds the same way.
  const full = Math.floor((end + 30) / 3600);
  const out: HrSlice[] = [];
  for (let k = 0; k < full; k++) out.push({ minutes: 60, avg: Math.round(meanBpm(series, k * 3600, Math.min(end, (k + 1) * 3600))) });
  const rest = end - full * 3600;
  if (rest >= 60) out.push({ minutes: Math.round(rest / 60), avg: Math.round(meanBpm(series, full * 3600, end)) });
  return out;
}

export type InsideLine = { head: string; values: string; note: string; nums: string[] };

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const COUNT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** A shorter last stretch only counts when it's long enough to mean something. */
const MIN_TAIL = 10;

/**
 * The climbing rule: at least two full hours, each strictly higher than the one before. A shorter
 * last stretch is included (and named) only when it climbs too; otherwise the claim is limited
 * to the full hours. Returns null when heart rate didn't climb every full hour.
 */
export function climbLine(slices: HrSlice[]): InsideLine | null {
  const full = slices.filter((s) => s.minutes >= 60);
  if (full.length < 2 || full.length > 10) return null;
  for (let i = 1; i < full.length; i++) if (full[i].avg <= full[i - 1].avg) return null;
  const tail = slices.find((s) => s.minutes < 60 && s.minutes >= MIN_TAIL) ?? null;
  const top = full[full.length - 1].avg;
  if (tail && tail.avg > top) {
    const all = [...full, tail];
    return {
      head: 'Heart rate kept climbing',
      values: all.map((s) => s.avg).join(' → ') + ' bpm',
      note: `Hourly average, last ${tail.minutes} min`,
      nums: all.map((s) => String(s.avg)),
    };
  }
  return {
    head: tail ? `Heart rate climbed through the first ${COUNT[full.length]} hours` : 'Heart rate climbed every hour',
    values: full.map((s) => s.avg).join(' → ') + ' bpm',
    note: 'Hourly average',
    nums: full.map((s) => String(s.avg)),
  };
}

/** The stretch with the clearly highest average, when the session has at least two to compare. */
function hardestLine(slices: HrSlice[]): InsideLine | null {
  const cands = slices.filter((s) => s.minutes >= MIN_TAIL);
  if (cands.length < 2) return null;
  const max = Math.max(...cands.map((s) => s.avg));
  const at = cands.filter((s) => s.avg === max);
  if (at.length !== 1) return null;
  const s = at[0];
  const i = slices.indexOf(s);
  const name = s.minutes < 60 ? `The last ${s.minutes} min were` : i < ORDINAL.length ? `The ${ORDINAL[i]} hour was` : null;
  if (!name) return null;
  return { head: `${name} the hardest`, values: `${s.avg} bpm`, note: s.minutes < 60 ? 'Average heart rate' : 'Hourly average', nums: [String(s.avg)] };
}

/** Short sessions: first half against second half, when they clearly differ. */
function halvesLine(series: HrSample[], durationSec: number): InsideLine | null {
  if (series.length < 2) return null;
  const end = hrEnd(series, durationSec);
  if (end < 20 * 60) return null;
  const a = Math.round(meanBpm(series, 0, end / 2));
  const b = Math.round(meanBpm(series, end / 2, end));
  if (Math.abs(a - b) < 3) return null;
  return { head: b > a ? 'The second half was harder' : 'The first half was harder', values: `${a} → ${b} bpm`, note: 'Average by half', nums: [String(a), String(b)] };
}

export type CoverLine = { big: string; small: string };
export type EditorialCopy = { issue: string; lines: CoverLine[]; inside: InsideLine | null; story: string | null };

/** All the words on the cover. Each value is printed once (R1–R5). */
export function editorialCopy(data: CardData, opts: CardOptions): EditorialCopy {
  const stats = visibleStats(data, opts);
  const hasTime = stats.some((s) => s.key === 'timeRange');
  const hasDuration = stats.some((s) => s.key === 'duration');
  const printed = new Set<string>();
  const lines: CoverLine[] = [];
  const sport = data.title.trim().toLowerCase() === data.sportName.toLowerCase() ? '' : data.sportLower;
  const small = (s: StatItem): string => {
    switch (s.key) {
      case 'duration':
        return hasTime ? `${data.timeText} to ${data.endTimeText}` : sport ? `of ${sport}` : 'on the clock';
      case 'energy':
        return 'energy burned';
      case 'avgHr':
        return 'average heart rate';
      case 'maxHr':
        return 'peak heart rate';
      case 'minHr':
        return 'lowest heart rate';
      case 'zoneMin':
        return 'at moderate effort or harder';
      case 'distance':
        return 'distance covered';
      case 'timeRange':
        return 'time of day';
    }
  };
  for (const s of stats) {
    // With the duration on the cover, the time range is its caption instead of a line of its own.
    if (s.key === 'timeRange' && hasDuration) continue;
    // Two stats can share a value (a session spent entirely at moderate+ effort): print it once.
    if (printed.has(s.number)) continue;
    lines.push({ big: s.value, small: small(s) });
    printed.add(s.number);
  }
  if (hasTime) {
    printed.add(data.timeText);
    printed.add(data.endTimeText);
  }
  const fresh = (vals: string[]) => vals.every((v) => !printed.has(v));

  let inside: InsideLine | null = null;
  if (data.hrSeries.length >= 2) {
    const slices = hourSlices(data.hrSeries, data.durationSec);
    for (const c of [climbLine(slices), hardestLine(slices), halvesLine(data.hrSeries, data.durationSec)]) {
      if (c && fresh(c.nums)) {
        inside = c;
        break;
      }
    }
  }
  inside?.nums.forEach((n) => printed.add(n));

  const sentences: string[] = [];
  const offer = (vals: string[], text: string) => {
    if (sentences.length >= 2 || !fresh(vals)) return;
    sentences.push(text);
    vals.forEach((v) => printed.add(v));
  };
  if (data.maxHr !== null && !showsStat(data, opts, 'maxHr')) offer([String(data.maxHr)], `Heart rate peaked at ${data.maxHr}.`);
  const effort = effortMinutes(data);
  if (effort !== null && Math.round(effort) >= 1 && !showsStat(data, opts, 'zoneMin')) {
    const t = formatMinutes(effort);
    offer([t], `${t} at moderate effort or harder.`);
  }
  if (!hasTime) offer([data.endTimeText], `Finished at ${data.endTimeText}.`);

  return { issue: issueLabel(data.startMin), lines, inside, story: sentences.length ? sentences.join(' ') : null };
}

// ── Look ──────────────────────────────────────────────────────────────────────

const PAD = 52;
const RADIUS = 28;
const CAP = 19;
const TRACK = 0.16;
const MAST_MAX = 250;
const MAST_MIN_ONE_LINE = 150;
const BIG = 76;
const SMALL = 23;
const INS_W = 330;
const INS_HEAD = 42;
const STORY = 64;
const LOGO = 26;
const BAND_MIN = 260;
const BAND_MAX = 420;
const MIN_H = 1560;
const MIN_H_NOHR = 1080;

/** Mid-tone covers for the picked colour; Mono is light grey or graphite by theme. */
const MID: Record<string, string> = { Green: '#34C584', Blue: '#4C8DFF', Purple: '#9B7BFF' };

function cover(opts: CardOptions): { paper: string; ink: string } {
  if (isMono(opts.accent)) return opts.theme === 'dark' ? { paper: '#2B2C30', ink: '#F3F1EC' } : { paper: '#DCDCD8', ink: '#121316' };
  const a = accentByKey(opts.accent);
  const paper = (a && MID[a.name]) ?? opts.accent;
  const l = luminance(paper);
  // Pick the ink with more contrast (mid-tones read best with near-black).
  const ink = (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#0B0B0D' : '#FFFFFF';
  return { paper, ink };
}

type Spaced = Ctx & { letterSpacing?: string };

/** Tracked uppercase caption. Returns the drawn width. */
function caps(ctx: Ctx, text: string, x: number, y: number, maxW: number, color: string | null, align: 'left' | 'right' = 'left', size = CAP): number {
  const c = ctx as Spaced;
  setFont(ctx, { family: SANS, weight: 600, size });
  const spaced = 'letterSpacing' in c;
  const prev = c.letterSpacing;
  if (spaced) c.letterSpacing = `${(size * TRACK).toFixed(2)}px`;
  const t = ellipsize(ctx, text.toUpperCase(), maxW);
  const w = ctx.measureText(t).width;
  if (color) {
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t, align === 'right' ? x - w : x, y);
  }
  if (spaced) c.letterSpacing = prev ?? '0px';
  return w;
}

/** The title as large as the width allows; long titles wrap to two lines rather than get tiny. Never clipped. */
function fitMasthead(ctx: Ctx, title: string, maxW: number): { lines: string[]; size: number } {
  const ref: FontSpec = { family: SERIF, weight: 400, size: 100 };
  setFont(ctx, ref);
  const one = Math.min(MAST_MAX, (100 * maxW) / Math.max(1, ctx.measureText(title).width));
  const words = title.split(/\s+/).filter(Boolean);
  if (one >= MAST_MIN_ONE_LINE || words.length < 2) return { lines: [title], size: one };
  let best: { a: string; b: string; w: number } | null = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || w < best.w) best = { a, b, w };
  }
  const two = Math.min(MAST_MAX * 0.72, (100 * maxW) / Math.max(1, best!.w));
  if (two <= one * 1.15) return { lines: [title], size: one };
  return { lines: [best!.a, best!.b], size: two };
}

function layout(width: number, data: CardData, opts: CardOptions) {
  const ctx = measureContext();
  const copy = editorialCopy(data, opts);
  const inner = width - PAD * 2;

  // Masthead.
  const mast = fitMasthead(ctx, data.title, width - 80);
  setFont(ctx, { family: SERIF, weight: 400, size: mast.size });
  const asc = ctx.measureText('Hdlfk').actualBoundingBoxAscent;
  const desc = Math.max(mast.size * 0.06, ...mast.lines.map((l) => ctx.measureText(l).actualBoundingBoxDescent));
  const mastPitch = mast.size * 0.9;
  const mastTop = 92;
  const mastBase = mastTop + asc; // first line's baseline
  const ruleY = mastBase + mastPitch * (mast.lines.length - 1) + desc + 26;

  // Cover lines (left) and the Inside box (right).
  const many = copy.lines.length >= 5;
  const gap = many ? 40 : 62;
  const leftW = copy.inside ? inner - INS_W - 40 : inner;
  let big = many ? BIG * 0.86 : BIG;
  setFont(ctx, { family: SERIF, weight: 400, size: big });
  for (const l of copy.lines) {
    const w = ctx.measureText(l.big).width;
    if (w > leftW) big = Math.max(BIG * 0.55, Math.min(big, (big * leftW) / w));
  }
  const lineH = big * 0.76 + 14 + SMALL * 1.05;
  const linesTop = ruleY + 56;
  const linesBottom = linesTop + copy.lines.length * lineH + Math.max(0, copy.lines.length - 1) * gap;

  let insideLines: string[] = [];
  let insideBottom = linesTop;
  if (copy.inside) {
    setFont(ctx, { family: SERIF, weight: 400, size: INS_HEAD, style: 'italic' });
    insideLines = wrapText(ctx, copy.inside.head, INS_W, 4);
    insideBottom = linesTop + CAP + 22 + insideLines.length * INS_HEAD * 1.08 + 30 + 14 + 19;
  }
  const contentBottom = Math.max(linesBottom, insideBottom);

  // Cover story.
  setFont(ctx, { family: SERIF, weight: 400, size: STORY });
  const storyLines = copy.story ? wrapText(ctx, copy.story, inner, 4) : [];
  const storyH = storyLines.length ? CAP + 26 + storyLines.length * STORY * 1.04 : 0;
  const footer = opts.showLogo ? 112 : 56;

  const art = data.hrSeries.length >= 2;
  let bandTop = 0;
  let band = 0;
  let storyTop: number;
  let h: number;
  if (art) {
    const fixed = contentBottom + 64 + 56 + storyH + (storyH ? 36 : 0) + footer;
    h = Math.max(MIN_H, fixed + BAND_MIN);
    const spare = h - fixed;
    band = Math.min(BAND_MAX, spare);
    // Anything left over is open cover between the lines and the art.
    bandTop = contentBottom + 64 + (spare - band);
    storyTop = bandTop + band + 56;
  } else {
    const fixed = contentBottom + 80 + storyH + footer;
    h = Math.max(MIN_H_NOHR, fixed);
    storyTop = h - footer - storyH;
  }
  return { copy, mast, mastBase, mastPitch, ruleY, big, lineH, gap, leftW, linesTop, insideLines, art, bandTop, band, storyLines, storyTop, h };
}

/** The heart-rate line, gently smoothed, as a filled silhouette down to the bottom of the cover. */
function drawSilhouette(ctx: Ctx, series: HrSample[], x: number, w: number, top: number, band: number, bottom: number, ink: string): void {
  const half = 2;
  const sm = series.map((p, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(series.length - 1, i + half); j++) {
      s += series[j].bpm;
      n++;
    }
    return { t: p.t, bpm: s / n };
  });
  const pts = graphPoints(sm, { x, y: top, w, h: band }, seriesRange(sm));
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  tracePath(ctx, pts, false);
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
}

export const editorial: CardDesign = {
  id: 'editorial',
  name: 'Editorial',
  blurb: 'A magazine cover of your session',
  supportsAccent: true,

  background(opts) {
    // Dark: a lifted grey so the black art reads against it; Mono's graphite cover needs near-black.
    if (opts.theme === 'dark') return isMono(opts.accent) ? '#0E0F11' : '#2A2B30';
    return '#F3F2EE';
  },

  measure(width, data, opts) {
    return { h: layout(width, data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(box.w, data, opts);
    const { paper, ink } = cover(opts);
    const x0 = box.x + PAD;
    const inner = box.w - PAD * 2;
    const right = box.x + box.w - PAD;

    ctx.save();
    roundRectPath(ctx, box.x, box.y, box.w, L.h, RADIUS);
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.clip();
    // The frame's text shadow (see-through) shouldn't blur printed ink on an opaque cover.
    ctx.shadowColor = 'transparent';

    // Top line: date (and place) left, the issue right.
    const capY = box.y + 58;
    const issueW = caps(ctx, L.copy.issue, right, capY, inner * 0.45, ink, 'right');
    const place = shortPlace(data);
    caps(ctx, [`${data.weekday} ${data.fullDate}`, place].filter(Boolean).join(' · '), x0, capY, inner - issueW - 32, ink);

    // Masthead.
    setFont(ctx, { family: SERIF, weight: 400, size: L.mast.size });
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    L.mast.lines.forEach((line, i) => ctx.fillText(line, box.x + 36, box.y + L.mastBase + i * L.mastPitch));
    ctx.fillRect(x0, box.y + L.ruleY, inner, 3);

    // Cover lines.
    L.copy.lines.forEach((l, i) => {
      const top = box.y + L.linesTop + i * (L.lineH + L.gap);
      const by = top + L.big * 0.76;
      setFont(ctx, { family: SERIF, weight: 400, size: L.big });
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.fillText(ellipsize(ctx, l.big, L.leftW), x0, by);
      setFont(ctx, { family: SANS, weight: 500, size: SMALL });
      ctx.fillStyle = rgba(ink, 0.86);
      ctx.fillText(ellipsize(ctx, l.small, L.leftW), x0, by + 14 + SMALL * 1.05);
    });

    // Inside.
    const ins = L.copy.inside;
    if (ins) {
      let y = box.y + L.linesTop + CAP;
      caps(ctx, 'Inside', right, y, INS_W, rgba(ink, 0.75), 'right');
      y += 22;
      setFont(ctx, { family: SERIF, weight: 400, size: INS_HEAD, style: 'italic' });
      ctx.fillStyle = ink;
      ctx.textAlign = 'right';
      for (const line of L.insideLines) {
        y += INS_HEAD * 1.08;
        ctx.fillText(line, right, y - INS_HEAD * 0.2);
      }
      y += 30;
      setFont(ctx, { family: SANS, weight: 600, size: SMALL });
      ctx.fillText(ellipsize(ctx, ins.values, INS_W), right, y);
      y += 14 + 19;
      setFont(ctx, { family: SANS, weight: 500, size: 19 });
      ctx.fillStyle = rgba(ink, 0.75);
      ctx.fillText(ellipsize(ctx, ins.note, INS_W), right, y);
      ctx.textAlign = 'left';
    }

    // Cover art: the heart-rate silhouette in ink; the story and mark print out of it.
    const bottom = box.y + L.h;
    const onArt = L.art ? paper : ink;
    if (L.art) drawSilhouette(ctx, data.hrSeries, box.x, box.w, box.y + L.bandTop, L.band, bottom, ink);
    if (L.storyLines.length) {
      let y = box.y + L.storyTop + CAP;
      caps(ctx, 'Cover story', x0, y, inner, rgba(onArt, 0.8));
      y += 26;
      setFont(ctx, { family: SERIF, weight: 400, size: STORY });
      ctx.fillStyle = onArt;
      ctx.textAlign = 'left';
      for (const line of L.storyLines) {
        y += STORY * 1.04;
        ctx.fillText(line, x0, y - STORY * 0.24);
      }
    }
    if (opts.showLogo) drawLogo(ctx, x0, bottom - 52 - LOGO * 0.5, LOGO, rgba(onArt, 0.6));
    ctx.restore();
  },
};
