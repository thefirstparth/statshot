# Decisions

Choices made where the build spec was silent or needed interpreting. Grouped by area.

## Stack and tooling

- **Versions:** Vite 8, TypeScript 6.0 (strict, plus `noUnusedLocals`/`noUnusedParameters`), Preact 10, Vitest 5, vite-plugin-pwa 2, @napi-rs/canvas 1. TypeScript 7 (the native port) was available but skipped as too new for the toolchain.
- **Fonts:** every package named in the spec exists (`@fontsource/inter`, `instrument-serif`, `jetbrains-mono`, `space-grotesk`), so there are no substitutions. Only the faces the designs use are bundled (Inter 400/500/600/700, Instrument Serif 400 normal + italic, JetBrains Mono 400/700, Space Grotesk 500/700), in the latin and latin-ext subsets. Other scripts (Devanagari, CJK…) in a custom title fall back to system fonts through the canvas font list.
- **Icons:** a small Vite plugin (`build/icons-plugin.ts`) exposes `virtual:tabler-icons`, a map of icon name → SVG string for exactly the icons the app uses. It checks every name against `@tabler/icons` at build time and falls back to `activity` with a build warning. The UI chrome uses the same Tabler icons, inlined as SVG.
- **Service worker:** `injectManifest` strategy (`src/sw.ts`) because the Android share target needs a custom POST handler. Workbox precaches the shell (JS, CSS, HTML, woff2 fonts, icons); navigations fall back to the precached `index.html` so the app opens offline.
- **Content Security Policy:** production builds add a CSP `<meta>` that allows only same-origin scripts, fonts and connections (plus `data:`/`blob:` images). This enforces the no-external-requests rule in the browser. Dev builds skip it because Vite's HMR needs inline scripts.
- **No `vercel.json`:** Vercel's Vite preset builds and serves `dist/` as is.
- **Node:** `engines.node >= 20.19` (Vite 8's minimum).
- **Footer link:** `src/config.ts` points at `https://github.com/thefirstparth/statshot` (the actual repo) rather than a dummy URL. Forks should change it.
- **Test environment:** tests run under jsdom (for `DOMParser`); rendering uses @napi-rs/canvas through a small injectable render environment (`src/render/env.ts`), with the same bundled woff2 files registered. Vitest 5 hides `console.log` from passing tests, so the private-fixture stats are written to stdout directly.

## Parsing and stats

- **Average HR:** trapezoid time-weighting over sample intervals. Intervals longer than 30 s are skipped, the same rule as zones. Falls back to the plain mean if no usable interval exists.
- **HR without samples:** if a file has lap summaries (`AverageHeartRateBpm`/`MaximumHeartRateBpm`) but no per-sample HR, those summaries still give the Avg/Max HR stats. Pulse, Zones, graphs and active minutes need at least 2 samples.
- **Calories of 0** are treated as missing (no "0 kcal" stat). **Distance** is the sum of lap `DistanceMeters`, or the largest trackpoint `DistanceMeters` if the laps say 0.
- **Duration** falls back to the trackpoint time span when `TotalTimeSeconds` is missing.
- **Times:** wall-clock fields are taken straight from the string and epoch values are computed arithmetically from them, so the device timezone never matters. Timestamps ending in `Z` (Garmin) are shown as written, i.e. in UTC. A missing offset is treated as `+00:00`.
- **Start time** is `<Id>`, else the first lap's `StartTime`, else the first trackpoint's time. Activities without any parseable time are skipped. If none remain, the error is "No workouts found in this file."
- **Duration format:** a whole number of hours shows as `1h` (not `1h 0m`). Under 59.5 s shows seconds. Zone and active-minute values use whole minutes (`0m`, `38m`, `1h 15m`).
- **Dates on cards** are English (`Tue, 20 Oct 2026`), whatever the device locale, to match the spec's examples. The date line on most cards is `Tue, 20 Oct 2026 · 02:02`.
- **12h/24h default** uses `new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12`. Without the `hour` option some engines return `undefined`.
- **Zones:** `[50,60)` → Z1 … `≥90 %` → Z5, so readings above max HR count as Z5 and readings below 50 % count toward no zone. Max HR accepts an override between 80 and 250 and an age between 5 and 110.
- **File size limit:** files over 50 MB are rejected before reading, with "This file is too large to be a workout export."

## Rendering

- **`CardDesign` extensions:** optional `supportsGraph`, `supportsTheme` (Receipt sets it to `false`), `defaultAccent`, plus `background(opts)` (solid canvas colour) and `icons(data, opts)`. `icons` lists the icon images to decode before drawing, so a draw call never waits on an image.
- **Icon rasterisation:** each recoloured SVG is given the exact pixel size it will be drawn at before decoding, and cached per (icon, colour, size). Upscaled 24 px SVGs can look soft in Safari otherwise.
- **Placement:** in Story size the card sits 3.5 % of the canvas height above centre. A card taller than the canvas minus 64 px margins (e.g. Zones in Square) is scaled down to fit instead of overflowing.
- **Stat rows:** 1–3 stats → one row; 4 → 2 + 2; 5 → 3 + 2; 6 → 3 + 3 (Glass, Editorial, Pulse, Zones). Midnight and Block use 2 columns, and an odd last stat stays in the left column. Receipt lists one line per stat.
- **Accent:** stored as `null` until the user picks a swatch. `null` means each design's own default: Messages blue `#0A84FF`, otherwise `#FF6B35`. Once picked, the accent applies to every design that supports one.
- **Accent use per design:** Glass (icon colour and a tint of its solid background), Midnight, Block, Pulse, Zones (header icon and graph) and Messages (bubbles) use it. Receipt and Editorial don't, so the swatches are hidden for them.
- **Solid backgrounds:** Glass uses a dark or light tint of the accent. Midnight, Pulse and Zones use `#0A0B0D` / `#E4E6EB`, Block `#1A1A1A` / `#E8E8E8`, Receipt `#2A2C31` (theme-independent), Editorial warm `#14120F` / `#F3EDE2`, and Messages black or white.
- **Glass:** a thin divider separates the stats from the logo footer.
- **Block:** the footer strip shows the logo on the left and the workout time on the right; the time stays when the logo is off. The icon inside the accent circle is black or white, whichever reads better on the accent.
- **Receipt:** the header shows "Workout" when the logo is off. A seeded barcode follows the optional `HR` sparkline line, and the paper has a soft drop shadow. The torn edges, speckle and barcode all come from the workout start time, so preview and export are identical. The test's (0,0) exemption for Receipt in Sticker size isn't needed: the shadow stays inside the 48 px padding.
- **Editorial:** stat labels are Instrument Serif regular.
- **Messages:** bubble text switches to black on light accents (`#FFD60A`, `#FFFFFF`). The sentence starts with "<duration> of <sport>" when Duration is on, otherwise "<Sport>: …". The other stats follow as short phrases ("avg 112 bpm", "38m active", "cardio load 87").
- **Pulse:** the y-axis leaves headroom for the max label. The max dot sits on the smoothed curve's peak but is labelled with the true max HR. Pulse and Zones also show the sport icon top-right, and both use Midnight's card colours.
- **Zones** without a known max HR still renders, with a grey bar and "–" rows, under the UI overlay.

## App behaviour

- **Defaults:** design Glass, background Solid, theme Dark, size Story, stats Duration + Energy + Avg HR, logo on, HR graph on. Solid is the default because a transparent Story PNG turns black in most chat apps. Sticker + Transparent is one tap away for IG stickers.
- **Unavailable stats:** their toggles are hidden, as the spec says. Active minutes appear once max HR is known. The Cardio load toggle appears once a value is entered in the Workout sheet and switches itself on the first time. Selections for unavailable stats are kept, so Distance comes back for the next file that has it.
- **Sport sheet:** if it's dismissed without a choice, the sport is "Workout". The search field's Enter key picks the first match, or uses the query as a custom name when nothing matches. Custom names are capped at 40 characters and use the `activity` icon. Recent shows the last 4 picks, custom names included.
- **Multi-activity files:** the "Pick a workout" sheet lists date, time, duration and, for Running/Biking files, the sport. If a workout is already open it stays open until you pick, and closing the sheet cancels the import. The Workout sheet offers "Pick another workout from this file".
- **Import errors** show in the empty state. If a workout is already open, they show as a toast and the open workout stays.
- **Customize:** the sheet's backdrop is lighter, and the preview shrinks into the space above the sheet, with the header and dots hidden while it's open, so changes are visible live.
- **Carousel:** pages are sized to the preview so neighbours peek in. Tapping a peeking neighbour or a dot jumps to it, and arrow keys work when the carousel has focus. The design name for Zones reads "Zones (est.)".
- **Share:** if the cached blob is stale at click time, the click handler renders synchronously and encodes with `toDataURL` (also synchronous), so nothing is awaited before `navigator.share`. If `share()` rejects with anything other than the user cancelling, the PNG downloads instead.
- **Copy:** an uncached blob is rendered inside the promise passed to `ClipboardItem`. A failed copy shows "Couldn't copy the image. Try Share instead."
- **Settings:** "Reset all preferences" needs a second tap ("Tap again to reset everything"). The max HR field shows the computed estimate as its placeholder and note.
- **Device name:** `<Creator><Name>` is parsed but not shown anywhere, so device trademarks don't appear in the UI or on cards.
- **Fonts:** a skeleton shows until `ensureFontsLoaded()` resolves, with a 5 s safety timeout so a failed font can't block the app.
- **Shared files (Android):** the service worker stores the file in a dedicated Cache API entry, which the app deletes as soon as it reads it.

## Fixtures

- `synthetic-basic.tcx` has 3325 samples (t = 0…6648 s, every 2 s) so that the sum is exactly 112 × N, with one 82 (the first sample) and one 135. The lap still says 6651 s.
- `synthetic-multilap.tcx` uses a −04:00 offset and includes Position, Altitude, DistanceMeters and a `TPX` extension to prove they're ignored.
- `synthetic-multi-activity.tcx` has a Biking and an Other activity on consecutive days.
