import type { Node } from 'cc';

export interface MovementObstacle {
    node: Node;
    offsetX: number;
    offsetY: number;
    radiusX: number;
    radiusY: number;
}
