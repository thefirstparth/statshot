import { REPO_URL } from '../config';
import { sportById } from '../sports';
import { Icon } from './icon';
import { BrandMark, SportSticker } from './sticker';

type Props = {
  error: string | null;
  onImport: () => void;
  onSample: () => void;
  onSettings: () => void;
};

export function EmptyState({ error, onImport, onSample, onSettings }: Props) {
  return (
    <main class="home">
      <header class="home-bar">
        <span class="brand">
          <BrandMark size={30} />
          Sweatshot
        </span>
        <button type="button" class="icon-btn" onClick={onSettings} aria-label="Settings" title="Settings">
          <Icon name="settings-fill" />
        </button>
      </header>

      <div class="collage" aria-hidden="true">
        <span class="collage-sticker c1">
          <SportSticker sport={sportById('pickleball')} size={64} rotate={false} />
          <b>52m</b>
        </span>
        <span class="collage-pill c2">418 kcal</span>
        <span class="collage-card c3">
          <small>avg heart rate</small>
          <b>130 bpm</b>
        </span>
        <span class="collage-pill c4">Pickleball · Tue</span>
        <span class="collage-caption">Example</span>
      </div>

      <section class="home-copy">
        <span class="tag">For Google Health workouts</span>
        <h1>Turn your workout into a picture to post.</h1>
        <p>
          Export a workout from Google Health (Fitbit Air included). It saves as a .tcx file. Open that file here and
          get an image for your story or chat. A .tcx file from any other fitness app works too.
        </p>

        {error && (
          <div class="alert" role="alert">
            <Icon name="warning-fill" />
            <span>{error}</span>
          </div>
        )}

        <button type="button" class="btn btn-primary btn-xl" onClick={onImport}>
          <Icon name="upload_file" />
          Open workout file
        </button>
        <button type="button" class="btn btn-ghost" onClick={onSample}>
          No file yet? Try a sample workout
        </button>

        <ul class="promises" aria-label="Privacy">
          <li>
            <Icon name="cloud_off" />
            Never uploaded
          </li>
          <li>
            <Icon name="wifi_off" />
            Works offline
          </li>
          <li>
            <Icon name="person_off" />
            No account
          </li>
        </ul>

        <details class="howto">
          <summary>
            How do I get the file from Google Health?
            <Icon name="keyboard_arrow_down" />
          </summary>
          <ol>
            <li>In Google Health, open the workout.</li>
            <li>Tap ⋯, then Export.</li>
            <li>Save it to Files, then open it here with “Open workout file”.</li>
          </ol>
          <p class="howto-note">On Android you can also share the file straight to Sweatshot once it’s installed.</p>
        </details>
      </section>

      <footer class="footer">
        <p>
          Your file is read on this device only and isn’t kept. Only your settings, favourite designs and recently
          used sports are saved on this phone. Not affiliated with Google or Fitbit.
        </p>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <Icon name="code" />
          Source code (opens GitHub)
        </a>
      </footer>
    </main>
  );
}
