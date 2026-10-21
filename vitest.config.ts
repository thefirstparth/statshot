import { defineConfig } from 'vitest/config';
import { tablerIcons } from './build/icons-plugin.ts';

export default defineConfig({
  plugins: [tablerIcons()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 120_000,
  },
});
