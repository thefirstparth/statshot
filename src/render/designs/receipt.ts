import { drawLogo, ellipsize, fitText, rgba, seededRandom, sparkBars, visibleStats } from '../canvas';
import { MONO, font } from '../font-faces';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { baseline } from './shared';

const PAPER = '#F2F0EB';
const INK = '#1C1C1C';
const EDGE = 10; // torn-edge amplitude
const SIDE = 56;
const HEADER_H = 84;
const TITLE = 56;
const LINE = 34;
const LINE_H = 60;
const SPARK_H = 56;
const BARCODE_H = 84;

function layout(data: CardData, opts: CardOptions) {
  const stats = visibleStats(data, opts);
  const headerTop = EDGE + 30;
  const titleTop = headerTop + HEADER_H + 52;
  const sep1 = titleTop + TITLE * 1.2 + 28;
  const statsTop = sep1 + 36;
  const sep2 = statsTop + stats.length * LINE_H + 20;
  const spark = opts.showGraph && data.hrSeries.length > 1;
  const sparkTop = sep2 + 40;
  const barcodeTop = (spark ? sparkTop + SPARK_H : sep2) + 48;
  const h = barcodeTop + BARCODE_H + 44 + EDGE + 8;
  return { stats, headerTop, titleTop, sep1, statsTop, sep2, spark, sparkTop, barcodeTop, h };
}

/** Deterministic jagged edge points along y = 0 (top) for width w. */
function tornEdge(rand: () => number, w: number): [number, number][] {
  const pts: [number, number][] = [];
  const teeth = 46;
  const step = w / teeth;
  for (let i = 0; i <= teeth; i++) {
    const x = i === 0 ? 0 : i === teeth ? w : i * step + (rand() - 0.5) * step * 0.35;
    const y = i % 2 === 0 ? rand() * 2.5 : EDGE - rand() * 2.5;
    pts.push([x, y]);
  }
  return pts;
}

function paperPath(ctx: CanvasRenderingContext2D, box: Rect, seed: number): void {
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

function dashedRule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
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

export const receipt: CardDesign = {
  id: 'receipt',
  name: 'Receipt',
  supportsAccent: false,
  supportsGraph: true,
  supportsTheme: false,

  background() {
    return '#2A2C31';
  },

  measure(_width, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(data, opts);
    const left = box.x + SIDE;
    const inner = box.w - SIDE * 2;

    // Paper with a soft drop shadow, then clip everything else to it.
    ctx.save();
    paperPath(ctx, box, data.seed);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.restore();

    ctx.save();
    paperPath(ctx, box, data.seed);
    ctx.clip();

    // Paper speckle (seeded) and a soft shadow band on the right 15 %.
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
    g.addColorStop(1, 'rgba(0, 0, 0, 0.07)');
    ctx.fillStyle = g;
    ctx.fillRect(shadowX, box.y, box.w * 0.15, box.h);

    // Dark header bar: logo left, date/time right.
    const hy = box.y + L.headerTop;
    ctx.fillStyle = INK;
    ctx.fillRect(left - 16, hy, inner + 32, HEADER_H);
    const midY = hy + HEADER_H / 2;
    let used = 0;
    if (opts.showLogo) {
      used = drawLogo(ctx, left + 8, midY, 28, PAPER, 'left') + 32;
    } else {
      ctx.font = font(MONO, 700, 28);
      ctx.fillStyle = PAPER;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Workout', left + 8, midY + 10);
      used = ctx.measureText('Workout').width + 32;
    }
    ctx.font = font(MONO, 400, 26);
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'right';
    const stamp = ellipsize(ctx, `${data.fullDate} ${data.timeText}`, inner - used - 8);
    ctx.fillText(stamp, left + inner - 8, midY + 9);

    // Title.
    const t = fitText(ctx, data.title, inner, { family: MONO, weight: 700, size: TITLE });
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(t.text, left, box.y + baseline(L.titleTop, TITLE));

    dashedRule(ctx, left, box.y + L.sep1, inner);

    // "Label ........ value" lines.
    L.stats.forEach((s, i) => {
      const y = box.y + baseline(L.statsTop + i * LINE_H, LINE);
      ctx.font = font(MONO, 700, LINE);
      const valueW = ctx.measureText(s.value).width;
      ctx.font = font(MONO, 400, LINE);
      const label = ellipsize(ctx, s.label, inner - valueW - 80);
      const labelW = ctx.measureText(label).width;
      const dotW = ctx.measureText('.').width;
      const room = inner - labelW - valueW - 32;
      const dots = '.'.repeat(Math.max(0, Math.floor(room / dotW)));
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.fillText(label, left, y);
      ctx.fillStyle = rgba(INK, 0.45);
      ctx.fillText(dots, left + labelW + 16, y);
      ctx.font = font(MONO, 700, LINE);
      ctx.fillStyle = INK;
      ctx.textAlign = 'right';
      ctx.fillText(s.value, left + inner, y);
    });

    dashedRule(ctx, left, box.y + L.sep2, inner);

    // Optional "HR ▁▂▅▇▅▃" bar sparkline.
    if (L.spark) {
      const top = box.y + L.sparkTop;
      ctx.font = font(MONO, 700, LINE);
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.fillText('HR', left, top + SPARK_H - 6);
      const sx = left + ctx.measureText('HR').width + 28;
      const sw = left + inner - sx;
      const n = 56;
      const bars = sparkBars(data.hrSeries, n);
      const bw = sw / n;
      bars.forEach((v, i) => {
        const bh = 6 + v * (SPARK_H - 6);
        ctx.fillRect(sx + i * bw + 1, top + SPARK_H - bh, Math.max(2, bw - 3), bh);
      });
    }

    // Barcode, seeded so preview and export match.
    const br = seededRandom(data.seed ^ 0xb4c0de);
    const by = box.y + L.barcodeTop;
    let x = left;
    ctx.fillStyle = INK;
    while (x < left + inner - 4) {
      const w = 2 + Math.floor(br() * 4) * 2;
      if (x + w > left + inner) break;
      ctx.fillRect(x, by, w, BARCODE_H);
      x += w + 3 + Math.floor(br() * 3) * 3;
    }
    ctx.restore();
  },
};
