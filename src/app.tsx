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
import { availableDesigns, resolveAccent } from './render/registry';
import { prepareCard, releaseCanvas, renderToNewCanvas } from './render/render';
import type { CardDesign, CardOptions, StatKey } from './render/types';
import { pushRecent, savePrefs, loadPrefs, clearPrefs, DEFAULT_PREFS, localeHour12, type Prefs } from './state/store';
import { slugify, sportById } from './sports';
import { NOTE_NO_HR, parseTcx, type Workout } from './tcx/parse';
import { formatDuration, isoDate } from './tcx/stats';
import { Carousel } from './ui/carousel';
import { EmptyState } from './ui/empty';
import { Icon } from './ui/icon';
import { CustomizeSheet, PickWorkoutSheet, SettingsSheet, WorkoutSheet } from './ui/sheets';
import { SportSheet } from './ui/sport-sheet';

type SheetName = 'pick' | 'sport' | 'workout' | 'settings' | 'customize';

const ERR_TOO_BIG = 'This file is too large to be a workout export.';
const ERR_READ = "Couldn't read that file. Try saving it to Files first, then import it again.";
const SHARE_CACHE = 'statshot-share';

export function App() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [fontsReady, setFontsReady] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [workoutIdx, setWorkoutIdx] = useState<number | null>(null);
  // A multi-workout file waiting for "Pick a workout"; the current workout stays until then.
  const [pending, setPending] = useState<Workout[] | null>(null);
  const [sportId, setSportId] = useState('workout');
  const [title, setTitle] = useState('');
  const [cardioLoad, setCardioLoad] = useState<number | null>(null);
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
    setCardioLoad(null);
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

  // Android share target: the service worker parks the shared file in the Cache API.
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get('shared') !== '1') return;
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
            cardioLoad,
            hour12,
            distanceUnit: prefs.distanceUnit,
            age: prefs.age,
            maxHrOverride: prefs.maxHrOverride,
          })
        : null,
    [workout, sportId, title, cardioLoad, hour12, prefs.distanceUnit, prefs.age, prefs.maxHrOverride],
  );
  const hasHr = !!workout && workout.hr.length > 1;
  const designs = useMemo(() => availableDesigns(hasHr), [hasHr]);
  const activeIndex = Math.max(0, designs.findIndex((d) => d.id === prefs.designId));
  const design = designs[activeIndex];
  const available = useMemo(() => (data ? availableStats(data) : []), [data]);
  const stats = useMemo<StatKey[]>(() => {
    const s = prefs.stats.filter((k) => available.includes(k));
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

  const zonesLocked = !!data && data.zoneMinutes === null;
  const exportBlocked = !data || (zonesLocked && !!design.needsZones);
  const opts = optsFor(design);
  const exportKey = data
    ? JSON.stringify([design.id, opts, prefs.size, workout?.start.iso, sportId, title, cardioLoad, hour12, prefs.distanceUnit, prefs.age, prefs.maxHrOverride])
    : '';
  const filename = workout
    ? exportFilename(slugify(sport.id.startsWith('custom:') ? sport.name : sport.id), isoDate(workout.start))
    : 'statshot.png';

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

  /** Click handler: no awaited work before navigator.share when the cache is fresh. */
  const onShare = () => {
    if (!data || exportBlocked) return;
    let blob = cachedBlob(exportKey);
    if (!blob) {
      const canvas = renderToNewCanvas(design, data, opts, prefs.size);
      blob = canvasToBlobSync(canvas);
      releaseCanvas(canvas);
      setCachedBlob(exportKey, blob);
    }
    if (!shareFiles) {
      downloadBlob(blob, filename);
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
      () => showToast('Copied — paste into your story as a sticker'),
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

  const dropOverlay = dragging && (
    <div class="drop-overlay" aria-hidden="true">
      <Icon name="file-import" class="icon-lg" />
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

  if (!workouts || !data || !workout) {
    return (
      <>
        <EmptyState error={error} onImport={openPicker} />
        {fileInputEl}
        {pickSheet}
        {dropOverlay}
        {toastEl}
      </>
    );
  }

  const customizing = sheet === 'customize';
  const summary = `${data.title} · ${data.shortDate} · ${formatDuration(workout.durationSec)}`;

  return (
    <>
      <div class={`app${customizing ? ' is-customizing' : ''}`} inert={sheet !== null && !customizing}>
        <header class="topbar">
          <button type="button" class="pill" onClick={() => setSheet('workout')} aria-label={`Workout: ${summary}. Edit`}>
            <Icon name={sport.icon} />
            <span class="pill-text">{summary}</span>
            <Icon name="chevron-down" class="pill-chevron" />
          </button>
          <button type="button" class="icon-btn" onClick={() => setSheet('settings')} aria-label="Settings">
            <Icon name="settings" />
          </button>
        </header>
        {!hasHr && <p class="note">{NOTE_NO_HR}</p>}

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
            onOpenSettings={() => setSheet('settings')}
          />
        </main>

        <div class="customize-row">
          <button type="button" class="btn btn-ghost" onClick={() => setSheet('customize')}>
            <Icon name="adjustments-horizontal" />
            Customize
          </button>
        </div>

        <nav class="action-bar" aria-label="Export">
          <button type="button" class="btn btn-primary btn-share" onClick={onShare} disabled={exportBlocked}>
            <Icon name={shareFiles ? 'share' : 'download'} />
            {shareFiles ? 'Share' : 'Download'}
          </button>
          {copyImages && (
            <button type="button" class="btn btn-secondary btn-copy" onClick={onCopy} disabled={exportBlocked}>
              <Icon name="copy" />
              Copy
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
          cardioLoad={cardioLoad}
          canPickAnother={workouts.length > 1}
          onChangeSport={() => setSheet('sport')}
          onTitle={setTitle}
          onCardioLoad={(v) => {
            // Turn the stat on the first time a value is entered.
            if (v !== null && cardioLoad === null && !prefs.stats.includes('cardioLoad')) {
              updatePrefs({ stats: [...prefs.stats, 'cardioLoad'] });
            }
            setCardioLoad(v);
          }}
          onPickAnother={() => setSheet('pick')}
          onImport={openPicker}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet
          prefs={prefs}
          hour12={hour12}
          onChange={updatePrefs}
          onReset={() => {
            clearPrefs();
            setPrefs({ ...DEFAULT_PREFS });
            showToast('Preferences reset');
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {customizing && (
        <CustomizeSheet
          design={design}
          prefs={prefs}
          accent={opts.accent}
          available={available}
          hasHr={hasHr}
          onChange={updatePrefs}
          onClose={() => setSheet(null)}
        />
      )}
      {dropOverlay}
      {toastEl}
    </>
  );
}
