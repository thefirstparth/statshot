import { defineConfig } from 'vitest/config';
import { materialIcons } from './build/icons-plugin.ts';

export default defineConfig({
  plugins: [materialIcons()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 120_000,
  },
});
