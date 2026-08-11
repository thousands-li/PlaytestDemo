import { Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { AnimatedSprite } from './AnimatedSprite';
import type { Direction } from './Direction';
import { GameUiFactory } from './GameUiFactory';

export interface NpcSceneBuilderConfig {
    actors: Node | null;
    npcSceneNodes: Node[];
    npcEntryNode: Node | null;
    npcExitNode: Node | null;
    characterScale: number;
    renderHeight: number;
    idleFramePrefix: string;
    walkInFramePrefix: string;
    walkOutFramePrefix: string;
}

export interface NpcSceneBuildResult {
    entryNode: Node | null;
    exitNode: Node | null;
}

export interface NpcSceneBuilderCallbacks {
    findChildDeep(parent: Node, name: string): Node | null;
    findNumberedChildren(parent: Node, prefix: string): Node[];
    resetQueue(npcs: AnimatedSprite[], queuePositions: Vec3[]): void;
    cleanupVisual(node: Node): void;
    setCarryDirectionForNode(node: Node, direction: Direction): void;
    applyQueueBubble(npc: AnimatedSprite, index: number): void;
    collectFrames(prefix: string): SpriteFrame[];
}

export class NpcSceneBuilder {
    constructor(
        private readonly getConfig: () => NpcSceneBuilderConfig,
        private readonly uiFactory: GameUiFactory,
        private readonly callbacks: NpcSceneBuilderCallbacks,
    ) {}

    buildQueue(): NpcSceneBuildResult {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            this.callbacks.resetQueue([], []);
            return { entryNode: config.npcEntryNode, exitNode: config.npcExitNode };
        }

        const entryNode = config.npcEntryNode ?? this.callbacks.findChildDeep(config.actors, 'NpcEntry');
        const exitNode = config.npcExitNode ?? this.callbacks.findChildDeep(config.actors, 'NpcExit');
        const nodes = config.npcSceneNodes.length > 0
            ? config.npcSceneNodes
            : this.callbacks.findNumberedChildren(config.actors, 'Npc');
        const queuePositions = nodes.map((node) => node.position.clone());
        const npcs: AnimatedSprite[] = [];

        nodes.forEach((node, index) => {
            node.setScale(config.characterScale, config.characterScale, 1);
            this.callbacks.cleanupVisual(node);
            const npc = this.setupNpcNode(node);
            npcs.push(npc);
            this.callbacks.applyQueueBubble(npc, index);
        });
        this.callbacks.resetQueue(npcs, queuePositions);
        return { entryNode, exitNode };
    }

    createNpcAt(position: Vec3, waiting = false) {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            throw new Error('NPC actors layer is not available.');
        }
        const node = this.uiFactory.makeNode(`Npc${Date.now()}`, config.actors, position.x, position.y);
        const npc = this.setupNpcNode(node);
        npc.play(waiting ? 'walk315' : 'idle');
        return npc;
    }

    private setupNpcNode(node: Node) {
        const config = this.getConfig();
        node.setScale(config.characterScale, config.characterScale, 1);
        this.callbacks.setCarryDirectionForNode(node, '315');
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        sprite.trim = false;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const idleFrames = this.callbacks.collectFrames(config.idleFramePrefix);
        const walkInFrames = this.callbacks.collectFrames(config.walkInFramePrefix);
        const walkOutFrames = this.callbacks.collectFrames(config.walkOutFramePrefix);
        this.applyRawFrameAspect(node, idleFrames[0] ?? walkInFrames[0] ?? walkOutFrames[0], config.renderHeight);
        const npc = new AnimatedSprite(node, sprite);
        npc.addClip('idle', idleFrames);
        npc.addClip('walk315', walkInFrames);
        npc.addClip('walk225', walkOutFrames);
        npc.play('idle');
        return npc;
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
