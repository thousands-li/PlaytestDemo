import { Node } from 'cc';

export const PLAYER_FOOT_RING_NAME = 'PlayerUndercycle';

export interface PlayerFootRingConfig {
    actors: Node | null;
    playerNode: Node | null;
    playerFootRingNode: Node | null;
    playerFootRingImagePath: string;
    playerFootRingWidth: number;
    playerFootRingHeight: number;
    playerFootRingOffsetX: number;
    playerFootRingOffsetY: number;
    showPlayerFootRing: boolean;
}

export interface PlayerFootRingCallbacks {
    resolveSceneNode(configNode: Node | null, parent: Node, name: string): Node;
    setSpriteFrameAndSize(node: Node, framePath: string, width: number, height: number): void;
}

export class PlayerFootRingSystem {
    private ringNode: Node | null = null;

    public constructor(
        private readonly getConfig: () => PlayerFootRingConfig,
        private readonly callbacks: PlayerFootRingCallbacks,
    ) {}

    public build() {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            return null;
        }

        const ring = this.callbacks.resolveSceneNode(config.playerFootRingNode, config.actors, PLAYER_FOOT_RING_NAME);
        this.ringNode = ring;
        this.update();
        return ring;
    }

    public update() {
        const config = this.getConfig();
        const ring = this.ringNode;
        const player = config.playerNode;
        if (!ring?.isValid || !player?.isValid) {
            return;
        }

        ring.active = config.showPlayerFootRing;
        if (!ring.active) {
            return;
        }
        this.callbacks.setSpriteFrameAndSize(
            ring,
            config.playerFootRingImagePath,
            config.playerFootRingWidth,
            config.playerFootRingHeight,
        );
        ring.setPosition(
            player.position.x + config.playerFootRingOffsetX,
            player.position.y + config.playerFootRingOffsetY,
            0,
        );
    }

    public isRingNode(node: Node) {
        return this.ringNode === node;
    }
}
