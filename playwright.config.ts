import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: /.*\.spec\.ts/,
  timeout: 45000,
  fullyParallel: false,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173/Sito-di-vault-attivit-clan/',
    trace: process.env.CI ? 'on-first-retry' : 'off',
    video: 'off',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/Sito-di-vault-attivit-clan/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
    {
      name: 'mobile-iphone-se',
      use: {
        ...devices['iPhone SE'],
      },
    },
    {
      name: 'mobile-iphone-15',
      use: {
        ...devices['iPhone 15'],
      },
    },
    {
      name: 'tablet-ipad',
      use: {
        ...devices['iPad (gen 7)'],
      },
    },
    {
      name: 'mobile-android',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
