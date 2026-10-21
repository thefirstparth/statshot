export type FontFace = {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  file: string; // @fontsource file stem, used by Node render tests
};

export const SANS = 'Inter';
export const SERIF = 'Instrument Serif';
export const MONO = 'JetBrains Mono';
export const GROTESK = 'Space Grotesk';
export const DISPLAY = 'Bricolage Grotesque';

/** Every face any design draws with. */
export const FONT_FACES: FontFace[] = [
  { family: SANS, weight: 400, style: 'normal', file: 'inter/files/inter-latin-400-normal' },
  { family: SANS, weight: 500, style: 'normal', file: 'inter/files/inter-latin-500-normal' },
  { family: SANS, weight: 600, style: 'normal', file: 'inter/files/inter-latin-600-normal' },
  { family: SANS, weight: 700, style: 'normal', file: 'inter/files/inter-latin-700-normal' },
  {
    family: SERIF,
    weight: 400,
    style: 'normal',
    file: 'instrument-serif/files/instrument-serif-latin-400-normal',
  },
  {
    family: SERIF,
    weight: 400,
    style: 'italic',
    file: 'instrument-serif/files/instrument-serif-latin-400-italic',
  },
  {
    family: MONO,
    weight: 400,
    style: 'normal',
    file: 'jetbrains-mono/files/jetbrains-mono-latin-400-normal',
  },
  {
    family: MONO,
    weight: 700,
    style: 'normal',
    file: 'jetbrains-mono/files/jetbrains-mono-latin-700-normal',
  },
  {
    family: GROTESK,
    weight: 500,
    style: 'normal',
    file: 'space-grotesk/files/space-grotesk-latin-500-normal',
  },
  {
    family: GROTESK,
    weight: 700,
    style: 'normal',
    file: 'space-grotesk/files/space-grotesk-latin-700-normal',
  },
  {
    family: DISPLAY,
    weight: 600,
    style: 'normal',
    file: 'bricolage-grotesque/files/bricolage-grotesque-latin-600-normal',
  },
  {
    family: DISPLAY,
    weight: 800,
    style: 'normal',
    file: 'bricolage-grotesque/files/bricolage-grotesque-latin-800-normal',
  },
];

const FALLBACKS: Record<string, string> = {
  [SANS]: 'system-ui, -apple-system, sans-serif',
  [SERIF]: 'Georgia, serif',
  [MONO]: 'ui-monospace, Menlo, monospace',
  [GROTESK]: 'system-ui, sans-serif',
  [DISPLAY]: 'system-ui, sans-serif',
};

/** CSS font shorthand for ctx.font. */
export function font(
  family: string,
  weight: number,
  size: number,
  style: 'normal' | 'italic' = 'normal',
): string {
  return `${style} ${weight} ${Math.round(size * 100) / 100}px "${family}", ${FALLBACKS[family] ?? 'sans-serif'}`;
}
