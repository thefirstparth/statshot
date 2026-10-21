# Statshot

Statshot turns a workout export file (`.tcx`) into a good-looking share image for Instagram Stories, WhatsApp and the rest. Google Health (Fitbit Air) shows your workouts but can't share one as an image; it can only export a TCX file. Statshot reads that file in your browser, lets you pick from eight card designs, tweak them a little, and share or copy a PNG in one tap.

**Live app:** https://statshot.example.com <!-- replace with your deployment URL -->

## How to use it

1. **Export the workout.** In Google Health, open the workout, tap ⋯ → Export, and choose Save to Files.
2. **Import it.** Open Statshot, tap "Import workout file" and pick the file. Then choose the sport (the file only says "Other").
3. **Share it.** Swipe through the designs, tap Customize if you like, then Share (Save Image, Instagram, WhatsApp…) or Copy and paste it into your story as a sticker.

Works with any TCX file (Garmin, Strava export, etc.).

Tip: add Statshot to your home screen (Share → Add to Home Screen). It works offline after the first visit.

## Privacy

Nothing is uploaded. Statshot is a static site with no backend, no analytics and no third-party requests: the file is read and drawn entirely on your device, and the production build ships a Content Security Policy that only allows same-origin resources. Only your display preferences (design, colours, age for heart-rate zones…) are saved, in your browser's local storage. The workout itself is never stored.

## Screenshots

<!-- Add screenshots here, e.g. docs/screenshot-carousel.png and docs/screenshot-cards.png -->

| Carousel | Designs |
| --- | --- |
| _screenshot placeholder_ | _screenshot placeholder_ |

## The designs

Glass, Midnight, Block, Receipt, Editorial, Messages, Pulse (heart-rate curve) and Zones (estimated time in heart-rate zones; needs your age or max heart rate in Settings). Each comes in light and dark, with a transparent or solid background, at Story (1080×1920), Post (1080×1350), Square (1080×1080) or Sticker size (just the card, best with a transparent background).

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
- `npm run icons` regenerates the PWA icons in `public/` from the logo glyph.
- `STATSHOT_PREVIEW=1 npm test` writes every rendered card to `tests/output/` so you can look at them.

Real exports for local testing go in `tests/fixtures/private/` (gitignored). If any `.tcx` file is there, `npm test` parses it and prints its stats.

Project layout: `src/tcx/` parses the file and derives stats, `src/render/` draws the cards with the Canvas 2D API (one file per design in `src/render/designs/`), `src/export/` handles share/copy/download, `src/state/` persists preferences, and `src/ui/` holds the Preact screens and sheets. Choices made beyond the original spec are listed in [DECISIONS.md](DECISIONS.md).

## Deploy your own

It's a static site: `npm run build` outputs `dist/`.

- **Vercel:** import the repository at vercel.com/new. The Vite preset is detected automatically (build `npm run build`, output `dist`); no configuration file is needed.
- **Anywhere else:** upload `dist/` to any static host (Netlify, Cloudflare Pages, GitHub Pages at a domain root, S3…). Serve it over HTTPS so the service worker and sharing work.

If you fork it, change the footer link in `src/config.ts`.

## License

[MIT](LICENSE). Fonts are bundled from Fontsource under the SIL Open Font License; icons are from Tabler Icons (MIT).

Not affiliated with Google or Fitbit.
