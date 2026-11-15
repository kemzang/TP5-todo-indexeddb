// Tests de mutation (npm run test:mutation) avec StrykerJS.
// Stryker modifie automatiquement src/db.js (mutants), relance les tests unitaires
// pour chacun, et verifie qu'au moins un test echoue (mutant "tue").
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.js' },
  mutate: ['src/db.js'],
  coverageAnalysis: 'perTest', // ne relance que les tests qui passent par la ligne mutee
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  // Score de mutation : >= 95 % vert, >= 85 % orange, < 90 % la commande echoue (et la CI).
  thresholds: { high: 95, low: 85, break: 90 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
