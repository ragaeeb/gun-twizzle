/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { PointerLockOverlay } from '../PointerLockOverlay';

afterEach(cleanup);

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
});
