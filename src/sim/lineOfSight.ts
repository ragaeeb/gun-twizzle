import type { WallDef } from '../content/levels/types';

type Point3 = { x: number; y: number; z: number };

const EPSILON = 1e-6;

const segmentIntersectsWall = (start: Point3, end: Point3, wall: WallDef): boolean => {
    const min = {
        x: wall.position.x - wall.size.width / 2,
        y: wall.position.y - wall.size.height / 2,
        z: wall.position.z - wall.size.depth / 2,
    };
    const max = {
        x: wall.position.x + wall.size.width / 2,
        y: wall.position.y + wall.size.height / 2,
        z: wall.position.z + wall.size.depth / 2,
    };

    let tMin = 0;
    let tMax = 1;

    for (const axis of ['x', 'y', 'z'] as const) {
        const delta = end[axis] - start[axis];
        if (Math.abs(delta) < EPSILON) {
            if (start[axis] < min[axis] || start[axis] > max[axis]) {
                return false;
            }
            continue;
        }

        const inverseDelta = 1 / delta;
        let entry = (min[axis] - start[axis]) * inverseDelta;
        let exit = (max[axis] - start[axis]) * inverseDelta;

        if (entry > exit) {
            [entry, exit] = [exit, entry];
        }

        tMin = Math.max(tMin, entry);
        tMax = Math.min(tMax, exit);
        if (tMin > tMax) {
            return false;
        }
    }

    return tMax >= EPSILON && tMin <= 1 - EPSILON;
};

export const hasLineOfSight = (start: Point3, end: Point3, walls: WallDef[]): boolean => {
    for (const wall of walls) {
        if (segmentIntersectsWall(start, end, wall)) {
            return false;
        }
    }

    return true;
};
