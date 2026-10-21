import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icon';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type Props = {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Lighter backdrop so a live preview stays visible (Customize). */
  light?: boolean;
  class?: string;
};

/**
 * Bottom sheet: drag handle (swipe down to close), dimmed backdrop (tap to close), Esc,
 * focus trapped inside while open and restored afterwards.
 */
export function Sheet({ title, onClose, children, light, class: cls }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const close = () => {
    if (closing) return;
    if (reducedMotion()) {
      closeRef.current();
      return;
    }
    setClosing(true);
    setTimeout(() => closeRef.current(), 180);
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el;
    first?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null || n === document.activeElement,
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === firstItem || active === ref.current)) {
      e.preventDefault();
      lastItem.focus();
    } else if (!e.shiftKey && active === lastItem) {
      e.preventDefault();
      firstItem.focus();
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    dragStart.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragStart.current) return;
    setDrag(Math.max(0, e.clientY - dragStart.current.y));
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const v = dy / Math.max(1, performance.now() - dragStart.current.t);
    dragStart.current = null;
    if (dy > 90 || (dy > 24 && v > 0.6)) close();
    else setDrag(0);
  };

  return (
    <div class={`sheet-layer${closing ? ' is-closing' : ''}`} onKeyDown={onKeyDown}>
      <div class={`sheet-backdrop${light ? ' is-light' : ''}`} onClick={close} aria-hidden="true" />
      <div
        ref={ref}
        class={`sheet${cls ? ' ' + cls : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div
          class="sheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span class="sheet-handle" />
          <div class="sheet-head">
            <h2>{title}</h2>
            <button type="button" class="icon-btn" onClick={close} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}
