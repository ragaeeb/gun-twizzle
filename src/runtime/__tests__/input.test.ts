/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';

import type { FpsCamera } from '../../render/scene';
import { InputController } from '../input';

const createCameraStub = (): FpsCamera =>
    ({
        moveOnMouseMove: vi.fn(),
    }) as unknown as FpsCamera;

describe('InputController', () => {
    it('resets latched input on pointer unlock', () => {
        const canvas = document.createElement('canvas');
        const camera = createCameraStub();
        const controller = new InputController(canvas, camera);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));

        expect(controller.isKeyDown('forward')).toBe(true);
        expect(controller.isMouseButtonPressed(0)).toBe(true);

        Object.defineProperty(document, 'pointerLockElement', {
            configurable: true,
            value: null,
        });
        document.dispatchEvent(new Event('pointerlockchange'));

        expect(controller.isKeyDown('forward')).toBe(false);
        expect(controller.isMouseButtonPressed(0)).toBe(false);

        controller.dispose();
    });

    it('resets latched input on window blur', () => {
        const canvas = document.createElement('canvas');
        const camera = createCameraStub();
        const controller = new InputController(canvas, camera);

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));

        window.dispatchEvent(new Event('blur'));

        expect(controller.isKeyDown('forward')).toBe(false);
        expect(controller.isMouseButtonPressed(0)).toBe(false);

        controller.dispose();
    });
});
