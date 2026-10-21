import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { canvasLayout, prepareCard, releaseCanvas, renderCard } from '../render/render';
import type { CardData, CardDesign, CardOptions, SizeKey } from '../render/types';
import { Icon } from './icon';
import { reducedMotion } from './sheet';

const GAP = 12;

type PreviewProps = {
  design: CardDesign;
  data: CardData;
  opts: CardOptions;
  size: SizeKey;
  live: boolean; // render a canvas (active page ± 1)
  ready: boolean; // fonts loaded
  box: { w: number; h: number };
  children?: ComponentChildren;
};

function CardPreview({ design, data, opts, size, live, ready, box, children }: PreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const optsKey = JSON.stringify(opts);
  const layout = useMemo(() => canvasLayout(design, data, opts, size), [design, data, optsKey, size]);
  const scale = box.w > 0 && box.h > 0 ? Math.min(box.w / layout.width, box.h / layout.height) : 0;
  const style = { width: `${Math.floor(layout.width * scale)}px`, height: `${Math.floor(layout.height * scale)}px` };

  // Full export resolution; CSS scales it down.
  useEffect(() => {
    if (!live || !ready) return;
    let cancelled = false;
    prepareCard(design, data, opts).then(() => {
      if (!cancelled && ref.current) renderCard(ref.current, design, data, opts, size);
    });
    return () => {
      cancelled = true;
    };
  }, [live, ready, design, data, optsKey, size]);

  useEffect(() => {
    const canvas = ref.current;
    return () => releaseCanvas(canvas);
  }, [live]);

  const transparent = opts.background === 'transparent';
  return (
    <div class={`preview${transparent ? ' is-transparent' : ''}`} style={style}>
      {live && ready ? (
        <canvas ref={ref} class="preview-canvas" role="img" aria-label={`${design.name} card preview`} />
      ) : (
        <div class="skeleton" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}

type Props = {
  designs: CardDesign[];
  activeIndex: number;
  onActiveChange: (i: number) => void;
  data: CardData;
  optsFor: (d: CardDesign) => CardOptions;
  size: SizeKey;
  ready: boolean;
  zonesLocked: boolean;
  favourites: string[];
  onOpenSettings: () => void;
};

/** Horizontal scroll-snap carousel, one design per page, with peeking neighbours and dots. */
export function Carousel({ designs, activeIndex, onActiveChange, data, optsFor, size, ready, zonesLocked, favourites, onOpenSettings }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 }); // carousel width, preview-area height
  const [visual, setVisual] = useState(activeIndex);
  const visualRef = useRef(activeIndex);
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;
  const changeRef = useRef(onActiveChange);
  changeRef.current = onActiveChange;
  const settle = useRef<number | undefined>(undefined);
  const programmatic = useRef(false);

  // Widest aspect among the designs at this size: pages are sized to the preview, so
  // neighbours peek in from both sides.
  const ratio = useMemo(
    () =>
      Math.max(
        ...designs.map((d) => {
          const l = canvasLayout(d, data, optsFor(d), size);
          return l.width / l.height;
        }),
      ),
    [designs, data, optsFor, size],
  );
  const pageW = frame.w > 0 ? Math.round(Math.max(140, Math.min(frame.w * 0.8, frame.h * ratio, frame.w - 48))) : 0;
  const spacer = Math.max(0, (frame.w - pageW) / 2 - GAP);
  const stride = pageW + GAP;

  const show = (i: number) => {
    visualRef.current = i;
    setVisual(i);
  };

  const jumpTo = (i: number) => {
    const el = scroller.current;
    if (!el || stride <= GAP) return;
    programmatic.current = true;
    el.scrollLeft = i * stride;
    requestAnimationFrame(() => (programmatic.current = false));
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const area = el.querySelector<HTMLElement>('.preview-area');
      setFrame({ w: el.clientWidth, h: area?.clientHeight ?? 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // After any layout change keep the page the user is looking at, and commit it.
  useLayoutEffect(() => {
    jumpTo(visualRef.current);
    if (visualRef.current !== activeRef.current) changeRef.current(visualRef.current);
  }, [stride]);

  // Active page changed from outside (initial load, designs list changed).
  useLayoutEffect(() => {
    if (activeIndex !== visualRef.current) {
      show(activeIndex);
      jumpTo(activeIndex);
    }
  }, [activeIndex, designs.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || programmatic.current || stride <= GAP) return;
    const i = Math.max(0, Math.min(designs.length - 1, Math.round(el.scrollLeft / stride)));
    if (i !== visualRef.current) show(i);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (visualRef.current !== activeRef.current) changeRef.current(visualRef.current);
    }, 90);
  };

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    show(i);
    changeRef.current(i);
    el.scrollTo({ left: i * stride, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div class="carousel-wrap">
      <div
        ref={scroller}
        class="carousel"
        style={{ '--page-w': `${pageW}px`, '--spacer': `${spacer}px`, '--gap': `${GAP}px` }}
        onScroll={onScroll}
        aria-roledescription="carousel"
        aria-label="Card designs"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo(Math.min(designs.length - 1, visual + 1));
          if (e.key === 'ArrowLeft') goTo(Math.max(0, visual - 1));
        }}
      >
        {designs.map((d, i) => {
          const locked = zonesLocked && d.needsZones;
          const current = i === visual;
          return (
            <section
              key={d.id}
              class={`page${current ? ' is-active' : ''}`}
              aria-roledescription="slide"
              aria-label={`${d.name}, ${i + 1} of ${designs.length}`}
              aria-hidden={!current}
              onClick={current ? undefined : () => goTo(i)}
            >
              <div class="preview-area">
                <CardPreview
                  design={d}
                  data={data}
                  opts={optsFor(d)}
                  size={size}
                  live={Math.abs(i - visual) <= 1}
                  ready={ready}
                  box={{ w: pageW, h: frame.h }}
                >
                  {locked && (
                    <div class="lock-overlay">
                      <Icon name="monitor_heart" class="icon-lg" />
                      <p>Add your resting heart rate and age in Settings to see zones</p>
                      <button type="button" class="btn btn-primary" onClick={onOpenSettings} tabIndex={current ? 0 : -1}>
                        Open settings
                      </button>
                    </div>
                  )}
                </CardPreview>
              </div>
              <p class="design-name">
                {favourites.includes(d.id) && <Icon name="star-fill" class="name-star" />}
                {d.name}
              </p>
            </section>
          );
        })}
      </div>
      <div class="dots">
        {designs.map((d, i) => (
          <button
            key={d.id}
            type="button"
            aria-current={i === visual ? 'true' : undefined}
            aria-label={`Show ${d.name}`}
            class={`dot${i === visual ? ' is-on' : ''}${favourites.includes(d.id) ? ' is-fav' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
