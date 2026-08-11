import { Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { AnimatedSprite } from './AnimatedSprite';
import { DIRECTION_NAMES } from './Direction';

export interface PlayerSceneBuilderConfig {
    actors: Node | null;
    playerSceneNode: Node | null;
    playerIdleFramePrefix: string;
    playerWalkFramePrefix: string;
    playerRenderHeight: number;
    playerCharacterScale: number;
}

export interface PlayerSceneBuildResult {
    playerNode: Node | null;
    player: AnimatedSprite | null;
}

export interface PlayerSceneBuilderCallbacks {
    resolveSceneNode(configNode: Node | null, parent: Node, name: string): Node;
    getSpriteFrame(path: string): SpriteFrame | undefined;
    collectFrames(prefix: string): SpriteFrame[];
    rebuildBackpack(): void;
}

export class PlayerSceneBuilder {
    constructor(
        private readonly getConfig: () => PlayerSceneBuilderConfig,
        private readonly callbacks: PlayerSceneBuilderCallbacks,
    ) {}

    build(): PlayerSceneBuildResult {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            return { playerNode: config.playerSceneNode, player: null };
        }

        const playerNode = this.callbacks.resolveSceneNode(config.playerSceneNode, config.actors, 'Player');
        const sprite = playerNode.getComponent(Sprite) ?? playerNode.addComponent(Sprite);
        sprite.trim = false;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const initialFrame = this.callbacks.getSpriteFrame(`${config.playerIdleFramePrefix}315_00000`)
            ?? this.callbacks.getSpriteFrame(`${config.playerWalkFramePrefix}315_00000`);
        this.applyRawFrameAspect(playerNode, initialFrame, config.playerRenderHeight);
        playerNode.setScale(config.playerCharacterScale, config.playerCharacterScale, 1);
        const player = new AnimatedSprite(playerNode, sprite);
        this.addPlayerClips(player, config);
        player.play('idle315');
        this.callbacks.rebuildBackpack();
        return { playerNode, player };
    }

    private addPlayerClips(player: AnimatedSprite, config: PlayerSceneBuilderConfig) {
        for (const dir of DIRECTION_NAMES) {
            player.addClip(`idle${dir}`, this.callbacks.collectFrames(`${config.playerIdleFramePrefix}${dir}_`));
            player.addClip(`walk${dir}`, this.callbacks.collectFrames(`${config.playerWalkFramePrefix}${dir}_`));
        }
    }

    private applyRawFrameAspect(node: Node, frame: SpriteFrame | undefined, fallbackHeight: number) {
        const originalSize = frame?.originalSize;
        const height = Math.max(1, fallbackHeight);
        const width = originalSize && originalSize.height > 0
            ? height * (originalSize.width / originalSize.height)
            : 70;
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(width, height);
        return transform;
    }
}
