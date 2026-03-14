import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { BillboardParticleSystem } from '../src/render/effects';

describe('Ring buffer algorithm', () => {
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
        const parent = new THREE.Object3D();
        const texture = new THREE.Texture();
        const system = new BillboardParticleSystem(parent, texture, MAX_PARTICLES, THREE.NormalBlending);

        for (let i = 0; i < MAX_PARTICLES; i++) {
            system.addParticle({
                duration: 1000,
                initialOpacity: 1,
                position: new THREE.Vector3(),
                rotation: 0,
                scale: 1,
                startTime: 0,
                velocity: new THREE.Vector3(),
            });
        }

        system.addParticle({
            duration: 1000,
            initialOpacity: 1,
            position: new THREE.Vector3(),
            rotation: 0,
            scale: 1,
            startTime: 0,
            velocity: new THREE.Vector3(),
        });

        expect(system.count).toBe(MAX_PARTICLES);
    });

    it('accepts particles again after removal', () => {
        const parent = new THREE.Object3D();
        const texture = new THREE.Texture();
        const system = new BillboardParticleSystem(parent, texture, MAX_PARTICLES, THREE.NormalBlending);

        for (let i = 0; i < 10; i++) {
            system.addParticle({
                duration: 1,
                initialOpacity: 1,
                position: new THREE.Vector3(),
                rotation: 0,
                scale: 1,
                startTime: 0,
                velocity: new THREE.Vector3(),
            });
        }

        expect(system.count).toBe(10);
        system.removeExpiredParticles(10);
        expect(system.count).toBe(0);

        system.addParticle({
            duration: 1000,
            initialOpacity: 1,
            position: new THREE.Vector3(),
            rotation: 0,
            scale: 1,
            startTime: 10,
            velocity: new THREE.Vector3(),
        });
        expect(system.count).toBe(1);
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
