import icons from 'virtual:icons';
import { FALLBACK_ICON } from '../sports';
import { renderEnv } from './env';
import type { IconRequest } from './types';

/** SVG path data (0 -960 960 960 viewBox) for an icon, falling back to the default glyph. */
export function iconPath(name: string): string {
  return icons[name] ?? icons[FALLBACK_ICON] ?? '';
}

/** Complete SVG with the given fill; `currentColor` lets inline UI icons inherit text colour. */
export function iconSvg(name: string, color = 'currentColor', size = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="${size}" height="${size}" fill="${color}"><path d="${iconPath(name)}"/></svg>`;
}

const cache = new Map<string, CanvasImageSource>();
const pending = new Map<string, Promise<void>>();

const keyOf = (r: IconRequest) => `${r.name}|${r.color.toLowerCase()}|${Math.round(r.size)}`;

/** Decodes the requested icon images (cached). Resolves once all are ready; never rejects. */
export function loadIcons(requests: IconRequest[]): Promise<void> {
  return Promise.all(
    requests.map((r) => {
      const key = keyOf(r);
      if (cache.has(key)) return undefined;
      let p = pending.get(key);
      if (!p) {
        const svg = iconSvg(r.name, r.color, Math.round(r.size));
        const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        p = renderEnv()
          .loadImage(src)
          .then((img) => {
            cache.set(key, img);
          })
          .catch(() => undefined)
          .finally(() => pending.delete(key));
        pending.set(key, p);
      }
      return p;
    }),
  ).then(() => undefined);
}

export function iconsReady(requests: IconRequest[]): boolean {
  return requests.every((r) => cache.has(keyOf(r)));
}

/** Draws a preloaded icon; silently skips one that isn't decoded yet. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  x: number,
  y: number,
  size: number,
): void {
  const img = cache.get(keyOf({ name, color, size }));
  if (img) ctx.drawImage(img, x, y, size, size);
}

/**
 * Draws an icon straight from its path data (no decode step). Preferred for new designs: it
 * is synchronous and exact at any size.
 */
export function drawIconPath(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  x: number,
  y: number,
  size: number,
): void {
  if (typeof Path2D === 'undefined') {
    drawIcon(ctx, name, color, x, y, size);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 960, size / 960);
  ctx.translate(0, 960);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(iconPath(name)));
  ctx.restore();
}
