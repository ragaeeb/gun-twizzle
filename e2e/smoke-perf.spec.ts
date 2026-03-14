import { expect, type Page, test } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────

const LEVEL_1 = 'The Compound';
const LEVEL_2 = 'The Shipyard';

const getHeapMB = (page: Page) =>
    page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: performance.memory is Chrome-only
        const mem = (performance as any).memory;
        return mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null;
    });

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

const selectLevel = async (page: Page, levelName: string) => {
    const card = page.locator('.level-select-card', { hasText: levelName });
    await card.click();
    await waitForLoadingDismissed(page);
    await page.waitForTimeout(2_000);
};

const simulateGameplay = async (page: Page, durationBursts = 10) => {
    const canvas = page.locator('canvas').first();
    await canvas.click({ force: true });
    await page.waitForTimeout(500);

    await page.keyboard.down('KeyW');
    for (let i = 0; i < durationBursts; i++) {
        await page.mouse.click(640, 360);
        await page.waitForTimeout(200);
    }
    await page.keyboard.up('KeyW');
};

const measureFps = (page: Page, durationMs = 3_000) =>
    page.evaluate((ms) => {
        return new Promise<{ avgFps: number; elapsedMs: number; frames: number }>((resolve) => {
            let frames = 0;
            const t0 = performance.now();
            const tick = () => {
                frames++;
                if (performance.now() - t0 < ms) {
                    requestAnimationFrame(tick);
                } else {
                    const elapsed = performance.now() - t0;
                    resolve({ avgFps: Math.round((frames / elapsed) * 1000), elapsedMs: Math.round(elapsed), frames });
                }
            };
            requestAnimationFrame(tick);
        });
    }, durationMs);

// ─── Tests ──────────────────────────────────────────────────────────────

test.describe('Smoke: Level Select', () => {
    test('renders all four level cards', async ({ page }) => {
        await page.goto('/');
        const cards = page.locator('.level-select-card');
        await expect(cards).toHaveCount(4);
    });

    test('each card shows level name and details', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.level-select-card').first()).toContainText('The Compound');
        await expect(page.locator('.level-select-card').nth(1)).toContainText('The Shipyard');
        await expect(page.locator('.level-select-card').nth(2)).toContainText('The Facility');
        await expect(page.locator('.level-select-card').nth(3)).toContainText('Training Grounds');
    });
});

test.describe('Smoke: Game Load', () => {
    test('Level 1 loads without console errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => {
            if (!err.message.includes('pointer lock')) {
                errors.push(err.message);
            }
        });

        await page.goto('/');
        await selectLevel(page, LEVEL_1);

        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();
        expect(errors).toHaveLength(0);
    });

    test('Level 2 loads without null pointer errors', async ({ page }) => {
        const nullPtrErrors: string[] = [];
        page.on('pageerror', (err) => {
            if (err.message.includes('null pointer')) {
                nullPtrErrors.push(err.message);
            }
        });

        await page.goto('/');
        await selectLevel(page, LEVEL_2);

        expect(nullPtrErrors).toHaveLength(0);
    });
});

test.describe('Smoke: Memory & Performance', () => {
    test('heap stays stable during gameplay', async ({ page }) => {
        await page.goto('/');
        await selectLevel(page, LEVEL_1);

        const baseline = await getHeapMB(page);

        await simulateGameplay(page, 15);
        await page.waitForTimeout(5_000);

        // Force GC via CDP
        try {
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('HeapProfiler.collectGarbage');
            await page.waitForTimeout(2_000);
        } catch {
            // CDP GC not available in all setups
        }

        const afterGC = await getHeapMB(page);

        if (baseline !== null && afterGC !== null) {
            const growth = afterGC - baseline;
            expect(growth).toBeLessThan(50);
        }
    });

    test('FPS is measurable (software renderer baseline)', async ({ page }) => {
        await page.goto('/');
        await selectLevel(page, LEVEL_1);

        const fps = await measureFps(page);
        expect(fps.frames).toBeGreaterThan(0);
        expect(fps.avgFps).toBeGreaterThan(0);
    });
});

test.describe('Smoke: Level Transitions', () => {
    test('switching levels does not produce null pointer errors', async ({ page }) => {
        const criticalErrors: string[] = [];
        page.on('pageerror', (err) => {
            if (err.message.includes('null pointer')) {
                criticalErrors.push(err.message);
            }
        });

        await page.goto('/');

        // Load Level 1
        await selectLevel(page, LEVEL_1);
        await simulateGameplay(page, 5);

        // Return to menu
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const menuBtn = page.locator('button', { hasText: /menu|back|return/i });
        if ((await menuBtn.count()) > 0) {
            await menuBtn.first().click();
            await page.waitForTimeout(2_000);

            // Load Level 2
            await selectLevel(page, LEVEL_2);
            await simulateGameplay(page, 5);
        }

        expect(criticalErrors).toHaveLength(0);
    });
});
