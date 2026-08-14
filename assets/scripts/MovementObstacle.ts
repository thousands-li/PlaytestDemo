import type { Node } from 'cc';

export type MovementObstacleShape = 'ellipse' | 'rectangle';

export interface MovementObstacle {
    node: Node;
    shape?: MovementObstacleShape;
    offsetX: number;
    offsetY: number;
    radiusX: number;
    radiusY: number;
}
