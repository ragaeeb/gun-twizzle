export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const getHealthColor = (ratio: number): string =>
    ratio > 0.6 ? '#44FF44' : ratio > 0.3 ? '#FFD700' : '#FF4444';

export const getAmmoColor = (ratio: number): string => (ratio > 0.5 ? '#FFFFFF' : ratio > 0.25 ? '#FFD700' : '#FF6B6B');
