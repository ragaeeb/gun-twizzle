/**
 * Collects performance baselines for all three levels.
 * Run via: bun run test:baselines
 *
 * This is an expensive test — excluded from the default test:e2e suite.
 */
import { expect, type Page, test } from '@playwright/test';

const LEVELS = ['The Compound', 'The Shipyard', 'The Facility'];

const waitForLoadingDismissed = async (page: Page) => {
    try {
        await page.waitForFunction(
            () => {
                const el = document.querySelector('.loading-screen');
                return !el || el.classList.contains('hidden');
            },
            { timeout: 15_000 },
        );
    } catch {
        await page.evaluate(() => {
            const el = document.querySelector('.loading-screen');
            if (el) {
                el.classList.remove('visible');
                el.classList.add('hidden');
            }
        });
    }
};

const selectLevel = async (page: Page, name: string) => {
    const card = page.locator('.level-select-card', { hasText: name });
    await card.click();
    await waitForLoadingDismissed(page);
    await page.waitForTimeout(3_000);
};

const waitForRendererInfo = async (page: Page) => {
    await page.waitForFunction(
        // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
        () => typeof (window as any).__THREE_RENDERER_INFO__ === 'function',
        { timeout: 30_000 },
    );
};

type RendererInfo = {
    drawCalls: number;
    geometries: number;
    programs: number;
    textures: number;
    triangles: number;
};

type SimProfile = Record<string, { avg: number; count: number }>;

const getRendererInfo = (page: Page): Promise<RendererInfo> =>
    // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
    page.evaluate(() => (window as any).__THREE_RENDERER_INFO__());

const getSimProfile = (page: Page): Promise<SimProfile> =>
    page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
        const fn = (window as any).__SIM_PROFILE__;
        return fn ? fn() : {};
    });

const getHeapMB = async (page: Page): Promise<number> => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(500);
    const metrics = await cdp.send('Performance.getMetrics');
    const heap = metrics.metrics.find((m: { name: string }) => m.name === 'JSHeapUsedSize')?.value ?? 0;
    return Math.round(heap / (1024 * 1024));
};

const getFrameTimeP50 = async (page: Page): Promise<number> => {
    const samples: number[] = await page.evaluate(
        // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
        () => [...((window as any).__FRAME_TIME_SAMPLES__ || [])],
    );
    if (samples.length === 0) {
        return 0;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

test.describe('Baseline Collection', () => {
    test('collect baselines for all levels', async ({ page }) => {
        test.setTimeout(300_000);

        console.log('\n=== PERFORMANCE BASELINES ===\n');
        console.log('| Metric | Level 1 | Level 2 | Level 3 |');
        console.log('|--------|---------|---------|---------|');

        const results: Record<string, RendererInfo & { frameTimeP50: number; heapMB: number }> = {};

        for (const levelName of LEVELS) {
            await page.goto('/');
            await selectLevel(page, levelName);
            await waitForRendererInfo(page);

            // Simulate 15s of gameplay
            const canvas = page.locator('canvas').first();
            await canvas.click({ force: true });
            await page.waitForTimeout(500);
            await page.keyboard.down('KeyW');
            for (let i = 0; i < 10; i++) {
                await page.mouse.click(640, 360);
                await page.waitForTimeout(200);
            }
            await page.keyboard.up('KeyW');
            await page.waitForTimeout(10_000);

            const info = await getRendererInfo(page);
            const heapMB = await getHeapMB(page);
            const frameTimeP50 = await getFrameTimeP50(page);

            results[levelName] = { ...info, frameTimeP50, heapMB };

            // Return to menu
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            const menuBtn = page.locator('button', { hasText: /menu|back|return/i });
            if ((await menuBtn.count()) > 0) {
                await menuBtn.first().click();
                await page.waitForTimeout(2_000);
            }
        }

        const r = (name: string) => results[name];

        const fmt = (v: number) => String(v);
        const fmtMs = (v: number) => `${v.toFixed(1)}ms`;

        console.log(
            `| Frame time P50 | ${fmtMs(r(LEVELS[0]).frameTimeP50)} | ${fmtMs(r(LEVELS[1]).frameTimeP50)} | ${fmtMs(r(LEVELS[2]).frameTimeP50)} |`,
        );
        console.log(
            `| Draw calls | ${fmt(r(LEVELS[0]).drawCalls)} | ${fmt(r(LEVELS[1]).drawCalls)} | ${fmt(r(LEVELS[2]).drawCalls)} |`,
        );
        console.log(
            `| Triangles | ${fmt(r(LEVELS[0]).triangles)} | ${fmt(r(LEVELS[1]).triangles)} | ${fmt(r(LEVELS[2]).triangles)} |`,
        );
        console.log(
            `| JS heap (MB) | ${fmt(r(LEVELS[0]).heapMB)} | ${fmt(r(LEVELS[1]).heapMB)} | ${fmt(r(LEVELS[2]).heapMB)} |`,
        );
        console.log(
            `| Geometries | ${fmt(r(LEVELS[0]).geometries)} | ${fmt(r(LEVELS[1]).geometries)} | ${fmt(r(LEVELS[2]).geometries)} |`,
        );
        console.log(
            `| Textures | ${fmt(r(LEVELS[0]).textures)} | ${fmt(r(LEVELS[1]).textures)} | ${fmt(r(LEVELS[2]).textures)} |`,
        );
        console.log(
            `| Programs | ${fmt(r(LEVELS[0]).programs)} | ${fmt(r(LEVELS[1]).programs)} | ${fmt(r(LEVELS[2]).programs)} |`,
        );

        // Collect sim profiling data from the last level loaded
        await page.goto('/');
        await selectLevel(page, 'The Facility');
        await waitForRendererInfo(page);
        await page.waitForTimeout(15_000);

        const simProfile = await getSimProfile(page);
        console.log('\n=== COMPONENTSTORE PROFILING (Level 3) ===\n');
        for (const [name, data] of Object.entries(simProfile)) {
            console.log(`| ${name} | avg: ${data.avg.toFixed(4)}ms | samples: ${data.count} |`);
        }

        expect(Object.keys(results)).toHaveLength(3);
    });
});
