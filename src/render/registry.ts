import { block } from './designs/block';
import { editorial } from './designs/editorial';
import { glass } from './designs/glass';
import { messages } from './designs/messages';
import { midnight } from './designs/midnight';
import { pulse } from './designs/pulse';
import { receipt } from './designs/receipt';
import { zones } from './designs/zones';
import type { CardDesign } from './types';

export const DEFAULT_ACCENT = '#FF6B35';
export const ACCENTS = ['#FF6B35', '#FFD60A', '#3DDC97', '#4CC9F0', '#0A84FF', '#FF4D8D', '#FFFFFF'];

/** Carousel order. */
export const DESIGNS: CardDesign[] = [glass, midnight, block, receipt, editorial, messages, pulse, zones];

export function designById(id: string): CardDesign {
  return DESIGNS.find((d) => d.id === id) ?? DESIGNS[0];
}

/** Designs that can be shown for this file (HR designs need samples). */
export function availableDesigns(hasHr: boolean): CardDesign[] {
  return DESIGNS.filter((d) => hasHr || !d.needsHr);
}

/** The stored accent, or the design's own default when the user hasn't picked one. */
export function resolveAccent(design: CardDesign, stored: string | null): string {
  return stored ?? design.defaultAccent ?? DEFAULT_ACCENT;
}
