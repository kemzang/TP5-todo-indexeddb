import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    // Terminal + rapport HTML (reports/vitest/index.html)
    reporters: ['default', 'html'],
    outputFile: { html: 'reports/vitest/index.html' },

    // Couverture de code (npm run test:coverage) : quelles lignes/branches les tests executent.
    // Mesuree sur la couche donnees, celle que testent les tests unitaires.
    coverage: {
      provider: 'v8',
      include: ['src/db.js'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'reports/coverage',
      // En dessous de ces seuils, la commande echoue (et donc la CI).
      thresholds: { lines: 95, statements: 95, functions: 100, branches: 90 },
    },
  },
});
