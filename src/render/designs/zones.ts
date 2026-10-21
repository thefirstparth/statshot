import { drawLogo, fillRoundRect, rgba, roundRectPath, setFont, statRows, visibleStats } from '../canvas';
import { SANS } from '../font-faces';
import { formatMinutes, ZONE_COLORS, ZONE_NAMES } from '../../tcx/stats';
import type { CardData, CardDesign, CardOptions, Rect } from '../types';
import { cardColors } from './midnight';
import { drawHeader, HEADER_H } from './pulse';
import { baseline, drawStatGrid, statGridHeight, type StatGridStyle } from './shared';

const PAD = 64;
const BAR_H = 64;
const ROW_H = 60;
const ROW_TEXT = 32;
const LOGO = 28;

function gridStyle(ink: string): StatGridStyle {
  return {
    label: { family: SANS, weight: 400, size: 28 },
    value: { family: SANS, weight: 600, size: 48 },
    ink,
    labelAlpha: 0.6,
    gap: 8,
    rowGap: 36,
    align: 'left',
    inset: 0,
  };
}

function layout(data: CardData, opts: CardOptions) {
  const rows = statRows(visibleStats(data, opts));
  const barTop = HEADER_H + 48;
  const listTop = barTop + BAR_H + 36;
  const listH = ROW_H * 5;
  const statsTop = listTop + listH + 40;
  const statsH = statGridHeight(rows.length, gridStyle('#000'));
  const footerTop = statsTop + statsH + 56;
  const h = opts.showLogo ? footerTop + LOGO + 52 : statsTop + statsH + PAD;
  return { rows, barTop, listTop, statsTop, footerTop, h };
}

export const zones: CardDesign = {
  id: 'zones',
  name: 'Zones',
  needsHr: true,
  needsZones: true,
  supportsAccent: true,

  background(opts) {
    return cardColors(opts).canvas;
  },

  icons(data, opts) {
    return [{ name: data.sportIcon, color: opts.accent, size: 72 }];
  },

  measure(_width, data, opts) {
    return { h: layout(data, opts).h };
  },

  draw(ctx: CanvasRenderingContext2D, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(data, opts);
    const c = cardColors(opts);
    fillRoundRect(ctx, box.x, box.y, box.w, box.h, 56, c.card);
    drawHeader(ctx, box, data, opts, c.ink);

    // Stacked bar, Z1 → Z5.
    const bx = box.x + PAD;
    const bw = box.w - PAD * 2;
    const by = box.y + L.barTop;
    const minutes = data.zoneMinutes ?? [0, 0, 0, 0, 0];
    const total = minutes.reduce((a, b) => a + b, 0);
    ctx.save();
    roundRectPath(ctx, bx, by, bw, BAR_H, 20);
    ctx.clip();
    ctx.fillStyle = rgba(c.ink, 0.1);
    ctx.fillRect(bx, by, bw, BAR_H);
    if (total > 0) {
      let x = bx;
      minutes.forEach((m, z) => {
        if (m <= 0) return;
        const w = (m / total) * bw;
        ctx.fillStyle = ZONE_COLORS[z];
        ctx.fillRect(x, by, w, BAR_H);
        x += w;
        if (x < bx + bw - 1) {
          ctx.fillStyle = c.card;
          ctx.fillRect(x - 2, by, 4, BAR_H);
        }
      });
    }
    ctx.restore();

    // Z1…Z5 rows: swatch, zone, name, minutes.
    for (let z = 0; z < 5; z++) {
      const top = box.y + L.listTop + z * ROW_H;
      const base = baseline(top + (ROW_H - ROW_TEXT * 1.2) / 2, ROW_TEXT);
      fillRoundRect(ctx, bx, base - ROW_TEXT * 0.72, 22, 22, 6, ZONE_COLORS[z]);
      setFont(ctx, { family: SANS, weight: 600, size: ROW_TEXT });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = c.ink;
      ctx.fillText(`Z${z + 1}`, bx + 44, base);
      setFont(ctx, { family: SANS, weight: 400, size: ROW_TEXT });
      ctx.fillStyle = rgba(c.ink, 0.7);
      ctx.fillText(ZONE_NAMES[z], bx + 112, base);
      setFont(ctx, { family: SANS, weight: 600, size: ROW_TEXT });
      ctx.fillStyle = c.ink;
      ctx.textAlign = 'right';
      ctx.fillText(data.zoneMinutes ? formatMinutes(minutes[z]) : '–', bx + bw, base);
      if (z < 4) {
        ctx.fillStyle = rgba(c.ink, 0.08);
        ctx.fillRect(bx, top + ROW_H - 1, bw, 2);
      }
    }

    drawStatGrid(ctx, L.rows, bx, box.y + L.statsTop, bw, gridStyle(c.ink));

    if (opts.showLogo) {
      drawLogo(ctx, box.x + box.w / 2, box.y + L.footerTop + LOGO / 2, LOGO, rgba(c.ink, 0.7), 'center');
    }
  },
};
