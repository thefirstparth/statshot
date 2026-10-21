/**
 * The few things rendering needs from its host. The browser defaults are replaced in Node
 * tests with @napi-rs/canvas equivalents.
 */
export type RenderEnv = {
  createCanvas(w: number, h: number): HTMLCanvasElement;
  loadImage(src: string): Promise<CanvasImageSource>;
};

const browserEnv: RenderEnv = {
  createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },
  async loadImage(src) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    try {
      await img.decode();
    } catch {
      // Some engines reject decode() for SVG data URLs; fall back to the load event.
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image failed to load'));
        });
      }
    }
    return img;
  },
};

let env: RenderEnv = browserEnv;

export function renderEnv(): RenderEnv {
  return env;
}

export function setRenderEnv(next: Partial<RenderEnv>): void {
  env = { ...env, ...next };
  measureCtx = null;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** A shared 1×1 context for measuring text outside of a draw call. */
export function measureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const ctx = env.createCanvas(1, 1).getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    measureCtx = ctx;
  }
  return measureCtx;
}
