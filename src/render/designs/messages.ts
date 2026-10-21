import { ellipsize, fitText, onColor, roundRectPath, setFont, visibleStats, wrapText } from '../canvas';
import { SANS } from '../font-faces';
import { measureContext } from '../env';
import type { CardData, CardDesign, CardOptions, Rect, StatItem } from '../types';
import { baseline } from './shared';

export const MESSAGES_BLUE = '#0A84FF';

const MAX_BUBBLE = 780;
const PAD_X = 40;
const PAD_Y = 24;
const RADIUS = 46;
const TAIL = 18; // room on the right for the tail
const TITLE = { family: SANS, weight: 600, size: 56 };
const BODY = { family: SANS, weight: 400, size: 44 };
const BODY_LH = 58;
const META = { family: SANS, weight: 400, size: 30 };
const GAP = 10;

/** "1h 51m of table tennis, 496 kcal, avg 112 bpm" */
export function statSentence(data: CardData, stats: StatItem[]): string {
  const duration = stats.find((s) => s.key === 'duration');
  const rest = stats.filter((s) => s.key !== 'duration').map((s) => s.phrase);
  if (duration) return [`${duration.value} of ${data.sportLower}`, ...rest].join(', ');
  if (rest.length === 0) return `${data.sportName} done`;
  const [first, ...more] = rest;
  return [`${data.sportName}: ${first}`, ...more].join(', ');
}

function layout(ctx: CanvasRenderingContext2D, data: CardData, opts: CardOptions) {
  setFont(ctx, BODY);
  const lines = wrapText(ctx, statSentence(data, visibleStats(data, opts)), MAX_BUBBLE - PAD_X * 2, 5);
  const bodyTextW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const title = fitText(ctx, data.title, MAX_BUBBLE - PAD_X * 2, TITLE);
  const titleW = ctx.measureText(title.text).width;
  const b1 = { w: Math.ceil(titleW + PAD_X * 2), h: Math.ceil(TITLE.size * 1.2 + PAD_Y * 2) };
  const b2 = { w: Math.ceil(bodyTextW + PAD_X * 2), h: Math.ceil(lines.length * BODY_LH + PAD_Y * 2 - (BODY_LH - BODY.size * 1.2)) };
  const metaTop = b1.h + GAP + b2.h + 22;
  const h = metaTop + META.size * 1.25;
  return { lines, title, b1, b2, metaTop, h };
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tail: boolean): void {
  roundRectPath(ctx, x, y, w, h, Math.min(RADIUS, h / 2));
  ctx.fill();
  if (!tail) return;
  // iMessage-style tail curling out of the bottom-right corner.
  const r = x + w;
  const b = y + h;
  ctx.beginPath();
  ctx.moveTo(r - 40, b - 40);
  ctx.lineTo(r, b - 40);
  ctx.bezierCurveTo(r, b - 16, r + 4, b - 4, r + TAIL, b);
  ctx.bezierCurveTo(r + 2, b + 3, r - 12, b - 1, r - 24, b - 7);
  ctx.bezierCurveTo(r - 30, b - 3, r - 36, b, r - 44, b);
  ctx.lineTo(r - 40, b - 40);
  ctx.closePath();
  ctx.fill();
}

export const messages: CardDesign = {
  id: 'messages',
  name: 'Messages',
  blurb: 'Your workout as a text bubble',
  supportsAccent: true,
  defaultAccent: MESSAGES_BLUE,

  background(opts) {
    return opts.theme === 'dark' ? '#000000' : '#FFFFFF';
  },

  measure(_width, data, opts) {
    return { h: layout(measureContext(), data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(ctx, data, opts);
    const right = box.x + box.w - TAIL;
    const text = onColor(opts.accent);

    ctx.fillStyle = opts.accent;
    bubble(ctx, right - L.b1.w, box.y, L.b1.w, L.b1.h, false);
    const b2y = box.y + L.b1.h + GAP;
    ctx.fillStyle = opts.accent;
    bubble(ctx, right - L.b2.w, b2y, L.b2.w, L.b2.h, true);

    ctx.fillStyle = text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    setFont(ctx, { ...TITLE, size: L.title.size });
    ctx.fillText(L.title.text, right - L.b1.w + PAD_X, box.y + L.b1.h / 2 + L.title.size * 0.36);

    setFont(ctx, BODY);
    L.lines.forEach((line, i) => {
      ctx.fillText(line, right - L.b2.w + PAD_X, b2y + baseline(PAD_Y + i * BODY_LH, BODY.size));
    });

    setFont(ctx, META);
    ctx.fillStyle = opts.theme === 'dark' ? '#98989F' : '#6C6C70';
    ctx.textAlign = 'right';
    const meta = [`${data.shortDate} at ${data.timeText}`, data.location, opts.showLogo ? 'Sweatshot' : ''].filter(Boolean).join(' · ');
    ctx.fillText(ellipsize(ctx, meta, box.w - 40), right - 8, box.y + baseline(L.metaTop, META.size));
  },
};
