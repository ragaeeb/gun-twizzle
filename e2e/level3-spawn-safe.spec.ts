import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

type DebugApi = {
    setPointerLockState?: (locked: boolean) => void;
};

type WindowWithDebug = Window & { __gtDebug?: DebugApi };

const waitForGameReady = async (page: Page) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    await page.waitForFunction(
        () => {
            const el = document.querySelector('.loading-screen');
            return !el || el.classList.contains('hidden');
        },
        { timeout: 30_000 },
    );

    await page.waitForTimeout(4_000);
};

const selectLevel = async (page: Page, levelName: string) => {
    const card = page.locator('.level-select-card', { hasText: levelName });
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await waitForGameReady(page);
};

const dismissTutorialAndUnpauseSinglePlayer = async (page: Page) => {
    const overlay = page.locator('#pointer-lock-overlay');
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await overlay.click({ force: true });
    await page.waitForTimeout(250);

    await page.waitForFunction(() => {
        const debug = (window as WindowWithDebug).__gtDebug;
        return Boolean(debug?.setPointerLockState);
    });

    await page.evaluate(() => {
        const overlayElement = document.getElementById('pointer-lock-overlay');
        overlayElement?.remove();
        const debug = (window as WindowWithDebug).__gtDebug;
        debug?.setPointerLockState?.(true);
    });
};

test.describe('Level 3 Spawn Safety', () => {
    test('The Facility does not immediately fail after tutorial dismissal', async ({ page }) => {
        await page.goto('/?e2e=1');
        await selectLevel(page, 'The Facility');
        await dismissTutorialAndUnpauseSinglePlayer(page);

        const healthText = page.locator('.health-text');
        await expect(healthText).toBeVisible();
        const startingHealth = Number.parseInt((await healthText.textContent()) ?? '0', 10);
        expect(startingHealth).toBeGreaterThanOrEqual(90);

        await page.waitForTimeout(3_000);

        await expect(page.getByRole('heading', { name: 'You Lost' })).toHaveCount(0);

        const endingHealth = Number.parseInt((await healthText.textContent()) ?? '0', 10);
        expect(endingHealth).toBeGreaterThanOrEqual(90);
    });
});
