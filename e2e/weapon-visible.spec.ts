import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const WEAPON_VIEW_CLIP = {
    height: 540,
    width: 600,
    x: 680,
    y: 180,
} as const;

type DebugApi = {
    poseWeaponClip?: (clipName: string, time?: number) => unknown;
    setWeapon?: (weaponId: string) => Promise<unknown> | unknown;
};

type WindowWithDebug = Window & { __gtDebug?: DebugApi };

const IDLE_CLIP_NAMES: Record<string, string> = {
    AK47: 'RIG_UE5_Comando_AK_Idle',
    Knife: 'allanims',
    Usp: 'Armature|Idle',
};

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

    const canvas = page.locator('canvas').first();
    await canvas.click({ force: true });
    await page.waitForTimeout(150);
};

const waitForDebugApi = async (page: Page) => {
    await page.waitForFunction(() => {
        const debug = (window as WindowWithDebug).__gtDebug;
        return Boolean(debug?.setWeapon);
    });
};

const setDebugWeapon = async (page: Page, weaponId: 'AK47' | 'Knife' | 'Usp') => {
    await waitForDebugApi(page);
    await page.evaluate(async (id) => {
        const debug = (window as WindowWithDebug).__gtDebug;
        await debug?.setWeapon?.(id);
    }, weaponId);
    await page.waitForTimeout(500);
};

const freezeAtIdlePose = async (page: Page, weaponId: string) => {
    const clipName = IDLE_CLIP_NAMES[weaponId] ?? '';
    await page.evaluate(
        ([name]) => {
            const debug = (window as WindowWithDebug).__gtDebug;
            debug?.poseWeaponClip?.(name, 0);
        },
        [clipName],
    );
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    await page.waitForTimeout(300);
};

test.describe('Weapon Model Visibility', () => {
    test('all weapon viewmodels are visible and facing forward', async ({ page }) => {
        await page.goto('/?e2e=1');
        await selectLevel(page, 'The Compound');
        await unlockShooterInput(page);
        await waitForDebugApi(page);

        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();

        await freezeAtIdlePose(page, 'Usp');
        await expect(page).toHaveScreenshot('weapon-usp.png', {
            clip: WEAPON_VIEW_CLIP,
            maxDiffPixelRatio: 0.05,
        });

        await setDebugWeapon(page, 'AK47');
        await expect(page.locator('.weapon-name')).toHaveText('AK-47');
        await freezeAtIdlePose(page, 'AK47');
        await expect(page).toHaveScreenshot('weapon-ak47.png', {
            clip: WEAPON_VIEW_CLIP,
            maxDiffPixelRatio: 0.05,
        });

        await setDebugWeapon(page, 'Knife');
        await expect(page.locator('.weapon-name')).toHaveText('Knife');
        await freezeAtIdlePose(page, 'Knife');
        await expect(page).toHaveScreenshot('weapon-knife.png', {
            clip: WEAPON_VIEW_CLIP,
            maxDiffPixelRatio: 0.05,
        });
    });
});
