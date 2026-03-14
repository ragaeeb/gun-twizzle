import { defineConfig } from '@playwright/test';

/**
 * Playwright config for expensive test suites (memory, soak, baselines).
 * Usage: bunx playwright test --config playwright.full.config.ts [file]
 */
export default defineConfig({
    forbidOnly: !!process.env.CI,

    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
    reporter: process.env.CI ? 'github' : 'list',
    retries: 0,
    testDir: './e2e',
    timeout: 300_000,

    use: {
        baseURL: 'http://localhost:5173',
        headless: true,
        launchOptions: {
            args: ['--enable-precise-memory-info', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
        },
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        viewport: { height: 720, width: 1280 },
    },

    webServer: {
        command: 'bun run dev',
        port: 5173,
        reuseExistingServer: true,
        timeout: 30_000,
    },
    workers: 1,
});
