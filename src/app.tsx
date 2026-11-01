import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { availableStats, buildCardData } from './card-data';
import { MAX_FILE_BYTES } from './config';
import {
  cachedBlob,
  canCopyImages,
  canShareFiles,
  canvasToBlob,
  canvasToBlobSync,
  copyBlob,
  downloadBlob,
  exportFilename,
  setCachedBlob,
  shareBlob,
} from './export/export';
import { ensureFontsLoaded } from './render/fonts';
import { availableDesigns, designById, resolveAccent } from './render/registry';
import { prepareCard, releaseCanvas, renderToNewCanvas } from './render/render';
import { MAX_STATS, type CardDesign, type CardOptions, type StatKey } from './render/types';
import {
  clearPrefs,
  DEFAULT_PREFS,
  loadPrefs,
  localeHour12,
  MAX_FAVOURITES,
  orderDesigns,
  pushRecent,
  savePrefs,
  toggleFavourite,
  type Prefs,
} from './state/store';
import { sampleWorkout } from './sample';
import { slugify, sportById } from './sports';
import { combineProblem, combineSessions, NOTE_DUPLICATE, uniqueSessions } from './tcx/merge';
import { NOTE_NO_HR, parseTcx, type Workout } from './tcx/parse';
import { formatDuration, isoDate, resolveMaxHr } from './tcx/stats';
import { Carousel } from './ui/carousel';
import { EmptyState } from './ui/empty';
import { Icon } from './ui/icon';
import { DesignsSheet, EditSheet, SessionsSheet, SettingsSheet, WorkoutSheet } from './ui/sheets';
import { SportSheet } from './ui/sport-sheet';
import { SportSticker } from './ui/sticker';

const SIZE_NAMES = { sticker: 'card only', story: 'story' } as const;

type SheetName = 'pick' | 'sport' | 'workout' | 'settings' | 'customize' | 'designs';

const ERR_TOO_BIG = 'This file is too large to be a workout export.';
const ERR_READ = "Couldn't read that file. Try saving it to Files first, then import it again.";
const SHARE_CACHE = 'sweatshot-share';

/** Applies Auto/Light/Dark to the app chrome (cards have their own theme). */
function useAppearance(appearance: Prefs['appearance']) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = () => {
      const dark = appearance === 'dark' || (appearance === 'auto' && !!mq?.matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = dark ? '#1C1612' : '#FFF4E4';
      document.head.appendChild(meta);
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [appearance]);
}

export function App() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [fontsReady, setFontsReady] = useState(false);
  // The sessions on the card (one, or several combined) and every session loaded since the last
  // fresh open, so "Choose sessions" can switch them on and off.
  const [parts, setParts] = useState<Workout[] | null>(null);
  const [pool, setPool] = useState<Workout[]>([]);
  // Several sessions waiting in "Your sessions"; the current card stays until one is confirmed.
  const [pending, setPending] = useState<{ sessions: Workout[]; on: boolean[]; duplicates: number; adding: boolean } | null>(null);
  const fileMode = useRef<'open' | 'add'>('open');
  const [sportId, setSportId] = useState('workout');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  // Carousel order is fixed while you edit, so starring a design doesn't move it.
  const [favOrder, setFavOrder] = useState<string[]>(() => prefs.favourites);
  const designsFrom = useRef<SheetName | null>(null);
  const cameFromDesigns = useRef(false);
  const [lockedAtOpen, setLockedAtOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  useAppearance(prefs.appearance);

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  // A sheet opening, or swiping to another design, clears any toast.
  useEffect(() => {
    if (sheet) setToast(null);
  }, [sheet]);
  useEffect(() => setToast(null), [prefs.designId, parts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Card fonts are only needed once there's a workout to draw, so home stays light on slow data.
  const needFonts = parts !== null || pending !== null;
  useEffect(() => {
    if (!needFonts || fontsReady) return;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setFontsReady(true);
      }
    };
    ensureFontsLoaded().then(finish, finish);
    const t = setTimeout(finish, 5000);
    return () => clearTimeout(t);
  }, [needFonts]);

  // ── Import ─────────────────────────────────────────────────────────────────

  /** Puts these sessions on the card. A fresh open also resets the title, place and sport. */
  const openSessions = (sessions: Workout[], fresh: boolean, all: Workout[] = sessions) => {
    setPending(null);
    setParts(sessions);
    setPool(all);
    if (!fresh) {
      setSheet(null);
      return;
    }
    const w = combineSessions(sessions);
    // Never open on a design that can't be saved yet (Zones before zones are set up).
    const max = resolveMaxHr(prefs.age, prefs.maxHrOverride);
    const zonesReady = prefs.restingHr !== null && max !== null && max > prefs.restingHr + 10;
    setLockedAtOpen(!zonesReady);
    if (!zonesReady && designById(prefs.designId).needsZones) {
      updatePrefs({ designId: prefs.favourites.find((id) => !designById(id).needsZones) ?? 'summary' });
    }
    setTitle('');
    setLocation('');
    setFavOrder(prefs.favourites);
    if (w.sourceSport === 'Running') {
      setSportId('running');
      setSheet(null);
    } else if (w.sourceSport === 'Biking') {
      setSportId('cycling');
      setSheet(null);
    } else {
      // Pre-select a likely sport from the pace when the file has distance; the picker still opens.
      const kmh = w.distanceM && w.durationSec > 0 ? (w.distanceM / w.durationSec) * 3.6 : 0;
      setSportId(kmh > 1.5 && kmh < 7.5 ? 'walking' : kmh >= 7.5 && kmh < 20 ? 'running' : 'workout');
      setSheet('sport');
    }
  };

  /**
   * Several sessions on the table: let the person pick or combine. On by default: everything when
   * opening fresh, or what's on the card plus the new sessions when adding; if that can't be one
   * card (different days, an overlap), just the first / the new ones, and the sheet says why.
   */
  const offerSessions = (candidates: Workout[], adding: boolean) => {
    const { sessions, duplicates } = uniqueSessions(candidates);
    if (adding && sessions.length === uniqueSessions(pool).sessions.length) {
      showToast(NOTE_DUPLICATE);
      setSheet(null);
      return;
    }
    if (sessions.length === 1) {
      openSessions(sessions, !adding);
      return;
    }
    const isNew = (w: Workout) => !pool.includes(w);
    let on = sessions.map((w) => (adding ? (parts ?? []).includes(w) || isNew(w) : true));
    // A file with a ride and a run isn't "the same sport twice": don't pre-tick a combination of those.
    const mixed = new Set(sessions.filter((_, i) => on[i]).map((w) => w.sourceSport)).size > 1;
    if (mixed || combineProblem(sessions.filter((_, i) => on[i])) !== null) {
      on = adding ? sessions.map(isNew) : sessions.map((_, i) => i === 0);
    }
    setPending({ sessions, on, duplicates, adding });
    setSheet('pick');
  };

  const handleFiles = async (files: Blob[], mode: 'open' | 'add') => {
    const loaded: Workout[] = [];
    let failure: string | null = null;
    for (const file of files) {
      let error: string | null = null;
      if (file.size > MAX_FILE_BYTES) {
        error = ERR_TOO_BIG;
      } else {
        try {
          const result = parseTcx(await file.text());
          if (result.ok) loaded.push(...result.workouts);
          else error = result.error;
        } catch {
          error = ERR_READ;
        }
      }
      if (error) {
        // With several files, say which one.
        const name = files.length > 1 && 'name' in file ? (file as File).name : '';
        failure = name ? `${name}: ${error}` : error;
        break;
      }
    }
    if (failure || loaded.length === 0) {
      // Keep the current workout if one is loaded; just say what went wrong.
      if (parts) showToast(failure ?? ERR_READ);
      else setError(failure ?? ERR_READ);
      return;
    }
    setError(null);
    const adding = mode === 'add' && parts !== null;
    offerSessions(adding ? [...pool, ...loaded] : loaded, adding);
  };
  const handleFileRef = useRef(handleFiles);
  handleFileRef.current = handleFiles;

  const openPicker = (mode: 'open' | 'add' = 'open') => {
    fileMode.current = mode;
    setSheet(null);
    fileInput.current?.click();
  };

  // Desktop: the whole page is a drop zone.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) handleFileRef.current(files, 'open');
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragenter', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragenter', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  // Phone Back: close the open sheet, else step back from the editor to home, instead of leaving.
  const hasWorkout = parts !== null;
  const backRef = useRef({ sheet, hasWorkout });
  backRef.current = { sheet, hasWorkout };
  useEffect(() => {
    if (!hasWorkout) return;
    history.pushState({ sweatshot: 'editor' }, '');
    const onPop = () => {
      const { sheet: open } = backRef.current;
      if (open) {
        setSheet(null);
        history.pushState({ sweatshot: 'editor' }, '');
      } else {
        setParts(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [hasWorkout]);

  // Android share target: the service worker parks the shared file in the Cache API.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('shared') !== '1') {
      // A file shared earlier but never opened shouldn't linger.
      if ('caches' in window) caches.delete(SHARE_CACHE).catch(() => undefined);
      return;
    }
    history.replaceState(null, '', url.pathname);
    if (!('caches' in window)) return;
    (async () => {
      const cache = await caches.open(SHARE_CACHE);
      const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith('/shared-file'));
      const blobs: Blob[] = [];
      for (const k of keys.sort((a, b) => a.url.localeCompare(b.url, undefined, { numeric: true }))) {
        const res = await cache.match(k);
        if (res) blobs.push(await res.blob());
      }
      await caches.delete(SHARE_CACHE);
      if (blobs.length) handleFileRef.current(blobs, 'open');
    })().catch(() => setError(ERR_READ));
  }, []);

  // ── Derived card data ──────────────────────────────────────────────────────

  const workout = useMemo(() => (parts ? combineSessions(parts) : null), [parts]);
  const sport = sportById(sportId);
  const hour12 = prefs.hour12 ?? localeHour12();
  const data = useMemo(
    () =>
      workout
        ? buildCardData({
            workout,
            sport: sportById(sportId),
            title,
            location,
            hour12,
            distanceUnit: prefs.distanceUnit,
            age: prefs.age,
            restingHr: prefs.restingHr,
            maxHrOverride: prefs.maxHrOverride,
          })
        : null,
    [workout, sportId, title, location, hour12, prefs.distanceUnit, prefs.age, prefs.restingHr, prefs.maxHrOverride],
  );
  const hasHr = !!workout && workout.hr.length > 1;
  // Decided when the workout opens, so turning zones on doesn't reshuffle the carousel mid-edit.
  const zonesSet = !workout || !lockedAtOpen;
  const designs = useMemo(() => {
    const ordered = orderDesigns(availableDesigns(hasHr), favOrder);
    // A locked design (zones not set up yet) goes last so it never interrupts swiping.
    return zonesSet ? ordered : [...ordered.filter((d) => !d.needsZones), ...ordered.filter((d) => d.needsZones)];
  }, [hasHr, favOrder, zonesSet]);
  const activeIndex = Math.max(0, designs.findIndex((d) => d.id === prefs.designId));
  const design = designs[activeIndex];
  const available = useMemo(() => (data ? availableStats(data) : []), [data]);
  const stats = useMemo<StatKey[]>(() => {
    const s = [...new Set(prefs.stats.filter((k) => available.includes(k)))];
    return s.length > 0 ? s : ['duration'];
  }, [prefs.stats, available]);

  const optsFor = useCallback(
    (d: CardDesign): CardOptions => ({
      theme: d.supportsTheme === false ? 'light' : prefs.theme,
      background: prefs.background,
      accent: resolveAccent(d, prefs.accent),
      stats,
      showLogo: prefs.showLogo,
      showGraph: prefs.showGraph && hasHr,
      bigStat: prefs.bigStat,
    }),
    [prefs.theme, prefs.background, prefs.accent, prefs.showLogo, prefs.showGraph, prefs.bigStat, stats, hasHr],
  );

  const zonesLocked = !!data && data.zones === null;
  const exportBlocked = !data || (zonesLocked && !!design.needsZones);
  const opts = optsFor(design);
  const exportKey = data
    ? JSON.stringify([design.id, opts, prefs.size, parts?.map((w) => `${w.start.iso}/${w.durationSec}`), sportId, title, location, hour12, prefs.distanceUnit, prefs.age, prefs.restingHr, prefs.maxHrOverride])
    : ''; // every session on the card is part of the key, so adding one never reuses an old image
  const filename = workout
    ? exportFilename(
        slugify(sport.id.startsWith('custom:') ? sport.name : sport.id),
        isoDate(workout.start),
        prefs.size === 'sticker' ? design.id : `${design.id}-${prefs.size}`,
      )
    : 'sweatshot.png';

  // Pre-render the PNG once options settle, so Share can use it inside the click handler.
  useEffect(() => {
    if (!data || !fontsReady || exportBlocked || cachedBlob(exportKey)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      await prepareCard(design, data, opts);
      if (cancelled) return;
      const canvas = renderToNewCanvas(design, data, opts, prefs.size);
      try {
        const blob = await canvasToBlob(canvas);
        if (!cancelled) setCachedBlob(exportKey, blob);
      } catch {
        // Share falls back to a synchronous render.
      } finally {
        releaseCanvas(canvas);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [exportKey, fontsReady, exportBlocked]);

  // ── Share / copy ───────────────────────────────────────────────────────────

  const shareFiles = useMemo(canShareFiles, []);
  const copyImages = useMemo(canCopyImages, []);

  /** The PNG for the current options: cached, or rendered synchronously right now. */
  const currentBlob = (): Blob => {
    let blob = cachedBlob(exportKey);
    if (!blob) {
      const canvas = renderToNewCanvas(design, data!, opts, prefs.size);
      blob = canvasToBlobSync(canvas);
      releaseCanvas(canvas);
      setCachedBlob(exportKey, blob);
    }
    return blob;
  };

  const busy = useRef(0);
  const lastSaved = useRef('');
  const blockedReason = () => showToast('Zones need your resting heart rate and age. Add them in Settings to save this design.');

  const onDownload = () => {
    if (!data) return;
    if (exportBlocked) return blockedReason();
    // A quick double or triple tap saves the same image once; a different design saves straight away.
    if (lastSaved.current === exportKey && performance.now() - busy.current < 900) return;
    busy.current = performance.now();
    lastSaved.current = exportKey;
    downloadBlob(currentBlob(), filename);
    showToast('Image saved. Find it in your Downloads or Files app.');
  };

  /** Click handler: no awaited work before navigator.share when the cache is fresh. */
  const onShare = () => {
    if (!data) return;
    if (exportBlocked) return blockedReason();
    const blob = currentBlob();
    if (!shareFiles) {
      downloadBlob(blob, filename);
      showToast('Image saved. Find it in your Downloads or Files app.');
      return;
    }
    const png = blob;
    try {
      shareBlob(png, filename, data.title).catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return; // user closed the share sheet
        downloadBlob(png, filename);
      });
    } catch {
      downloadBlob(png, filename);
    }
  };

  /** Click handler: ClipboardItem gets the promise synchronously (Safari's pattern). */
  const onCopy = () => {
    if (!data) return;
    if (exportBlocked) return blockedReason();
    const cached = cachedBlob(exportKey);
    const blob = cached
      ? Promise.resolve(cached)
      : prepareCard(design, data, opts).then(() => {
          const canvas = renderToNewCanvas(design, data, opts, prefs.size);
          return canvasToBlob(canvas).finally(() => releaseCanvas(canvas));
        });
    copyBlob(blob).then(
      () => showToast('Copied. Paste it into your story or chat.'),
      () => showToast("Couldn't copy the image. Try Share instead."),
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const onPickSport = (id: string) => {
    setSportId(id);
    updatePrefs({ recentSports: pushRecent(prefs.recentSports, id) });
    setSheet(null);
  };

  const fileInputEl = (
    <input
      ref={fileInput}
      type="file"
      multiple
      class="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const input = e.currentTarget as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        input.value = '';
        if (files.length) handleFiles(files, fileMode.current);
      }}
    />
  );

  const onSample = () => {
    setError(null);
    openSessions([sampleWorkout()], true);
    setSportId('pickleball');
    setTitle('Sample pickleball');
    setSheet(null);
    showToast('This is a made-up sample. To open your own file, tap “Sample pickleball” at the top.');
  };

  const onStar = (id: string) => {
    const next = toggleFavourite(prefs.favourites, id);
    if (next) return updatePrefs({ favourites: next });
    // Full: the oldest favourite makes room for the new one.
    const [oldest, ...rest] = prefs.favourites;
    updatePrefs({ favourites: [...rest, id] });
    showToast(`Starred ${designById(id).name}. ${designById(oldest).name} is no longer a favourite (max ${MAX_FAVOURITES}).`);
  };

  const dropOverlay = dragging && (
    <div class="drop-overlay" aria-hidden="true">
      <Icon name="upload_file" class="icon-lg" />
      <p>Drop your workout files</p>
    </div>
  );

  const pickSheet = sheet === 'pick' && pending && (
    <SessionsSheet
      key={pending.sessions.map((w) => w.start.iso).join()}
      sessions={pending.sessions}
      initial={pending.on}
      duplicates={pending.duplicates}
      hour12={hour12}
      onConfirm={(selected) => openSessions(selected, !pending.adding, pending.sessions)}
      onClose={() => {
        setSheet(null);
        setPending(null);
      }}
    />
  );

  const toastEl = toast && (
    <div class="toast" role="status" key={toast.id}>
      {toast.text}
    </div>
  );

  const onSettingsChange = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    const ready = (p: Prefs) => {
      const max = resolveMaxHr(p.age, p.maxHrOverride);
      return p.restingHr !== null && max !== null && max > p.restingHr + 10;
    };
    const before = ready(prefs);
    const after = ready(next);
    // The first time zones turn on, put zone minutes on the card too.
    if (!before && after && !next.stats.includes('zoneMin') && next.stats.length < MAX_STATS) {
      patch = { ...patch, stats: [...next.stats, 'zoneMin' as StatKey] };
    }
    updatePrefs(patch);
  };

  const settingsSheet = sheet === 'settings' && (
    <SettingsSheet
      prefs={prefs}
      hour12={hour12}
      onChange={onSettingsChange}
      onReset={() => {
        clearPrefs();
        setPrefs({ ...DEFAULT_PREFS });
        showToast('Settings reset');
      }}
      onClose={() => {
        setSheet(designsFrom.current);
        designsFrom.current = null;
      }}
    />
  );

  if (!parts || !data || !workout) {
    return (
      <>
        <div inert={sheet !== null}>
          <EmptyState error={error} onImport={() => openPicker('open')} onSample={onSample} onSettings={() => setSheet('settings')} />
        </div>
        {fileInputEl}
        {pickSheet}
        {settingsSheet}
        {dropOverlay}
        {toastEl}
      </>
    );
  }

  const customizing = sheet === 'customize';
  if (sheet !== 'customize' && sheet !== 'designs') cameFromDesigns.current = false;
  const summary = `${data.shortDate} · ${formatDuration(workout.durationSec)}`;
  const starred = prefs.favourites.includes(design.id);
  const lockedFor = (d: CardDesign) => zonesLocked && !!d.needsZones;

  return (
    <>
      <div class={`app${customizing ? ' is-customizing' : ''}`} inert={sheet !== null && !customizing}>
        <header class="topbar">
          <button type="button" class="pill" onClick={() => setSheet('workout')} aria-label={`${data.title}, ${summary}. Edit workout details`}>
            <SportSticker sport={sport} size={36} />
            <span class="pill-main">
              <span class="pill-title">{data.title}</span>
              <span class="pill-text">{summary}</span>
            </span>
            <Icon name="edit" class="pill-chevron" />
          </button>
          <button type="button" class="icon-btn" onClick={() => setSheet('settings')} aria-label="Settings">
            <Icon name="settings-fill" />
          </button>
        </header>
        {!hasHr && <p class="note">{NOTE_NO_HR} Heart-rate designs are hidden.</p>}


        <h1 class="visually-hidden">Choose a design, then save or share it</h1>
        <main class="stage" inert={customizing}>
          <Carousel
            designs={designs}
            activeIndex={activeIndex}
            onActiveChange={(i) => updatePrefs({ designId: designs[i].id })}
            data={data}
            optsFor={optsFor}
            size={prefs.size}
            ready={fontsReady}
            zonesLocked={zonesLocked}
            favourites={prefs.favourites}
            onOpenSettings={() => setSheet('settings')}
          />
        </main>

        <div class="design-bar">
          <div class="fav-row">
            <div
              class="size-switch"
              role="radiogroup"
              aria-label={`Image size: ${SIZE_NAMES[prefs.size]}`}
              onKeyDown={(e) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const next = prefs.size === 'story' ? 'sticker' : 'story';
                updatePrefs({ size: next });
                const group = e.currentTarget as HTMLElement;
                requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
              }}
            >
              {(['sticker', 'story'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  role="radio"
                  aria-checked={prefs.size === sz}
                  tabIndex={prefs.size === sz || (sz === 'sticker' && prefs.size !== 'story') ? 0 : -1}
                  class={prefs.size === sz ? 'is-on' : ''}
                  onClick={() => updatePrefs({ size: sz })}
                >
                  {sz === 'sticker' ? 'Card only' : 'Story'}
                </button>
              ))}
            </div>
            <p class="visually-hidden" aria-live="polite">
              Image size: {SIZE_NAMES[prefs.size]}
            </p>
            <span class="design-label">{design.name}</span>
            <button
              type="button"
              class={`star-btn${starred ? ' is-on' : ''}`}
              aria-pressed={starred}
              aria-label={`Favourite: ${design.name}`}
              title={starred ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => onStar(design.id)}
            >
              <Icon name={starred ? 'star-fill' : 'star'} />
            </button>
          </div>
          <button type="button" class="btn btn-secondary btn-customize" onClick={() => setSheet('customize')}>
            <Icon name="palette" />
            Customize
          </button>
        </div>

        <nav class="action-row" aria-label="Save or share">
          <button type="button" class="round-action" onClick={onDownload} aria-disabled={exportBlocked}>
            <span class="round-icon">
              <Icon name="download" />
            </span>
            Save image
          </button>
          {copyImages && (
            <button type="button" class="round-action" onClick={onCopy} aria-disabled={exportBlocked}>
              <span class="round-icon">
                <Icon name="content_copy" />
              </span>
              Copy image
            </button>
          )}
          {shareFiles && (
            <button type="button" class="round-action is-primary" onClick={onShare} aria-disabled={exportBlocked}>
              <span class="round-icon">
                <Icon name="ios_share" />
              </span>
              Share
            </button>
          )}
        </nav>
      </div>

      {fileInputEl}

      {pickSheet}
      {sheet === 'sport' && (
        <SportSheet
          currentId={sportId}
          recent={prefs.recentSports}
          onPick={(id) => {
            onPickSport(id);
            setSheet(designsFrom.current);
            designsFrom.current = null;
          }}
          onClose={() => {
            setSheet(designsFrom.current);
            designsFrom.current = null;
          }}
        />
      )}
      {sheet === 'workout' && (
        <WorkoutSheet
          sport={sport}
          title={title}
          location={location}
          sessionsText={data.sessionsText}
          canChooseSessions={pool.length > 1}
          onChangeSport={() => {
            designsFrom.current = 'workout';
            setSheet('sport');
          }}
          onTitle={setTitle}
          onLocation={setLocation}
          onChooseSessions={() => {
            const { sessions } = uniqueSessions(pool);
            setPending({ sessions, on: sessions.map((w) => parts.includes(w)), duplicates: 0, adding: true });
            setSheet('pick');
          }}
          onAddSession={() => openPicker('add')}
          onImport={() => openPicker('open')}
          onClose={() => setSheet(null)}
        />
      )}
      {settingsSheet}
      {sheet === 'designs' && (
        <DesignsSheet
          designs={designs}
          activeId={design.id}
          favourites={prefs.favourites}
          locked={lockedFor}
          data={data}
          optsFor={optsFor}
          ready={fontsReady}
          onPick={(id) => {
            updatePrefs({ designId: designById(id).id });
            setSheet(designsFrom.current);
            designsFrom.current = null;
          }}
          onStar={onStar}
          onClose={() => {
            cameFromDesigns.current = designsFrom.current === 'customize';
            setSheet(designsFrom.current);
            designsFrom.current = null;
          }}
        />
      )}
      {customizing && (
        <EditSheet
          design={design}
          data={data}
          prefs={prefs}
          accent={opts.accent}
          stats={stats}
          available={available}
          hasHr={hasHr}
          zonesLocked={zonesLocked}
          onChange={updatePrefs}
          onOpenSettings={() => {
            designsFrom.current = 'customize';
            setSheet('settings');
          }}
          focusDesigns={cameFromDesigns.current}
          onOpenDesigns={() => {
            designsFrom.current = 'customize';
            setSheet('designs');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {dropOverlay}
      {toastEl}
    </>
  );
}
