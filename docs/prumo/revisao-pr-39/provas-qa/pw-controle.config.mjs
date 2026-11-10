import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e39', timeout: 40000, fullyParallel: false, workers: 1, reporter: 'list',
  outputDir: './pw-out',
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 5'] } }, { name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
});
