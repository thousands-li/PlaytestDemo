import { Node, Vec3 } from 'cc';

export interface CameraVisibleRect {
    left: number;
    right: number;
    bottom: number;
    top: number;
}

export interface CameraFollowConfig {
    world: Node | null;
    actors: Node | null;
    playerNode: Node | null;
    designWidth: number;
    designHeight: number;
    followEnabled: boolean;
    viewScale: number;
    followSmooth: number;
    offsetX: number;
    offsetY: number;
    boundsMinX: number;
    boundsMaxX: number;
    boundsMinY: number;
    boundsMaxY: number;
}

export class CameraFollowSystem {
    private readonly layerPosition = new Vec3();
    private readonly targetPosition = new Vec3();

    public constructor(private readonly getConfig: () => CameraFollowConfig) {}

    public update(dt: number, snap = false) {
        const config = this.getConfig();
        const world = config.world;
        const actors = config.actors;
        if (!world?.isValid || !actors?.isValid) {
            return;
        }

        const scale = this.getScale(config);
        const playerNode = config.playerNode;
        const hasPlayer = !!playerNode?.isValid;
        const targetX = config.followEnabled && hasPlayer
            ? playerNode.position.x - config.offsetX / scale
            : -config.offsetX / scale;
        const targetY = config.followEnabled && hasPlayer
            ? playerNode.position.y - config.offsetY / scale
            : -config.offsetY / scale;
        const halfViewWidth = config.designWidth / (2 * scale);
        const halfViewHeight = config.designHeight / (2 * scale);

        this.targetPosition.set(
            this.clampCameraCenter(targetX, config.boundsMinX, config.boundsMaxX, halfViewWidth),
            this.clampCameraCenter(targetY, config.boundsMinY, config.boundsMaxY, halfViewHeight),
            0,
        );

        const desiredX = -this.targetPosition.x * scale;
        const desiredY = -this.targetPosition.y * scale;
        if (snap || config.followSmooth <= 0 || dt <= 0) {
            this.layerPosition.set(desiredX, desiredY, 0);
        } else {
            const t = 1 - Math.exp(-config.followSmooth * dt);
            this.layerPosition.set(
                this.layerPosition.x + (desiredX - this.layerPosition.x) * t,
                this.layerPosition.y + (desiredY - this.layerPosition.y) * t,
                0,
            );
        }

        world.setScale(scale, scale, 1);
        actors.setScale(scale, scale, 1);
        world.setPosition(this.layerPosition);
        actors.setPosition(this.layerPosition);
    }

    public getVisibleRect(padding = 0): CameraVisibleRect {
        const config = this.getConfig();
        const scale = this.getScale(config);
        return {
            left: (-config.designWidth / 2 - this.layerPosition.x) / scale - padding,
            right: (config.designWidth / 2 - this.layerPosition.x) / scale + padding,
            bottom: (-config.designHeight / 2 - this.layerPosition.y) / scale - padding,
            top: (config.designHeight / 2 - this.layerPosition.y) / scale + padding,
        };
    }

    private getScale(config: CameraFollowConfig) {
        return Math.max(0.1, config.viewScale);
    }

    private clampCameraCenter(value: number, min: number, max: number, halfViewSize: number) {
        if (max <= min) {
            return value;
        }
        const minCenter = min + halfViewSize;
        const maxCenter = max - halfViewSize;
        if (minCenter > maxCenter) {
            return (min + max) / 2;
        }
        return this.clamp(value, minCenter, maxCenter);
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }
}
