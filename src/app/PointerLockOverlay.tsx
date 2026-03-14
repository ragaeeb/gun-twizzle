import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

import { audioService } from '../assets/audioService';

const CONTROL_GROUPS = [
    {
        items: [
            { action: 'Move', keys: 'W / A / S / D' },
            { action: 'Look', keys: 'Mouse' },
            { action: 'Jump', keys: 'Space' },
            { action: 'Sprint', keys: 'Shift' },
            { action: 'Crouch', keys: 'Ctrl / C' },
        ],
        title: 'Movement',
    },
    {
        items: [
            { action: 'Shoot / attack', keys: 'Left Click' },
            { action: 'Reload', keys: 'R' },
            { action: 'Switch weapons', keys: '1 / 2 / 3' },
            { action: 'Unlock cursor', keys: 'Esc' },
        ],
        title: 'Combat',
    },
] as const;

type PointerLockOverlayProps = {
    canvasRef?: RefObject<HTMLCanvasElement | null>;
};

export const PointerLockOverlay = ({ canvasRef }: PointerLockOverlayProps) => {
    const [isLocked, setIsLocked] = useState(
        () => typeof document !== 'undefined' && document.pointerLockElement != null,
    );

    useEffect(() => {
        const handler = () =>
            setIsLocked(
                canvasRef?.current
                    ? document.pointerLockElement === canvasRef.current
                    : document.pointerLockElement != null,
            );
        handler();
        document.addEventListener('pointerlockchange', handler);
        return () => document.removeEventListener('pointerlockchange', handler);
    }, [canvasRef]);

    if (isLocked) {
        return null;
    }

    const handleClick = () => {
        // Warm up audio context on user gesture
        audioService.warmup();
        // Request pointer lock on the canvas
        canvasRef?.current?.requestPointerLock();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label="Click to play"
            className="pointer-lock-overlay"
            id="pointer-lock-overlay"
        >
            <div className="pointer-lock-panel">
                <div className="pointer-lock-eyebrow">Mission Briefing</div>
                <div className="pointer-lock-title">Click to Play</div>
                <div className="pointer-lock-subtitle">
                    Lock the mouse into the game window, then use these controls to move, shoot, reload, and switch
                    weapons.
                </div>

                <div className="pointer-lock-grid">
                    {CONTROL_GROUPS.map((group) => (
                        <section key={group.title} className="pointer-lock-section">
                            <div className="pointer-lock-section-title">{group.title}</div>
                            <div className="pointer-lock-list">
                                {group.items.map((item) => (
                                    <div key={item.action} className="pointer-lock-row">
                                        <span className="pointer-lock-key">{item.keys}</span>
                                        <span className="pointer-lock-action">{item.action}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="pointer-lock-footer">Press Esc anytime to release the mouse and reopen this guide.</div>
            </div>
        </button>
    );
};
