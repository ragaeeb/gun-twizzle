/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App';

vi.mock('../../ui/LevelSelect', () => ({
    LevelSelect: ({
        levels,
        onSelect,
    }: {
        levels: Array<{ id: string; name: string }>;
        onSelect: (level: unknown) => void;
    }) => (
        <button type="button" onClick={() => onSelect(levels[0])}>
            Start {levels[0]?.name}
        </button>
    ),
}));

vi.mock('../GameSession', () => ({
    GameSession: ({
        onMissionComplete,
        onPlayerDefeated,
    }: {
        onMissionComplete: () => void;
        onPlayerDefeated: () => void;
    }) => (
        <div>
            <button type="button" onClick={onMissionComplete}>
                Win Mission
            </button>
            <button type="button" onClick={onPlayerDefeated}>
                Lose Mission
            </button>
        </div>
    ),
}));

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('App', () => {
    it('shows the loss screen and returns to the main menu after defeat', () => {
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: /start the compound/i }));
        fireEvent.click(screen.getByRole('button', { name: /lose mission/i }));

        expect(screen.getByRole('heading', { name: 'You Lost' })).toBeDefined();
        expect(screen.getByRole('button', { name: /return to main menu/i })).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: /return to main menu/i }));

        expect(screen.getByRole('button', { name: /start the compound/i })).toBeDefined();
    });
});
