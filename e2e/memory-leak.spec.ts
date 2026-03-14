import { expect, type Page, test } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────

const LEVEL_1 = 'The Compound';
const LEVEL_2 = 'The Shipyard';

const waitForLoadingDismissed = async (page: Page) => {
    await page.waitForFunction(
        () => {
            const el = document.querySelector('.loading-screen');
            return !el || el.classList.contains('hidden');
        },
        { timeout: 15_000 },
    );
};

const waitForFrames = async (page: Page, frameCount = 2) => {
    await page.evaluate(
        (frames) =>
            new Promise((resolve) => {
                let remaining = frames;
                const step = () => {
                    remaining -= 1;
                    if (remaining <= 0) {
                        resolve(null);
                        return;
                    }
                    requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            }),
        frameCount,
    );
};

const waitForRendererInfoStable = async (page: Page, stableForMs = 1000) => {
    await page.waitForFunction(
        ({ stableForMs }) => {
            // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
            const infoFn = (window as any).__THREE_RENDERER_INFO__;
            if (typeof infoFn !== 'function') {
                return false;
            }
            const info = infoFn();
            if (!info) {
                return false;
            }
            const now = performance.now();
            const key = '__gtRendererStable__';
            const state =
                // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
                (window as any)[key] ?? { last: info, lastChange: now };
            const changed =
                info.geometries !== state.last.geometries ||
                info.textures !== state.last.textures ||
                info.programs !== state.last.programs;
            if (changed) {
                state.last = info;
                state.lastChange = now;
                // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
                (window as any)[key] = state;
                return false;
            }
            // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
            (window as any)[key] = state;
            return now - state.lastChange >= stableForMs;
        },
        { timeout: 20_000 },
        { stableForMs },
    );
};

const selectLevel = async (page: Page, levelName: string) => {
    const card = page.locator('.level-select-card', { hasText: levelName });
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await waitForLoadingDismissed(page);
    await waitForFrames(page, 2);
};

const waitForGame = async (page: Page) => {
    await page.goto('/');
    await selectLevel(page, LEVEL_1);
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

const getRendererInfo = (page: Page): Promise<RendererInfo> =>
    // biome-ignore lint/suspicious/noExplicitAny: E2E window accessor
    page.evaluate(() => (window as any).__THREE_RENDERER_INFO__());

// ─── Tests ──────────────────────────────────────────────────────────────

test.describe('GPU Resource Leaks', () => {
    test('geometry count stabilizes after gameplay', async ({ page }) => {
        await waitForGame(page);
        await waitForRendererInfo(page);

        const baseline = await getRendererInfo(page);

        const canvas = page.locator('canvas').first();
        await canvas.click({ force: true });
        await page.waitForFunction(
            () => document.activeElement?.tagName === 'CANVAS' || document.pointerLockElement?.tagName === 'CANVAS',
        );

        await page.keyboard.down('KeyW');
        for (let i = 0; i < 20; i++) {
            await page.mouse.click(640, 360);
            await waitForFrames(page, 2);
        }
        await page.keyboard.up('KeyW');
        await waitForRendererInfoStable(page);

        const after = await getRendererInfo(page);

        const geometryGrowth = after.geometries - baseline.geometries;
        const textureGrowth = after.textures - baseline.textures;

        console.log(`Geometry: ${baseline.geometries} → ${after.geometries} (+${geometryGrowth})`);
        console.log(`Textures: ${baseline.textures} → ${after.textures} (+${textureGrowth})`);

        expect(geometryGrowth, 'Geometry leak detected').toBeLessThanOrEqual(50);
        expect(textureGrowth, 'Texture leak detected').toBeLessThanOrEqual(30);
    });

    test('level transition does not leak resources', async ({ page }) => {
        await waitForGame(page);
        await waitForRendererInfo(page);

        const afterLevel1 = await getRendererInfo(page);
        expect(afterLevel1.geometries).toBeGreaterThan(0);
        expect(afterLevel1.textures).toBeGreaterThan(0);

        console.log(`Level 1 — Geometries: ${afterLevel1.geometries}, Textures: ${afterLevel1.textures}`);

        // Return to menu via Escape → menu button
        await page.keyboard.press('Escape');

        const menuBtn = page.locator('button', { hasText: /menu|back|return/i });
        await expect(menuBtn.first(), 'Expected a menu/back/return button after pressing Escape').toBeVisible();
        await menuBtn.first().click();
        await expect(page.locator('.level-select-card').first()).toBeVisible({ timeout: 10_000 });

        // Load Level 2
        await selectLevel(page, LEVEL_2);
        await waitForRendererInfo(page);

        const afterLevel2 = await getRendererInfo(page);
        console.log(`Level 2 — Geometries: ${afterLevel2.geometries}, Textures: ${afterLevel2.textures}`);

        // Level 1's unique resources should be disposed; net count should not double
        expect(afterLevel2.geometries, 'Resources doubled after level switch').toBeLessThan(afterLevel1.geometries * 2);
        expect(afterLevel2.textures, 'Textures doubled after level switch').toBeLessThan(afterLevel1.textures * 2);
    });
});
