import type { LoadingState } from '../runtime/types';

type LoadingScreenProps = {
    state: LoadingState;
};

export function LoadingScreen({ state }: LoadingScreenProps) {
    return (
        <div className={`loading-screen ${state.visible ? 'visible' : 'hidden'}`}>
            <div className="loading-logo">Gun Twizzle</div>
            <div className="loading-text">Loading...</div>
            <div className="loading-progress">
                <div className="loading-progress-bar" style={{ width: `${state.progress}%` }} />
            </div>
            <div className="loading-status">{state.status}</div>
        </div>
    );
}
