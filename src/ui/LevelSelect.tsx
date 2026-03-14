import type { LevelDef } from '../content/levels/types';

type LevelSelectProps = {
    levels: LevelDef[];
    onSelect: (level: LevelDef) => void;
};

export function LevelSelect({ levels, onSelect }: LevelSelectProps) {
    return (
        <div className="level-select">
            <h1 className="level-select-title">GUN TWIZZLE</h1>
            <p className="level-select-subtitle">Select a Mission</p>
            <div className="level-select-grid">
                {levels.map((level, index) => (
                    <button key={level.id} type="button" className="level-select-card" onClick={() => onSelect(level)}>
                        <span className="level-select-number">Level {index + 1}</span>
                        <span className="level-select-name">{level.name}</span>
                        <span className="level-select-detail">
                            {level.enemies.length} enemies · {level.missions.length} objective
                            {level.missions.length > 1 ? 's' : ''}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
