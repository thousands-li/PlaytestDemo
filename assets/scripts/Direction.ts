import { Vec3 } from 'cc';

export const DIRECTION_NAMES = ['000', '045', '090', '135', '180', '225', '270', '315'] as const;

export type Direction = typeof DIRECTION_NAMES[number];

export function getDirectionVector(direction: Direction) {
    const degrees = Number(direction);
    const angle = (90 - degrees) * Math.PI / 180;
    return new Vec3(Math.cos(angle), Math.sin(angle), 0);
}
