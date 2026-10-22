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

/** The Sweatshot heart mark (matches the app icon and drawHeartMark). */
export function BrandMark({ size = 28 }: { size?: number }) {
  const k = 70 / 714;
  const pill = (dx: number, deg: number, fill: string) => (
    <rect
      x={-125 * k}
      y={-250 * k}
      width={250 * k}
      height={500 * k}
      rx={125 * k}
      fill={fill}
      transform={`translate(${50 + dx * k} 52) rotate(${deg})`}
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" class="brand-mark">
      <rect width="100" height="100" rx="24" fill="#0B0B0D" />
      {pill(-92, -45, '#FFFFFF')}
      {pill(92, 45, '#FF5C7A')}
    </svg>
  );
}
