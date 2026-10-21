<p align="center">
  <img src="public/icons/icon-512.png" width="112" alt="Sweatshot app icon: a mango sweat drop with a sparkle">
</p>

<h1 align="center">Sweatshot</h1>

<p align="center"><b>Turn your Google Health workout into a picture you can post.</b><br>
Runs on your phone. Never uploads your file. Works offline. No account.</p>

<p align="center">
  <a href="https://statshot-five.vercel.app"><img alt="Open the app" src="https://img.shields.io/badge/open_the_app-statshot--five.vercel.app-FFB547?style=for-the-badge"></a>
</p>
<p align="center">
  <img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-2A1E14">
  <img alt="No backend" src="https://img.shields.io/badge/backend-none-2A1E14">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-2A1E14">
  <img alt="Works offline" src="https://img.shields.io/badge/works-offline-2A1E14">
  <img alt="Installable PWA" src="https://img.shields.io/badge/PWA-installable-2A1E14">
</p>

<p align="center"><img src="docs/screens.png" alt="Sweatshot screens: home, sport picker, design carousel with Save and Copy, and the Customize sheet" width="100%"></p>

Google Health (and the Fitbit Air) records your workouts beautifully, but it can't share one as an image. It can export a `.tcx` file, though. **Sweatshot reads that file in your browser and turns it into a clean, story-ready picture in about three taps.** Pick from eleven designs, star your favourites, choose which numbers to show, and save, copy or share a PNG. A clear (transparent) version drops straight onto your own photo.

> Not affiliated with Google or Fitbit. "Google Health" and "Fitbit" are named only to say which exports work.

---

## How it works

| Step | What happens |
| --- | --- |
| **1. Export** | In Google Health, open the workout, tap ⋯, then **Export**, and save the file to Files. |
| **2. Open** | In Sweatshot, tap **Open workout file** and pick it. Your phone reads it; nothing leaves the device. |
| **3. Pick the sport** | The file just says "Other", so tap what you played: table tennis, pickleball, a walk, the gym, 35 sports in all, or type your own. |
| **4. Share** | Swipe through the designs, tap **Customize** if you like, then **Save image**, **Copy image** or **Share**. |

No file yet? Tap **Try a sample workout** on the home screen.

## Quick start

| Where | What to do |
| --- | --- |
| **iPhone (Safari)** | Open [the app](https://statshot-five.vercel.app) → Share → **Add to Home Screen**. After that it works offline. |
| **Android (Chrome)** | Open [the app](https://statshot-five.vercel.app) → ⋮ → **Install app**. Once installed you can also **share a .tcx file straight to Sweatshot** from Files. |
| **Desktop** | Open [the app](https://statshot-five.vercel.app) and drop a `.tcx` file anywhere on the page. |

## The designs

<p align="center"><img src="docs/designs.png" alt="Eight of the eleven designs: Summary, Heart trace, Messages, Receipt, Poster, Day dial, Widgets and Zones" width="100%"></p>

| Design | What it is |
| --- | --- |
| **Summary** | Big title, your stats in tidy tiles, optional heart-rate line. |
| **Hero number** | One giant number does the talking. |
| **Heart trace** | Your heart rate as one clean line, peak and average marked. |
| **Zones** | Zone minutes and time in each heart-rate zone, Google Health style. |
| **Messages** | Your workout as a text bubble. |
| **Receipt** | A till receipt for your effort. |
| **Editorial** | Magazine-style serif, calm and classy. |
| **Sticker pill** | A compact pill to drop on any photo. |
| **Widgets** | Your stats as a stack of phone widgets. |
| **Poster** | Bold type and a giant sport glyph, made for a story. |
| **Day dial** | When you played, on a quiet 24-hour clock. |

Every design comes in **light or dark**, on a **solid or clear** background, as **just the card** (the default, best for pasting onto a story or photo) or **Story 1080×1920, Post 1080×1350 or Square 1080×1080**. Star up to **five favourites** and they come first.

**Numbers you can show:** duration, energy, average / peak / lowest heart rate, zone minutes, distance (walks and runs) and time of day. Add where you played if you want it on the card.

## Your data

Sweatshot is a static website with **no server, no database, no analytics and no third-party requests**.

- Your file is read with JavaScript **on your device**. It is never uploaded, and it isn't stored either: close the tab and it's gone.
- The production build ships a **Content Security Policy** that only allows the app's own origin, so even a bug couldn't send your data anywhere.
- Only your preferences (favourite designs, colours, resting heart rate and age for zones) are saved, in your browser's local storage. **Settings → Reset** clears them.
- After the first visit a service worker caches the app, so it **works in airplane mode**.

Don't take our word for it: the code is all here, and your browser's network panel will show zero requests while you use it.

## Heart-rate zones

Zones use the same **heart-rate reserve** method as Google Health:

| Zone | % of heart-rate reserve |
| --- | --- |
| Light | under 40 % |
| Moderate | 40–59 % |
| Vigorous | 60–84 % |
| Peak | 85 % and up |

Heart-rate reserve is *max − resting*. **Zone minutes** count moderate minutes once and vigorous and peak minutes twice. Set your **resting heart rate** (Google Health shows it under Heart rate) and **age** in Settings; add your max heart rate if you know it, otherwise 220 − age is used. Exact numbers can differ slightly from Google Health, which may use its own estimate of your max.

## Which files work

| Source | Works? |
| --- | --- |
| Google Health / Fitbit Air export (`.tcx`) | ✅ Made for it: heart rate, energy, duration, distance for walks and runs |
| Garmin, Strava, Polar, Wahoo, etc. (`.tcx`) | ✅ Any standard TCX file |
| Files with several workouts | ✅ You pick which one |
| Files without heart rate | ✅ Heart-rate designs are hidden; the rest work |
| `.gpx`, `.fit`, screenshots | ❌ Not yet |

## Questions people ask

**Is it really free and private?** Yes. There's no server to send anything to. It's MIT-licensed, so you can host your own copy too.

**Why do I have to pick the sport?** Google Health exports most workouts as "Other". Your recent sports appear first next time.

**My numbers differ by a minute or a beat from Google Health.** Durations are rounded to the minute like Google Health, but averages are computed from the raw samples in the file, so tiny differences can happen.

**Why does it say "Card only"?** That's the image cropped tight to the design, the easiest to paste onto an Instagram story or your own photo and resize. Choose Story, Post or Square in Customize for a full-size image.

**Can I remove the little Sweatshot mark?** Yes: Customize → **Show Sweatshot mark**.

**Does it work on iPhone?** Yes, in Safari, including Add to Home Screen and offline use. Sharing a file *into* the app is Android-only (an iOS limitation); on iPhone, open it from inside the app.

## Run it yourself

Requires Node 20.19+ (or 22.12+).

```sh
npm ci            # install
npm run dev       # dev server on http://localhost:5173
npm test          # unit + render tests (Vitest, @napi-rs/canvas)
npm run build     # type-check and build to dist/
npm run preview   # serve the production build (service worker included)
```

- `npm run fixtures` regenerates the synthetic TCX files in `tests/fixtures/`.
- `npm run icons` regenerates the app icons in `public/` from the sweat-drop mark.
- `SWEATSHOT_PREVIEW=1 npm test` writes every rendered card to `tests/output/` so you can look at them.
- Real exports for local testing go in `tests/fixtures/private/` (gitignored, never committed).

**Deploy:** it's a static site. On **Vercel**, import the repo (the Vite preset is detected; build `npm run build`, output `dist`). Anywhere else, upload `dist/` to any HTTPS static host. If you fork it, change the footer link in `src/config.ts`.

**Layout:** `src/tcx/` parses the file and derives stats, `src/render/` draws the cards with Canvas 2D (one file per design in `src/render/designs/`), `src/export/` handles share / copy / download, `src/state/` stores preferences, `src/ui/` holds the Preact screens. Design decisions are in [DECISIONS.md](DECISIONS.md).

## Contributing

| Help with | How |
| --- | --- |
| **A new design** | Add a file in `src/render/designs/` implementing `CardDesign`, register it in `src/render/registry.ts`. The render tests check it in every size, theme and stat count. |
| **A sport that's missing** | Add it to `SPORTS` in `src/sports.ts` with a [Material Symbols](https://fonts.google.com/icons) icon name. |
| **Another export format** | A parser that returns the same `Workout` shape as `src/tcx/parse.ts`. |
| **Bugs** | Open an issue with the steps. **Never attach a real workout file**; describe it, or share a synthetic one. |

## Licence

[MIT](LICENSE). Fonts are bundled from Fontsource (SIL Open Font License). Icons are Material Symbols (Apache-2.0), plus a custom table tennis glyph.

Sweatshot is an independent project, **not affiliated with, endorsed by or connected to Google or Fitbit**.
