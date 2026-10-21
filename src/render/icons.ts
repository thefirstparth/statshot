import icons from 'virtual:tabler-icons';
import { FALLBACK_ICON } from '../sports';
import { renderEnv } from './env';
import type { IconRequest } from './types';

export function iconSvg(name: string): string {
  return icons[name] ?? icons[FALLBACK_ICON] ?? '';
}

/** Tabler SVG recoloured (currentColor → color) and sized for crisp rasterisation. */
export function coloredIconSvg(name: string, color: string, size: number, strokeWidth = 2): string {
  return iconSvg(name)
    .replace(/currentColor/g, color)
    .replace(/\swidth="24"/, ` width="${size}"`)
    .replace(/\sheight="24"/, ` height="${size}"`)
    .replace(/stroke-width="2"/, `stroke-width="${strokeWidth}"`);
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
        const svg = coloredIconSvg(r.name, r.color, Math.round(r.size));
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
