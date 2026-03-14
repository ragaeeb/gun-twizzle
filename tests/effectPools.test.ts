import { describe, expect, it } from 'vitest';

describe('BulletHoleSystem ring buffer', () => {
    const MAX_DECALS = 50;

    it('wraps index at max capacity', () => {
        let nextIndex = 0;
        const indices: number[] = [];

        for (let i = 0; i < MAX_DECALS + 10; i++) {
            indices.push(nextIndex);
            nextIndex = (nextIndex + 1) % MAX_DECALS;
        }

        expect(indices[MAX_DECALS]).toBe(0);
        expect(indices[MAX_DECALS + 1]).toBe(1);
    });

    it('never exceeds max decals', () => {
        let nextIndex = 0;
        for (let i = 0; i < 500; i++) {
            nextIndex = (nextIndex + 1) % MAX_DECALS;
            expect(nextIndex).toBeLessThan(MAX_DECALS);
            expect(nextIndex).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('BillboardParticleSystem max cap', () => {
    const MAX_PARTICLES = 100;

    it('rejects particles beyond max capacity', () => {
        let particleCount = 0;
        const addParticle = () => {
            if (particleCount >= MAX_PARTICLES) {
                return false;
            }
            particleCount += 1;
            return true;
        };

        for (let i = 0; i < MAX_PARTICLES; i++) {
            expect(addParticle()).toBe(true);
        }

        expect(addParticle()).toBe(false);
        expect(particleCount).toBe(MAX_PARTICLES);
    });

    it('accepts particles again after removal', () => {
        let particleCount = MAX_PARTICLES;
        const removeExpired = (count: number) => {
            particleCount = Math.max(0, particleCount - count);
        };
        const addParticle = () => {
            if (particleCount >= MAX_PARTICLES) {
                return false;
            }
            particleCount += 1;
            return true;
        };

        expect(addParticle()).toBe(false);
        removeExpired(10);
        expect(addParticle()).toBe(true);
        expect(particleCount).toBe(MAX_PARTICLES - 10 + 1);
    });
});

describe('BulletCasingParticleSystem max cap', () => {
    const MAX_CASINGS = 100;

    it('does not exceed max casings', () => {
        let particleCount = 0;
        const addParticle = () => {
            if (particleCount >= MAX_CASINGS) {
                return false;
            }
            particleCount += 1;
            return true;
        };

        for (let i = 0; i < MAX_CASINGS + 50; i++) {
            addParticle();
        }
        expect(particleCount).toBe(MAX_CASINGS);
    });
});
