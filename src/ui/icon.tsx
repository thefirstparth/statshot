import { iconSvg } from '../render/icons';

/** Inline Tabler icon (bundled SVG string; inherits currentColor). */
export function Icon({ name, class: cls }: { name: string; class?: string }) {
  return (
    <span
      class={cls ? `icon ${cls}` : 'icon'}
      aria-hidden="true"
      // Trusted, build-time SVG from @tabler/icons.
      dangerouslySetInnerHTML={{ __html: iconSvg(name) }}
    />
  );
}
