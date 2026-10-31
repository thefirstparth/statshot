import { mix } from './canvas';
import type { CardOptions, Theme } from './types';

/**
 * The card colours a user can pick. `key` is what gets stored (and passed as opts.accent); `dark`
 * is the shade for dark cards and `light` a deeper shade that stays readable on white.
 */
export type Accent = { key: string; name: string; dark: string; light: string };

export const ACCENTS: Accent[] = [
  { key: '#3DDC97', name: 'Green', dark: '#3DDC97', light: '#0F9D63' },
  { key: '#4C8DFF', name: 'Blue', dark: '#4C8DFF', light: '#2F6FEB' },
  { key: '#9B7BFF', name: 'Purple', dark: '#9B7BFF', light: '#7656EE' },
  { key: '#FFFFFF', name: 'Mono', dark: '#FFFFFF', light: '#1A1C1E' },
];

export const DEFAULT_ACCENT = ACCENTS[0].key;

export function accentByKey(key: string): Accent | undefined {
  return ACCENTS.find((a) => a.key.toLowerCase() === key.toLowerCase());
}

/** The accent shade to draw with on this theme (custom design defaults pass through unchanged). */
export function accentInk(opts: Pick<CardOptions, 'accent' | 'theme'>): string {
  const a = accentByKey(opts.accent);
  if (!a) return opts.accent;
  return opts.theme === 'dark' ? a.dark : a.light;
}

export const isMono = (accent: string): boolean => accentByKey(accent)?.name === 'Mono';

/** Tones for a sticker-style badge in the picked colour: a soft fill and a strong glyph. */
export function accentTones(opts: Pick<CardOptions, 'accent' | 'theme'>): { bg: string; fg: string; strong: string } {
  const ink = accentInk(opts);
  const dark = opts.theme === 'dark';
  if (isMono(opts.accent)) {
    return dark ? { bg: '#2C2D31', fg: '#FFFFFF', strong: '#FFFFFF' } : { bg: '#E6E7EA', fg: '#1A1C1E', strong: '#1A1C1E' };
  }
  return dark
    ? { bg: mix(ink, '#000000', 0.62), fg: mix(ink, '#FFFFFF', 0.25), strong: ink }
    : { bg: mix(ink, '#FFFFFF', 0.82), fg: mix(ink, '#000000', 0.35), strong: ink };
}

// ── Heart-rate zones ─────────────────────────────────────────────────────────

export const ZONE_NAMES = ['Light', 'Moderate', 'Vigorous', 'Peak'] as const;

/** Fixed data colours (they don't follow the picked colour, so zones always read the same). */
export function zoneColors(theme: Theme): string[] {
  return theme === 'dark' ? ['#A3ADB8', '#F2B33D', '#F06A3C', '#E3365E'] : ['#9AA4AF', '#E3A21F', '#E8592A', '#D62A52'];
}
