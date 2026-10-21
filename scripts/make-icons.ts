/**
 * Generates the PWA icons in public/ from the Sweatshot drop (no external assets).
 * A mango sweat drop with an ink outline and offset shadow, sticker-book style, on cream.
 * Run: npm run icons
 */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_ORANGE, dropPath, sparkPath } from '../src/render/canvas.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = '#FFF4E4';
const INK = '#2A1E14';

/** `glyph` is the drop height as a fraction of the icon. */
function icon(size: number, glyph: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  const g = size * glyph;
  const x = (size - g) / 2;
  const y = (size - g) / 2;
  const line = size * 0.028;
  const off = size * 0.035;
  dropPath(ctx, x + off, y + off, g);
  ctx.fillStyle = INK;
  ctx.fill();
  dropPath(ctx, x, y, g);
  ctx.fillStyle = BRAND_ORANGE;
  ctx.fill();
  ctx.lineWidth = line;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  sparkPath(ctx, x + g * 0.6, y + g * 0.64, g * 0.15);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  return canvas.toBuffer('image/png');
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${BG}"/><path d="M54 18C61 32 82 50 82 66a28 28 0 0 1-56 0C26 50 47 32 54 18Z" fill="${INK}"/><path d="M50 14C57 28 78 46 78 62a28 28 0 0 1-56 0C22 46 43 28 50 14Z" fill="${BRAND_ORANGE}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M57 50q2.5 8 10 10.5q-7.5 2.5-10 10.5q-2.5-8-10-10.5q7.5-2.5 10-10.5Z" fill="#FFFFFF"/></svg>\n`;

mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
const files: Record<string, Buffer | string> = {
  'icons/icon-192.png': icon(192, 0.62),
  'icons/icon-512.png': icon(512, 0.62),
  'icons/maskable-512.png': icon(512, 0.48), // inside the maskable safe zone
  'icons/apple-touch-icon.png': icon(180, 0.62),
  'favicon.svg': FAVICON,
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(path.join(ROOT, name), content);
  console.log(`wrote public/${name}`);
}
