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

const selectLevel = async (page: Page, levelName: string) => {
    const card = page.locator('.level-select-card', { hasText: levelName });
    await card.click();
    await waitForLoadingDismissed(page);
    await page.waitForTimeout(3_000);
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
        await page.waitForTimeout(500);

        await page.keyboard.down('KeyW');
        for (let i = 0; i < 20; i++) {
            await page.mouse.click(640, 360);
            await page.waitForTimeout(200);
        }
        await page.keyboard.up('KeyW');
        await page.waitForTimeout(10_000);

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
        await page.waitForTimeout(500);

        const menuBtn = page.locator('button', { hasText: /menu|back|return/i });
        await expect(menuBtn.first(), 'Expected a menu/back/return button after pressing Escape').toBeVisible();
        await menuBtn.first().click();
        await page.waitForTimeout(2_000);

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
