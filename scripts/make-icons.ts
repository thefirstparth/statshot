/**
 * Generates the PWA icons in public/ from the logo glyph (no external assets).
 * Run: npm run icons
 */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawLogoGlyph } from '../src/render/canvas.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = '#101114';
const MARK = '#FF6B35';

/** `glyph` is the glyph size as a fraction of the icon. */
function icon(size: number, glyph: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  const g = size * glyph;
  drawLogoGlyph(ctx, (size - g) / 2, (size - g) / 2, g, MARK);
  return canvas.toBuffer('image/png');
}

function faviconSvg(): string {
  const bar = 0.24;
  const gap = (1 - bar * 3) / 2;
  const g = 18; // glyph box inside a 32×32 icon
  const o = (32 - g) / 2;
  const rects = [0.5, 0.75, 1]
    .map((h, i) => {
      const x = o + i * (bar + gap) * g;
      const hh = h * g;
      return `<rect x="${x.toFixed(2)}" y="${(o + g - hh).toFixed(2)}" width="${(bar * g).toFixed(2)}" height="${hh.toFixed(2)}" rx="${(bar * g * 0.45).toFixed(2)}" fill="${MARK}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${BG}"/>${rects}</svg>\n`;
}

mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
const files: Record<string, Buffer | string> = {
  'icons/icon-192.png': icon(192, 0.5),
  'icons/icon-512.png': icon(512, 0.5),
  'icons/maskable-512.png': icon(512, 0.4), // inside the maskable safe zone
  'icons/apple-touch-icon.png': icon(180, 0.5),
  'favicon.svg': faviconSvg(),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(path.join(ROOT, name), content);
  console.log(`wrote public/${name}`);
}
