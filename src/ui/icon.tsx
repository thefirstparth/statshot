import { iconPath } from '../render/icons';

/** Inline Material Symbols icon (bundled path data; inherits currentColor). */
export function Icon({ name, class: cls }: { name: string; class?: string }) {
  return (
    <span class={cls ? `icon ${cls}` : 'icon'} aria-hidden="true">
      <svg viewBox="0 -960 960 960" width="24" height="24" fill="currentColor">
        <path d={iconPath(name)} />
      </svg>
    </span>
  );
}
