import { REPO_URL } from '../config';
import { Icon } from './icon';

/** The 3-bar glyph as inline SVG (same proportions as the canvas logo). */
export function LogoMark({ size = 28 }: { size?: number }) {
  const bar = 0.24;
  const gap = (1 - bar * 3) / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 1 1" aria-hidden="true" class="logo-mark">
      {[0.5, 0.75, 1].map((h, i) => (
        <rect x={i * (bar + gap)} y={1 - h} width={bar} height={h} rx={bar * 0.45} fill="currentColor" />
      ))}
    </svg>
  );
}

export function EmptyState({ error, onImport }: { error: string | null; onImport: () => void }) {
  return (
    <main class="empty">
      <div class="empty-inner">
        <div class="brand">
          <LogoMark size={30} />
          <span>Statshot</span>
        </div>
        <p class="tagline">Turn a workout export into a share image.</p>

        <button type="button" class="btn btn-primary btn-xl" onClick={onImport}>
          <Icon name="file-import" />
          Import workout file
        </button>
        <p class="drop-hint">or drop a .tcx file anywhere on this page</p>

        {error && (
          <div class="alert" role="alert">
            <Icon name="alert-triangle" />
            <span>{error}</span>
          </div>
        )}

        <details class="howto">
          <summary>
            How to export from Google Health
            <Icon name="chevron-down" />
          </summary>
          <ol>
            <li>Open the workout.</li>
            <li>Tap ⋯ → Export.</li>
            <li>Choose Save to Files, then import it here.</li>
          </ol>
          <p class="howto-note">Works with any TCX file (Garmin, Strava export, etc.).</p>
        </details>

        <p class="privacy">
          <Icon name="lock" />
          Your file stays on your device.
        </p>
      </div>
      <footer class="footer">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="brand-github" />
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
