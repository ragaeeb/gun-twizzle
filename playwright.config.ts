import { defineConfig } from '@playwright/test';

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
    testIgnore: [
        '**/memory-leak.spec.ts',
        '**/heap-stability.spec.ts',
        '**/soak.spec.ts',
        '**/collect-baselines.spec.ts',
    ],
    timeout: 120_000,

    use: {
        baseURL: 'http://localhost:5174',
        headless: true,
        launchOptions: {
            args: ['--enable-precise-memory-info', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
        },
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        viewport: { height: 720, width: 1280 },
    },

    webServer: {
        command: 'bun run dev --port 5174',
        port: 5174,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
    workers: 1,
});
