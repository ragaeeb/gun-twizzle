import { AnimationClip, NumberKeyframeTrack, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';

import { prepareWeaponAnimationClips } from '../weaponAnimationClips';

const createClip = () =>
    new AnimationClip('firstperson_idle', 1, [
        new VectorKeyframeTrack('rootJoint.position', [0, 1], [3, 6, 9, 12, 15, 18]),
        new QuaternionKeyframeTrack('rootJoint.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.5, 0, 0.866]),
        new NumberKeyframeTrack('slide.scale[x]', [0, 1], [1, 1.25]),
    ]);

const roundValues = (values: ArrayLike<number>) => Array.from(values, (value) => Number(value.toFixed(3)));

describe('prepareWeaponAnimationClips', () => {
    it('clones clips and compensates position tracks for upscaled clip-based weapons', () => {
        const sourceClip = createClip();

        const prepared = prepareWeaponAnimationClips({
            clipBased: true,
            clips: [sourceClip],
            modelScale: 250,
        });

        const clip = prepared[0];
        if (!clip) {
            throw new Error('Expected a prepared clip.');
        }
        const [track0, track1, track2] = clip.tracks;
        if (!track0 || !track1 || !track2) {
            throw new Error('Expected prepared clip tracks.');
        }
        const sourceTrack0 = sourceClip.tracks[0];
        if (!sourceTrack0) {
            throw new Error('Expected source clip track.');
        }
        expect(prepared).toHaveLength(1);
        expect(clip).not.toBe(sourceClip);
        expect(roundValues(track0.values)).toEqual([0.012, 0.024, 0.036, 0.048, 0.06, 0.072]);
        expect(roundValues(track1.values)).toEqual([0, 0, 0, 1, 0, 0.5, 0, 0.866]);
        expect(roundValues(track2.values)).toEqual([1, 1.25]);
        expect(roundValues(sourceTrack0.values)).toEqual([3, 6, 9, 12, 15, 18]);
    });

    it('leaves position tracks unchanged when the model is not upscaled', () => {
        const sourceClip = createClip();

        const prepared = prepareWeaponAnimationClips({
            additiveClipNames: [],
            clipBased: true,
            clips: [sourceClip],
            modelScale: 0.05,
        });

        const clip = prepared[0];
        if (!clip || !clip.tracks[0]) {
            throw new Error('Expected prepared clip track.');
        }
        expect(Array.from(clip.tracks[0].values)).toEqual([3, 6, 9, 12, 15, 18]);
    });

    it('leaves marker-based clips unchanged', () => {
        const sourceClip = createClip();

        const prepared = prepareWeaponAnimationClips({
            additiveClipNames: [],
            clipBased: false,
            clips: [sourceClip],
            modelScale: 250,
        });

        const clip = prepared[0];
        if (!clip || !clip.tracks[0]) {
            throw new Error('Expected prepared clip track.');
        }
        expect(Array.from(clip.tracks[0].values)).toEqual([3, 6, 9, 12, 15, 18]);
    });

    it('converts configured clips to additive relative motion', () => {
        const sourceClip = createClip();

        const prepared = prepareWeaponAnimationClips({
            additiveClipNames: ['firstperson_idle'],
            clipBased: true,
            clips: [sourceClip],
            modelScale: 1.3,
        });

        const clip = prepared[0];
        const track0 = clip?.tracks[0];
        const sourceTrack0 = sourceClip.tracks[0];
        if (!track0 || !sourceTrack0) {
            throw new Error('Expected clip tracks.');
        }
        expect(roundValues(track0.values)).toEqual([0, 0, 0, 9, 9, 9]);
        expect(roundValues(sourceTrack0.values)).toEqual([3, 6, 9, 12, 15, 18]);
    });
});
