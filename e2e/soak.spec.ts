import { expect, test } from '@playwright/test';

const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) {
        return Number.NaN;
    }
    const sorted = arr.toSorted((a, b) => a - b);
    const i = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[Math.max(0, i)];
};

test.describe('Sustained Performance', () => {
    test('frame time remains stable over 5 minutes', async ({ page }) => {
        test.setTimeout(420_000);

        await page.goto('/');

        const card = page.locator('.level-select-card', { hasText: 'The Compound' });
        await card.click();

        try {
            await page.waitForFunction(
                () => {
                    const el = document.querySelector('.loading-screen');
                    return !el || el.classList.contains('hidden');
                },
                { timeout: 15_000 },
            );
        } catch {
            console.warn('Loading screen did not auto-hide; forcing hidden state.');
            await page.evaluate(() => {
                const el = document.querySelector('.loading-screen');
                if (el) {
                    el.classList.remove('visible');
                    el.classList.add('hidden');
                }
            });
            await page.waitForFunction(
                () => {
                    const canvas = document.querySelector('canvas');
                    const el = document.querySelector('.loading-screen');
                    return Boolean(canvas) && (!el || el.classList.contains('hidden'));
                },
                { timeout: 5_000 },
            );
        }

        await page.waitForFunction(
            // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
            () => typeof (window as any).__FRAME_TIME_SAMPLES__ !== 'undefined',
            { timeout: 30_000 },
        );

        // Let the game stabilize for 30 seconds
        await page.waitForTimeout(30_000);

        const earlyFrameTimes: number[] = await page.evaluate(
            // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
            () => [...(window as any).__FRAME_TIME_SAMPLES__],
        );

        // Let the game run for 4 more minutes (240s)
        await page.waitForTimeout(240_000);

        const allFrameTimes: number[] = await page.evaluate(
            // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
            () => [...(window as any).__FRAME_TIME_SAMPLES__],
        );
        const lateFrameTimes = allFrameTimes.slice(earlyFrameTimes.length);

        expect(earlyFrameTimes.length, 'Early frame samples missing').toBeGreaterThan(0);
        expect(lateFrameTimes.length, 'Late frame samples missing').toBeGreaterThan(0);

        const earlyP50 = percentile(earlyFrameTimes, 50);
        const earlyP95 = percentile(earlyFrameTimes, 95);
        const earlyP99 = percentile(earlyFrameTimes, 99);
        const lateP50 = percentile(lateFrameTimes, 50);
        const lateP95 = percentile(lateFrameTimes, 95);
        const lateP99 = percentile(lateFrameTimes, 99);

        console.log('=== Frame Time Stability (5-minute soak) ===');
        console.log(
            `Early  — P50: ${earlyP50.toFixed(1)}ms, P95: ${earlyP95.toFixed(1)}ms, P99: ${earlyP99.toFixed(1)}ms`,
        );
        console.log(
            `Late   — P50: ${lateP50.toFixed(1)}ms, P95: ${lateP95.toFixed(1)}ms, P99: ${lateP99.toFixed(1)}ms`,
        );
        console.log(
            `Degradation — P50: ${(lateP50 - earlyP50).toFixed(1)}ms, P95: ${(lateP95 - earlyP95).toFixed(1)}ms`,
        );

        // SwiftShader (headless) runs well above 16.6ms so we cannot assert
        // absolute P50 < 16.6ms. Instead we assert stability: no degradation.
        const p50Degradation = lateP50 - earlyP50;
        const p95Degradation = lateP95 - earlyP95;

        expect(p95Degradation, 'P95 frame time degraded significantly').toBeLessThan(5);
        expect(p50Degradation, 'P50 frame time degraded significantly').toBeLessThan(5);
        expect(lateP99, 'P99 too high — possible GC pauses from memory leak').toBeLessThan(lateP50 * 3);
        expect(lateFrameTimes.length, 'Frame samples collected').toBeGreaterThan(0);
    });
});
