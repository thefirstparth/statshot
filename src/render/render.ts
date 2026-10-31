import { renderEnv } from './env';
import { luminance, roundRectPath } from './canvas';
import { drawIconPath, loadIcons } from './icons';
import type { CanvasSize, CardData, CardDesign, CardOptions, Rect, SizeKey } from './types';

export const CARD_WIDTH = 920;
export const STICKER_PAD = 32;
const MIN_MARGIN = 64;

export const SIZES: Record<Exclude<CanvasSize, 'sticker'>, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 }, // design-list thumbnails only
};

export type CanvasLayout = {
  width: number;
  height: number;
  /** Where the card goes on the canvas (after scaling). */
  x: number;
  y: number;
  scale: number;
  /** The card box in card coordinates. */
  box: Rect;
};

export function canvasLayout(
  design: CardDesign,
  data: CardData,
  opts: CardOptions,
  size: CanvasSize,
): CanvasLayout {
  const cardH = Math.ceil(design.measure(CARD_WIDTH, data, opts).h);
  const box: Rect = { x: 0, y: 0, w: CARD_WIDTH, h: cardH };
  if (size === 'sticker') {
    return {
      width: CARD_WIDTH + STICKER_PAD * 2,
      height: cardH + STICKER_PAD * 2,
      x: STICKER_PAD,
      y: STICKER_PAD,
      scale: 1,
      box,
    };
  }
  const { w, h } = SIZES[size];
  // Never overflow: shrink the whole card if it is taller than the canvas allows.
  const scale = Math.min(1, (h - MIN_MARGIN * 2) / cardH);
  const cw = CARD_WIDTH * scale;
  const ch = cardH * scale;
  let y = (h - ch) / 2;
  return { width: w, height: h, x: Math.round((w - cw) / 2), y: Math.round(y), scale, box };
}

/**
 * See-through text-only cards get a soft frosted panel (dark behind light text, light behind dark
 * text) so they stay readable on any photo, plus a gentle halo on the text itself.
 */
function applyFloatingShadow(ctx: CanvasRenderingContext2D, design: CardDesign, opts: CardOptions, box?: Rect): void {
  if (!design.floating || opts.background !== 'transparent') return;
  if (box) {
    const pad = 28;
    ctx.save();
    roundRectPath(ctx, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2, 56);
    ctx.fillStyle = opts.theme === 'dark' ? 'rgba(12, 12, 14, 0.42)' : 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowColor = opts.theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
}

/**
 * A compact card on a tall Story would float in empty space; a huge, faint sport glyph behind it
 * makes the frame feel designed. Solid backgrounds only (see-through stays clean for photos).
 */
function drawStoryBackdrop(
  ctx: CanvasRenderingContext2D,
  design: CardDesign,
  data: CardData,
  opts: CardOptions,
  size: SizeKey,
  layout: CanvasLayout,
): void {
  if (size !== 'story') return;
  const cardH = layout.box.h * layout.scale;
  if (cardH > layout.height * 0.62) return;
  const bg = design.background(opts);
  const glyph = luminance(bg) > 0.45 ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.06)';
  const s = layout.width * 1.15;
  drawIconPath(ctx, data.sportIcon, glyph, layout.width - s * 0.7, layout.height - s * 0.78, s);
  drawIconPath(ctx, data.sportIcon, glyph, -s * 0.38, -s * 0.3, s * 0.75);
}

/** Decode everything a card needs before drawing it (fonts are loaded once at app start). */
export function prepareCard(design: CardDesign, data: CardData, opts: CardOptions): Promise<void> {
  return loadIcons(design.icons?.(data, opts) ?? []);
}

/** Synchronous full-resolution render into `canvas` (resized to the export size). */
export function renderCard(
  canvas: HTMLCanvasElement,
  design: CardDesign,
  data: CardData,
  opts: CardOptions,
  size: SizeKey,
): CanvasLayout {
  const layout = canvasLayout(design, data, opts, size);
  if (canvas.width !== layout.width) canvas.width = layout.width;
  if (canvas.height !== layout.height) canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, layout.width, layout.height);
  if (opts.background === 'solid') {
    ctx.fillStyle = design.background(opts);
    ctx.fillRect(0, 0, layout.width, layout.height);
    drawStoryBackdrop(ctx, design, data, opts, size, layout);
  }
  ctx.save();
  ctx.translate(layout.x, layout.y);
  ctx.scale(layout.scale, layout.scale);
  applyFloatingShadow(ctx, design, opts, layout.box);
  design.draw(ctx, layout.box, data, opts);
  ctx.restore();
  return layout;
}

/** Small preview: the same drawing scaled to `width` CSS pixels (× devicePixelRatio). */
export function renderThumb(
  canvas: HTMLCanvasElement,
  design: CardDesign,
  data: CardData,
  opts: CardOptions,
  size: CanvasSize,
  width: number,
  dpr = 1,
): void {
  const layout = canvasLayout(design, data, opts, size);
  const k = (width * dpr) / layout.width;
  canvas.width = Math.round(layout.width * k);
  canvas.height = Math.round(layout.height * k);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, layout.width, layout.height);
  if (opts.background === 'solid') {
    ctx.fillStyle = design.background(opts);
    ctx.fillRect(0, 0, layout.width, layout.height);
  }
  ctx.translate(layout.x, layout.y);
  ctx.scale(layout.scale, layout.scale);
  ctx.save();
  applyFloatingShadow(ctx, design, opts, layout.box);
  design.draw(ctx, layout.box, data, opts);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function renderToNewCanvas(
  design: CardDesign,
  data: CardData,
  opts: CardOptions,
  size: SizeKey,
): HTMLCanvasElement {
  const canvas = renderEnv().createCanvas(1, 1);
  renderCard(canvas, design, data, opts, size);
  return canvas;
}

/** Frees the backing store early; iOS counts canvas memory until GC otherwise. */
export function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}
