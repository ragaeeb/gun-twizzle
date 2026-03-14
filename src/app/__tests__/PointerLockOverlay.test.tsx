/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RefObject } from 'react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { audioService } from '../../assets/audioService';
import { PointerLockOverlay } from '../PointerLockOverlay';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('PointerLockOverlay', () => {
    it('shows the core movement and combat controls', () => {
        const canvasRef = createRef<HTMLCanvasElement>();
        render(<PointerLockOverlay canvasRef={canvasRef} />);

        expect(screen.getByText('Mission Briefing')).toBeDefined();
        expect(screen.getByText('W / A / S / D')).toBeDefined();
        expect(screen.getByText('Left Click')).toBeDefined();
        expect(screen.getByText('1 / 2 / 3')).toBeDefined();
        expect(screen.getByText('R')).toBeDefined();
        expect(screen.getByText(/Press Esc anytime/i)).toBeDefined();
    });

    it('requests pointer lock when clicking the CTA', () => {
        const requestPointerLock = vi.fn();
        const canvas = document.createElement('canvas');
        canvas.requestPointerLock = requestPointerLock;
        const canvasRef = { current: canvas } as RefObject<HTMLCanvasElement>;

        const warmupSpy = vi.spyOn(audioService, 'warmup').mockImplementation(() => {});
        render(<PointerLockOverlay canvasRef={canvasRef} />);

        fireEvent.click(screen.getByRole('button', { name: /click to play/i }));

        expect(requestPointerLock).toHaveBeenCalled();
        expect(warmupSpy).toHaveBeenCalled();
    });
});
