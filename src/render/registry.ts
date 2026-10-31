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
import { DEFAULT_ACCENT } from './palette';
import type { CardDesign } from './types';

export { ACCENTS, DEFAULT_ACCENT } from './palette';

/** Catalogue order: the five strongest first. Starred favourites jump ahead of all of these. */
export const DESIGNS: CardDesign[] = [summary, trace, pill, messages, hero, zones, receipt, editorial, widgets, poster, dial];

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
