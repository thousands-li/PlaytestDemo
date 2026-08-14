import { Node, UITransform, Vec2, Vec3 } from 'cc';
import { DIRECTION_NAMES, type Direction } from './Direction';
import type { MovementObstacle } from './MovementObstacle';

export interface PlayerMovementActor {
    play(name: string): void;
}

export interface PlayerMovementConfig {
    playerNode: Node | null;
    playerActor: PlayerMovementActor | null;
    currentDirection: Direction;
    speed: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    walkableBoundaryNode: Node | null;
    movementObstacles: MovementObstacle[];
    collisionFootInsetRatio: number;
    collisionRadiusX: number;
    collisionRadiusY: number;
}

export interface PlayerMovementCallbacks {
    getMoveDirection(): Vec2;
    setDirection(direction: Direction): void;
}

export class PlayerMovementSystem {
    private readonly boundaryPoints: Vec3[] = [];
    private readonly tempPoint = new Vec3();
    private readonly closestPoint = new Vec3();
    private readonly resolvedPosition = new Vec3();
    private readonly collisionPoint = new Vec3();
    private readonly obstacleCenter = new Vec3();
    private readonly obstacleWorldPoint = new Vec3();
    private readonly collisionOffset = new Vec2();

    public constructor(
        private readonly getConfig: () => PlayerMovementConfig,
        private readonly callbacks: PlayerMovementCallbacks,
    ) {}

    public update(dt: number) {
        const config = this.getConfig();
        const playerNode = config.playerNode;
        const playerActor = config.playerActor;
        if (!playerNode?.isValid || !playerActor) {
            return;
        }

        const dir = this.callbacks.getMoveDirection();
        if (dir.lengthSqr() > 0.001) {
            dir.normalize();
            const pos = playerNode.position;
            const desired = new Vec3(
                pos.x + dir.x * config.speed * dt,
                pos.y + dir.y * config.speed * dt,
                0,
            );
            const next = this.constrainMovement(pos, desired, config);
            const direction = this.toDirection(dir);
            playerNode.setPosition(next);
            this.callbacks.setDirection(direction);
            playerActor.play(`walk${direction}`);
            return;
        }

        const idlePosition = this.constrainMovement(playerNode.position, playerNode.position.clone(), config);
        if (Vec3.squaredDistance(idlePosition, playerNode.position) > 0.0001) {
            playerNode.setPosition(idlePosition);
        }
        playerActor.play(`idle${config.currentDirection}`);
    }

    private constrainMovement(current: Readonly<Vec3>, desired: Vec3, config: PlayerMovementConfig) {
        const boundedDesired = this.constrainPosition(desired, config);
        this.resolvedPosition.set(boundedDesired.x, boundedDesired.y, 0);

        for (let i = 0; i < 3; i += 1) {
            this.resolveObstacleCollisions(this.resolvedPosition, config);
            const boundedResolved = this.constrainPosition(this.resolvedPosition, config);
            this.resolvedPosition.set(boundedResolved.x, boundedResolved.y, 0);
        }

        if (this.isCollisionPointInsideObstacle(this.resolvedPosition, config)) {
            const xOnly = this.testAxisSlide(current, desired.x, current.y, config);
            const yOnly = this.testAxisSlide(current, current.x, desired.y, config);
            if (xOnly && yOnly) {
                return Vec3.squaredDistance(xOnly, desired) <= Vec3.squaredDistance(yOnly, desired) ? xOnly : yOnly;
            }
            return xOnly ?? yOnly ?? current;
        }

        return this.resolvedPosition;
    }

    private testAxisSlide(current: Readonly<Vec3>, x: number, y: number, config: PlayerMovementConfig) {
        const candidate = this.constrainPosition(new Vec3(x, y, 0), config);
        this.resolvedPosition.set(candidate.x, candidate.y, 0);
        this.resolveObstacleCollisions(this.resolvedPosition, config);
        const bounded = this.constrainPosition(this.resolvedPosition, config);
        this.resolvedPosition.set(bounded.x, bounded.y, 0);
        return this.isCollisionPointInsideObstacle(this.resolvedPosition, config)
            ? null
            : this.resolvedPosition.clone();
    }

    private toDirection(vec: Vec2): Direction {
        const angle = Math.atan2(vec.y, vec.x) * 180 / Math.PI;
        const spriteAngle = (90 - angle + 360) % 360;
        const index = Math.round(spriteAngle / 45) % DIRECTION_NAMES.length;
        return DIRECTION_NAMES[index];
    }

    private constrainPosition(position: Vec3, config: PlayerMovementConfig) {
        const polygon = this.collectBoundaryPoints(config);
        if (polygon.length >= 3) {
            if (this.isPointInPolygon(position, polygon)) {
                return position;
            }
            return this.closestPointOnPolygon(position, polygon, this.closestPoint);
        }

        position.x = this.clamp(position.x, config.minX, config.maxX);
        position.y = this.clamp(position.y, config.minY, config.maxY);
        return position;
    }

    private resolveObstacleCollisions(position: Vec3, config: PlayerMovementConfig) {
        const obstacles = config.movementObstacles;
        if (obstacles.length <= 0) {
            return position;
        }

        this.getCollisionOffset(config, this.collisionOffset);
        this.collisionPoint.set(position.x + this.collisionOffset.x, position.y + this.collisionOffset.y, 0);

        for (let pass = 0; pass < 3; pass += 1) {
            let moved = false;
            obstacles.forEach((obstacle) => {
                if (!this.isObstacleActive(obstacle)) {
                    return;
                }
                this.getObstacleCenter(obstacle, config, this.obstacleCenter);
                const radiusX = this.getObstacleRadiusX(obstacle, config);
                const radiusY = this.getObstacleRadiusY(obstacle, config);
                if (this.pushPointOutOfObstacle(this.collisionPoint, this.obstacleCenter, radiusX, radiusY, obstacle)) {
                    moved = true;
                }
            });
            if (!moved) {
                break;
            }
        }

        position.set(
            this.collisionPoint.x - this.collisionOffset.x,
            this.collisionPoint.y - this.collisionOffset.y,
            0,
        );
        return position;
    }

    private isCollisionPointInsideObstacle(position: Vec3, config: PlayerMovementConfig) {
        const obstacles = config.movementObstacles;
        if (obstacles.length <= 0) {
            return false;
        }

        this.getCollisionOffset(config, this.collisionOffset);
        this.collisionPoint.set(position.x + this.collisionOffset.x, position.y + this.collisionOffset.y, 0);
        return obstacles.some((obstacle) => {
            if (!this.isObstacleActive(obstacle)) {
                return false;
            }
            this.getObstacleCenter(obstacle, config, this.obstacleCenter);
            return this.isPointInsideObstacle(
                this.collisionPoint,
                this.obstacleCenter,
                this.getObstacleRadiusX(obstacle, config),
                this.getObstacleRadiusY(obstacle, config),
                obstacle,
            );
        });
    }

    private getCollisionOffset(config: PlayerMovementConfig, out: Vec2) {
        out.set(0, 0);
        const playerNode = config.playerNode;
        const transform = playerNode?.getComponent(UITransform);
        if (!playerNode?.isValid || !transform) {
            return out;
        }

        const size = transform.contentSize;
        const anchor = transform.anchorPoint;
        const insetRatio = this.clamp(config.collisionFootInsetRatio, 0, 1);
        out.y = (-size.height * anchor.y + size.height * insetRatio) * playerNode.scale.y;
        return out;
    }

    private getObstacleCenter(obstacle: MovementObstacle, config: PlayerMovementConfig, out: Vec3) {
        const obstacleScale = obstacle.node.worldScale;
        this.obstacleWorldPoint.set(
            obstacle.node.worldPosition.x + obstacle.offsetX * obstacleScale.x,
            obstacle.node.worldPosition.y + obstacle.offsetY * obstacleScale.y,
            0,
        );

        const playerParent = config.playerNode?.parent ?? null;
        const parentTransform = playerParent?.getComponent(UITransform);
        if (parentTransform) {
            parentTransform.convertToNodeSpaceAR(this.obstacleWorldPoint, out);
            out.z = 0;
            return out;
        }

        out.set(obstacle.node.position.x + obstacle.offsetX, obstacle.node.position.y + obstacle.offsetY, 0);
        return out;
    }

    private getObstacleRadiusX(obstacle: MovementObstacle, config: PlayerMovementConfig) {
        const obstacleScale = Math.abs(obstacle.node.worldScale.x);
        const parentScale = Math.max(Math.abs(config.playerNode?.parent?.worldScale.x ?? 1), 0.0001);
        return Math.max(1, obstacle.radiusX * obstacleScale / parentScale + Math.max(0, config.collisionRadiusX));
    }

    private getObstacleRadiusY(obstacle: MovementObstacle, config: PlayerMovementConfig) {
        const obstacleScale = Math.abs(obstacle.node.worldScale.y);
        const parentScale = Math.max(Math.abs(config.playerNode?.parent?.worldScale.y ?? 1), 0.0001);
        return Math.max(1, obstacle.radiusY * obstacleScale / parentScale + Math.max(0, config.collisionRadiusY));
    }

    private pushPointOutOfEllipse(point: Vec3, center: Vec3, radiusX: number, radiusY: number) {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const normalizedDistanceSqr = dx * dx / (radiusX * radiusX) + dy * dy / (radiusY * radiusY);
        if (normalizedDistanceSqr >= 1) {
            return false;
        }

        if (Math.abs(dx) <= 0.0001 && Math.abs(dy) <= 0.0001) {
            point.x = center.x + radiusX + 0.5;
            point.y = center.y;
            return true;
        }

        const scaleToEdge = 1 / Math.max(Math.sqrt(normalizedDistanceSqr), 0.0001);
        const length = Math.max(Math.hypot(dx, dy), 0.0001);
        point.x = center.x + dx * scaleToEdge + dx / length * 0.5;
        point.y = center.y + dy * scaleToEdge + dy / length * 0.5;
        return true;
    }

    private pushPointOutOfRectangle(point: Vec3, center: Vec3, halfWidth: number, halfHeight: number) {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        if (Math.abs(dx) >= halfWidth || Math.abs(dy) >= halfHeight) {
            return false;
        }

        const pushX = halfWidth - Math.abs(dx);
        const pushY = halfHeight - Math.abs(dy);
        if (pushX <= pushY) {
            point.x = center.x + (dx >= 0 ? halfWidth + 0.5 : -halfWidth - 0.5);
        } else {
            point.y = center.y + (dy >= 0 ? halfHeight + 0.5 : -halfHeight - 0.5);
        }
        return true;
    }

    private pushPointOutOfObstacle(point: Vec3, center: Vec3, radiusX: number, radiusY: number, obstacle: MovementObstacle) {
        return obstacle.shape === 'rectangle'
            ? this.pushPointOutOfRectangle(point, center, radiusX, radiusY)
            : this.pushPointOutOfEllipse(point, center, radiusX, radiusY);
    }

    private isPointInsideEllipse(point: Vec3, center: Vec3, radiusX: number, radiusY: number) {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return dx * dx / (radiusX * radiusX) + dy * dy / (radiusY * radiusY) < 1;
    }

    private isPointInsideRectangle(point: Vec3, center: Vec3, halfWidth: number, halfHeight: number) {
        return Math.abs(point.x - center.x) < halfWidth && Math.abs(point.y - center.y) < halfHeight;
    }

    private isPointInsideObstacle(point: Vec3, center: Vec3, radiusX: number, radiusY: number, obstacle: MovementObstacle) {
        return obstacle.shape === 'rectangle'
            ? this.isPointInsideRectangle(point, center, radiusX, radiusY)
            : this.isPointInsideEllipse(point, center, radiusX, radiusY);
    }

    private isObstacleActive(obstacle: MovementObstacle) {
        return obstacle.node.isValid && obstacle.node.activeInHierarchy;
    }

    private collectBoundaryPoints(config: PlayerMovementConfig) {
        this.boundaryPoints.length = 0;
        const boundaryNode = config.walkableBoundaryNode;
        const playerParent = config.playerNode?.parent ?? null;
        if (!boundaryNode?.isValid || !boundaryNode.activeInHierarchy || !playerParent?.isValid) {
            return this.boundaryPoints;
        }

        const parentTransform = playerParent.getComponent(UITransform);
        if (!parentTransform) {
            return this.boundaryPoints;
        }

        const pointNodes = this.getBoundaryPointNodes(boundaryNode);
        for (const pointNode of pointNodes) {
            parentTransform.convertToNodeSpaceAR(pointNode.worldPosition, this.tempPoint);
            this.boundaryPoints.push(new Vec3(this.tempPoint.x, this.tempPoint.y, 0));
        }
        return this.boundaryPoints;
    }

    private getBoundaryPointNodes(boundaryNode: Node) {
        const numberedPointPattern = /^Point(\d+)$/i;
        const numberedPoints = boundaryNode.children
            .filter((child) => child.isValid && child.activeInHierarchy && numberedPointPattern.test(child.name))
            .sort((a, b) => {
                const aIndex = Number(a.name.match(numberedPointPattern)?.[1] ?? 0);
                const bIndex = Number(b.name.match(numberedPointPattern)?.[1] ?? 0);
                return aIndex - bIndex;
            });
        if (numberedPoints.length >= 3) {
            return numberedPoints;
        }
        return boundaryNode.children.filter((child) => child.isValid && child.activeInHierarchy);
    }

    private isPointInPolygon(point: Vec3, polygon: Vec3[]) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const a = polygon[i];
            const b = polygon[j];
            if (this.distanceToSegmentSqr(point, a, b) <= 0.01) {
                return true;
            }
            const crossesY = (a.y > point.y) !== (b.y > point.y);
            if (!crossesY) {
                continue;
            }
            const intersectX = (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
            if (point.x < intersectX) {
                inside = !inside;
            }
        }
        return inside;
    }

    private closestPointOnPolygon(point: Vec3, polygon: Vec3[], out: Vec3) {
        let bestDistanceSqr = Number.POSITIVE_INFINITY;
        for (let i = 0; i < polygon.length; i += 1) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            this.closestPointOnSegment(point, a, b, this.tempPoint);
            const distanceSqr = Vec3.squaredDistance(point, this.tempPoint);
            if (distanceSqr < bestDistanceSqr) {
                bestDistanceSqr = distanceSqr;
                out.set(this.tempPoint.x, this.tempPoint.y, 0);
            }
        }
        return out;
    }

    private distanceToSegmentSqr(point: Vec3, a: Vec3, b: Vec3) {
        this.closestPointOnSegment(point, a, b, this.tempPoint);
        return Vec3.squaredDistance(point, this.tempPoint);
    }

    private closestPointOnSegment(point: Vec3, a: Vec3, b: Vec3, out: Vec3) {
        const abX = b.x - a.x;
        const abY = b.y - a.y;
        const lengthSqr = abX * abX + abY * abY;
        if (lengthSqr <= 0.0001) {
            out.set(a.x, a.y, 0);
            return out;
        }

        const t = this.clamp(((point.x - a.x) * abX + (point.y - a.y) * abY) / lengthSqr, 0, 1);
        out.set(a.x + abX * t, a.y + abY * t, 0);
        return out;
    }

    private clamp(value: number, min: number, max: number) {
        return Math.max(min, Math.min(max, value));
    }
}
