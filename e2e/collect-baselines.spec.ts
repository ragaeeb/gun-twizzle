/**
 * Collects performance baselines for all three levels.
 * Run via: bun run test:baselines
 *
 * This is an expensive test — excluded from the default test:e2e suite.
 */
import { expect, type Page, test } from '@playwright/test';

import { LEVEL_1 } from '../src/content/levels/level1';
import { LEVEL_2 } from '../src/content/levels/level2';
import { LEVEL_3 } from '../src/content/levels/level3';
import { LEVEL_4 } from '../src/content/levels/level4';

const LEVELS = [LEVEL_1.name, LEVEL_2.name, LEVEL_3.name, LEVEL_4.name];

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
        throw new Error('Loading screen did not dismiss within 15s');
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
        const header = `| Metric | ${LEVELS.join(' | ')} |`;
        const divider = `|${['---', ...LEVELS.map(() => '---')].join('|')}|`;
        console.log(header);
        console.log(divider);

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

        const formatRow = (label: string, values: number[], formatter: (value: number) => string) =>
            `| ${label} | ${values.map((value) => formatter(value)).join(' | ')} |`;

        console.log(
            formatRow(
                'Frame time P50',
                LEVELS.map((name) => r(name).frameTimeP50),
                fmtMs,
            ),
        );
        console.log(
            formatRow(
                'Draw calls',
                LEVELS.map((name) => r(name).drawCalls),
                fmt,
            ),
        );
        console.log(
            formatRow(
                'Triangles',
                LEVELS.map((name) => r(name).triangles),
                fmt,
            ),
        );
        console.log(
            formatRow(
                'JS heap (MB)',
                LEVELS.map((name) => r(name).heapMB),
                fmt,
            ),
        );
        console.log(
            formatRow(
                'Geometries',
                LEVELS.map((name) => r(name).geometries),
                fmt,
            ),
        );
        console.log(
            formatRow(
                'Textures',
                LEVELS.map((name) => r(name).textures),
                fmt,
            ),
        );
        console.log(
            formatRow(
                'Programs',
                LEVELS.map((name) => r(name).programs),
                fmt,
            ),
        );

        // Collect sim profiling data from the last level loaded
        await page.goto('/');
        await selectLevel(page, LEVELS[LEVELS.length - 1]);
        await waitForRendererInfo(page);
        await page.waitForTimeout(15_000);

        const simProfile = await getSimProfile(page);
        console.log(`\n=== COMPONENTSTORE PROFILING (${LEVELS[LEVELS.length - 1]}) ===\n`);
        for (const [name, data] of Object.entries(simProfile)) {
            console.log(`| ${name} | avg: ${data.avg.toFixed(4)}ms | samples: ${data.count} |`);
        }

        expect(Object.keys(results)).toHaveLength(LEVELS.length);
    });
});
