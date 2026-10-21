import { drawFitText, drawLogo, rgba, visibleStats } from '../canvas';
import { DISPLAY, MONO, SANS } from '../font-faces';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { drawSportBadge, metaLine } from './shared';

const DIAL = 780;
const BADGE = 116;
const STATS_H = 52 + 10 + 30;
const LOGO = 28;

function colors(data: CardData, opts: CardOptions) {
  return opts.theme === 'dark'
    ? { ink: '#F1F2F4', muted: 'rgba(241,242,244,0.66)', track: 'rgba(255,255,255,0.14)', tick: 'rgba(255,255,255,0.34)', faint: 'rgba(255,255,255,0.42)', accent: data.sportColors.bg }
    : { ink: '#1A1C1E', muted: 'rgba(26,28,30,0.62)', track: 'rgba(0,0,0,0.09)', tick: 'rgba(0,0,0,0.28)', faint: 'rgba(0,0,0,0.38)', accent: data.sportColors.strong };
}

function extras(data: CardData, opts: CardOptions) {
  return visibleStats(data, opts)
    .filter((s) => s.key !== 'duration' && s.key !== 'timeRange')
    .slice(0, 3);
}

function layout(data: CardData, opts: CardOptions) {
  const titleTop = DIAL + 56;
  const metaTop = titleTop + 64 * 1.15 + 6;
  let end = metaTop + 36 * 1.2;
  const ex = extras(data, opts);
  const statsTop = end + 56;
  if (ex.length) end = statsTop + STATS_H;
  const logoTop = end + 48;
  if (opts.showLogo) end = logoTop + LOGO * 1.2;
  return { titleTop, metaTop, statsTop, logoTop, ex, h: end };
}

/** Angle for a minute of the day: midnight at the top, clockwise. */
const angle = (min: number) => (min / 1440) * Math.PI * 2 - Math.PI / 2;

export const dial: CardDesign = {
  id: 'dial',
  name: 'Day dial',
  blurb: 'When you played, on a 24-hour clock',
  supportsAccent: false,

  background(opts) {
    return opts.theme === 'dark' ? '#0B0C0E' : '#F6F7F9';
  },

  measure(_w, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const c = colors(data, opts);
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
    for (const h of [0, 6, 12, 18]) {
      const a = angle(h * 60);
      const r = R - 84;
      ctx.fillText(String(h).padStart(2, '0'), cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.textBaseline = 'alphabetic';

    // The session arc.
    const mins = Math.max(data.durationSec / 60, 6);
    ctx.beginPath();
    ctx.arc(cx, cy, R, angle(data.startMin), angle(data.startMin + Math.min(mins, 1439)));
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Centre: sport sticker, duration, time range.
    drawSportBadge(ctx, data, cx - BADGE / 2, cy - 196, BADGE, opts.theme === 'dark');
    drawFitText(ctx, data.stats.duration?.value ?? '', cx, cy + 66, R * 1.3, { family: DISPLAY, weight: 800, size: 136 }, c.ink, 'center', 0.5);
    drawFitText(ctx, `${data.timeText} – ${data.endTimeText}`, cx, cy + 128, R * 1.2, { family: MONO, weight: 400, size: 36 }, c.muted, 'center', 0.7);

    // Below the dial.
    drawFitText(ctx, data.title, cx, box.y + L.titleTop + 64 * 0.9, box.w, { family: SANS, weight: 700, size: 64 }, c.ink, 'center', 0.6);
    drawFitText(ctx, metaLine(data, false), cx, box.y + L.metaTop + 36 * 0.9, box.w, { family: SANS, weight: 400, size: 36 }, c.muted, 'center');

    if (L.ex.length) {
      const colW = box.w / L.ex.length;
      L.ex.forEach((s, i) => {
        const sx = box.x + colW * (i + 0.5);
        drawFitText(ctx, s.value, sx, box.y + L.statsTop + 52 * 0.86, colW - 24, { family: SANS, weight: 700, size: 52 }, c.ink, 'center', 0.6);
        drawFitText(ctx, s.label, sx, box.y + L.statsTop + 52 + 10 + 28, colW - 24, { family: SANS, weight: 400, size: 28 }, c.muted, 'center', 0.7);
      });
    }

    if (opts.showLogo) drawLogo(ctx, cx, box.y + L.logoTop + LOGO * 0.6, LOGO, rgba(opts.theme === 'dark' ? '#FFFFFF' : '#1A1C1E', 0.55), 'center');
  },
};
