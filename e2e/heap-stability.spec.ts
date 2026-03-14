import { expect, test } from '@playwright/test';

test('JS heap does not grow unboundedly during gameplay', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');

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
        await page.evaluate(() => {
            const el = document.querySelector('.loading-screen');
            if (el) {
                el.classList.remove('visible');
                el.classList.add('hidden');
            }
        });
    }

    await page.waitForTimeout(5_000);

    // Force GC and measure initial heap
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(1_000);
    const metrics1 = await cdp.send('Performance.getMetrics');
    const heapBefore = metrics1.metrics.find((m: { name: string }) => m.name === 'JSHeapUsedSize')?.value ?? 0;

    // Let the game run for 30 seconds
    await page.waitForTimeout(30_000);

    // Force GC and measure again
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(1_000);
    const metrics2 = await cdp.send('Performance.getMetrics');
    const heapAfter = metrics2.metrics.find((m: { name: string }) => m.name === 'JSHeapUsedSize')?.value ?? 0;

    const growthMB = (heapAfter - heapBefore) / (1024 * 1024);
    console.log(
        `Heap growth over 30s: ${growthMB.toFixed(2)} MB (${(heapBefore / 1e6).toFixed(1)} → ${(heapAfter / 1e6).toFixed(1)} MB)`,
    );

    expect(growthMB, 'JS heap leak detected').toBeLessThan(20);
});
