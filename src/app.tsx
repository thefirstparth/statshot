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
import { NOTE_NO_HR, parseTcx, type Workout } from './tcx/parse';
import { formatDuration, isoDate, resolveMaxHr } from './tcx/stats';
import { Carousel } from './ui/carousel';
import { EmptyState } from './ui/empty';
import { Icon } from './ui/icon';
import { DesignsSheet, EditSheet, PickWorkoutSheet, SettingsSheet, WorkoutSheet } from './ui/sheets';
import { SportSheet } from './ui/sport-sheet';
import { SportSticker } from './ui/sticker';

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
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [workoutIdx, setWorkoutIdx] = useState<number | null>(null);
  // A multi-workout file waiting for "Pick a workout"; the current workout stays until then.
  const [pending, setPending] = useState<Workout[] | null>(null);
  const [sportId, setSportId] = useState('workout');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  // Carousel order is fixed while you edit, so starring a design doesn't move it.
  const [favOrder, setFavOrder] = useState<string[]>(() => prefs.favourites);
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
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Fonts must be ready before the first draw; don't hang forever if one fails.
  useEffect(() => {
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
  }, []);

  // ── Import ─────────────────────────────────────────────────────────────────

  const selectWorkout = (list: Workout[], i: number) => {
    const w = list[i];
    setWorkouts(list);
    setPending(null);
    setWorkoutIdx(i);
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
      setSportId('workout');
      setSheet('sport');
    }
  };

  const handleFile = async (file: Blob) => {
    let failure: string | null = null;
    let list: Workout[] | null = null;
    if (file.size > MAX_FILE_BYTES) {
      failure = ERR_TOO_BIG;
    } else {
      try {
        const result = parseTcx(await file.text());
        if (result.ok) list = result.workouts;
        else failure = result.error;
      } catch {
        failure = ERR_READ;
      }
    }
    if (!list) {
      // Keep the current workout if one is loaded; just say what went wrong.
      if (workouts && workoutIdx !== null) showToast(failure ?? ERR_READ);
      else setError(failure);
      return;
    }
    setError(null);
    if (list.length > 1) {
      setPending(list);
      setSheet('pick');
    } else {
      selectWorkout(list, 0);
    }
  };
  const handleFileRef = useRef(handleFile);
  handleFileRef.current = handleFile;

  const openPicker = () => {
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
      const f = e.dataTransfer?.files[0];
      if (f) handleFileRef.current(f);
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
  const hasWorkout = workouts !== null && workoutIdx !== null;
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
        setWorkouts(null);
        setWorkoutIdx(null);
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
      const res = await cache.match('/shared-file');
      await caches.delete(SHARE_CACHE);
      if (res) handleFileRef.current(await res.blob());
    })().catch(() => setError(ERR_READ));
  }, []);

  // ── Derived card data ──────────────────────────────────────────────────────

  const workout = workouts && workoutIdx !== null ? workouts[workoutIdx] : null;
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
  const zonesSet = !workout || !!data?.zones;
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
    }),
    [prefs.theme, prefs.background, prefs.accent, prefs.showLogo, prefs.showGraph, stats, hasHr],
  );

  const zonesLocked = !!data && data.zones === null;
  const exportBlocked = !data || (zonesLocked && !!design.needsZones);
  const opts = optsFor(design);
  const exportKey = data
    ? JSON.stringify([design.id, opts, prefs.size, workout?.start.iso, sportId, title, location, hour12, prefs.distanceUnit, prefs.age, prefs.restingHr, prefs.maxHrOverride])
    : '';
  const filename = workout
    ? exportFilename(slugify(sport.id.startsWith('custom:') ? sport.name : sport.id), isoDate(workout.start), design.id)
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
  const onDownload = () => {
    if (!data || exportBlocked) return;
    // A quick double or triple tap saves once.
    if (performance.now() - busy.current < 1200) return;
    busy.current = performance.now();
    downloadBlob(currentBlob(), filename);
    showToast('Image saved. Find it in your Downloads or Files app.');
  };

  /** Click handler: no awaited work before navigator.share when the cache is fresh. */
  const onShare = () => {
    if (!data || exportBlocked) return;
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
    if (!data || exportBlocked) return;
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
      class="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const input = e.currentTarget as HTMLInputElement;
        const f = input.files?.[0];
        input.value = '';
        if (f) handleFile(f);
      }}
    />
  );

  const onSample = () => {
    setError(null);
    selectWorkout([sampleWorkout()], 0);
    setSportId('pickleball');
    setSheet(null);
    showToast('This is a made-up sample. Open your own file any time.');
  };

  const onStar = (id: string) => {
    const next = toggleFavourite(prefs.favourites, id);
    if (!next) return showToast(`You can star up to ${MAX_FAVOURITES}. Unstar one first.`);
    updatePrefs({ favourites: next });
  };

  const dropOverlay = dragging && (
    <div class="drop-overlay" aria-hidden="true">
      <Icon name="upload_file" class="icon-lg" />
      <p>Drop your workout file</p>
    </div>
  );

  const pickList = pending ?? workouts;
  const pickSheet = sheet === 'pick' && pickList && (
    <PickWorkoutSheet
      workouts={pickList}
      hour12={hour12}
      onPick={(i) => selectWorkout(pickList, i)}
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
      onClose={() => setSheet(null)}
    />
  );

  if (!workouts || !data || !workout) {
    return (
      <>
        <EmptyState error={error} onImport={openPicker} onSample={onSample} onSettings={() => setSheet('settings')} />
        {fileInputEl}
        {pickSheet}
        {settingsSheet}
        {dropOverlay}
        {toastEl}
      </>
    );
  }

  const customizing = sheet === 'customize';
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
        {zonesLocked && design.needsZones && (
          <p class="note">
            Zones need your resting heart rate and age.{' '}
            <button type="button" class="link-btn" onClick={() => setSheet('settings')}>
              Open settings
            </button>
          </p>
        )}

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
          <button type="button" class="btn btn-secondary btn-customize" data-focus-home onClick={() => setSheet('customize')}>
            <Icon name="palette" />
            Customize
          </button>
        </div>

        <nav class="action-row" aria-label="Save or share">
          <button type="button" class="round-action" onClick={onDownload} disabled={exportBlocked}>
            <span class="round-icon">
              <Icon name="download" />
            </span>
            Save image
          </button>
          {copyImages && (
            <button type="button" class="round-action" onClick={onCopy} disabled={exportBlocked}>
              <span class="round-icon">
                <Icon name="content_copy" />
              </span>
              Copy image
            </button>
          )}
          {shareFiles && (
            <button type="button" class="round-action is-primary" onClick={onShare} disabled={exportBlocked}>
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
        <SportSheet currentId={sportId} recent={prefs.recentSports} onPick={onPickSport} onClose={() => setSheet(null)} />
      )}
      {sheet === 'workout' && (
        <WorkoutSheet
          sport={sport}
          title={title}
          location={location}
          canPickAnother={workouts.length > 1}
          onChangeSport={() => setSheet('sport')}
          onTitle={setTitle}
          onLocation={setLocation}
          onPickAnother={() => setSheet('pick')}
          onImport={openPicker}
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
            setSheet(null);
          }}
          onStar={onStar}
          onClose={() => setSheet(null)}
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
          onOpenSettings={() => setSheet('settings')}
          onOpenDesigns={() => setSheet('designs')}
          onClose={() => setSheet(null)}
        />
      )}
      {dropOverlay}
      {toastEl}
    </>
  );
}
