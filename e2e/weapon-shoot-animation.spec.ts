import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        let audioStartCount = 0;
        const originalStart = AudioBufferSourceNode.prototype.start;

        Object.defineProperty(window, '__audioStartCount', {
            configurable: true,
            get: () => audioStartCount,
        });

        AudioBufferSourceNode.prototype.start = function (...args) {
            audioStartCount += 1;
            return originalStart.apply(this, args);
        };
    });
});

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

const getCurrentAmmo = async (page: Page) => {
    const text = (await page.locator('.weapon-ammo-current').textContent()) ?? '0';
    return Number(text.trim());
};

const getAudioStartCount = async (page: Page) =>
    page.evaluate(() => (window as Window & { __audioStartCount?: number }).__audioStartCount ?? 0);

const unlockShooterInput = async (page: Page) => {
    const overlay = page.locator('#pointer-lock-overlay');
    if ((await overlay.count()) > 0) {
        await overlay.click({ force: true });
        await page.waitForTimeout(250);
    }

    await page.evaluate(() => {
        const overlay = document.getElementById('pointer-lock-overlay');
        if (overlay) {
            overlay.remove();
        }
    });
};

const fireShot = async (page: Page, unlockInput = true) => {
    const ammoBefore = await getCurrentAmmo(page);
    if (unlockInput) {
        await unlockShooterInput(page);
    }

    await page.evaluate(() => {
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });

    try {
        await page.waitForFunction(
            (before) => {
                const ammoText = document.querySelector('.weapon-ammo-current')?.textContent;
                return ammoText ? Number(ammoText.trim()) < before : false;
            },
            ammoBefore,
            { timeout: 1_500 },
        );
    } finally {
        await page.evaluate(() => {
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
        });
    }

    const ammoAfter = await getCurrentAmmo(page);
    if (ammoAfter >= ammoBefore) {
        throw new Error('Failed to fire a shot in the USP repro.');
    }
};

test.describe('USP Shoot Animation', () => {
    test('shooting uses the fire pose instead of a reload-like pose and still plays audio', async ({ page }) => {
        await page.goto('/?e2e=1');
        await selectLevel(page, 'The Compound');
        await unlockShooterInput(page);
        await page.waitForTimeout(150);
        const audioStartsBeforeShot = await getAudioStartCount(page);
        await fireShot(page, false);
        await expect.poll(() => getAudioStartCount(page)).toBeGreaterThan(audioStartsBeforeShot);
        await page.waitForTimeout(240);

        await expect(page).toHaveScreenshot('weapon-usp-shoot.png', {
            maxDiffPixelRatio: 0.3,
        });
    });
});
