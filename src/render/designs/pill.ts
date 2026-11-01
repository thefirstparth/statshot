import { drawLogo, fitText, measureLogo, roundRectPath, setFont, splitRows, visibleStats, type FontSpec } from '../canvas';
import { SANS } from '../font-faces';
import { measureContext } from '../env';
import { drawIconPath } from '../icons';
import type { CardData, CardDesign, CardOptions, Rect, StatItem, StatKey } from '../types';
import { CATEGORY_SHAPES, sportById } from '../../sports';
import { accentInk, accentTones } from '../palette';
import { showsTimeStat, shortPlace } from './shared';

type Ctx = CanvasRenderingContext2D;

// Material Symbols Rounded (Apache-2.0), filled, 0 -960 960 960 viewBox. Not in the app's icon
// set, so the few stat glyphs this card needs live here.
const FLAME =
  'M160-400q0-116 71.5-225T428-811q17-11 34.5-.5T480-780v72q0 34 23.5 57t57.5 23q18 0 33.5-7.5T622-658q8-9 18-12.5t19 2.5q66 45 103.5 116T800-400q0 95-49 171.5T622-113q23-26 35.5-58t12.5-67q0-38-14-71.5T615-370L480-502 346-370q-28 27-42 60.5T290-238q0 35 12.5 67t35.5 58q-80-39-129-115.5T160-400Zm320-18 92 90q18 18 28 41t10 49q0 53-38 90.5T480-110q-54 0-92-37.5T350-238q0-26 9.5-49t28.5-41l92-90Z';
const HEART =
  'M458-144q-11-4-19-12l-53-49Q262-320 171-424.5T80-643q0-90 60.5-150.5T290-854q51 0 101 24.5t89 80.5q44-56 91-80.5t99-24.5q89 0 149.5 60.5T880-643q0 114-91 218.5T574-205l-53 49q-8 8-19 12t-22 4q-11 0-22-4Z';
const TIMER =
  'M390-860q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h180q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H390Zm111.5 438.37q8.5-8.62 8.5-21.37v-170q0-12.75-8.68-21.38-8.67-8.62-21.5-8.62-12.82 0-21.32 8.62-8.5 8.63-8.5 21.38v170q0 12.75 8.68 21.37 8.67 8.63 21.5 8.63 12.82 0 21.32-8.63Zm-161 312.13Q275-138 226-187t-77.5-114.5Q120-367 120-441t28.5-139.5Q177-646 226-695t114.5-77.5Q406-801 480-801q67 0 125.5 22T710-717l30-30q9-9 21.5-9t21.5 9q9 9 9 21.5t-9 21.5l-30 30q36 40 61.5 97T840-441q0 74-28.5 139.5T734-187q-49 49-114.5 77.5T480-81q-74 0-139.5-28.5Z';
const ROUTE =
  'M245-165.53Q200-211.06 200-275v-349q-35-13-57.5-41.26-22.5-28.27-22.5-64.41Q120-776 152.5-808t78-32q45.5 0 77.5 32.14t32 78.05q0 35.81-22.5 64.31T260-624v349q0 39.19 27.5 67.09Q315-180 355.5-180t67.5-27.91q27-27.9 27-67.09v-410q0-65 45-110t110-45q65 0 110 45t45 110v349q35 13 57.5 41.36Q840-266.27 840-230q0 45-32.08 77.5Q775.83-120 730-120q-45 0-77.5-32.5T620-230q0-36.3 22.5-65.15Q665-324 700-336v-349q0-40-27.5-67.5T605-780q-40 0-67.5 27.5T510-685v410q0 63.94-45 109.47T355-120q-65 0-110-45.53ZM230.5-680q20.5 0 35-15t14.5-35.5q0-20.5-14.37-35Q251.25-780 230-780q-20 0-35 14.37-15 14.38-15 35.63 0 20 15 35t35.5 15Zm500 500q20.5 0 35-15t14.5-35.5q0-20.5-14.37-35Q751.25-280 730-280q-20 0-35 14.37-15 14.38-15 35.63 0 20 15 35t35.5 15Z';
const BOLT =
  'M360-360H217q-18 0-26.5-16t2.5-31l338-488q8-11 20-15t24 1q12 5 19 16t5 24l-39 309h176q19 0 27 17t-4 32L388-66q-8 10-20.5 13T344-55q-11-5-17.5-16T322-95l38-265Z';
const CLOCK =
  'M513-492v-171q0-13-8.5-21.5T483-693q-13 0-21.5 8.5T453-663v183q0 6 2 11t6 10l144 149q9 10 22.5 9.5T650-310q9-9 9-22t-9-22L513-492ZM480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-82 31.5-155t86-127.5Q252-817 325-848.5T480-880q82 0 155 31.5t127.5 86Q817-708 848.5-635T880-480q0 82-31.5 155t-86 127.5Q708-143 635-111.5T480-80Z';
export const PIN =
  'M458.5-103.5Q448-107 440-115q-42-38-91-87.5T258-309q-42-57-70-119t-28-124q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 62-28 124t-70 119q-42 57-91 106.5T520-115q-8 8-18.5 11.5T480-100q-11 0-21.5-3.5Zm71-407Q550-531 550-560t-20.5-49.5Q509-630 480-630t-49.5 20.5Q410-589 410-560t20.5 49.5Q451-490 480-490t49.5-20.5Z';

export const STAT_GLYPHS: Record<StatKey, string> = {
  duration: TIMER,
  energy: FLAME,
  avgHr: HEART,
  maxHr: HEART,
  minHr: HEART,
  zoneMin: BOLT,
  distance: ROUTE,
  timeRange: CLOCK,
};

/** Fills raw Material Symbols path data (0 -960 960 960 box) into a size×size square. */
export function drawGlyph(ctx: Ctx, d: string, color: string, x: number, y: number, size: number): void {
  if (typeof Path2D === 'undefined') return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 960, size / 960);
  ctx.translate(0, 960);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(d));
  ctx.restore();
}

/** Sport sticker: the category outline filled, with the sport glyph inside. */
export function drawSticker(ctx: Ctx, data: CardData, x: number, y: number, size: number, bg: string, fg: string): void {
  const shape = CATEGORY_SHAPES[sportById(data.sportId).cat] ?? CATEGORY_SHAPES.racket;
  if (typeof Path2D !== 'undefined') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    ctx.fillStyle = bg;
    ctx.fill(new Path2D(shape));
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  }
  const g = size * 0.52;
  drawIconPath(ctx, data.sportIcon, fg, x + (size - g) / 2, y + (size - g) / 2, g);
}

// ── Layout ────────────────────────────────────────────────────────────────────

const TOP = 24; // room for the shadow above the pill
const BOTTOM = 44;
const MAIN_H = 184;
const STICKER = 132;
const MAIN_PAD_L = 26;
const MAIN_PAD_R = 72;
const MAIN_GAP = 28;
const HEADING: FontSpec = { family: SANS, weight: 700, size: 60 };
const LINE: FontSpec = { family: SANS, weight: 400, size: 40 };
const CHIP_H = 108;
const CHIP_PAD_L = 26;
const CHIP_PAD_R = 34;
const CHIP_ICON = 50;
const CHIP_GAP = 12;
const VALUE: FontSpec = { family: SANS, weight: 700, size: 52 };
const UNIT: FontSpec = { family: SANS, weight: 400, size: 34 };
const ROW_GAP = 16;
const STACK_GAP = 24;
const LOGO_H = 64;
const LOGO_SIZE = 28;

const THEMES = {
  light: { bg: '#F6F7F9', surface: '#FFFFFF', ink: '#1A1C1E', muted: '#5B6066' },
  dark: { bg: '#0F1012', surface: '#1C1D20', ink: '#F1F2F4', muted: '#A7ABB1' },
};

function palette(_data: CardData, opts: CardOptions) {
  const th = THEMES[opts.theme];
  const t = accentTones(opts);
  return { ...th, stickerBg: t.bg, stickerFg: t.fg, icon: accentInk(opts) };
}

/** Short unit words so the three heart-rate chips stay distinguishable. */
function chipUnit(s: StatItem): string {
  switch (s.key) {
    case 'avgHr':
      return 'avg';
    case 'maxHr':
      return 'peak';
    case 'minHr':
      return 'low';
    default:
      return s.unit;
  }
}

type Chip = { item: StatItem; value: string; valueSize: number; unit: string; w: number };

function chipFor(ctx: Ctx, item: StatItem, maxW: number): Chip {
  const unit = chipUnit(item);
  setFont(ctx, UNIT);
  const unitW = unit ? ctx.measureText(unit).width + 12 : 0;
  const fixed = CHIP_PAD_L + CHIP_ICON + CHIP_GAP + unitW + CHIP_PAD_R;
  const v = fitText(ctx, item.number, maxW - fixed, VALUE, 0.7);
  const valueW = ctx.measureText(v.text).width;
  return { item, value: v.text, valueSize: v.size, unit, w: Math.ceil(fixed + valueW) };
}

function layout(ctx: Ctx, width: number, data: CardData, opts: CardOptions) {
  const textMax = width - MAIN_PAD_L - STICKER - MAIN_GAP - MAIN_PAD_R;
  const heading = fitText(ctx, data.title, textMax, HEADING, 0.7);
  const headingW = ctx.measureText(heading.text).width;
  // The start time is left out when the time-range chip already shows it.
  const lineText = [`${data.weekday} ${data.shortDate}`, data.sessionsText || shortPlace(data, 22) || (showsTimeStat(data, opts) ? '' : data.timeText)].filter(Boolean).join(' · ');
  const line = fitText(ctx, lineText, textMax, LINE, 0.85);
  const lineW = ctx.measureText(line.text).width;
  const mainW = Math.ceil(MAIN_PAD_L + STICKER + MAIN_GAP + Math.max(headingW, lineW) + MAIN_PAD_R);

  const chips = visibleStats(data, opts).map((s) => chipFor(ctx, s, width));
  const rowW = (row: Chip[]) => row.reduce((a, c) => a + c.w, 0) + ROW_GAP * (row.length - 1);
  let rows: Chip[][] = [];
  for (let per = Math.min(3, chips.length); per >= 1; per--) {
    rows = splitRows(chips, per);
    if (rows.every((r) => rowW(r) <= width)) break;
  }

  const chipsTop = TOP + MAIN_H + STACK_GAP;
  const chipsH = rows.length ? rows.length * CHIP_H + (rows.length - 1) * ROW_GAP : 0;
  const logoTop = chipsTop + chipsH + (rows.length ? STACK_GAP : 0);
  const end = opts.showLogo ? logoTop + LOGO_H : chipsTop + chipsH - (rows.length ? 0 : STACK_GAP);
  return { heading, line, mainW, rows, rowW, chipsTop, logoTop, h: end + BOTTOM };
}

function shadowed(ctx: Ctx, blur: number, dy: number, alpha: number, paint: () => void): void {
  ctx.save();
  ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  paint();
  ctx.restore();
}

export const pill: CardDesign = {
  id: 'pill',
  name: 'Sticker pill',
  blurb: 'A compact pill you can drop on any photo',
  supportsAccent: true,

  background(opts) {
    return THEMES[opts.theme].bg;
  },

  measure(width, data, opts) {
    return { h: layout(measureContext(), width, data, opts).h };
  },

  draw(ctx: Ctx, box: Rect, data: CardData, opts: CardOptions) {
    const L = layout(ctx, box.w, data, opts);
    const p = palette(data, opts);
    const cx = box.x + box.w / 2;

    // Main pill: sticker + title + date line.
    const mx = Math.round(cx - L.mainW / 2);
    const my = box.y + TOP;
    shadowed(ctx, 30, 10, 0.18, () => {
      roundRectPath(ctx, mx, my, L.mainW, MAIN_H, MAIN_H / 2);
      ctx.fillStyle = p.surface;
      ctx.fill();
    });
    drawSticker(ctx, data, mx + MAIN_PAD_L, my + (MAIN_H - STICKER) / 2, STICKER, p.stickerBg, p.stickerFg);
    const tx = mx + MAIN_PAD_L + STICKER + MAIN_GAP;
    const blockH = L.heading.size * 1.05 + 4 + L.line.size * 1.15;
    const top = my + (MAIN_H - blockH) / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    setFont(ctx, { ...HEADING, size: L.heading.size });
    ctx.fillStyle = p.ink;
    ctx.fillText(L.heading.text, tx, top + L.heading.size * 0.86);
    setFont(ctx, { ...LINE, size: L.line.size });
    ctx.fillStyle = p.muted;
    ctx.fillText(L.line.text, tx, top + L.heading.size * 1.05 + 4 + L.line.size * 0.92);

    // Stat chips, centred rows.
    L.rows.forEach((row, r) => {
      const y = box.y + L.chipsTop + r * (CHIP_H + ROW_GAP);
      let x = Math.round(cx - L.rowW(row) / 2);
      for (const c of row) {
        shadowed(ctx, 24, 8, 0.16, () => {
          roundRectPath(ctx, x, y, c.w, CHIP_H, CHIP_H / 2);
          ctx.fillStyle = p.surface;
          ctx.fill();
        });
        drawGlyph(ctx, STAT_GLYPHS[c.item.key], p.icon, x + CHIP_PAD_L, y + (CHIP_H - CHIP_ICON) / 2, CHIP_ICON);
        let vx = x + CHIP_PAD_L + CHIP_ICON + CHIP_GAP;
        const base = y + CHIP_H / 2 + VALUE.size * 0.36;
        setFont(ctx, { ...VALUE, size: c.valueSize });
        ctx.fillStyle = p.ink;
        ctx.textAlign = 'left';
        ctx.fillText(c.value, vx, base);
        vx += ctx.measureText(c.value).width + 12;
        if (c.unit) {
          setFont(ctx, UNIT);
          ctx.fillStyle = p.muted;
          ctx.fillText(c.unit, vx, base);
        }
        x += c.w + ROW_GAP;
      }
    });

    // Small Sweatshot tag.
    if (opts.showLogo) {
      const w = Math.ceil(measureLogo(ctx, LOGO_SIZE) + 56);
      const lx = Math.round(cx - w / 2);
      const ly = box.y + L.logoTop;
      shadowed(ctx, 20, 6, 0.14, () => {
        roundRectPath(ctx, lx, ly, w, LOGO_H, LOGO_H / 2);
        ctx.fillStyle = p.surface;
        ctx.fill();
      });
      drawLogo(ctx, cx, ly + LOGO_H / 2, LOGO_SIZE, p.muted, 'center');
    }
  },
};
