import { expect, type Page, test } from '@playwright/test';

const VIEW_CLIP = {
    height: 540,
    width: 600,
    x: 680,
    y: 180,
} as const;

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
        document.getElementById('pointer-lock-overlay')?.remove();
    });

    await page.locator('canvas').first().click({ force: true });
    await page.waitForTimeout(150);
};

const setWeapon = async (page: Page, weaponId: 'AK47' | 'Knife' | 'Usp') => {
    await page.waitForFunction(() => Boolean((window as Window & { __gtDebug?: unknown }).__gtDebug));
    await page.evaluate(async (id) => {
        const debug = (
            window as Window & {
                __gtDebug?: { setWeapon?: (weaponId: string) => Promise<unknown> | unknown };
            }
        ).__gtDebug;
        await debug?.setWeapon?.(id);
    }, weaponId);
    await page.waitForTimeout(150);
};

const poseClip = async (page: Page, clipName: string, time: number) => {
    await page.evaluate(
        ({ clipName: nextClipName, time: nextTime }) => {
            const debug = (
                window as Window & {
                    __gtDebug?: {
                        poseWeaponClip?: (clipName: string, time?: number) => boolean;
                    };
                }
            ).__gtDebug;
            debug?.poseWeaponClip?.(nextClipName, nextTime);
        },
        { clipName, time },
    );
    await page.waitForTimeout(100);
};

const setTransform = async (
    page: Page,
    transform: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: number;
    },
) => {
    await page.evaluate((nextTransform) => {
        const debug = (
            window as Window & {
                __gtDebug?: {
                    setWeaponTransform?: (transform: {
                        position?: [number, number, number];
                        rotation?: [number, number, number];
                        scale?: number;
                    }) => void;
                };
            }
        ).__gtDebug;
        debug?.setWeaponTransform?.(nextTransform);
    }, transform);
    await page.waitForTimeout(100);
};

test.describe.configure({ timeout: 120_000 });

test('inspect AK and knife forward stances', async ({ page }) => {
    await page.goto('/?e2e=1');
    await selectLevel(page, 'The Compound');
    await unlockShooterInput(page);

    await setWeapon(page, 'AK47');
    const akCandidates = [
        ['RIG_UE5_Comando_AK_Hold', 0.1],
        ['RIG_UE5_Comando_AK_Idle', 0.1],
        ['RIG_UE5_Comando_AK_Idle_Aim', 0.1],
        ['RIG_UE5_Comando_AK_Walk_Aim', 0.1],
        ['RIG_UE5_Comando_AK_Aim_Fire', 0.15],
    ] as const;

    for (const [clipName, time] of akCandidates) {
        await poseClip(page, clipName, time);
        await page.screenshot({
            clip: VIEW_CLIP,
            path: `/tmp/${clipName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`,
        });
    }

    const akTransformCandidates = [
        {
            name: 'ak-forward-c0',
            transform: {
                position: [0.25, -0.45, -0.55] as [number, number, number],
                rotation: [0.1, Math.PI / 2, 0.12] as [number, number, number],
                scale: 0.34,
            },
        },
        {
            name: 'ak-forward-c1',
            transform: {
                position: [0.16, -0.24, -0.46] as [number, number, number],
                rotation: [0.08, Math.PI - 0.1, 0.1] as [number, number, number],
                scale: 0.18,
            },
        },
        {
            name: 'ak-forward-c2',
            transform: {
                position: [0.22, -0.3, -0.5] as [number, number, number],
                rotation: [0.14, Math.PI - 0.18, 0.18] as [number, number, number],
                scale: 0.22,
            },
        },
        {
            name: 'ak-forward-c3',
            transform: {
                position: [0.1, -0.18, -0.42] as [number, number, number],
                rotation: [0.06, Math.PI - 0.06, 0.08] as [number, number, number],
                scale: 0.17,
            },
        },
        {
            name: 'ak-forward-c4',
            transform: {
                position: [0.32, -0.35, -0.55] as [number, number, number],
                rotation: [0.3, Math.PI / 2, 0.45] as [number, number, number],
                scale: 0.34,
            },
        },
        {
            name: 'ak-forward-c5',
            transform: {
                position: [0.35, -0.28, -0.58] as [number, number, number],
                rotation: [0.4, 1.8, 0.5] as [number, number, number],
                scale: 0.34,
            },
        },
        {
            name: 'ak-forward-c6',
            transform: {
                position: [0.28, -0.3, -0.52] as [number, number, number],
                rotation: [0.25, 1.35, 0.6] as [number, number, number],
                scale: 0.34,
            },
        },
        {
            name: 'ak-forward-c7',
            transform: {
                position: [0.38, -0.38, -0.62] as [number, number, number],
                rotation: [0.15, 1.9, 0.25] as [number, number, number],
                scale: 0.32,
            },
        },
    ] as const;

    await poseClip(page, 'RIG_UE5_Comando_AK_Idle_Aim', 0.1);
    for (const candidate of akTransformCandidates) {
        await setTransform(page, candidate.transform);
        await page.screenshot({
            clip: VIEW_CLIP,
            path: `/tmp/${candidate.name}.png`,
        });
    }

    await setWeapon(page, 'Knife');
    const knifeTimes = [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4] as const;
    for (const time of knifeTimes) {
        await poseClip(page, 'allanims', time);
        await page.screenshot({
            clip: VIEW_CLIP,
            path: `/tmp/knife-allanims-${String(time).replace('.', '_')}.png`,
        });
    }

    const knifeTransformCandidates = [
        {
            name: 'knife-forward-c1',
            time: 0,
            transform: {
                position: [0.18, -0.2, -0.28] as [number, number, number],
                rotation: [0, Math.PI - 0.2, 0.25] as [number, number, number],
                scale: 0.007,
            },
        },
        {
            name: 'knife-forward-c2',
            time: 4.4,
            transform: {
                position: [0.24, -0.24, -0.32] as [number, number, number],
                rotation: [0.1, Math.PI - 0.3, 0.35] as [number, number, number],
                scale: 0.0065,
            },
        },
        {
            name: 'knife-forward-c3',
            time: 4.4,
            transform: {
                position: [0.12, -0.18, -0.24] as [number, number, number],
                rotation: [-0.08, Math.PI - 0.1, 0.2] as [number, number, number],
                scale: 0.006,
            },
        },
        {
            name: 'knife-forward-c4',
            time: 0,
            transform: {
                position: [0.22, -0.1, -0.5] as [number, number, number],
                rotation: [0.18, -Math.PI / 2, 1] as [number, number, number],
                scale: 0.008,
            },
        },
        {
            name: 'knife-forward-c5',
            time: 0,
            transform: {
                position: [0.35, -0.22, -0.42] as [number, number, number],
                rotation: [0.25, -1.35, 0.5] as [number, number, number],
                scale: 0.008,
            },
        },
        {
            name: 'knife-forward-c6',
            time: 0,
            transform: {
                position: [0.4, -0.25, -0.45] as [number, number, number],
                rotation: [0.5, -1.25, 0.2] as [number, number, number],
                scale: 0.009,
            },
        },
        {
            name: 'knife-forward-c7',
            time: 0,
            transform: {
                position: [0.32, -0.25, -0.45] as [number, number, number],
                rotation: [0.3, -1.7, 0.2] as [number, number, number],
                scale: 0.007,
            },
        },
        {
            name: 'knife-forward-c8',
            time: 4.4,
            transform: {
                position: [0.34, -0.18, -0.4] as [number, number, number],
                rotation: [0.2, -1.5, 0.6] as [number, number, number],
                scale: 0.007,
            },
        },
    ] as const;

    for (const candidate of knifeTransformCandidates) {
        await poseClip(page, 'allanims', candidate.time);
        await setTransform(page, candidate.transform);
        await page.screenshot({
            clip: VIEW_CLIP,
            path: `/tmp/${candidate.name}.png`,
        });
    }
});
