/**
 * Generates the PWA icons in public/ from the Sweatshot heart (no external assets): a white
 * and a coral pill crossing into a heart, on near-black.
 * Run: npm run icons
 */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_CORAL, BRAND_INK, BRAND_WHITE, drawHeartMark } from '../src/render/canvas.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** `glyph` is the heart width as a fraction of the icon. Full-bleed: the OS applies its own mask. */
function icon(size: number, glyph: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = BRAND_INK;
  ctx.fillRect(0, 0, size, size);
  const g = size * glyph;
  drawHeartMark(ctx, (size - g) / 2, (size - g) / 2 + size * 0.02, g, BRAND_WHITE, BRAND_CORAL);
  return canvas.toBuffer('image/png');
}

/** Same geometry as drawHeartMark, in a 100×100 favicon. */
function faviconSvg(): string {
  const k = 70 / 714;
  const pill = (dx: number, deg: number, fill: string) =>
    `<rect x="${(-125 * k).toFixed(2)}" y="${(-250 * k).toFixed(2)}" width="${(250 * k).toFixed(2)}" height="${(500 * k).toFixed(2)}" rx="${(125 * k).toFixed(2)}" fill="${fill}" transform="translate(${(50 + dx * k).toFixed(2)} 52) rotate(${deg})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${BRAND_INK}"/>${pill(-92, -45, BRAND_WHITE)}${pill(92, 45, BRAND_CORAL)}</svg>\n`;
}

mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
const files: Record<string, Buffer | string> = {
  'icons/icon-192.png': icon(192, 0.7),
  'icons/icon-512.png': icon(512, 0.7),
  'icons/maskable-512.png': icon(512, 0.56), // inside the maskable safe zone
  'icons/apple-touch-icon.png': icon(180, 0.7),
  'favicon.svg': faviconSvg(),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(path.join(ROOT, name), content);
  console.log(`wrote public/${name}`);
}
