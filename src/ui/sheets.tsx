import { useEffect, useRef, useState } from 'preact/hooks';
import { MAX_LOCATION, MAX_TITLE } from '../card-data';
import { REPO_URL } from '../config';
import { ACCENTS } from '../render/registry';
import { prepareCard, releaseCanvas, renderThumb } from '../render/render';
import { MAX_STATS, STAT_ORDER, type CardData, type CardDesign, type CardOptions, type SizeKey, type StatKey } from '../render/types';
import type { Sport } from '../sports';
import { BIG_STATS, MAX_FAVOURITES, type Appearance, type Prefs } from '../state/store';
import type { Workout } from '../tcx/parse';
import { formatDuration, formatLongDate, formatTime, resolveMaxHr } from '../tcx/stats';
import { NumberField, Segmented, Swatches, Toggle } from './controls';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { SportSticker } from './sticker';

// ── Pick a workout (files with several activities) ───────────────────────────

export function PickWorkoutSheet({
  workouts,
  hour12,
  onPick,
  onClose,
}: {
  workouts: Workout[];
  hour12: boolean;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Pick a workout" onClose={onClose}>
      <ul class="list">
        {workouts.map((w, i) => (
          <li key={w.start.iso + i}>
            <button type="button" class="list-item" onClick={() => onPick(i)} data-autofocus={i === 0 ? true : undefined}>
              <span class="list-main">
                <span class="list-title">{formatLongDate(w.start)}</span>
                <span class="list-sub">
                  {formatTime(w.start, hour12)} · {formatDuration(w.durationSec)}
                  {w.sourceSport !== 'Other' ? ` · ${w.sourceSport === 'Biking' ? 'Cycling' : 'Running'}` : ''}
                </span>
              </span>
              <Icon name="chevron_right" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ── Workout details ──────────────────────────────────────────────────────────

export function WorkoutSheet({
  sport,
  title,
  location,
  canPickAnother,
  onChangeSport,
  onTitle,
  onLocation,
  onPickAnother,
  onImport,
  onClose,
}: {
  sport: Sport;
  title: string;
  location: string;
  canPickAnother: boolean;
  onChangeSport: () => void;
  onTitle: (t: string) => void;
  onLocation: (t: string) => void;
  onPickAnother: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Workout details" onClose={onClose}>
      <div class="field">
        <div class="field-label">Sport</div>
        <button type="button" class="row-btn" onClick={onChangeSport} data-autofocus>
          <SportSticker sport={sport} size={40} />
          <span class="row-btn-text">{sport.name}</span>
          <span class="row-btn-action">Change</span>
        </button>
      </div>
      <div class="field">
        <label class="field-label" for="title-input">
          Title <span class="field-note">· optional, up to {MAX_TITLE} characters</span>
        </label>
        <input
          id="title-input"
          class="input"
          type="text"
          maxLength={MAX_TITLE}
          placeholder={`e.g. Morning ${sport.lower}`}
          value={title}
          enterKeyHint="done"
          onInput={(e) => onTitle((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <div class="field">
        <label class="field-label" for="location-input">
          Where <span class="field-note">· optional, up to {MAX_LOCATION} characters</span>
        </label>
        <input
          id="location-input"
          class="input"
          type="text"
          maxLength={MAX_LOCATION}
          placeholder="e.g. Smash Club, Pune"
          value={location}
          enterKeyHint="done"
          onInput={(e) => onLocation((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <div class="sheet-actions">
        {canPickAnother && (
          <button type="button" class="btn btn-secondary" onClick={onPickAnother}>
            Pick another workout from this file
          </button>
        )}
        <button type="button" class="btn btn-secondary" onClick={onImport}>
          <Icon name="upload_file" />
          Open a different file
        </button>
        <button type="button" class="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function SettingsSheet({
  prefs,
  hour12,
  onChange,
  onReset,
  onClose,
}: {
  prefs: Prefs;
  hour12: boolean;
  onChange: (p: Partial<Prefs>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const maxHr = resolveMaxHr(prefs.age, prefs.maxHrOverride);
  const zonesReady = prefs.restingHr !== null && maxHr !== null && maxHr > prefs.restingHr + 10;
  const zonesConflict = prefs.restingHr !== null && maxHr !== null && !zonesReady;
  return (
    <Sheet title="Settings" onClose={onClose}>
      <section class="settings-group">
        <h3 class="section-title">Heart-rate zones</h3>
        <p class="field-help">
          Zones show how hard you worked (Light, Moderate, Vigorous, Peak), and cards can show your time at
          moderate effort or harder. Enter your resting heart rate and your age to turn them on. They are saved only
          on this phone.
        </p>
        <NumberField
          label="Resting heart rate"
          value={prefs.restingHr}
          onChange={(restingHr) => onChange({ restingHr })}
          placeholder="e.g. 62"
          min={30}
          max={120}
          suffix="bpm"
          note="Your heart rate when you sit still. Google Health shows it on the Heart rate page."
        />
        <NumberField label="Age" value={prefs.age} onChange={(age) => onChange({ age })} placeholder="e.g. 30" min={10} max={100} suffix="years" />
        <NumberField
          label="Max heart rate (optional)"
          value={prefs.maxHrOverride}
          onChange={(maxHrOverride) => onChange({ maxHrOverride })}
          placeholder="Optional"
          min={100}
          max={230}
          suffix="bpm"
          note={
            maxHr
              ? prefs.maxHrOverride
                ? `Max heart rate used: ${maxHr} bpm.`
                : `Max heart rate used: ${maxHr} bpm (estimated from your age).`
              : 'If you leave this empty, we estimate it from your age.'
          }
        />
        <p class={`zone-status${zonesReady ? ' is-ready' : ''}`} role="status">
          <Icon name={zonesReady ? 'check' : 'lock'} />
          {zonesReady
            ? 'Zones are on.'
            : zonesConflict
              ? 'Max heart rate must be well above resting heart rate. Check both numbers.'
              : 'Zones are off until resting heart rate and age are both filled in with valid numbers.'}
        </p>
      </section>

      <section class="settings-group">
        <h3 class="section-title">App</h3>
        <Segmented<Appearance>
          label="App colours"
          value={prefs.appearance}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(appearance) => onChange({ appearance })}
        />
        <Segmented
          label="Time format"
          value={hour12 ? '12h' : '24h'}
          options={[
            { value: '24h', label: '24-hour' },
            { value: '12h', label: '12-hour' },
          ]}
          onChange={(v) => onChange({ hour12: v === '12h' })}
        />
        <Segmented
          label="Distance"
          value={prefs.distanceUnit}
          options={[
            { value: 'km', label: 'Kilometres' },
            { value: 'mi', label: 'Miles' },
          ]}
          onChange={(distanceUnit) => onChange({ distanceUnit })}
        />
      </section>

      <div class="sheet-actions">
        <button type="button" class="btn btn-primary" onClick={onClose}>
          Done
        </button>
        <button
          type="button"
          class={`btn ${confirmReset ? 'btn-danger' : 'btn-secondary'}`}
          onClick={() => {
            if (!confirmReset) return setConfirmReset(true);
            setConfirmReset(false);
            onReset();
          }}
        >
          {confirmReset ? 'Tap again to reset all settings' : 'Reset all settings'}
        </button>
      </div>
      <p class="fine-print">
        Only your preferences (settings, favourite designs, recent sports and how you last set up a card) are saved
        on this phone. Your workout file is never uploaded and never saved.
        Not affiliated with Google or Fitbit.{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Source code (opens GitHub)
        </a>
      </p>
    </Sheet>
  );
}

// ── Customize ────────────────────────────────────────────────────────────────

const SIZE_NOTES: Record<SizeKey, string> = {
  sticker: 'only the card, to paste on a story or photo',
  story: 'tall, fills a phone screen',
};

export function EditSheet({
  design,
  data,
  prefs,
  accent,
  stats,
  available,
  hasHr,
  zonesLocked,
  onChange,
  onOpenSettings,
  onOpenDesigns,
  focusDesigns,
  onClose,
}: {
  focusDesigns?: boolean;
  design: CardDesign;
  data: CardData;
  prefs: Prefs;
  accent: string;
  stats: StatKey[]; // what the card shows now
  available: StatKey[];
  hasHr: boolean;
  zonesLocked: boolean;
  onChange: (p: Partial<Prefs>) => void;
  onOpenSettings: () => void;
  onOpenDesigns: () => void;
  onClose: () => void;
}) {
  const setStat = (key: StatKey, on: boolean) => {
    // Keep choices for stats this file lacks (e.g. distance) so they return for other files.
    const kept = prefs.stats.filter((k) => !available.includes(k));
    const next = on ? [...stats, key] : stats.filter((k) => k !== key);
    if (next.length === 0) return;
    onChange({ stats: [...STAT_ORDER.filter((k) => next.includes(k)), ...kept] });
  };
  const themeLocked = design.supportsTheme === false;
  const full = stats.length >= MAX_STATS;
  const bigOptions = BIG_STATS.filter((k) => data.stats[k]).map((k) => ({ value: k, label: data.stats[k]!.short }));

  return (
    <Sheet title="Customize" onClose={onClose} light class="sheet-customize">
      <Segmented<SizeKey>
        label="Image size"
        note={SIZE_NOTES[prefs.size]}
        value={prefs.size}
        options={[
          { value: 'sticker', label: 'Card only' },
          { value: 'story', label: 'Story' },
        ]}
        onChange={(size) => onChange({ size })}
      />
      {design.supportsBigStat && bigOptions.length > 1 && (
        <Segmented<StatKey>
          label="Big number"
          value={bigOptions.some((o) => o.value === prefs.bigStat) ? prefs.bigStat : 'duration'}
          options={bigOptions}
          onChange={(bigStat) => onChange({ bigStat })}
        />
      )}
      <Segmented
        label="Image colours"
        value={themeLocked ? 'light' : prefs.theme}
        disabled={themeLocked}
        note={themeLocked ? `${design.name} is always light` : undefined}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(theme) => onChange({ theme })}
      />
      <Segmented
        label="Background"
        note="See-through means no background, to put on your own photo"
        value={prefs.background}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'transparent', label: 'See-through' },
        ]}
        onChange={(background) => onChange({ background })}
      />

      <div class="toggle-list">
        {available.map((k) => {
          const on = stats.includes(k);
          return (
            <Toggle
              key={k}
              label={data.stats[k]!.label}
              hint={data.stats[k]!.value}
              checked={on}
              disabled={(on && stats.length === 1) || (!on && full)}
              onChange={(v) => setStat(k, v)}
            />
          );
        })}
        {zonesLocked && hasHr && (
          <button type="button" class="toggle-row toggle-link" onClick={onOpenSettings}>
            <span class="toggle-text">
              Moderate or harder (how hard you worked)
              <span class="toggle-hint">Opens Settings, where you enter resting heart rate and age</span>
            </span>
            <Icon name="chevron_right" />
          </button>
        )}
      </div>
      {full && <p class="field-help">Up to {MAX_STATS} numbers fit on a card.</p>}

      <div class="toggle-list">
        {design.supportsGraph && hasHr && (
          <Toggle
            label="Heart-rate line"
            hint="Your heart rate during the workout, drawn as a line"
            checked={prefs.showGraph}
            onChange={(showGraph) => onChange({ showGraph })}
          />
        )}
        <Toggle label="Show Sweatshot mark" checked={prefs.showLogo} onChange={(showLogo) => onChange({ showLogo })} />
      </div>

      {design.supportsAccent && <Swatches value={accent} colors={ACCENTS} onChange={(c) => onChange({ accent: c })} />}

      <button type="button" class="row-btn" onClick={onOpenDesigns} data-autofocus={focusDesigns ? true : undefined}>
        <Icon name="grid_view" />
        <span class="row-btn-text">See all designs and pick favourites</span>
      </button>

      <div class="sheet-actions">
        <button type="button" class="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

// ── All designs ──────────────────────────────────────────────────────────────

function Thumb({ design, data, opts, ready }: { design: CardDesign; data: CardData; opts: CardOptions; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(opts);
  useEffect(() => {
    if (!ready || !ref.current) return;
    let cancelled = false;
    const canvas = ref.current;
    prepareCard(design, data, opts).then(() => {
      if (!cancelled) renderThumb(canvas, design, data, opts, 'square', 96, Math.min(2, window.devicePixelRatio || 1));
    });
    return () => {
      cancelled = true;
    };
  }, [design, data, key, ready]);
  useEffect(() => {
    const canvas = ref.current;
    return () => releaseCanvas(canvas);
  }, []);
  return <canvas ref={ref} class={`thumb${opts.background === 'transparent' ? ' is-transparent' : ''}`} aria-hidden="true" />;
}

export function DesignsSheet({
  designs,
  activeId,
  favourites,
  locked,
  data,
  optsFor,
  ready,
  onPick,
  onStar,
  onClose,
}: {
  designs: CardDesign[];
  activeId: string;
  favourites: string[];
  locked: (d: CardDesign) => boolean;
  data: CardData;
  optsFor: (d: CardDesign) => CardOptions;
  ready: boolean;
  onPick: (id: string) => void;
  onStar: (id: string) => void;
  onClose: () => void;
}) {
  const favs = designs.filter((d) => favourites.includes(d.id));
  const rest = designs.filter((d) => !favourites.includes(d.id));
  const row = (d: CardDesign) => {
    const starred = favourites.includes(d.id);
    return (
      <li key={d.id} class={`design-row${d.id === activeId ? ' is-on' : ''}`}>
        <button type="button" class="design-pick" onClick={() => onPick(d.id)} aria-current={d.id === activeId ? 'true' : undefined}>
          <Thumb design={d} data={data} opts={optsFor(d)} ready={ready} />
          <span class="design-text">
          <span class="design-title">
            {d.name}
            {locked(d) && <Icon name="lock" />}
          </span>
          <span class="design-blurb">{d.blurb}</span>
          </span>
        </button>
        <button
          type="button"
          class={`star-btn${starred ? ' is-on' : ''}`}
          aria-pressed={starred}
          aria-label={`Favourite: ${d.name}`}
          data-star={d.id}
          onClick={() => {
            onStar(d.id);
            // The row moves between lists, so put focus back on its star.
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-star="${d.id}"]`)?.focus());
          }}
        >
          <Icon name={starred ? 'star-fill' : 'star'} />
        </button>
      </li>
    );
  };
  return (
    <Sheet title="All designs" onClose={onClose} class="sheet-tall">
      <p class="field-help">Star up to {MAX_FAVOURITES} favourites. They come first when you swipe.</p>
      <h3 class="section-title">
        Favourites · {favs.length} of {MAX_FAVOURITES}
      </h3>
      <ul class="design-list">{favs.length ? favs.map(row) : <li class="fine-print">No favourites yet.</li>}</ul>
      <h3 class="section-title">More designs</h3>
      <ul class="design-list">{rest.map(row)}</ul>
    </Sheet>
  );
}
