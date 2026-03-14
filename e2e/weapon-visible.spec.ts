import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

const WEAPON_VIEW_CLIP = {
    height: 540,
    width: 600,
    x: 680,
    y: 180,
} as const;

type DebugApi = {
    getWeaponAnimations?: () => Array<{ name: string; duration: number }>;
    getWeaponTransform?: () => {
        currentWeaponId: string | null;
        position: [number, number, number];
        rotation: [number, number, number];
        scale: number;
    } | null;
    getPointerLockState?: () => boolean;
    poseWeaponClip?: (clipName: string, time?: number) => unknown;
    setPointerLockState?: (locked: boolean) => void;
    setWeapon?: (weaponId: string) => Promise<unknown> | unknown;
};

type WindowWithDebug = Window & { __gtDebug?: DebugApi };

const IDLE_CLIP_NAMES = {
    AK47: 'RIG_UE5_Comando_AK_Idle',
    Knife: 'allanims',
    Usp: 'Armature|Idle',
} as const;

type WeaponId = keyof typeof IDLE_CLIP_NAMES;

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

    await page.waitForFunction(() => Boolean((window as WindowWithDebug).__gtDebug?.setWeapon), null, {
        timeout: 30_000,
    });
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
    }

    await page.evaluate(() => {
        const overlay = document.getElementById('pointer-lock-overlay');
        if (overlay) {
            overlay.remove();
        }
    });
    await expect(page.locator('#pointer-lock-overlay')).toHaveCount(0);

    const canvas = page.locator('canvas').first();
    await canvas.click({ force: true });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
};

const waitForDebugApi = async (page: Page) => {
    await page.waitForFunction(() => {
        const debug = (window as WindowWithDebug).__gtDebug;
        return Boolean(debug?.setWeapon);
    });
};

const forcePointerLock = async (page: Page) => {
    await waitForDebugApi(page);
    await page.evaluate(() => {
        const debug = (window as WindowWithDebug).__gtDebug;
        debug?.setPointerLockState?.(true);
    });
    await page.waitForFunction(() => (window as WindowWithDebug).__gtDebug?.getPointerLockState?.() === true);
};

const waitForWeaponAnimations = async (page: Page) => {
    await waitForDebugApi(page);
    await page.waitForFunction(() => {
        const debug = (window as WindowWithDebug).__gtDebug;
        const animations = debug?.getWeaponAnimations?.();
        return Array.isArray(animations) && animations.length > 0;
    });
};

const setDebugWeapon = async (page: Page, weaponId: 'AK47' | 'Knife' | 'Usp') => {
    await waitForDebugApi(page);
    await page.evaluate(async (id) => {
        const debug = (window as WindowWithDebug).__gtDebug;
        await debug?.setWeapon?.(id);
    }, weaponId);
    await page.waitForFunction((id) => {
        const debug = (window as WindowWithDebug).__gtDebug;
        const state = debug?.getWeaponTransform?.();
        return state?.currentWeaponId === id;
    }, weaponId);
};

const freezeAtIdlePose = async (page: Page, weaponId: WeaponId) => {
    const clipName = IDLE_CLIP_NAMES[weaponId];
    if (!clipName) {
        throw new Error(`Missing idle clip for weapon: ${weaponId}`);
    }

    const posed = await page.evaluate(
        ([name]) => {
            const debug = (window as WindowWithDebug).__gtDebug;
            return debug?.poseWeaponClip?.(name, 0) ?? false;
        },
        [clipName],
    );
    expect(posed).toBe(true);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
};

test.describe('Weapon Model Visibility', () => {
    test('all weapon viewmodels are visible and facing forward', async ({ page }) => {
        await page.goto('/?e2e=1');
        await selectLevel(page, 'The Compound');
        await unlockShooterInput(page);
        await forcePointerLock(page);
        await waitForDebugApi(page);
        await waitForWeaponAnimations(page);

        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();

        await setDebugWeapon(page, 'Usp');
        await waitForWeaponAnimations(page);
        await freezeAtIdlePose(page, 'Usp');
        await expect(page).toHaveScreenshot('weapon-usp.png', {
            clip: WEAPON_VIEW_CLIP,
            maxDiffPixelRatio: 0.05,
        });

        await setDebugWeapon(page, 'AK47');
        await waitForWeaponAnimations(page);
        await expect(page.locator('.weapon-name')).toHaveText('AK-47');
        await freezeAtIdlePose(page, 'AK47');
        await expect(page).toHaveScreenshot('weapon-ak47.png', {
            clip: WEAPON_VIEW_CLIP,
            maxDiffPixelRatio: 0.05,
        });

        await setDebugWeapon(page, 'Knife');
        await waitForWeaponAnimations(page);
        await expect(page.locator('.weapon-name')).toHaveText('Knife');
        await freezeAtIdlePose(page, 'Knife');
        await expect(page).toHaveScreenshot('weapon-knife.png', {
            clip: WEAPON_VIEW_CLIP,
            maxDiffPixelRatio: 0.05,
        });
    });
});
