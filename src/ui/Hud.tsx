import type { HudState } from '../runtime/types';
import { clamp01, getAmmoColor, getHealthColor } from './utils/hudColorMapping';

type HudProps = {
    state: HudState;
};

export const computeAmmoRatio = (ammo: number, magazineSize: number): number =>
    magazineSize > 0 ? ammo / magazineSize : 1;

export function Hud({ state }: HudProps) {
    const ammoRatioRaw = computeAmmoRatio(state.ammo, state.magazineSize);
    const ammoRatio = clamp01(ammoRatioRaw);
    const ammoColor = getAmmoColor(ammoRatio);
    const healthRatioRaw = state.healthMax > 0 ? state.health / state.healthMax : 1;
    const healthRatio = clamp01(healthRatioRaw);
    const healthColor = getHealthColor(healthRatio);
    const healthDisplay = Math.max(0, Math.ceil(state.health));
    const hasAmmo = state.magazineSize > 0 || state.totalAmmo > 0;

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
                    {healthDisplay} HP
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
                {hasAmmo && (
                    <div className="weapon-ammo">
                        <span className="weapon-ammo-current" style={{ color: ammoColor }}>
                            {state.ammo}
                        </span>
                        <span className="weapon-ammo-separator">/</span>
                        <span className="weapon-ammo-total">{state.totalAmmo}</span>
                    </div>
                )}
            </div>

            <div className={`reload-indicator ${state.isReloading ? 'visible' : ''}`} aria-hidden={!state.isReloading}>
                Reloading
            </div>
        </div>
    );
}
