import type { AnimationClip, KeyframeTrack } from 'three';
import { AnimationUtils } from 'three';

const POSITION_TRACK_SUFFIX = '.position';
const POSITION_TRACK_NORMALIZATION_THRESHOLD = 10;

const cloneClips = (clips: readonly AnimationClip[] = []): AnimationClip[] => clips.map((clip) => clip.clone());

const normalizeTrackValues = (track: KeyframeTrack, scale: number) => {
    const { values } = track;
    if (!values) {
        return;
    }
    for (let index = 0; index < values.length; index += 1) {
        const current = values[index];
        if (current !== undefined) {
            values[index] = current / scale;
        }
    }
};

export const prepareWeaponAnimationClips = ({
    additiveClipNames,
    clipBased,
    clips,
    modelScale,
}: {
    additiveClipNames?: readonly string[];
    clipBased: boolean;
    clips?: readonly AnimationClip[];
    modelScale?: number;
}): AnimationClip[] => {
    const preparedClips = cloneClips(clips);
    const additiveClipNameSet = new Set(additiveClipNames ?? []);

    // Upscaled clip-based weapons need translation tracks compensated so bone motion
    // stays in the model's native space after the weapon mesh is scaled in view.
    if (clipBased && modelScale && modelScale > POSITION_TRACK_NORMALIZATION_THRESHOLD) {
        for (const clip of preparedClips) {
            for (const track of clip.tracks) {
                if (!track.name.endsWith(POSITION_TRACK_SUFFIX)) {
                    continue;
                }

                normalizeTrackValues(track, modelScale);
            }
        }
    }

    for (const clip of preparedClips) {
        if (!additiveClipNameSet.has(clip.name)) {
            continue;
        }

        AnimationUtils.makeClipAdditive(clip, 0, clip, 30);
    }

    return preparedClips;
};
