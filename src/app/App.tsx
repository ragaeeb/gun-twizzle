import { useCallback, useState } from 'react';

import { LEVEL_1 } from '../content/levels/level1';
import { LEVEL_2 } from '../content/levels/level2';
import { LEVEL_3 } from '../content/levels/level3';
import { LEVEL_4 } from '../content/levels/level4';
import type { LevelDef } from '../content/levels/types';
import { LevelSelect } from '../ui/LevelSelect';
import { ErrorBoundary } from './ErrorBoundary';
import { GameSession } from './GameSession';

type GamePhase = 'menu' | 'playing' | 'complete' | 'failed';

type EndScreenProps = {
    buttonLabel: string;
    className: string;
    subtitle?: string;
    title: string;
    onReturn: () => void;
};

const EndScreen = ({ buttonLabel, className, subtitle, title, onReturn }: EndScreenProps) => (
    <div className={className}>
        <h1 className={`${className}-title`}>{title}</h1>
        {subtitle ? <p className={`${className}-subtitle`}>{subtitle}</p> : null}
        <button type="button" className={`${className}-btn`} onClick={onReturn}>
            {buttonLabel}
        </button>
    </div>
);

const ALL_LEVELS: LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];

export const App = () => {
    const [phase, setPhase] = useState<GamePhase>('menu');
    const [selectedLevel, setSelectedLevel] = useState<LevelDef | null>(null);

    const handleLevelSelect = useCallback((level: LevelDef) => {
        setSelectedLevel(level);
        setPhase('playing');
    }, []);

    const handleMissionComplete = useCallback(() => {
        document.exitPointerLock?.();
        setPhase('complete');
    }, []);

    const handlePlayerDefeated = useCallback(() => {
        document.exitPointerLock?.();
        setPhase('failed');
    }, []);

    const handleReturnToMenu = useCallback(() => {
        document.exitPointerLock?.();
        setSelectedLevel(null);
        setPhase('menu');
    }, []);

    if (phase === 'menu') {
        return (
            <ErrorBoundary
                fallback={
                    <div className="error-screen">
                        <h1>Something went wrong</h1>
                        <p>Please refresh the page to try again.</p>
                    </div>
                }
            >
                <LevelSelect levels={ALL_LEVELS} onSelect={handleLevelSelect} />
            </ErrorBoundary>
        );
    }

    if (phase === 'complete') {
        return (
            <EndScreen
                buttonLabel="Return to Level Select"
                className="mission-complete-screen"
                onReturn={handleReturnToMenu}
                subtitle={selectedLevel?.name}
                title="Mission Complete"
            />
        );
    }

    if (phase === 'failed') {
        return (
            <EndScreen
                buttonLabel="Return to Main Menu"
                className="mission-failed-screen"
                onReturn={handleReturnToMenu}
                subtitle={selectedLevel?.name}
                title="You Lost"
            />
        );
    }

    if (!selectedLevel) {
        return null;
    }

    return (
        <ErrorBoundary
            fallback={
                <div className="error-screen">
                    <h1>Something went wrong</h1>
                    <p>Please refresh the page to try again.</p>
                </div>
            }
        >
            <GameSession
                key={selectedLevel.id}
                levelDef={selectedLevel}
                onMissionComplete={handleMissionComplete}
                onPlayerDefeated={handlePlayerDefeated}
            />
        </ErrorBoundary>
    );
};
