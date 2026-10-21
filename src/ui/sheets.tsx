import { useState } from 'preact/hooks';
import { ACCENTS } from '../render/registry';
import { STAT_ORDER, type CardDesign, type SizeKey, type StatKey } from '../render/types';
import type { Sport } from '../sports';
import type { Workout } from '../tcx/parse';
import { formatDuration, formatLongDate, formatTime, resolveMaxHr } from '../tcx/stats';
import type { Prefs } from '../state/store';
import { NumberField, Segmented, Swatches, Toggle } from './controls';
import { Icon } from './icon';
import { Sheet } from './sheet';

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
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ── Workout ──────────────────────────────────────────────────────────────────

export function WorkoutSheet({
  sport,
  title,
  cardioLoad,
  canPickAnother,
  onChangeSport,
  onTitle,
  onCardioLoad,
  onPickAnother,
  onImport,
  onClose,
}: {
  sport: Sport;
  title: string;
  cardioLoad: number | null;
  canPickAnother: boolean;
  onChangeSport: () => void;
  onTitle: (t: string) => void;
  onCardioLoad: (v: number | null) => void;
  onPickAnother: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Workout" onClose={onClose}>
      <div class="field">
        <div class="field-label">Sport</div>
        <button type="button" class="row-btn" onClick={onChangeSport} data-autofocus>
          <Icon name={sport.icon} />
          <span class="row-btn-text">{sport.name}</span>
          <span class="row-btn-action">Change</span>
        </button>
      </div>
      <div class="field">
        <label class="field-label" for="title-input">
          Title
        </label>
        <input
          id="title-input"
          class="input"
          type="text"
          maxLength={60}
          placeholder={sport.name}
          value={title}
          onInput={(e) => onTitle((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <NumberField
        label="Cardio load"
        value={cardioLoad}
        onChange={onCardioLoad}
        placeholder="Optional"
        min={0}
        max={9999}
        note="Copy it from your fitness app if you want it on the card."
      />
      <div class="sheet-actions">
        {canPickAnother && (
          <button type="button" class="btn btn-secondary" onClick={onPickAnother}>
            Pick another workout from this file
          </button>
        )}
        <button type="button" class="btn btn-secondary" onClick={onImport}>
          <Icon name="file-import" />
          Import a different file
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
  return (
    <Sheet title="Settings" onClose={onClose}>
      <NumberField label="Age" value={prefs.age} onChange={(age) => onChange({ age })} placeholder="Years" min={5} max={110} />
      <NumberField
        label="Max heart rate"
        value={prefs.maxHrOverride}
        onChange={(maxHrOverride) => onChange({ maxHrOverride })}
        placeholder={prefs.age ? String(220 - prefs.age) : 'Optional'}
        min={80}
        max={250}
        suffix="bpm"
        note={
          maxHr
            ? `Used for estimated zones (est. max ${maxHr} bpm).`
            : 'Used for estimated zones. Leave empty to use 220 − age.'
        }
      />
      <Segmented
        label="Time format"
        value={hour12 ? '12h' : '24h'}
        options={[
          { value: '24h', label: '24h' },
          { value: '12h', label: '12h' },
        ]}
        onChange={(v) => onChange({ hour12: v === '12h' })}
      />
      <Segmented
        label="Distance"
        value={prefs.distanceUnit}
        options={[
          { value: 'km', label: 'km' },
          { value: 'mi', label: 'mi' },
        ]}
        onChange={(distanceUnit) => onChange({ distanceUnit })}
      />
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
          {confirmReset ? 'Tap again to reset everything' : 'Reset all preferences'}
        </button>
      </div>
      <p class="fine-print">Settings stay on this device. Your workout file is never stored or uploaded.</p>
    </Sheet>
  );
}

// ── Customize ────────────────────────────────────────────────────────────────

const STAT_LABELS: Record<StatKey, string> = {
  duration: 'Duration',
  energy: 'Energy',
  avgHr: 'Avg heart rate',
  maxHr: 'Max heart rate',
  activeMin: 'Active minutes (est.)',
  distance: 'Distance',
  cardioLoad: 'Cardio load',
};

export function CustomizeSheet({
  design,
  prefs,
  accent,
  available,
  hasHr,
  onChange,
  onClose,
}: {
  design: CardDesign;
  prefs: Prefs;
  accent: string;
  available: StatKey[];
  hasHr: boolean;
  onChange: (p: Partial<Prefs>) => void;
  onClose: () => void;
}) {
  const enabled = prefs.stats.filter((k) => available.includes(k));
  const effective = enabled.length > 0 ? enabled : (['duration'] as StatKey[]);
  const toggleStat = (key: StatKey, on: boolean) => {
    const next = on ? [...effective, key] : effective.filter((k) => k !== key);
    if (next.length === 0) return;
    // Keep choices for unavailable stats (e.g. distance) so they come back for other files.
    const keep = prefs.stats.filter((k) => !available.includes(k));
    onChange({ stats: STAT_ORDER.filter((k) => next.includes(k) || keep.includes(k)) });
  };
  const themeLocked = design.supportsTheme === false;

  return (
    <Sheet title="Customize" onClose={onClose} light class="sheet-customize">
      <Segmented
        label="Background"
        value={prefs.background}
        options={[
          { value: 'transparent', label: 'Transparent' },
          { value: 'solid', label: 'Solid' },
        ]}
        onChange={(background) => onChange({ background })}
      />
      <Segmented
        label="Theme"
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
          { value: 'sticker', label: 'Sticker' },
        ]}
        onChange={(size) => onChange({ size })}
      />
      {design.supportsAccent && <Swatches value={accent} colors={ACCENTS} onChange={(c) => onChange({ accent: c })} />}

      <div class="field">
        <div class="field-label">Stats</div>
        <div class="toggle-list">
          {STAT_ORDER.filter((k) => available.includes(k)).map((k) => {
            const on = effective.includes(k);
            return (
              <Toggle
                key={k}
                label={STAT_LABELS[k]}
                checked={on}
                disabled={on && effective.length === 1}
                onChange={(v) => toggleStat(k, v)}
              />
            );
          })}
        </div>
      </div>

      <div class="field">
        <div class="field-label">Extras</div>
        <div class="toggle-list">
          {design.supportsGraph && hasHr && (
            <Toggle label="Heart-rate graph" checked={prefs.showGraph} onChange={(showGraph) => onChange({ showGraph })} />
          )}
          <Toggle label="Show Statshot logo" checked={prefs.showLogo} onChange={(showLogo) => onChange({ showLogo })} />
        </div>
      </div>
    </Sheet>
  );
}
