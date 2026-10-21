import { dial } from './designs/dial';
import { editorial } from './designs/editorial';
import { hero } from './designs/hero';
import { messages } from './designs/messages';
import { pill } from './designs/pill';
import { poster } from './designs/poster';
import { receipt } from './designs/receipt';
import { summary } from './designs/summary';
import { trace } from './designs/trace';
import { widgets } from './designs/widgets';
import { zones } from './designs/zones';
import type { CardDesign } from './types';

export const DEFAULT_ACCENT = '#FFB547';
export const ACCENTS = ['#FFB547', '#FF6B35', '#FF4D8D', '#3DDC97', '#4CC9F0', '#0A84FF', '#B18CFF', '#FFFFFF'];

/** Catalogue order (the picker shows favourites first, then this order). */
export const DESIGNS: CardDesign[] = [summary, hero, trace, zones, messages, receipt, editorial, pill, widgets, poster, dial];

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
