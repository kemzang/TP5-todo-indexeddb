import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Terminal + rapport HTML (playwright-report/index.html)
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npx http-server . -p 4173 -s',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    // Capture d'ecran + trace (actions, DOM, reseau) consultables dans le rapport
    screenshot: 'on',
    trace: 'on',
  },
});
