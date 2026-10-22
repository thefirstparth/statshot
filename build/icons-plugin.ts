import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';
import { CUSTOM_ICONS, FALLBACK_ICON, ICON_NAMES } from '../src/sports.ts';

const VIRTUAL_ID = 'virtual:icons';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

function iconsDir(): string {
  const require = createRequire(import.meta.url);
  return path.dirname(require.resolve(`@material-symbols/svg-400/rounded/${FALLBACK_ICON}.svg`));
}

/** All path data in one Material Symbols file (they share the 0 -960 960 960 viewBox). */
function pathData(svg: string): string {
  return [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]).join(' ');
}

/**
 * Exposes `virtual:icons`: icon name → SVG path data for every icon the app uses, from Material
 * Symbols Rounded (Apache-2.0) plus a few custom glyphs. Each name also gets a `-fill` variant
 * when one exists. A missing name falls back to the default icon with a build warning.
 */
export function materialIcons(names: string[] = ICON_NAMES): Plugin {
  return {
    name: 'sweatshot-icons',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const dir = iconsDir();
      const file = (name: string) => path.join(dir, `${name}.svg`);
      const read = (name: string) => pathData(readFileSync(file(name), 'utf8'));
      const map: Record<string, string> = { ...CUSTOM_ICONS };
      for (const name of names) {
        if (CUSTOM_ICONS[name]) continue;
        if (existsSync(file(name))) {
          map[name] = read(name);
          if (existsSync(file(`${name}-fill`))) map[`${name}-fill`] = read(`${name}-fill`);
        } else {
          this.warn(`Icon "${name}" not found; using "${FALLBACK_ICON}" instead.`);
          map[name] = read(FALLBACK_ICON);
        }
      }
      return `export default ${JSON.stringify(map)};`;
    },
  };
}
