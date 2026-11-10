import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60000, fullyParallel: false, workers: 1, reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 5'] } }, { name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run preview -- --port 4173', cwd: '<raiz-do-repositório>', port: 4173, reuseExistingServer: true, timeout: 60000, env: { VITE_USE_EMULATORS: 'true' } },
});
