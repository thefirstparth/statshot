import { CATEGORY_COLORS, CATEGORY_SHAPES, type Sport } from '../sports';
import { iconPath } from '../render/icons';

/** Slight, stable tilt per sport so a sheet of stickers looks hand-placed. */
export function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 13) - 6) * 0.9;
}

/** Die-cut sport sticker: category shape, white edge, glyph. */
export function SportSticker({ sport, size = 56, rotate = true }: { sport: Sport; size?: number; rotate?: boolean }) {
  const c = CATEGORY_COLORS[sport.cat];
  return (
    <svg
      class="sticker"
      width={size}
      height={size}
      viewBox="-6 -6 112 112"
      aria-hidden="true"
      style={rotate ? { transform: `rotate(${tilt(sport.id)}deg)` } : undefined}
    >
      <path d={CATEGORY_SHAPES[sport.cat]} fill={c.bg} stroke="#FFFFFF" stroke-width="7" stroke-linejoin="round" />
      <svg x="25" y="25" width="50" height="50" viewBox="0 -960 960 960">
        <path d={iconPath(sport.icon)} fill={c.fg} />
      </svg>
    </svg>
  );
}

/** The Sweatshot drop with its spark (matches the canvas glyph and the app icon). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" class="brand-mark">
      <path d="M50 6C58 22 86 46 86 66a36 36 0 0 1-72 0C14 46 42 22 50 6Z" fill="#FFB547" stroke="currentColor" stroke-width="6" stroke-linejoin="round" />
      <path d="M60 50q3 9 12 12q-9 3-12 12q-3-9-12-12q9-3 12-12Z" fill="#FFFFFF" />
    </svg>
  );
}
