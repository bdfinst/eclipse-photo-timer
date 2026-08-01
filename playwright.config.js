import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Some CI/sandboxed environments pre-provision a chromium binary at a fixed
// path instead of the revision this project's Playwright version expects.
// Prefer it when present so tests don't try to download a new browser.
const preinstalledChromium = '/opt/pw-browsers/chromium'
const executablePath = fs.existsSync(preinstalledChromium) ? preinstalledChromium : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
})
