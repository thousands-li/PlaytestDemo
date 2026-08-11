import { Color, Label, LabelOutline, Node, Sprite, UITransform, Vec2, Vec3 } from 'cc';
import { getDirectionVector, type Direction } from './Direction';

export type NpcBubbleState = 'wood' | 'wait' | 'check' | 'smile';

export interface NpcVisualActor {
    node: Node;
}

export interface NpcVisualConfig {
    actors: Node | null;
    showHeldCarryItems: boolean;
    showCompleteCheckBubble: boolean;
    carryBackDistance: number;
    carryBackYScale: number;
    carryWoodOffsetX: number;
    carryWoodStartY: number;
    carryWoodGapY: number;
    bubbleOffsetX: number;
    bubbleOffsetY: number;
    bubbleWidth: number;
    bubbleHeight: number;
    bubbleLabelOffsetX: number;
    bubbleLabelOffsetY: number;
    bubbleLabelFontSize: number;
    bubbleCircleImagePath: string;
    bubbleProgressImagePath: string;
    bubbleWoodImagePath: string;
    bubblePointImagePath: string;
    bubbleCheckImagePath: string;
    bubbleSmileImagePath: string;
}

export interface NpcVisualCallbacks {
    makeNode(name: string, parent: Node, x?: number, y?: number): Node;
    addSprite(name: string, framePath: string, parent: Node, x: number, y: number, width: number, height: number): Node;
    addOrUpdateLabel(name: string, parent: Node, text: string, x: number, y: number, size: number, color: Color): Label;
    applyCarryWoodVisualForDirection(node: Node, direction: Direction): void;
    sortActors(): void;
}

const NPC_CARRY_BACKPACK_NAME_PREFIX = 'NpcCarryBackpack';
const NPC_BUBBLE_NAME = 'NpcBubble';
const LEGACY_NPC_BUBBLE_NAMES = ['NeedBubble', 'WaitDots'];
const BUBBLE_CANVAS_WIDTH = 90;
const BUBBLE_CANVAS_HEIGHT = 109;
const BUBBLE_SPRITE_LAYOUTS = {
    circle: { width: 89, height: 109, x: -0.5, y: 0 },
    progress: { width: 85, height: 84, x: -0.5, y: 9.5 },
    wood: { width: 78, height: 69, x: 1, y: 18.5 },
    point: { width: 59, height: 19, x: 0.5, y: 8.5 },
    check: { width: 66, height: 50, x: -2, y: 8.5 },
    smile: { width: 76, height: 76, x: 0.5, y: 10.5 },
};
const BUBBLE_PROGRESS_FILL_START = 0.25;

export class NpcVisualController<T extends NpcVisualActor = NpcVisualActor> {
    private readonly carryBackpackNodes = new Map<Node, Node>();
    private readonly carryWoodNodes = new Map<Node, Node[]>();
    private readonly carryDirections = new Map<Node, Direction>();

    public constructor(
        private readonly getConfig: () => NpcVisualConfig,
        private readonly callbacks: NpcVisualCallbacks,
    ) {}

    public applyQueueBubble(npc: T, index: number, remainingRequirement: number, totalRequirement: number) {
        if (!npc.node.isValid) {
            return;
        }
        this.setCarryDirection(npc, '315');
        this.setBubbleState(npc, index === 0 ? 'wood' : 'wait', remainingRequirement, totalRequirement);
    }

    public updateFrontBubble(npc: T | null, isComplete: boolean, remainingRequirement: number, totalRequirement: number) {
        if (!npc?.node.isValid) {
            return;
        }
        if (isComplete) {
            if (this.getConfig().showCompleteCheckBubble) {
                this.setBubbleState(npc, 'check', remainingRequirement, totalRequirement);
            } else if (!this.updateWoodBubble(npc.node, remainingRequirement, totalRequirement)) {
                this.setBubbleState(npc, 'wood', remainingRequirement, totalRequirement);
            }
            return;
        }

        if (this.updateWoodBubble(npc.node, remainingRequirement, totalRequirement)) {
            return;
        }
        this.setBubbleState(npc, 'wood', remainingRequirement, totalRequirement);
    }

    public setBubbleState(npc: T, state: NpcBubbleState, remainingRequirement = 0, totalRequirement = remainingRequirement) {
        if (!npc.node.isValid) {
            return;
        }

        const config = this.getConfig();
        this.clearBubble(npc.node);

        const scale = npc.node.scale;
        const scaleX = Math.max(Math.abs(scale.x), 0.0001);
        const scaleY = Math.max(Math.abs(scale.y), 0.0001);
        const bubble = this.callbacks.makeNode(
            NPC_BUBBLE_NAME,
            npc.node,
            config.bubbleOffsetX / scaleX,
            config.bubbleOffsetY / scaleY,
        );
        bubble.setScale(1 / scaleX, 1 / scaleY, 1);
        this.ensureBubbleTransform(bubble, config);
        this.addBubbleSprite('BubbleCircle', config.bubbleCircleImagePath, bubble, BUBBLE_SPRITE_LAYOUTS.circle, config);
        if (state === 'wood' || state === 'check') {
            const progress = state === 'check' ? 1 : this.getProgressRatio(remainingRequirement, totalRequirement);
            const progressNode = this.addBubbleSprite('BubbleProgress', config.bubbleProgressImagePath, bubble, BUBBLE_SPRITE_LAYOUTS.progress, config);
            this.setupProgressSprite(progressNode.getComponent(Sprite), progress);
        }
        this.addBubbleSprite('BubbleIcon', this.getBubbleIconPath(state, config), bubble, this.getBubbleIconLayout(state), config);
        if (state === 'wood') {
            const label = this.callbacks.addOrUpdateLabel(
                'BubbleNeedLabel',
                bubble,
                `x${remainingRequirement}`,
                config.bubbleLabelOffsetX,
                config.bubbleLabelOffsetY,
                config.bubbleLabelFontSize,
                Color.WHITE,
            );
            this.setupBubbleLabel(label, config);
        }
    }

    public clearBubble(npcNode: Node) {
        [NPC_BUBBLE_NAME, ...LEGACY_NPC_BUBBLE_NAMES].forEach((name) => {
            const node = npcNode.getChildByName(name);
            if (node?.isValid) {
                node.removeFromParent();
                node.destroy();
            }
        });
    }

    public addHeldWood(npc: T, wood: Node, slotIndex: number) {
        if (!npc.node.isValid || !wood.isValid) {
            return;
        }

        const backpack = this.getCarryBackpackNode(npc.node);
        if (!backpack) {
            return;
        }

        const woodNodes = this.carryWoodNodes.get(npc.node) ?? [];
        woodNodes[slotIndex] = wood;
        this.carryWoodNodes.set(npc.node, woodNodes);
        if (wood.parent !== backpack) {
            wood.setParent(backpack, true);
        }
        wood.active = true;
        this.layoutCarryItems(npc.node);
        this.updateCarryBackpackPosition(npc.node);
        this.callbacks.sortActors();
    }

    public updateCarryBackpackPositions() {
        this.carryBackpackNodes.forEach((_backpack, npcNode) => {
            if (!npcNode.isValid) {
                this.cleanup(npcNode);
                return;
            }
            this.updateCarryBackpackPosition(npcNode);
        });
    }

    public setCarryDirection(npc: T, direction: Direction) {
        this.setCarryDirectionForNode(npc.node, direction);
    }

    public setCarryDirectionForNode(npcNode: Node, direction: Direction) {
        if (!npcNode.isValid) {
            return;
        }
        this.carryDirections.set(npcNode, direction);
        this.layoutCarryItems(npcNode);
        this.updateCarryBackpackPosition(npcNode);
    }

    public getCarryDirection(npcNode: Node) {
        return this.carryDirections.get(npcNode) ?? '315';
    }

    public getCarryItemActorsPosition(npcNode: Node, index: number, direction = this.getCarryDirection(npcNode)) {
        const backOffset = this.getCarryBackOffset(direction);
        const localPosition = this.getCarryItemLocalPosition(index);
        return new Vec3(
            npcNode.position.x + backOffset.x + localPosition.x,
            npcNode.position.y + backOffset.y + localPosition.y,
            0,
        );
    }

    public cleanup(npcNode: Node) {
        const backpack = this.carryBackpackNodes.get(npcNode);
        if (backpack?.isValid) {
            backpack.removeFromParent();
            backpack.destroy();
        }
        this.carryBackpackNodes.delete(npcNode);
        this.carryWoodNodes.delete(npcNode);
        this.carryDirections.delete(npcNode);
    }

    public isCarryBackpackNode(node: Node) {
        let hasNode = false;
        this.carryBackpackNodes.forEach((backpack) => {
            if (backpack === node) {
                hasNode = true;
            }
        });
        return hasNode;
    }

    public getBubbleImagePaths() {
        const config = this.getConfig();
        return [
            config.bubbleCircleImagePath,
            config.bubbleProgressImagePath,
            config.bubbleWoodImagePath,
            config.bubblePointImagePath,
            config.bubbleCheckImagePath,
            config.bubbleSmileImagePath,
        ];
    }

    private getBubbleIconPath(state: NpcBubbleState, config: NpcVisualConfig) {
        switch (state) {
            case 'wait':
                return config.bubblePointImagePath;
            case 'check':
                return config.bubbleCheckImagePath;
            case 'smile':
                return config.bubbleSmileImagePath;
            case 'wood':
            default:
                return config.bubbleWoodImagePath;
        }
    }

    private getBubbleIconLayout(state: NpcBubbleState) {
        switch (state) {
            case 'wait':
                return BUBBLE_SPRITE_LAYOUTS.point;
            case 'check':
                return BUBBLE_SPRITE_LAYOUTS.check;
            case 'smile':
                return BUBBLE_SPRITE_LAYOUTS.smile;
            case 'wood':
            default:
                return BUBBLE_SPRITE_LAYOUTS.wood;
        }
    }

    private ensureBubbleTransform(bubble: Node, config: NpcVisualConfig) {
        const transform = bubble.getComponent(UITransform) ?? bubble.addComponent(UITransform);
        transform.setContentSize(config.bubbleWidth, config.bubbleHeight);
    }

    private setupProgressSprite(sprite: Sprite | null | undefined, progress: number) {
        if (!sprite) {
            return;
        }

        sprite.type = Sprite.Type.FILLED;
        sprite.fillType = Sprite.FillType.RADIAL;
        sprite.fillCenter = new Vec2(0.5, 0.5);
        sprite.fillStart = BUBBLE_PROGRESS_FILL_START;
        sprite.fillRange = -this.clamp01(progress);
    }

    private addBubbleSprite(
        name: string,
        framePath: string,
        parent: Node,
        layout: { width: number; height: number; x: number; y: number },
        config: NpcVisualConfig,
    ) {
        const scale = this.getBubbleSpriteScale(config);
        return this.callbacks.addSprite(
            name,
            framePath,
            parent,
            layout.x * scale,
            layout.y * scale,
            layout.width * scale,
            layout.height * scale,
        );
    }

    private setupBubbleLabel(label: Label, config: NpcVisualConfig) {
        const transform = label.node.getComponent(UITransform) ?? label.node.addComponent(UITransform);
        const width = config.bubbleWidth * 0.68;
        const height = config.bubbleHeight * 0.24;
        transform.setContentSize(width, height);
        const fontSize = Math.min(config.bubbleLabelFontSize, Math.floor(height) - 2);
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 2;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        const outline = label.node.getComponent(LabelOutline) ?? label.node.addComponent(LabelOutline);
        outline.color = new Color(0, 0, 0, 235);
        outline.width = Math.max(2, Math.round(fontSize * 0.16));
    }

    private getBubbleSpriteScale(config: NpcVisualConfig) {
        return Math.min(
            config.bubbleWidth / BUBBLE_CANVAS_WIDTH,
            config.bubbleHeight / BUBBLE_CANVAS_HEIGHT,
        );
    }

    private getProgressRatio(remainingRequirement: number, totalRequirement: number) {
        const total = Math.max(1, Math.floor(totalRequirement));
        return this.clamp01((total - remainingRequirement) / total);
    }

    private updateWoodBubble(npcNode: Node, remainingRequirement: number, totalRequirement: number) {
        const bubble = npcNode.getChildByName(NPC_BUBBLE_NAME);
        if (!bubble?.isValid) {
            return false;
        }

        const label = bubble.getChildByName('BubbleNeedLabel')?.getComponent(Label);
        if (!label) {
            return false;
        }

        label.string = `x${remainingRequirement}`;
        this.setupBubbleLabel(label, this.getConfig());

        const progressSprite = bubble.getChildByName('BubbleProgress')?.getComponent(Sprite);
        if (progressSprite) {
            this.setupProgressSprite(progressSprite, this.getProgressRatio(remainingRequirement, totalRequirement));
        }

        return true;
    }

    private clamp01(value: number) {
        return Math.min(1, Math.max(0, value));
    }

    private getCarryBackpackNode(npcNode: Node) {
        const existing = this.carryBackpackNodes.get(npcNode);
        if (existing?.isValid) {
            return existing;
        }

        const actors = this.getConfig().actors;
        if (!actors?.isValid) {
            return null;
        }

        const backpack = this.callbacks.makeNode(`${NPC_CARRY_BACKPACK_NAME_PREFIX}_${npcNode.name}`, actors, npcNode.position.x, npcNode.position.y);
        backpack.active = this.getConfig().showHeldCarryItems;
        this.carryBackpackNodes.set(npcNode, backpack);
        return backpack;
    }

    private updateCarryBackpackPosition(npcNode: Node) {
        const backpack = this.carryBackpackNodes.get(npcNode);
        if (!backpack?.isValid) {
            return;
        }

        const config = this.getConfig();
        const direction = this.getCarryDirection(npcNode);
        const offset = this.getCarryBackOffset(direction);
        backpack.active = config.showHeldCarryItems && this.getCarryWoodCount(npcNode) > 0;
        backpack.setPosition(npcNode.position.x + offset.x, npcNode.position.y + offset.y, 0);
        this.layoutCarryItems(npcNode);
    }

    private layoutCarryItems(npcNode: Node) {
        const backpack = this.carryBackpackNodes.get(npcNode);
        const woodNodes = this.carryWoodNodes.get(npcNode);
        if (!backpack?.isValid || !woodNodes) {
            return;
        }

        const direction = this.getCarryDirection(npcNode);
        woodNodes.forEach((wood, index) => {
            if (!wood?.isValid) {
                return;
            }
            if (wood.parent !== backpack) {
                wood.setParent(backpack, true);
            }
            this.callbacks.applyCarryWoodVisualForDirection(wood, direction);
            wood.setPosition(this.getCarryItemLocalPosition(index));
            wood.setScale(1, 1, 1);
        });
    }

    private getCarryBackOffset(direction: Direction) {
        const config = this.getConfig();
        const front = getDirectionVector(direction);
        return new Vec3(
            -front.x * config.carryBackDistance,
            -front.y * config.carryBackDistance * config.carryBackYScale,
            0,
        );
    }

    private getCarryItemLocalPosition(index: number) {
        const config = this.getConfig();
        return new Vec3(
            config.carryWoodOffsetX,
            config.carryWoodStartY + index * config.carryWoodGapY,
            0,
        );
    }

    private getCarryWoodCount(npcNode: Node) {
        return (this.carryWoodNodes.get(npcNode) ?? []).filter((wood) => wood?.isValid).length;
    }
}
