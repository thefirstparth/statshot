import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import path from 'node:path';
import { setRenderEnv } from '../src/render/env';
import { FONT_FACES } from '../src/render/font-faces';

// Register the same bundled font files the app ships, so Node renders match the browser.
const require = createRequire(import.meta.url);
const fontsource = path.dirname(path.dirname(require.resolve('@fontsource/inter/package.json')));
for (const f of FONT_FACES) {
  GlobalFonts.registerFromPath(path.join(fontsource, `${f.file}.woff2`), f.family);
}

setRenderEnv({
  createCanvas: (w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement,
  loadImage: (src) => loadImage(src) as unknown as Promise<CanvasImageSource>,
});
