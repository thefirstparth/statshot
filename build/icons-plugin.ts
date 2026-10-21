import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';
import { FALLBACK_ICON, ICON_NAMES } from '../src/sports.ts';

const VIRTUAL_ID = 'virtual:tabler-icons';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

function iconsDir(): string {
  // The package only exports `./*` → `./icons/*`, so resolve a known icon file.
  const require = createRequire(import.meta.url);
  return path.dirname(require.resolve(`@tabler/icons/outline/${FALLBACK_ICON}.svg`));
}

/** Strip comments, the invisible bounding-box path and the CSS class; collapse whitespace. */
function clean(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/g, '')
    .replace(/\s+class="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

/**
 * Exposes `virtual:tabler-icons`: a map of icon name → SVG string for every icon the app uses.
 * Each name is verified against @tabler/icons at build time; a missing one falls back to
 * `activity` with a build warning, so a renamed icon never breaks the build.
 */
export function tablerIcons(names: string[] = ICON_NAMES): Plugin {
  return {
    name: 'statshot-tabler-icons',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const dir = iconsDir();
      const read = (name: string) => clean(readFileSync(path.join(dir, `${name}.svg`), 'utf8'));
      const fallback = read(FALLBACK_ICON);
      const map: Record<string, string> = {};
      for (const name of names) {
        if (existsSync(path.join(dir, `${name}.svg`))) {
          map[name] = read(name);
        } else {
          this.warn(`Tabler icon "${name}" not found; using "${FALLBACK_ICON}" instead.`);
          map[name] = fallback;
        }
      }
      return `export default ${JSON.stringify(map)};`;
    },
  };
}
