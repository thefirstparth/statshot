import { useEffect, useRef, useState } from 'preact/hooks';
import { MAX_LOCATION, MAX_TITLE } from '../card-data';
import { REPO_URL } from '../config';
import { ACCENTS } from '../render/registry';
import { prepareCard, releaseCanvas, renderThumb } from '../render/render';
import { MAX_STATS, type CardData, type CardDesign, type CardOptions, type SizeKey, type StatKey } from '../render/types';
import type { Sport } from '../sports';
import { MAX_FAVOURITES, type Appearance, type Prefs } from '../state/store';
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
          Title <span class="field-note">· optional</span>
        </label>
        <input
          id="title-input"
          class="input"
          type="text"
          maxLength={MAX_TITLE}
          placeholder={sport.name}
          value={title}
          enterKeyHint="done"
          onInput={(e) => onTitle((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <div class="field">
        <label class="field-label" for="location-input">
          Where <span class="field-note">· optional, shown on the card</span>
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
  const zonesReady = prefs.restingHr !== null && maxHr !== null;
  return (
    <Sheet title="Settings" onClose={onClose}>
      <section class="settings-group">
        <h3 class="section-title">Heart-rate zones</h3>
        <p class="field-help">
          Zones and zone minutes use your heart-rate reserve, the same method as Google Health. Fill in both to unlock
          them.
        </p>
        <NumberField
          label="Resting heart rate"
          value={prefs.restingHr}
          onChange={(restingHr) => onChange({ restingHr })}
          placeholder="e.g. 62"
          min={30}
          max={120}
          suffix="bpm"
          note="Find it in Google Health under Heart rate."
        />
        <NumberField label="Age" value={prefs.age} onChange={(age) => onChange({ age })} placeholder="Years" min={10} max={100} />
        <NumberField
          label="Max heart rate (optional)"
          value={prefs.maxHrOverride}
          onChange={(maxHrOverride) => onChange({ maxHrOverride })}
          placeholder={prefs.age ? String(220 - prefs.age) : 'Optional'}
          min={100}
          max={230}
          suffix="bpm"
          note={maxHr ? `Using ${maxHr} bpm.` : 'Leave empty to use 220 − age.'}
        />
        <p class={`zone-status${zonesReady ? ' is-ready' : ''}`} role="status">
          <Icon name={zonesReady ? 'check' : 'lock'} />
          {zonesReady ? 'Zones are on.' : 'Zones are off until resting heart rate and age are set.'}
        </p>
      </section>

      <section class="settings-group">
        <h3 class="section-title">App</h3>
        <Segmented<Appearance>
          label="Appearance"
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
        <div class="toggle-list">
          <Toggle
            label="Small Sweatshot mark on images"
            checked={prefs.showLogo}
            onChange={(showLogo) => onChange({ showLogo })}
          />
        </div>
      </section>

      <div class="sheet-actions">
        <button
          type="button"
          class={`btn ${confirmReset ? 'btn-danger' : 'btn-secondary'}`}
          onClick={() => {
            if (!confirmReset) return setConfirmReset(true);
            setConfirmReset(false);
            onReset();
          }}
        >
          {confirmReset ? 'Tap again to reset everything' : 'Reset all settings'}
        </button>
      </div>
      <p class="fine-print">
        Settings stay on this device. Your workout file is never stored or uploaded. Not affiliated with Google or
        Fitbit. <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source code</a>
      </p>
    </Sheet>
  );
}

// ── Stats & look ─────────────────────────────────────────────────────────────

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
  onOpenDetails,
  onClose,
}: {
  design: CardDesign;
  data: CardData;
  prefs: Prefs;
  accent: string;
  stats: StatKey[]; // what the card shows now, in order
  available: StatKey[];
  hasHr: boolean;
  zonesLocked: boolean;
  onChange: (p: Partial<Prefs>) => void;
  onOpenSettings: () => void;
  onOpenDetails: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const toggleStat = (key: StatKey) => {
    setNote(null);
    if (stats.includes(key)) {
      if (stats.length === 1) return setNote('Keep at least one number on the card.');
      // Keep choices for stats this file lacks (e.g. distance) so they return for other files.
      return onChange({ stats: prefs.stats.filter((k) => k !== key) });
    }
    if (stats.length >= MAX_STATS) return setNote(`Up to ${MAX_STATS} numbers fit. Remove one first.`);
    const kept = prefs.stats.filter((k) => !available.includes(k));
    onChange({ stats: [...stats, key, ...kept] });
  };
  const themeLocked = design.supportsTheme === false;

  return (
    <Sheet title="Numbers & look" onClose={onClose} light class="sheet-customize">
      <div class="field">
        <div class="field-label">
          Numbers on the card <span class="field-note">· tap to add or remove, in the order you want</span>
        </div>
        <div class="stat-tray">
          {available.map((k) => {
            const pos = stats.indexOf(k);
            const item = data.stats[k]!;
            return (
              <button key={k} type="button" class={`stat-sticker k-${k}${pos >= 0 ? ' is-on' : ''}`} aria-pressed={pos >= 0} onClick={() => toggleStat(k)}>
                {pos >= 0 && <span class="stat-pos">{pos + 1}</span>}
                <span class="stat-label">{item.label}</span>
                <b>{item.value}</b>
              </button>
            );
          })}
          {zonesLocked && hasHr && (
            <button type="button" class="stat-sticker is-locked" onClick={onOpenSettings}>
              <span class="stat-label">Zone minutes</span>
              <b>
                <Icon name="lock" /> Set up
              </b>
            </button>
          )}
          <button type="button" class="stat-sticker is-add" onClick={onOpenDetails}>
            <span class="stat-label">Where</span>
            <b>{data.location || '+ Add place'}</b>
          </button>
        </div>
        {note && (
          <p class="field-help" role="status">
            {note}
          </p>
        )}
      </div>

      {design.supportsGraph && hasHr && (
        <div class="toggle-list">
          <Toggle label="Heart-rate line" checked={prefs.showGraph} onChange={(showGraph) => onChange({ showGraph })} />
        </div>
      )}

      <Segmented
        label="Background"
        value={prefs.background}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'transparent', label: 'Clear (for photos)' },
        ]}
        onChange={(background) => onChange({ background })}
      />
      <Segmented
        label="Colours"
        value={themeLocked ? 'light' : prefs.theme}
        disabled={themeLocked}
        note={themeLocked ? `${design.name} is always light` : undefined}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(theme) => onChange({ theme })}
      />
      <Segmented<SizeKey>
        label="Size"
        value={prefs.size}
        options={[
          { value: 'story', label: 'Story' },
          { value: 'post', label: 'Post' },
          { value: 'square', label: 'Square' },
          { value: 'sticker', label: 'Just the card' },
        ]}
        onChange={(size) => onChange({ size })}
      />
      {design.supportsAccent && <Swatches value={accent} colors={ACCENTS} onChange={(c) => onChange({ accent: c })} />}
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
          aria-label={starred ? `Unstar ${d.name}` : `Star ${d.name}`}
          onClick={() => onStar(d.id)}
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
