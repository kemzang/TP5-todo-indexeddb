import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    // Terminal + rapport HTML (reports/vitest/index.html)
    reporters: ['default', 'html'],
    outputFile: { html: 'reports/vitest/index.html' },
  },
});
