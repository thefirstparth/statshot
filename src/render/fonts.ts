// Bundled @font-face rules (latin + latin-ext). Text outside those ranges falls back to system fonts.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-700.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-ext-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/instrument-serif/latin-ext-400-italic.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-ext-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-ext-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/space-grotesk/latin-ext-700.css';
import '@fontsource/bricolage-grotesque/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-ext-400.css';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-ext-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-ext-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/bricolage-grotesque/latin-ext-800.css';
import { FONT_FACES } from './font-faces';

let loading: Promise<void> | null = null;

/** Loads every family/weight/style a design uses. Must resolve before the first draw. */
export function ensureFontsLoaded(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      if (typeof document === 'undefined' || !document.fonts) return;
      await Promise.all(
        FONT_FACES.map((f) =>
          document.fonts
            .load(`${f.style} ${f.weight} 48px "${f.family}"`, 'Sweatshot 0123 Aa')
            .catch(() => []),
        ),
      );
      await document.fonts.ready;
    })();
  }
  return loading;
}
