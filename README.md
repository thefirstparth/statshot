# Sweatshot

Sweatshot turns a Google Health workout export (`.tcx`) into a picture you can post: a story, a chat message, or a clear sticker to drop on your own photo. Google Health (Fitbit Air) shows your workouts but can't share one as an image; it can only export a TCX file. Sweatshot reads that file on your phone, lets you pick from eleven designs, and shares, copies or downloads a PNG in one tap.

**Live app:** https://statshot-five.vercel.app

## How to use it

1. **Export the workout.** In Google Health, open the workout, tap ⋯ → Export, and choose Save to Files.
2. **Open it.** Open Sweatshot, tap "Open workout file" and pick the file. Then tap the sport you played (the file only says "Other"). No file yet? Tap "Try a sample workout".
3. **Share it.** Swipe through the designs, tap "Numbers & look" to choose what's on the card, then Share (Save Image, Instagram, WhatsApp…), Copy, or Download.

Works with any TCX file (Garmin, Strava export, etc.).

Tip: add Sweatshot to your home screen (Share → Add to Home Screen). It works offline after the first visit.

## Privacy

Nothing is uploaded. Sweatshot is a static site with no backend, no analytics and no third-party requests: the file is read and drawn entirely on your device, and the production build ships a Content Security Policy that only allows same-origin resources. Only your display preferences (favourite designs, colours, resting heart rate and age for zones…) are saved, in your browser's local storage. The workout itself is never stored.

## The designs

Eleven designs: Summary, Hero number, Heart trace, Zones, Messages, Receipt, Editorial, Sticker pill, Widgets, Poster and Day dial. Star up to five favourites and they come first when you swipe; the rest stay one tap away under "Designs". Each design comes in light and dark, with a solid or clear (transparent) background, at Story (1080×1920), Post (1080×1350), Square (1080×1080) or just the card. Pick the numbers you want (duration, energy, average, peak and lowest heart rate, zone minutes, distance, time of day) in the order you want them, and add where you played.

## Heart-rate zones

Zones and zone minutes follow Google Health's heart-rate-reserve method: Light below 40 %, Moderate 40–59 %, Vigorous 60–84 % and Peak 85 % and above of (max − resting). Zone minutes count moderate minutes once and vigorous and peak minutes twice. Set your resting heart rate and age (and optionally your max heart rate, otherwise 220 − age) in Settings.

## Local development

Requires Node 20.19+ (or 22.12+).

```sh
npm ci            # install
npm run dev       # dev server on http://localhost:5173
npm test          # unit + render tests (Vitest, @napi-rs/canvas)
npm run build     # type-check and build to dist/
npm run preview   # serve the production build (service worker included)
```

Other scripts:

- `npm run fixtures` regenerates the synthetic TCX files in `tests/fixtures/` (deterministic).
- `npm run icons` regenerates the PWA icons in `public/` from the sweat-drop mark.
- `SWEATSHOT_PREVIEW=1 npm test` writes every rendered card to `tests/output/` so you can look at them.

Real exports for local testing go in `tests/fixtures/private/` (gitignored). If any `.tcx` file is there, `npm test` parses it and prints its stats.

Project layout: `src/tcx/` parses the file and derives stats, `src/render/` draws the cards with the Canvas 2D API (one file per design in `src/render/designs/`), `src/export/` handles share/copy/download, `src/state/` persists preferences, and `src/ui/` holds the Preact screens and sheets. Choices made beyond the original spec are listed in [DECISIONS.md](DECISIONS.md).

## Deploy your own

It's a static site: `npm run build` outputs `dist/`.

- **Vercel:** import the repository at vercel.com/new. The Vite preset is detected automatically (build `npm run build`, output `dist`); no configuration file is needed.
- **Anywhere else:** upload `dist/` to any static host (Netlify, Cloudflare Pages, GitHub Pages at a domain root, S3…). Serve it over HTTPS so the service worker and sharing work.

If you fork it, change the footer link in `src/config.ts`.

## License

[MIT](LICENSE). Fonts are bundled from Fontsource under the SIL Open Font License; icons are Material Symbols (Apache-2.0), plus a custom table tennis glyph.

Not affiliated with Google or Fitbit.
