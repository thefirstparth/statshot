import { ACCENT_NAMES } from '../render/registry';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

type Option<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  note,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div class={`field${disabled ? ' is-disabled' : ''}`}>
      <div class="field-label" id={`seg-${label}`}>
        {label}
        {note && <span class="field-note"> · {note}</span>}
      </div>
      <div class="segmented" role="radiogroup" aria-labelledby={`seg-${label}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            class={o.value === value ? 'is-on' : ''}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: ComponentChildren;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label class={`toggle-row${disabled ? ' is-disabled' : ''}`}>
      <span class="toggle-text">
        {label}
        {hint && <span class="toggle-hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <span class="switch" aria-hidden="true" />
    </label>
  );
}

export function Swatches({
  value,
  colors,
  onChange,
}: {
  value: string;
  colors: string[];
  onChange: (c: string) => void;
}) {
  return (
    <div class="field">
      <div class="field-label" id="accent-label">
        Accent
      </div>
      <div class="swatches" role="radiogroup" aria-labelledby="accent-label">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c.toLowerCase() === value.toLowerCase()}
            aria-label={ACCENT_NAMES[c.toUpperCase()] ?? c}
            class={`swatch${c.toLowerCase() === value.toLowerCase() ? ' is-on' : ''}`}
            style={{ '--swatch': c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  note,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  note?: string;
  min: number;
  max: number;
  suffix?: string;
}) {
  const id = `num-${label.replace(/\W+/g, '-').toLowerCase()}`;
  // Local text so partial input ("1" on the way to "18") isn't wiped by a re-render.
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value || (t === '' && value === null) ? t : value === null ? '' : String(value)));
  }, [value]);
  const n = Number(text);
  const invalid = text !== '' && !(Number.isFinite(n) && n >= min && n <= max);
  return (
    <div class="field">
      <label class="field-label" for={id}>
        {label}
      </label>
      <div class="input-wrap">
        <input
          id={id}
          class="input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          placeholder={placeholder}
          value={text}
          onInput={(e) => {
            const raw = (e.currentTarget as HTMLInputElement).value.trim();
            setText(raw);
            if (raw === '') return onChange(null);
            const n = Number(raw);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n));
          }}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-err` : undefined}
        />
        {suffix && <span class="input-suffix">{suffix}</span>}
      </div>
      {invalid ? (
        <p class="field-error" id={`${id}-err`}>
          Enter a number from {min} to {max}.
        </p>
      ) : (
        note && <p class="field-help">{note}</p>
      )}
    </div>
  );
}
