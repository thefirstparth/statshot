import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { tablerIcons } from './build/icons-plugin.ts';

/**
 * Production-only Content Security Policy: everything comes from this origin, so the browser
 * itself refuses any attempt to load or send data elsewhere.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'statshot-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [
    preact(),
    tablerIcons(),
    csp(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        // woff2 only: every browser with service workers supports it. Manifest icons are added
        // by the plugin itself.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/apple-touch-icon.png'],
      },
      manifest: {
        name: 'Statshot',
        short_name: 'Statshot',
        description: 'Turn a workout export (.tcx) into a share image.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        theme_color: '#101114',
        background_color: '#101114',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{ name: 'file', accept: ['*/*', '.tcx', 'application/vnd.garmin.tcx+xml', 'application/xml', 'text/xml'] }],
          },
        },
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: ['es2022', 'safari16'],
  },
});
