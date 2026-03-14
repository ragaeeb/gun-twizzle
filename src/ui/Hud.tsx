import type { HudState } from '../runtime/types';

type HudProps = {
    state: HudState;
};

export function Hud({ state }: HudProps) {
    const ammoRatio = state.magazineSize > 0 ? state.ammo / state.magazineSize : 1;
    const ammoColor = ammoRatio > 0.5 ? '#FFFFFF' : ammoRatio > 0.25 ? '#FFD700' : '#FF6B6B';
    const healthRatio = state.healthMax > 0 ? state.health / state.healthMax : 1;
    const healthColor = healthRatio > 0.6 ? '#44FF44' : healthRatio > 0.3 ? '#FFD700' : '#FF4444';

    return (
        <div className="hud">
            <div className="crosshair" aria-hidden="true">
                <span className="crosshair-line crosshair-left" />
                <span className="crosshair-line crosshair-right" />
                <span className="crosshair-line crosshair-top" />
                <span className="crosshair-line crosshair-bottom" />
            </div>

            {/* Health bar — bottom left */}
            <div className="health-hud" aria-live="polite">
                <div className="health-bar-bg">
                    <div
                        className="health-bar-fill"
                        style={{
                            backgroundColor: healthColor,
                            width: `${healthRatio * 100}%`,
                        }}
                    />
                </div>
                <div className="health-text" style={{ color: healthColor }}>
                    {Math.ceil(state.health)} HP
                </div>
            </div>

            {/* Mission objective — top center */}
            {state.missionText && (
                <div className="mission-hud" aria-live="polite">
                    {state.missionText}
                </div>
            )}

            <div className="weapon-hud" aria-live="polite">
                <img className="weapon-image" src={state.hudImage} alt={state.weaponName || 'Weapon'} />
                <div className="weapon-name">{state.weaponName}</div>
                <div className="weapon-ammo">
                    <span className="weapon-ammo-current" style={{ color: ammoColor }}>
                        {state.ammo}
                    </span>
                    <span className="weapon-ammo-separator">/</span>
                    <span className="weapon-ammo-total">{state.totalAmmo}</span>
                </div>
            </div>

            <div className={`reload-indicator ${state.isReloading ? 'visible' : ''}`} aria-hidden={!state.isReloading}>
                Reloading
            </div>
        </div>
    );
}
