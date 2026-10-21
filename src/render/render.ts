import { renderEnv } from './env';
import { loadIcons } from './icons';
import type { CardData, CardDesign, CardOptions, Rect, SizeKey } from './types';

export const CARD_WIDTH = 920;
export const STICKER_PAD = 48;
const MIN_MARGIN = 64;

export const SIZES: Record<Exclude<SizeKey, 'sticker'>, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
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
  size: SizeKey,
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
  if (size === 'story') y = Math.max(MIN_MARGIN, y - h * 0.035); // slightly above the middle
  return { width: w, height: h, x: Math.round((w - cw) / 2), y: Math.round(y), scale, box };
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
  }
  ctx.save();
  ctx.translate(layout.x, layout.y);
  ctx.scale(layout.scale, layout.scale);
  design.draw(ctx, layout.box, data, opts);
  ctx.restore();
  return layout;
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
